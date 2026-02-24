const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);
const CLI_PATH = path.join(__dirname, '../src/atlas-memory-oracle.js');
const TEST_WORKSPACE = path.join(__dirname, '../data/test_workspace_cli');

describe('ATLAS Memory Oracle CLI', () => {
  beforeEach(async () => {
    // Create test workspace
    await fs.mkdir(TEST_WORKSPACE, { recursive: true });
    
    await fs.writeFile(path.join(TEST_WORKSPACE, 'MEMORY.md'), `# MEMORY.md
## Testing
Built comprehensive test suite with Jest. Coverage at 60%.

## Build 010: Evaluation Dashboard
JSONL metrics logging system. No database needed.
`, 'utf8');

    await fs.writeFile(path.join(TEST_WORKSPACE, 'DEVLOG.md'), `# DEVLOG.md
## 2026-02-21 - Build 011: Test Infrastructure
Status: ✅ COMPLETE
Tests: 150 passing

## 2026-02-20 - Failed: Database Integration
Status: ❌ FAILED
Abandoned PostgreSQL, JSONL is simpler.
`, 'utf8');
  });

  afterAll(async () => {
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true });
  });

  describe('help', () => {
    it('should show help with --help', async () => {
      const { stdout } = await execAsync(`node "${CLI_PATH}" --help`);
      
      expect(stdout).toContain('Usage:');
      expect(stdout).toContain('Options:');
      expect(stdout).toContain('Examples:');
    });

    it('should show help with -h', async () => {
      const { stdout } = await execAsync(`node "${CLI_PATH}" -h`);
      
      expect(stdout).toContain('Usage:');
    });

    it('should show help with no args', async () => {
      const { stdout } = await execAsync(`node "${CLI_PATH}"`);
      
      expect(stdout).toContain('Usage:');
    });
  });

  describe('search', () => {
    it('should search and format results', async () => {
      const { stdout } = await execAsync(`cd "${TEST_WORKSPACE}" && node "${CLI_PATH}" "test"`);
      
      expect(stdout).toContain('Memory Oracle Results');
      expect(stdout).toContain('Summary');
      expect(stdout).toContain('Total Matches');
    });

    it('should output JSON with --json flag', async () => {
      const { stdout } = await execAsync(`cd "${TEST_WORKSPACE}" && node "${CLI_PATH}" "test" --json`);
      
      const json = JSON.parse(stdout);
      expect(json).toHaveProperty('query');
      expect(json).toHaveProperty('matches');
      expect(json).toHaveProperty('summary');
    });

    it('should use compact mode with --compact flag', async () => {
      const { stdout } = await execAsync(`cd "${TEST_WORKSPACE}" && node "${CLI_PATH}" "test" --compact`);
      
      expect(stdout).toContain('>'); // Quote syntax
      expect(stdout).not.toContain('```'); // No code blocks
    });

    it('should hide context with --no-context flag', async () => {
      const { stdout } = await execAsync(`cd "${TEST_WORKSPACE}" && node "${CLI_PATH}" "test" --no-context`);
      
      // Output should be shorter without context
      expect(stdout.length).toBeGreaterThan(0);
      expect(stdout).toContain('Memory Oracle Results');
    });

    it('should respect --max-results flag', async () => {
      const { stdout } = await execAsync(`cd "${TEST_WORKSPACE}" && node "${CLI_PATH}" "test" --max-results=1 --json`);
      
      const json = JSON.parse(stdout);
      // Should have at most 1 result per file
      const memoryMatches = json.matches.filter(m => m.file === 'MEMORY.md');
      expect(memoryMatches.length).toBeLessThanOrEqual(1);
    });

    it('should respect --context-lines flag', async () => {
      const { stdout } = await execAsync(`cd "${TEST_WORKSPACE}" && node "${CLI_PATH}" "test" --context-lines=1`);
      
      expect(stdout).toContain('Memory Oracle Results');
    });

    it('should handle queries with spaces', async () => {
      const { stdout } = await execAsync(`cd "${TEST_WORKSPACE}" && node "${CLI_PATH}" "test infrastructure"`);
      
      expect(stdout).toContain('test infrastructure');
    });

    it('should handle special characters in query', async () => {
      const { stdout } = await execAsync(`cd "${TEST_WORKSPACE}" && node "${CLI_PATH}" "Build 010"`);
      
      expect(stdout).toContain('Build 010');
    });

    it('should handle no matches', async () => {
      const { stdout } = await execAsync(`cd "${TEST_WORKSPACE}" && node "${CLI_PATH}" "xyznotfound"`);
      
      expect(stdout).toContain('No relevant context found');
    });
  });

  describe('error handling', () => {
    it('should handle empty query gracefully', async () => {
      try {
        await execAsync(`node "${CLI_PATH}" ""`);
        fail('Should have thrown error');
      } catch (err) {
        expect(err.message).toContain('Error');
      }
    });
  });
});
