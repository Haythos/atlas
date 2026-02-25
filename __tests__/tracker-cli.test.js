const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);
const CLI_PATH = path.join(__dirname, '../src/atlas-tracker.js');

describe('ATLAS Tracker CLI', () => {
  let testLogPath;

  beforeEach(async () => {
    // Use unique log file per test to avoid parallel execution conflicts
    testLogPath = path.join(__dirname, `../data/test_cli_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jsonl`);
    
    // Clean up if exists (shouldn't, but just in case)
    try {
      await fs.unlink(testLogPath);
    } catch (err) {
      // Ignore
    }
    
    // Set environment variable to use unique test log path
    process.env.ATLAS_LOG_PATH = testLogPath;
  });

  afterEach(async () => {
    // Clean up test log after each test
    try {
      await fs.unlink(testLogPath);
    } catch (err) {
      // Ignore
    }
  });

  afterAll(async () => {
    delete process.env.ATLAS_LOG_PATH;
  });

  describe('start command', () => {
    it('should start a task and return UUID', async () => {
      const { stdout } = await execAsync(`node "${CLI_PATH}" start "Test task"`);
      const taskId = stdout.trim();
      
      expect(taskId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should error without description', async () => {
      try {
        await execAsync(`node "${CLI_PATH}" start`);
        fail('Should have thrown error');
      } catch (err) {
        expect(err.message).toContain('Usage: atlas-tracker start');
      }
    });
  });

  describe('end command', () => {
    it('should end a task successfully', async () => {
      const { stdout: startOutput } = await execAsync(`node "${CLI_PATH}" start "Test task"`);
      const taskId = startOutput.trim();
      
      const { stdout: endOutput } = await execAsync(`node "${CLI_PATH}" end ${taskId} --success`);
      expect(endOutput).toContain('SUCCESS');
    });

    it('should end a task with failure', async () => {
      const { stdout: startOutput } = await execAsync(`node "${CLI_PATH}" start "Test task"`);
      const taskId = startOutput.trim();
      
      const { stdout: endOutput } = await execAsync(`node "${CLI_PATH}" end ${taskId} --failure="Test error"`);
      expect(endOutput).toContain('FAILED');
    });

    it('should error without task ID', async () => {
      try {
        await execAsync(`node "${CLI_PATH}" end`);
        fail('Should have thrown error');
      } catch (err) {
        expect(err.message).toContain('Usage: atlas-tracker end');
      }
    });
  });

  describe('update command', () => {
    it('should update tools', async () => {
      const { stdout: startOutput } = await execAsync(`node "${CLI_PATH}" start "Test task"`);
      const taskId = startOutput.trim();
      
      const { stdout: updateOutput } = await execAsync(`node "${CLI_PATH}" update ${taskId} --tools=exec,write`);
      expect(updateOutput).toContain('updated');
    });

    it('should update files', async () => {
      const { stdout: startOutput } = await execAsync(`node "${CLI_PATH}" start "Test task"`);
      const taskId = startOutput.trim();
      
      const { stdout: updateOutput } = await execAsync(`node "${CLI_PATH}" update ${taskId} --files=src/x.js,src/y.js`);
      expect(updateOutput).toContain('updated');
    });

    it('should error without task ID', async () => {
      try {
        await execAsync(`node "${CLI_PATH}" update`);
        fail('Should have thrown error');
      } catch (err) {
        expect(err.message).toContain('Usage: atlas-tracker update');
      }
    });
  });

  describe('get command', () => {
    it('should get task by ID', async () => {
      const { stdout: startOutput } = await execAsync(`node "${CLI_PATH}" start "Test task"`);
      const taskId = startOutput.trim();
      
      const { stdout: getOutput } = await execAsync(`node "${CLI_PATH}" get ${taskId}`);
      const task = JSON.parse(getOutput);
      
      expect(task.task_id).toBe(taskId);
      expect(task.description).toBe('Test task');
    });

    it('should error for missing task', async () => {
      try {
        await execAsync(`node "${CLI_PATH}" get fake-id`);
        fail('Should have thrown error');
      } catch (err) {
        expect(err.message).toContain('Task not found');
      }
    });

    it('should error without task ID', async () => {
      try {
        await execAsync(`node "${CLI_PATH}" get`);
        fail('Should have thrown error');
      } catch (err) {
        expect(err.message).toContain('Usage: atlas-tracker get');
      }
    });
  });

  describe('list command', () => {
    it('should list tasks', async () => {
      await execAsync(`node "${CLI_PATH}" start "Task 1"`);
      await execAsync(`node "${CLI_PATH}" start "Task 2"`);
      
      const { stdout } = await execAsync(`node "${CLI_PATH}" list`);
      
      expect(stdout).toContain('Task 1');
      expect(stdout).toContain('Task 2');
    });

    it('should respect limit flag', async () => {
      await execAsync(`node "${CLI_PATH}" start "Task 1"`);
      await execAsync(`node "${CLI_PATH}" start "Task 2"`);
      await execAsync(`node "${CLI_PATH}" start "Task 3"`);
      
      const { stdout } = await execAsync(`node "${CLI_PATH}" list --limit=2`);
      const lines = stdout.trim().split('\n');
      
      expect(lines.length).toBe(2);
    });

    it('should show status icons', async () => {
      const { stdout: startOutput } = await execAsync(`node "${CLI_PATH}" start "Task 1"`);
      const taskId = startOutput.trim();
      await execAsync(`node "${CLI_PATH}" end ${taskId} --success`);
      
      const { stdout } = await execAsync(`node "${CLI_PATH}" list`);
      
      expect(stdout).toContain('✅'); // Success icon
    });
  });

  describe('log command (alias for update)', () => {
    it('should work as alias for update', async () => {
      const { stdout: startOutput } = await execAsync(`node "${CLI_PATH}" start "Test task"`);
      const taskId = startOutput.trim();
      
      const { stdout: logOutput } = await execAsync(`node "${CLI_PATH}" log ${taskId} --tools=exec`);
      expect(logOutput).toContain('updated');
    });
  });

  describe('invalid command', () => {
    it('should show usage for unknown command', async () => {
      try {
        await execAsync(`node "${CLI_PATH}" invalid`);
        fail('Should have thrown error');
      } catch (err) {
        expect(err.message).toContain('Usage: atlas-tracker');
      }
    });
  });

  describe('end command options', () => {
    it('should accept duration flag', async () => {
      const { stdout: startOutput } = await execAsync(`node "${CLI_PATH}" start "Test task"`);
      const taskId = startOutput.trim();
      
      await execAsync(`node "${CLI_PATH}" end ${taskId} --success --duration=45`);
      
      const { stdout: getOutput } = await execAsync(`node "${CLI_PATH}" get ${taskId}`);
      const task = JSON.parse(getOutput);
      
      expect(task.duration_min).toBe(45);
    });

    it('should accept quality flag', async () => {
      const { stdout: startOutput } = await execAsync(`node "${CLI_PATH}" start "Test task"`);
      const taskId = startOutput.trim();
      
      await execAsync(`node "${CLI_PATH}" end ${taskId} --success --quality=complete`);
      
      const { stdout: getOutput } = await execAsync(`node "${CLI_PATH}" get ${taskId}`);
      const task = JSON.parse(getOutput);
      
      expect(task.outcome_quality).toBe('complete');
    });
  });
});
