#!/usr/bin/env node

/**
 * ATLAS Execution Tracker
 * 
 * Logs task execution to JSONL for failure analysis and learning.
 * 
 * CLI Usage:
 *   atlas-tracker start "Build X feature"
 *   atlas-tracker end <task_id> --success --duration=45
 *   atlas-tracker log <task_id> --tools=exec,write --files=src/x.js
 * 
 * Programmatic Usage:
 *   const tracker = require('./atlas-tracker');
 *   const taskId = await tracker.startTask('Build X');
 *   await tracker.updateTask(taskId, { tools_used: ['exec'] });
 *   await tracker.endTask(taskId, { success: true, duration_min: 45 });
 */

const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');

const DEFAULT_LOG_PATH = path.join(__dirname, '../data/atlas_executions.jsonl');
const SCHEMA_VERSION = '1.0';

/**
 * Create a new task execution entry
 * @param {string} description - Task description
 * @param {object} options - Additional options
 * @param {string} options.logPath - Path to JSONL log file
 * @returns {Promise<string>} task_id
 */
async function startTask(description, options = {}) {
  if (!description || typeof description !== 'string') {
    throw new Error('Task description is required and must be a string');
  }

  const taskId = randomUUID();
  const logPath = options.logPath || DEFAULT_LOG_PATH;

  const entry = {
    task_id: taskId,
    description: description.trim(),
    start_ts: new Date().toISOString(),
    end_ts: null,
    duration_min: null,
    success: false,
    failure_reason: null,
    tools_used: [],
    files_modified: [],
    outcome_quality: 'incomplete',
    metadata: options.metadata || {},
    schema_version: SCHEMA_VERSION
  };

  await appendToLog(logPath, entry);
  return taskId;
}

/**
 * Update task execution details (tools, files, metadata)
 * @param {string} taskId - Task UUID
 * @param {object} updates - Fields to update
 * @param {string[]} updates.tools_used - Tools invoked
 * @param {string[]} updates.files_modified - Files modified
 * @param {object} updates.metadata - Additional metadata
 * @param {string} options.logPath - Path to JSONL log file
 * @returns {Promise<void>}
 */
async function updateTask(taskId, updates, options = {}) {
  if (!taskId || typeof taskId !== 'string') {
    throw new Error('Task ID is required and must be a string');
  }

  const logPath = options.logPath || DEFAULT_LOG_PATH;
  const entries = await readLog(logPath);
  const entry = entries.find(e => e.task_id === taskId);

  if (!entry) {
    throw new Error(`Task not found: ${taskId}`);
  }

  // Merge updates (append arrays, merge metadata)
  if (updates.tools_used) {
    entry.tools_used = [...new Set([...entry.tools_used, ...updates.tools_used])];
  }
  if (updates.files_modified) {
    entry.files_modified = [...new Set([...entry.files_modified, ...updates.files_modified])];
  }
  if (updates.metadata) {
    entry.metadata = { ...entry.metadata, ...updates.metadata };
  }

  await rewriteLog(logPath, entries);
}

/**
 * End task execution and record outcome
 * @param {string} taskId - Task UUID
 * @param {object} outcome - Task outcome
 * @param {boolean} outcome.success - Whether task succeeded
 * @param {number} outcome.duration_min - Task duration in minutes
 * @param {string} outcome.failure_reason - Why task failed (if success=false)
 * @param {string} outcome.outcome_quality - complete|incomplete|partial|abandoned
 * @param {string} options.logPath - Path to JSONL log file
 * @returns {Promise<void>}
 */
async function endTask(taskId, outcome, options = {}) {
  if (!taskId || typeof taskId !== 'string') {
    throw new Error('Task ID is required and must be a string');
  }

  const logPath = options.logPath || DEFAULT_LOG_PATH;
  const entries = await readLog(logPath);
  const entry = entries.find(e => e.task_id === taskId);

  if (!entry) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const endTs = new Date().toISOString();
  const startMs = new Date(entry.start_ts).getTime();
  const endMs = new Date(endTs).getTime();
  const durationMin = outcome.duration_min !== undefined 
    ? outcome.duration_min 
    : (endMs - startMs) / 60000;

  entry.end_ts = endTs;
  entry.duration_min = Math.round(durationMin * 100) / 100; // 2 decimal places
  entry.success = outcome.success !== undefined ? outcome.success : false;
  entry.failure_reason = outcome.failure_reason || null;
  entry.outcome_quality = outcome.outcome_quality || (entry.success ? 'complete' : 'incomplete');

  // Validate outcome_quality
  const validQualities = ['complete', 'incomplete', 'partial', 'abandoned'];
  if (!validQualities.includes(entry.outcome_quality)) {
    throw new Error(`Invalid outcome_quality: ${entry.outcome_quality}. Must be one of: ${validQualities.join(', ')}`);
  }

  await rewriteLog(logPath, entries);
}

/**
 * Get task by ID
 * @param {string} taskId - Task UUID
 * @param {string} options.logPath - Path to JSONL log file
 * @returns {Promise<object|null>} Task entry or null
 */
