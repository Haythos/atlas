#!/usr/bin/env node

/**
 * ATLAS Workflow Helper
 * 
 * Convenience wrapper for using Memory Oracle + Execution Tracker together.
 * 
 * Usage:
 *   const workflow = require('./workflow-helper');
 *   
 *   // Start a task with context search
 *   const task = await workflow.startTask('Build X feature', { searchMemory: true });
 *   
 *   // Update during execution
 *   await task.log('exec', 'src/x.js');
 *   
 *   // End successfully
 *   await task.complete();
 *   
 *   // Or end with failure
 *   await task.fail('Missing tests');
 */

const path = require('path');
const oracle = require('../src/atlas-memory-oracle');
const tracker = require('../src/atlas-tracker');

/**
 * Start a task with optional memory search
 * @param {string} description - Task description
 * @param {object} options - Options
 * @param {boolean} options.searchMemory - Run memory oracle first (default: true)
 * @param {boolean} options.showContext - Display oracle results (default: true)
 * @param {object} options.metadata - Initial metadata
 * @returns {Promise<object>} Task object with helper methods
 */
async function startTask(description, options = {}) {
  const searchMemory = options.searchMemory !== undefined ? options.searchMemory : true;
  const showContext = options.showContext !== undefined ? options.showContext : true;

  let context = null;

  // Step 1: Search memory for relevant context
  if (searchMemory) {
    context = await oracle.searchContext(description);
    
    if (showContext && context.summary.total_matches > 0) {
      console.log('\n📚 Memory Oracle found relevant context:');
      console.log(`   - ${context.summary.total_matches} matches`);
      console.log(`   - ${context.summary.prior_attempts} prior attempts`);
      console.log(`   - ${context.summary.failures} failures`);
      console.log(`   - ${context.summary.successes} successes`);
      
      if (context.summary.failures > 0) {
        console.log('\n⚠️  Warning: Prior failures detected. Review context before proceeding.');
      }
      console.log('');
    }
  }

  // Step 2: Start tracking execution
  const taskId = await tracker.startTask(description, {
    metadata: {
      ...options.metadata,
      memory_search_performed: searchMemory,
      prior_attempts: context?.summary.prior_attempts || 0,
      prior_failures: context?.summary.failures || 0
    }
  });

  // Return task object with helper methods
  return {
    taskId,
    description,
    context,
    
    /**
     * Log a tool/file during execution
     * @param {string} tool - Tool name
     * @param {string} file - File path (optional)
     */
    async log(tool, file) {
      const updates = { tools_used: [tool] };
      if (file) {
        updates.files_modified = [file];
      }
      await tracker.updateTask(taskId, updates);
    },

    /**
     * Complete task successfully
     * @param {object} options - Completion options
     */
    async complete(options = {}) {
      await tracker.endTask(taskId, {
        success: true,
        outcome_quality: options.quality || 'complete',
        ...options
      });
      console.log(`✅ Task ${taskId} completed successfully`);
    },

    /**
     * Fail task with reason
     * @param {string} reason - Failure reason
     * @param {object} options - Failure options
     */
    async fail(reason, options = {}) {
      await tracker.endTask(taskId, {
        success: false,
        failure_reason: reason,
        outcome_quality: options.quality || 'incomplete',
        ...options
      });
      console.log(`❌ Task ${taskId} failed: ${reason}`);
    },

    /**
     * Get current task state
     * @returns {Promise<object>} Task entry
     */
    async getState() {
      return await tracker.getTask(taskId);
    },

    /**
     * Get memory context (if search was performed)
     * @returns {object|null} Oracle results
     */
    getContext() {
      return context;
    }
  };
}

/**
 * Analyze recent execution logs
 * @param {object} options - Query options
 * @returns {Promise<object>} Analysis results
 */
async function analyzeRecent(options = {}) {
  const tasks = await tracker.getTasks({
    limit: options.limit || 10,
    since: options.since
  });

  const analysis = {
    total: tasks.length,
    successful: tasks.filter(t => t.success).length,
    failed: tasks.filter(t => t.success === false && t.end_ts).length,
    in_progress: tasks.filter(t => !t.end_ts).length,
    avg_duration: 0,
    common_tools: {},
    common_failures: {}
  };

  // Calculate average duration
  const completedTasks = tasks.filter(t => t.duration_min !== null);
  if (completedTasks.length > 0) {
    const totalDuration = completedTasks.reduce((sum, t) => sum + t.duration_min, 0);
    analysis.avg_duration = Math.round((totalDuration / completedTasks.length) * 100) / 100;
  }

  // Count common tools
  tasks.forEach(task => {
    task.tools_used.forEach(tool => {
      analysis.common_tools[tool] = (analysis.common_tools[tool] || 0) + 1;
    });
  });

  // Count common failure reasons
  tasks.filter(t => t.failure_reason).forEach(task => {
    analysis.common_failures[task.failure_reason] = 
      (analysis.common_failures[task.failure_reason] || 0) + 1;
  });

  return analysis;
}

/**
 * CLI entry point
 */
async function cli() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'start') {
    const description = args[1];
    if (!description) {
      console.error('Usage: workflow-helper start "Task description"');
      process.exit(1);
    }

    const task = await startTask(description);
    console.log(`Task ID: ${task.taskId}`);
  } 
  else if (command === 'analyze') {
    const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1]) || 10;
    const analysis = await analyzeRecent({ limit });

    console.log('\n📊 Recent Task Analysis\n');
    console.log(`Total tasks: ${analysis.total}`);
    console.log(`Successful: ${analysis.successful} (${Math.round(analysis.successful / analysis.total * 100)}%)`);
    console.log(`Failed: ${analysis.failed} (${Math.round(analysis.failed / analysis.total * 100)}%)`);
    console.log(`In progress: ${analysis.in_progress}`);
    console.log(`Avg duration: ${analysis.avg_duration} min`);
    console.log('');
    console.log('Common tools:');
    Object.entries(analysis.common_tools)
      .sort((a, b) => b[1] - a[1])
      .forEach(([tool, count]) => {
        console.log(`  ${tool}: ${count}`);
      });
    
    if (Object.keys(analysis.common_failures).length > 0) {
      console.log('');
      console.log('Common failures:');
      Object.entries(analysis.common_failures)
        .sort((a, b) => b[1] - a[1])
        .forEach(([reason, count]) => {
          console.log(`  ${reason}: ${count}`);
        });
    }
  }
  else {
    console.log('Usage: workflow-helper <command>');
    console.log('');
    console.log('Commands:');
    console.log('  start "description"    Start a task with memory search');
    console.log('  analyze [--limit=N]    Analyze recent task execution');
    process.exit(0);
  }
}

// Run CLI if invoked directly
if (require.main === module) {
  cli().catch(err => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  startTask,
  analyzeRecent
};
