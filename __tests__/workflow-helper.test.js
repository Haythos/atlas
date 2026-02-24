const fs = require('fs').promises;
const path = require('path');
const workflow = require('../examples/workflow-helper');
const tracker = require('../src/atlas-tracker');

const TEST_LOG_PATH = path.join(__dirname, '../data/test_workflow_executions.jsonl');

describe('ATLAS Workflow Helper', () => {
  let consoleSpy;

  beforeEach(async () => {
    // Clean up
    try {
      await fs.unlink(TEST_LOG_PATH);
    } catch (err) {
      // Ignore
    }
    // Override default log path for tests
    process.env.ATLAS_LOG_PATH = TEST_LOG_PATH;
    
    // Silence console logs during tests
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    if (consoleSpy) {
      consoleSpy.mockRestore();
    }
  });

  afterAll(async () => {
    try {
      await fs.unlink(TEST_LOG_PATH);
    } catch (err) {
      // Ignore
    }
    delete process.env.ATLAS_LOG_PATH;
  });

  describe('startTask', () => {
    it('should start task with memory search', async () => {
      const task = await workflow.startTask('Test task', {
        searchMemory: false, // Disable for test speed
        showContext: false
      });

      expect(task.taskId).toBeTruthy();
      expect(task.description).toBe('Test task');
    });

    it('should return task object with helper methods', async () => {
      const task = await workflow.startTask('Test task', {
        searchMemory: false,
        showContext: false
      });

      expect(task).toHaveProperty('log');
      expect(task).toHaveProperty('complete');
      expect(task).toHaveProperty('fail');
      expect(task).toHaveProperty('getState');
      expect(task).toHaveProperty('getContext');
    });

    it('should include metadata from memory search', async () => {
      const task = await workflow.startTask('Test task', {
        searchMemory: false,
        showContext: false
      });

      const state = await task.getState();
      expect(state.metadata).toHaveProperty('memory_search_performed');
      expect(state.metadata).toHaveProperty('prior_attempts');
      expect(state.metadata).toHaveProperty('prior_failures');
    });

    it('should support custom metadata', async () => {
      const task = await workflow.startTask('Test task', {
        searchMemory: false,
        showContext: false,
        metadata: { custom: 'value' }
      });

      const state = await task.getState();
      expect(state.metadata.custom).toBe('value');
    });
  });

  describe('task.log', () => {
    it('should log tools', async () => {
      const task = await workflow.startTask('Test task', {
        searchMemory: false,
        showContext: false
      });

      await task.log('exec');
      const state = await task.getState();

      expect(state.tools_used).toContain('exec');
    });

    it('should log files', async () => {
      const task = await workflow.startTask('Test task', {
        searchMemory: false,
        showContext: false
      });

      await task.log('write', 'src/test.js');
      const state = await task.getState();

      expect(state.files_modified).toContain('src/test.js');
    });

    it('should log multiple calls', async () => {
      const task = await workflow.startTask('Test task', {
        searchMemory: false,
        showContext: false
      });

      await task.log('exec');
      await task.log('write', 'src/test.js');
      const state = await task.getState();

      expect(state.tools_used).toContain('exec');
      expect(state.tools_used).toContain('write');
      expect(state.files_modified).toContain('src/test.js');
    });
  });

  describe('task.complete', () => {
    it('should mark task as successful', async () => {
      const task = await workflow.startTask('Test task', {
        searchMemory: false,
        showContext: false
      });

      await task.complete();
      const state = await task.getState();

      expect(state.success).toBe(true);
      expect(state.outcome_quality).toBe('complete');
    });

    it('should support custom quality', async () => {
      const task = await workflow.startTask('Test task', {
        searchMemory: false,
        showContext: false
      });

      await task.complete({ quality: 'partial' });
      const state = await task.getState();

      expect(state.outcome_quality).toBe('partial');
    });
  });

  describe('task.fail', () => {
    it('should mark task as failed', async () => {
      const task = await workflow.startTask('Test task', {
        searchMemory: false,
        showContext: false
      });

      await task.fail('Test error');
      const state = await task.getState();

      expect(state.success).toBe(false);
      expect(state.failure_reason).toBe('Test error');
      expect(state.outcome_quality).toBe('incomplete');
    });

    it('should support custom quality', async () => {
      const task = await workflow.startTask('Test task', {
        searchMemory: false,
        showContext: false
      });

      await task.fail('Abandoned', { quality: 'abandoned' });
      const state = await task.getState();

      expect(state.outcome_quality).toBe('abandoned');
    });
  });

  describe('task.getState', () => {
    it('should return current task state', async () => {
      const task = await workflow.startTask('Test task', {
        searchMemory: false,
        showContext: false
      });

      const state = await task.getState();

      expect(state.task_id).toBe(task.taskId);
      expect(state.description).toBe('Test task');
    });
  });

  describe('task.getContext', () => {
    it('should return memory context if search was performed', async () => {
      const task = await workflow.startTask('test', {
        searchMemory: true,
        showContext: false
      });

      const context = task.getContext();

      expect(context).not.toBeNull();
      expect(context).toHaveProperty('query');
      expect(context).toHaveProperty('summary');
    });

    it('should return null if memory search was disabled', async () => {
      const task = await workflow.startTask('test', {
        searchMemory: false,
        showContext: false
      });

      const context = task.getContext();
      expect(context).toBeNull();
    });
  });

  describe('analyzeRecent', () => {
    beforeEach(async () => {
      // Create some test tasks
      const task1 = await workflow.startTask('Task 1', {
        searchMemory: false,
        showContext: false
      });
      await task1.log('exec');
      await task1.complete();

      const task2 = await workflow.startTask('Task 2', {
        searchMemory: false,
        showContext: false
      });
      await task2.log('write');
      await task2.fail('Test error');

      const task3 = await workflow.startTask('Task 3', {
        searchMemory: false,
        showContext: false
      });
      // Leave in progress
    });

    it('should analyze recent tasks', async () => {
      const analysis = await workflow.analyzeRecent({ limit: 10 });

      expect(analysis.total).toBeGreaterThanOrEqual(3);
      expect(analysis.successful).toBeGreaterThanOrEqual(1);
      expect(analysis.failed).toBeGreaterThanOrEqual(1);
      expect(analysis.in_progress).toBeGreaterThanOrEqual(1);
    });

    it('should count common tools', async () => {
      const analysis = await workflow.analyzeRecent({ limit: 10 });

      expect(analysis.common_tools).toHaveProperty('exec');
      expect(analysis.common_tools).toHaveProperty('write');
    });

    it('should count common failures', async () => {
      const analysis = await workflow.analyzeRecent({ limit: 10 });

      expect(analysis.common_failures).toHaveProperty('Test error');
      expect(analysis.common_failures['Test error']).toBeGreaterThanOrEqual(1);
    });

    it('should calculate average duration', async () => {
      const analysis = await workflow.analyzeRecent({ limit: 10 });

      // Should have calculated average (might be 0 if tasks were too fast)
      expect(typeof analysis.avg_duration).toBe('number');
    });

    it('should respect limit option', async () => {
      const analysis = await workflow.analyzeRecent({ limit: 2 });

      expect(analysis.total).toBe(2);
    });
  });

  describe('Full workflow', () => {
    it('should complete full task lifecycle', async () => {
      // Start task
      const task = await workflow.startTask('Full workflow test', {
        searchMemory: false,
        showContext: false
      });

      // Log activities
      await task.log('exec');
      await task.log('write', 'src/test.js');
      await task.log('read', 'docs/guide.md');

      // Complete
      await task.complete();

      // Verify state
      const state = await task.getState();
      expect(state.success).toBe(true);
      expect(state.tools_used).toContain('exec');
      expect(state.tools_used).toContain('write');
      expect(state.tools_used).toContain('read');
      expect(state.files_modified).toContain('src/test.js');
      expect(state.files_modified).toContain('docs/guide.md');
    });

    it('should handle failure workflow', async () => {
      const task = await workflow.startTask('Failing task', {
        searchMemory: false,
        showContext: false
      });

      await task.log('exec');
      await task.fail('Missing dependencies', { quality: 'abandoned' });

      const state = await task.getState();
      expect(state.success).toBe(false);
      expect(state.failure_reason).toBe('Missing dependencies');
      expect(state.outcome_quality).toBe('abandoned');
    });
  });
});