async function getTask(taskId, options = {}) {
  const logPath = options.logPath || DEFAULT_LOG_PATH;
  const entries = await readLog(logPath);
  return entries.find(e => e.task_id === taskId) || null;
}

/**
 * Get all tasks
 * @param {object} options - Query options
 * @param {string} options.logPath - Path to JSONL log file
 * @param {boolean} options.success - Filter by success status
 * @param {number} options.limit - Max tasks to return
 * @param {number} options.since - Unix timestamp (ms) - only tasks after this time
 * @returns {Promise<object[]>} Array of task entries
 */
async function getTasks(options = {}) {
  const logPath = options.logPath || DEFAULT_LOG_PATH;
  let entries = await readLog(logPath);

  // Filter by success
  if (options.success !== undefined) {
    entries = entries.filter(e => e.success === options.success);
  }

  // Filter by time
  if (options.since) {
    entries = entries.filter(e => new Date(e.start_ts).getTime() >= options.since);
  }

  // Limit results
  if (options.limit) {
    entries = entries.slice(-options.limit);
  }

  return entries;
}

/**
 * Append entry to JSONL log
 * @param {string} logPath - Path to log file
 * @param {object} entry - Log entry
 * @returns {Promise<void>}
 */
async function appendToLog(logPath, entry) {
  const line = JSON.stringify(entry) + '\n';
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.appendFile(logPath, line, 'utf8');
}

/**
 * Read all entries from JSONL log
 * @param {string} logPath - Path to log file
 * @returns {Promise<object[]>} Array of entries
 */
async function readLog(logPath) {
  try {
    const content = await fs.readFile(logPath, 'utf8');
    return content
      .trim()
      .split('\n')
      .filter(line => line.length > 0)
      .map(line => JSON.parse(line));
  } catch (err) {
    if (err.code === 'ENOENT') {
      return []; // File doesn't exist yet
    }
    throw err;
  }
}

/**
 * Rewrite entire log (for updates)
 * @param {string} logPath - Path to log file
 * @param {object[]} entries - All entries
 * @returns {Promise<void>}
 */
async function rewriteLog(logPath, entries) {
  const content = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.writeFile(logPath, content, 'utf8');
}

/**
 * CLI entry point
 */
async function cli() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    if (command === 'start') {
      const description = args[1];
      if (!description) {
        console.error('Usage: atlas-tracker start "Task description"');
        process.exit(1);
      }
      const taskId = await startTask(description);
      console.log(taskId);
    } 
    else if (command === 'end') {
      const taskId = args[1];
      if (!taskId) {
        console.error('Usage: atlas-tracker end <task_id> [--success] [--failure="reason"] [--duration=45] [--quality=complete]');
        process.exit(1);
      }

      const outcome = {
        success: args.includes('--success'),
        failure_reason: args.find(a => a.startsWith('--failure='))?.split('=')[1],
        duration_min: parseFloat(args.find(a => a.startsWith('--duration='))?.split('=')[1]),
        outcome_quality: args.find(a => a.startsWith('--quality='))?.split('=')[1]
      };

      await endTask(taskId, outcome);
      console.log(`Task ${taskId} ended: ${outcome.success ? 'SUCCESS' : 'FAILED'}`);
    }
    else if (command === 'update' || command === 'log') {
      const taskId = args[1];
      if (!taskId) {
        console.error('Usage: atlas-tracker update <task_id> [--tools=exec,write] [--files=src/x.js,src/y.js]');
        process.exit(1);
      }

      const updates = {};
      const toolsArg = args.find(a => a.startsWith('--tools='));
      if (toolsArg) {
        updates.tools_used = toolsArg.split('=')[1].split(',');
      }
      const filesArg = args.find(a => a.startsWith('--files='));
      if (filesArg) {
        updates.files_modified = filesArg.split('=')[1].split(',');
      }

      await updateTask(taskId, updates);
      console.log(`Task ${taskId} updated`);
    }
    else if (command === 'get') {
      const taskId = args[1];
      if (!taskId) {
        console.error('Usage: atlas-tracker get <task_id>');
        process.exit(1);
      }
      const task = await getTask(taskId);
      if (task) {
        console.log(JSON.stringify(task, null, 2));
      } else {
        console.error(`Task not found: ${taskId}`);
        process.exit(1);
      }
    }
    else if (command === 'list') {
      const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1]) || 10;
      const tasks = await getTasks({ limit });
      tasks.forEach(t => {
        const status = t.success ? '✅' : (t.end_ts ? '❌' : '⏳');
        console.log(`${status} ${t.task_id.slice(0, 8)} | ${t.description.slice(0, 60)}`);
      });
    }
    else {
      console.error('Usage: atlas-tracker <start|end|update|get|list>');
      console.error('  start "description"');
      console.error('  end <task_id> [--success] [--failure="reason"]');
      console.error('  update <task_id> [--tools=exec,write] [--files=src/x.js]');
      console.error('  get <task_id>');
      console.error('  list [--limit=10]');
      process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

// Run CLI if invoked directly
if (require.main === module) {
  cli();
}

module.exports = {
  startTask,
  updateTask,
  endTask,
  getTask,
  getTasks,
  DEFAULT_LOG_PATH,
  SCHEMA_VERSION
};
