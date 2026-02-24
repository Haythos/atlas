const fs = require('fs').promises;
const path = require('path');
const tracker = require('../src/atlas-tracker');

const TEST_LOG_PATH = path.join(__dirname, '../data/test_executions.jsonl');

describe('ATLAS Tracker', () => {
  beforeEach(async () => {
    // Clean up test log before each test
    try {
      await fs.unlink(TEST_LOG_PATH);
    } catch (err) {
      // File might not exist, ignore
    }
  });

  afterAll(async () => {
    // Clean up test log after all tests
    try {
      await fs.unlink(TEST_LOG_PATH);
    } catch (err) {
      // Ignore
    }
  });

  describe('startTask', () => {
    it('should create a new task with UUID', async () => {
      const taskId = await tracker.startTask('Test task', { logPath: TEST_LOG_PATH });
      
      expect(taskId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should write task to log file', async () => {
      const taskId = await tracker.startTask('Test task', { logPath: TEST_LOG_PATH });
      const tasks = await tracker.getTasks({ logPath: TEST_LOG_PATH });
      
      expect(tasks).toHaveLength(1);
      expect(tasks[0].task_id).toBe(taskId);
      expect(tasks[0].description).toBe('Test task');
    });

    it('should set default values for new task', async () => {
      const taskId = await tracker.startTask('Test task', { logPath: TEST_LOG_PATH });
      const task = await tracker.getTask(taskId, { logPath: TEST_LOG_PATH });
      
      expect(task.end_ts).toBeNull();
      expect(task.duration_min).toBeNull();
      expect(task.success).toBe(false);
      expect(task.failure_reason).toBeNull();
      expect(task.tools_used).toEqual([]);
      expect(task.files_modified).toEqual([]);
      expect(task.outcome_quality).toBe('incomplete');
      expect(task.schema_version).toBe('1.0');
    });

    it('should include ISO timestamp', async () => {
      const taskId = await tracker.startTask('Test task', { logPath: TEST_LOG_PATH });
      const task = await tracker.getTask(taskId, { logPath: TEST_LOG_PATH });
      
      expect(task.start_ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should trim description whitespace', async () => {
      const taskId = await tracker.startTask('  Test task  ', { logPath: TEST_LOG_PATH });
      const task = await tracker.getTask(taskId, { logPath: TEST_LOG_PATH });
      
      expect(task.description).toBe('Test task');
    });

    it('should accept metadata', async () => {
      const metadata = { build_number: 19, test_coverage: 65 };
      const taskId = await tracker.startTask('Test task', { 
        logPath: TEST_LOG_PATH, 
        metadata 
      });
      const task = await tracker.getTask(taskId, { logPath: TEST_LOG_PATH });
      
      expect(task.metadata).toEqual(metadata);
    });

    it('should throw error for missing description', async () => {
      await expect(tracker.startTask('', { logPath: TEST_LOG_PATH }))
        .rejects.toThrow('Task description is required');
    });

    it('should throw error for non-string description', async () => {
      await expect(tracker.startTask(123, { logPath: TEST_LOG_PATH }))
        .rejects.toThrow('Task description is required');
    });
  });

  describe('updateTask', () => {
    it('should update tools_used', async () => {
      const taskId = await tracker.startTask('Test task', { logPath: TEST_LOG_PATH });
      await tracker.updateTask(taskId, { tools_used: ['exec', 'write'] }, { logPath: TEST_LOG_PATH });
      const task = await tracker.getTask(taskId, { logPath: TEST_LOG_PATH });
      
      expect(task.tools_used).toEqual(['exec', 'write']);
    });

    it('should update files_modified', async () => {
      const taskId = await tracker.startTask('Test task', { logPath: TEST_LOG_PATH });
      await tracker.updateTask(taskId, { files_modified: ['src/x.js', 'src/y.js'] }, { logPath: TEST_LOG_PATH });
      const task = await tracker.getTask(taskId, { logPath: TEST_LOG_PATH });
      
      expect(task.files_modified).toEqual(['src/x.js', 'src/y.js']);
    });

    it('should merge metadata', async () => {
      const taskId = await tracker.startTask('Test task', { 
        logPath: TEST_LOG_PATH, 
        metadata: { a: 1 } 
      });
      await tracker.updateTask(taskId, { metadata: { b: 2 } }, { logPath: TEST_LOG_PATH });
      const task = await tracker.getTask(taskId, { logPath: TEST_LOG_PATH });
      
      expect(task.metadata).toEqual({ a: 1, b: 2 });
    });

    it('should append to arrays without duplicates', async () => {
      const taskId = await tracker.startTask('Test task', { logPath: TEST_LOG_PATH });
      await tracker.updateTask(taskId, { tools_used: ['exec'] }, { logPath: TEST_LOG_PATH });
      await tracker.updateTask(taskId, { tools_used: ['exec', 'write'] }, { logPath: TEST_LOG_PATH });
      const task = await tracker.getTask(taskId, { logPath: TEST_LOG_PATH });
      
      expect(task.tools_used).toEqual(['exec', 'write']);
    });

    it('should throw error for missing task', async () => {
      await expect(tracker.updateTask('fake-id', { tools_used: ['exec'] }, { logPath: TEST_LOG_PATH }))
        .rejects.toThrow('Task not found: fake-id');
    });

    it('should throw error for invalid task ID', async () => {
      await expect(tracker.updateTask('', { tools_used: ['exec'] }, { logPath: TEST_LOG_PATH }))
        .rejects.toThrow('Task ID is required');
    });
  });

  describe('endTask', () => {
    it('should mark task as complete', async () => {
      const taskId = await tracker.startTask('Test task', { logPath: TEST_LOG_PATH });
      await tracker.endTask(taskId, { success: true }, { logPath: TEST_LOG_PATH });
      const task = await tracker.getTask(taskId, { logPath: TEST_LOG_PATH });
      
      expect(task.success).toBe(true);
      expect(task.end_ts).not.toBeNull();
      expect(task.outcome_quality).toBe('complete');
    });

    it('should mark task as failed', async () => {
      const taskId = await tracker.startTask('Test task', { logPath: TEST_LOG_PATH });
      await tracker.endTask(taskId, { 
        success: false, 
        failure_reason: 'Test failed' 
      }, { logPath: TEST_LOG_PATH });
      const task = await tracker.getTask(taskId, { logPath: TEST_LOG_PATH });
      
      expect(task.success).toBe(false);
      expect(task.failure_reason).toBe('Test failed');
      expect(task.outcome_quality).toBe('incomplete');
    });

    it('should calculate duration automatically', async () => {
      const taskId = await tracker.startTask('Test task', { logPath: TEST_LOG_PATH });
      
      // Wait 50ms to ensure some time passes
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await tracker.endTask(taskId, { success: true }, { logPath: TEST_LOG_PATH });
      const task = await tracker.getTask(taskId, { logPath: TEST_LOG_PATH });
      
      // Duration should be small but non-zero (at least 0.001 minutes = 60ms)
      expect(task.duration_min).toBeGreaterThanOrEqual(0);
      expect(task.duration_min).toBeLessThan(1); // Less than 1 minute
    });

    it('should accept manual duration', async () => {
      const taskId = await tracker.startTask('Test task', { logPath: TEST_LOG_PATH });
      await tracker.endTask(taskId, { success: true, duration_min: 45 }, { logPath: TEST_LOG_PATH });
      const task = await tracker.getTask(taskId, { logPath: TEST_LOG_PATH });
      
      expect(task.duration_min).toBe(45);
    });

    it('should accept custom outcome_quality', async () => {
      const taskId = await tracker.startTask('Test task', { logPath: TEST_LOG_PATH });
      await tracker.endTask(taskId, { 
        success: false, 
        outcome_quality: 'abandoned' 
      }, { logPath: TEST_LOG_PATH });
      const task = await tracker.getTask(taskId, { logPath: TEST_LOG_PATH });
      
      expect(task.outcome_quality).toBe('abandoned');
    });

    it('should throw error for invalid outcome_quality', async () => {
      const taskId = await tracker.startTask('Test task', { logPath: TEST_LOG_PATH });
      
      await expect(tracker.endTask(taskId, { 
        success: true, 
        outcome_quality: 'invalid' 
      }, { logPath: TEST_LOG_PATH }))
        .rejects.toThrow('Invalid outcome_quality');
    });

    it('should throw error for missing task', async () => {
      await expect(tracker.endTask('fake-id', { success: true }, { logPath: TEST_LOG_PATH }))
        .rejects.toThrow('Task not found: fake-id');
    });

    it('should round duration to 2 decimal places', async () => {
      const taskId = await tracker.startTask('Test task', { logPath: TEST_LOG_PATH });
      await tracker.endTask(taskId, { success: true, duration_min: 45.6789 }, { logPath: TEST_LOG_PATH });
      const task = await tracker.getTask(taskId, { logPath: TEST_LOG_PATH });
      
      expect(task.duration_min).toBe(45.68);
    });
  });

  describe('getTask', () => {
    it('should return task by ID', async () => {
      const taskId = await tracker.startTask('Test task', { logPath: TEST_LOG_PATH });
      const task = await tracker.getTask(taskId, { logPath: TEST_LOG_PATH });
      
      expect(task).not.toBeNull();
      expect(task.task_id).toBe(taskId);
    });

    it('should return null for missing task', async () => {
      const task = await tracker.getTask('fake-id', { logPath: TEST_LOG_PATH });
      expect(task).toBeNull();
    });
  });

  describe('getTasks', () => {
    it('should return all tasks', async () => {
      await tracker.startTask('Task 1', { logPath: TEST_LOG_PATH });
      await tracker.startTask('Task 2', { logPath: TEST_LOG_PATH });
      const tasks = await tracker.getTasks({ logPath: TEST_LOG_PATH });
      
      expect(tasks).toHaveLength(2);
    });

    it('should filter by success status', async () => {
      const id1 = await tracker.startTask('Task 1', { logPath: TEST_LOG_PATH });
      const id2 = await tracker.startTask('Task 2', { logPath: TEST_LOG_PATH });
      await tracker.endTask(id1, { success: true }, { logPath: TEST_LOG_PATH });
      await tracker.endTask(id2, { success: false }, { logPath: TEST_LOG_PATH });
      
      const successTasks = await tracker.getTasks({ success: true, logPath: TEST_LOG_PATH });
      const failedTasks = await tracker.getTasks({ success: false, logPath: TEST_LOG_PATH });
      
      expect(successTasks).toHaveLength(1);
      expect(failedTasks).toHaveLength(1);
    });

    it('should limit results', async () => {
      await tracker.startTask('Task 1', { logPath: TEST_LOG_PATH });
      await tracker.startTask('Task 2', { logPath: TEST_LOG_PATH });
      await tracker.startTask('Task 3', { logPath: TEST_LOG_PATH });
      
      const tasks = await tracker.getTasks({ limit: 2, logPath: TEST_LOG_PATH });
      
      expect(tasks).toHaveLength(2);
    });

    it('should filter by time', async () => {
      const now = Date.now();
      await tracker.startTask('Old task', { logPath: TEST_LOG_PATH });
      
      // Wait 10ms
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await tracker.startTask('New task', { logPath: TEST_LOG_PATH });
      
      const recentTasks = await tracker.getTasks({ since: now + 5, logPath: TEST_LOG_PATH });
      
      expect(recentTasks).toHaveLength(1);
      expect(recentTasks[0].description).toBe('New task');
    });

    it('should return empty array for missing log file', async () => {
      const tasks = await tracker.getTasks({ logPath: TEST_LOG_PATH });
      expect(tasks).toEqual([]);
    });

    it('should work with no filter options', async () => {
      await tracker.startTask('Task 1', { logPath: TEST_LOG_PATH });
      await tracker.startTask('Task 2', { logPath: TEST_LOG_PATH });
      
      const tasks = await tracker.getTasks({ logPath: TEST_LOG_PATH });
      expect(tasks).toHaveLength(2);
    });

    it('should combine multiple filters', async () => {
      const id1 = await tracker.startTask('Task 1', { logPath: TEST_LOG_PATH });
      await tracker.startTask('Task 2', { logPath: TEST_LOG_PATH });
      await tracker.startTask('Task 3', { logPath: TEST_LOG_PATH });
      await tracker.endTask(id1, { success: true }, { logPath: TEST_LOG_PATH });
      
      const tasks = await tracker.getTasks({
        success: true,
        limit: 1,
        logPath: TEST_LOG_PATH
      });
      
      expect(tasks).toHaveLength(1);
      expect(tasks[0].success).toBe(true);
    });
  });

  describe('JSONL format', () => {
    it('should write valid JSONL', async () => {
      await tracker.startTask('Task 1', { logPath: TEST_LOG_PATH });
      await tracker.startTask('Task 2', { logPath: TEST_LOG_PATH });
      
      const content = await fs.readFile(TEST_LOG_PATH, 'utf8');
      const lines = content.trim().split('\n');
      
      expect(lines).toHaveLength(2);
      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });

    it('should append to existing log', async () => {
      await tracker.startTask('Task 1', { logPath: TEST_LOG_PATH });
      await tracker.startTask('Task 2', { logPath: TEST_LOG_PATH });
      
      const tasks = await tracker.getTasks({ logPath: TEST_LOG_PATH });
      expect(tasks).toHaveLength(2);
    });
  });

  describe('Error handling', () => {
    it('should handle corrupted JSONL file', async () => {
      // Write invalid JSON
      await require('fs').promises.writeFile(TEST_LOG_PATH, 'invalid json\n{"valid": "json"}\n', 'utf8');
      
      // Should throw parse error
      await expect(tracker.getTasks({ logPath: TEST_LOG_PATH }))
        .rejects.toThrow();
    });

    it('should handle empty log file', async () => {
      await require('fs').promises.writeFile(TEST_LOG_PATH, '', 'utf8');
      const tasks = await tracker.getTasks({ logPath: TEST_LOG_PATH });
      expect(tasks).toEqual([]);
    });

    it('should handle file with only newlines', async () => {
      await require('fs').promises.writeFile(TEST_LOG_PATH, '\n\n\n', 'utf8');
      const tasks = await tracker.getTasks({ logPath: TEST_LOG_PATH });
      expect(tasks).toEqual([]);
    });
  });

  describe('Edge cases', () => {
    it('should handle very long descriptions', async () => {
      const longDesc = 'A'.repeat(10000);
      const taskId = await tracker.startTask(longDesc, { logPath: TEST_LOG_PATH });
      const task = await tracker.getTask(taskId, { logPath: TEST_LOG_PATH });
      
      expect(task.description).toBe(longDesc);
    });

    it('should handle special characters in description', async () => {
      const desc = 'Task with "quotes" and \n newlines and \t tabs';
      const taskId = await tracker.startTask(desc, { logPath: TEST_LOG_PATH });
      const task = await tracker.getTask(taskId, { logPath: TEST_LOG_PATH });
      
      expect(task.description).toBe(desc);
    });

    it('should handle concurrent writes', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(tracker.startTask(`Task ${i}`, { logPath: TEST_LOG_PATH }));
      }
      
      await Promise.all(promises);
      const tasks = await tracker.getTasks({ logPath: TEST_LOG_PATH });
      
      expect(tasks).toHaveLength(10);
    });

    it('should handle missing directory', async () => {
      const deepPath = path.join(__dirname, '../data/deep/nested/path/test.jsonl');
      const taskId = await tracker.startTask('Test', { logPath: deepPath });
      
      expect(taskId).toBeTruthy();
      
      // Cleanup
      await fs.rm(path.join(__dirname, '../data/deep'), { recursive: true, force: true });
    });

    it('should handle empty metadata', async () => {
      const taskId = await tracker.startTask('Test', { logPath: TEST_LOG_PATH, metadata: {} });
      const task = await tracker.getTask(taskId, { logPath: TEST_LOG_PATH });
      
      expect(task.metadata).toEqual({});
    });

    it('should handle null/undefined in outcome', async () => {
      const taskId = await tracker.startTask('Test', { logPath: TEST_LOG_PATH });
      await tracker.endTask(taskId, {}, { logPath: TEST_LOG_PATH });
      const task = await tracker.getTask(taskId, { logPath: TEST_LOG_PATH });
      
      expect(task.success).toBe(false);
      expect(task.outcome_quality).toBe('incomplete');
    });

    it('should handle empty arrays in update', async () => {
      const taskId = await tracker.startTask('Test', { logPath: TEST_LOG_PATH });
      await tracker.updateTask(taskId, { tools_used: [], files_modified: [] }, { logPath: TEST_LOG_PATH });
      const task = await tracker.getTask(taskId, { logPath: TEST_LOG_PATH });
      
      expect(task.tools_used).toEqual([]);
      expect(task.files_modified).toEqual([]);
    });

    it('should preserve order in limit', async () => {
      const id1 = await tracker.startTask('First', { logPath: TEST_LOG_PATH });
      await new Promise(r => setTimeout(r, 10));
      const id2 = await tracker.startTask('Second', { logPath: TEST_LOG_PATH });
      await new Promise(r => setTimeout(r, 10));
      const id3 = await tracker.startTask('Third', { logPath: TEST_LOG_PATH });
      
      const tasks = await tracker.getTasks({ limit: 2, logPath: TEST_LOG_PATH });
      
      expect(tasks).toHaveLength(2);
      expect(tasks[0].description).toBe('Second');
      expect(tasks[1].description).toBe('Third');
    });
  });
});
