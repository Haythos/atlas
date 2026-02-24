const fs = require('fs').promises;
const path = require('path');
const oracle = require('../src/atlas-memory-oracle');

const TEST_WORKSPACE = path.join(__dirname, '../data/test_workspace');
const TEST_MEMORY = path.join(TEST_WORKSPACE, 'MEMORY.md');
const TEST_DEVLOG = path.join(TEST_WORKSPACE, 'DEVLOG.md');
const TEST_CHANGELOG = path.join(TEST_WORKSPACE, 'CHANGELOG.md');

describe('ATLAS Memory Oracle', () => {
  beforeEach(async () => {
    // Create test workspace
    await fs.mkdir(TEST_WORKSPACE, { recursive: true });
    
    // Create test files
    await fs.writeFile(TEST_MEMORY, `# MEMORY.md
## Testing Infrastructure
- Built test coverage tool
- Coverage improved from 0% to 60%
- Tests prevent regressions

## CI/CD Pipeline
- GitHub Actions configured
- Multi-version testing (Node 18/20/22)
- Coverage enforcement at 60%

## Build 010: Evaluation Dashboard
- JSONL metrics logging
- HTML dashboard generation
- No database needed
`, 'utf8');

    await fs.writeFile(TEST_DEVLOG, `# DEVLOG.md

## 2026-02-22 - Build 018: PCAS Policy Engine
**Status:** ✅ COMPLETE
**Build Time:** 90 minutes
**Tests:** 28 tests, 62% coverage

Policy engine for safe trading. Prevents dangerous actions.

## 2026-02-21 - Build 011: Test Infrastructure
**Status:** ✅ COMPLETE
**Build Time:** 120 minutes
**Tests:** 150 tests, 63% coverage

Added Jest, wrote tests for 6 tools. Coverage enforcement via CI.

## 2026-02-20 - Failed Attempt: Database Integration
**Status:** ❌ FAILED
**Reason:** Over-engineering, JSONL simpler

Tried to add PostgreSQL for metrics storage. Abandoned after 2 hours.
JSONL is sufficient and has no dependencies.
`, 'utf8');

    await fs.writeFile(TEST_CHANGELOG, `# CHANGELOG.md

## [2026-02-22] Build 018
- Added PCAS policy engine
- 28 tests passing
- Safe trading actions

## [2026-02-21] Build 011
- Test infrastructure complete
- 150 tests, 63% coverage
- CI/CD integrated
`, 'utf8');
  });

  afterAll(async () => {
    // Cleanup
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true });
  });

  describe('searchContext', () => {
    it('should find relevant matches across files', async () => {
      const results = await oracle.searchContext('test coverage', {
        workspaceRoot: TEST_WORKSPACE
      });

      expect(results.summary.total_matches).toBeGreaterThan(0);
      expect(results.summary.files_searched).toBeGreaterThan(0);
    });

    it('should return structured results', async () => {
      const results = await oracle.searchContext('testing', {
        workspaceRoot: TEST_WORKSPACE
      });

      expect(results).toHaveProperty('query');
      expect(results).toHaveProperty('timestamp');
      expect(results).toHaveProperty('matches');
      expect(results).toHaveProperty('summary');
      expect(results.query).toBe('testing');
    });

    it('should include match details', async () => {
      const results = await oracle.searchContext('CI/CD', {
        workspaceRoot: TEST_WORKSPACE
      });

      const match = results.matches[0];
      expect(match).toHaveProperty('file');
      expect(match).toHaveProperty('line');
      expect(match).toHaveProperty('score');
      expect(match).toHaveProperty('match_line');
      expect(match).toHaveProperty('context');
    });

    it('should detect prior attempts', async () => {
      const results = await oracle.searchContext('build test', {
        workspaceRoot: TEST_WORKSPACE
      });

      expect(results.summary.prior_attempts).toBeGreaterThan(0);
    });

    it('should detect failures', async () => {
      const results = await oracle.searchContext('database', {
        workspaceRoot: TEST_WORKSPACE
      });

      expect(results.summary.failures).toBeGreaterThan(0);
    });

    it('should detect successes', async () => {
      const results = await oracle.searchContext('test infrastructure', {
        workspaceRoot: TEST_WORKSPACE
      });

      expect(results.summary.successes).toBeGreaterThan(0);
    });

    it('should respect maxResults option', async () => {
      const results = await oracle.searchContext('test', {
        workspaceRoot: TEST_WORKSPACE,
        maxResults: 2
      });

      // Each file can have max 2 results
      const memoryMatches = results.matches.filter(m => m.file === 'MEMORY.md');
      expect(memoryMatches.length).toBeLessThanOrEqual(2);
    });

    it('should include context lines', async () => {
      const results = await oracle.searchContext('JSONL', {
        workspaceRoot: TEST_WORKSPACE,
        contextLines: 1
      });

      const match = results.matches[0];
      const contextLineCount = match.context.split('\n').length;
      expect(contextLineCount).toBeGreaterThan(1); // At least match line + 1 context
    });

    it('should handle missing files gracefully', async () => {
      const results = await oracle.searchContext('test', {
        workspaceRoot: TEST_WORKSPACE,
        files: ['MISSING.md', 'MEMORY.md']
      });

      // Should still find matches in MEMORY.md
      expect(results.summary.total_matches).toBeGreaterThan(0);
    });

    it('should return empty results for no matches', async () => {
      const results = await oracle.searchContext('xyzabc123notfound', {
        workspaceRoot: TEST_WORKSPACE
      });

      expect(results.summary.total_matches).toBe(0);
      expect(results.matches).toHaveLength(0);
    });

    it('should throw error for missing query', async () => {
      await expect(oracle.searchContext(''))
        .rejects.toThrow('Query is required');
    });

    it('should throw error for non-string query', async () => {
      await expect(oracle.searchContext(123))
        .rejects.toThrow('Query is required');
    });

    it('should score exact matches higher', async () => {
      const results = await oracle.searchContext('Testing Infrastructure', {
        workspaceRoot: TEST_WORKSPACE
      });

      // First match should have high score (exact phrase match)
      expect(results.matches[0].score).toBeGreaterThanOrEqual(10);
    });

    it('should search custom files', async () => {
      const results = await oracle.searchContext('test', {
        workspaceRoot: TEST_WORKSPACE,
        files: ['DEVLOG.md']
      });

      expect(results.matches.every(m => m.file === 'DEVLOG.md')).toBe(true);
    });

    it('should trim query whitespace', async () => {
      const results = await oracle.searchContext('  test  ', {
        workspaceRoot: TEST_WORKSPACE
      });

      expect(results.query).toBe('test');
    });

    it('should include ISO timestamp', async () => {
      const results = await oracle.searchContext('test', {
        workspaceRoot: TEST_WORKSPACE
      });

      expect(results.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('extractKeywords', () => {
    it('should extract meaningful keywords', () => {
      const keywords = oracle.extractKeywords('Build test infrastructure with Jest');
      
      expect(keywords).toContain('build');
      expect(keywords).toContain('test');
      expect(keywords).toContain('infrastructure');
      expect(keywords).toContain('jest');
    });

    it('should remove stop words', () => {
      const keywords = oracle.extractKeywords('the quick brown fox');
      
      expect(keywords).not.toContain('the');
      expect(keywords).toContain('quick');
      expect(keywords).toContain('brown');
    });

    it('should handle punctuation', () => {
      const keywords = oracle.extractKeywords('Build CI/CD pipeline!');
      
      expect(keywords).toContain('build');
      expect(keywords).toContain('pipeline');
    });

    it('should filter short words', () => {
      const keywords = oracle.extractKeywords('a to in on at');
      
      expect(keywords).toHaveLength(0);
    });

    it('should preserve hyphens', () => {
      const keywords = oracle.extractKeywords('CI-CD test-coverage');
      
      expect(keywords).toContain('ci-cd');
      expect(keywords).toContain('test-coverage');
    });

    it('should lowercase keywords', () => {
      const keywords = oracle.extractKeywords('BUILD TEST');
      
      expect(keywords).toContain('build');
      expect(keywords).toContain('test');
    });
  });

  describe('formatResults', () => {
    it('should format results as markdown', async () => {
      const results = await oracle.searchContext('test', {
        workspaceRoot: TEST_WORKSPACE
      });
      const formatted = oracle.formatResults(results);

      expect(formatted).toContain('# Memory Oracle Results');
      expect(formatted).toContain('## Summary');
      expect(formatted).toContain('## Relevant Context');
    });

    it('should include query and timestamp', async () => {
      const results = await oracle.searchContext('test', {
        workspaceRoot: TEST_WORKSPACE
      });
      const formatted = oracle.formatResults(results);

      expect(formatted).toContain('**Query:** test');
      expect(formatted).toContain('**Timestamp:**');
    });

    it('should include summary stats', async () => {
      const results = await oracle.searchContext('test', {
        workspaceRoot: TEST_WORKSPACE
      });
      const formatted = oracle.formatResults(results);

      expect(formatted).toContain('**Total Matches:**');
      expect(formatted).toContain('**Prior Attempts:**');
      expect(formatted).toContain('**Failures:**');
      expect(formatted).toContain('**Successes:**');
    });

    it('should format matches with file and line', async () => {
      const results = await oracle.searchContext('test', {
        workspaceRoot: TEST_WORKSPACE
      });
      const formatted = oracle.formatResults(results);

      expect(formatted).toMatch(/### \w+\.md:\d+/);
    });

    it('should support compact mode', async () => {
      const results = await oracle.searchContext('test', {
        workspaceRoot: TEST_WORKSPACE
      });
      const formatted = oracle.formatResults(results, { compact: true });

      expect(formatted).toContain('>'); // Quote syntax for compact
      expect(formatted).not.toContain('```'); // No code blocks in compact
    });

    it('should hide context when requested', async () => {
      const results = await oracle.searchContext('test', {
        workspaceRoot: TEST_WORKSPACE
      });
      const formatted = oracle.formatResults(results, { includeContext: false });

      // Context should be minimal (just match line, not surrounding lines)
      const codeBlocks = formatted.match(/```[\s\S]*?```/g);
      if (codeBlocks) {
        const firstBlock = codeBlocks[0];
        const lines = firstBlock.split('\n');
        expect(lines.length).toBeLessThan(10); // Much shorter without context
      }
    });

    it('should handle zero results', async () => {
      const results = await oracle.searchContext('xyznotfound', {
        workspaceRoot: TEST_WORKSPACE
      });
      const formatted = oracle.formatResults(results);

      expect(formatted).toContain('No relevant context found');
    });
  });

  describe('formatJSON', () => {
    it('should format results as JSON', async () => {
      const results = await oracle.searchContext('test', {
        workspaceRoot: TEST_WORKSPACE
      });
      const json = oracle.formatJSON(results);

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should include all fields in JSON', async () => {
      const results = await oracle.searchContext('test', {
        workspaceRoot: TEST_WORKSPACE
      });
      const json = JSON.parse(oracle.formatJSON(results));

      expect(json).toHaveProperty('query');
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('matches');
      expect(json).toHaveProperty('summary');
    });

    it('should pretty-print JSON', async () => {
      const results = await oracle.searchContext('test', {
        workspaceRoot: TEST_WORKSPACE
      });
      const json = oracle.formatJSON(results);

      expect(json).toContain('\n'); // Indented
      expect(json).toContain('  '); // 2-space indent
    });
  });

  describe('Edge cases', () => {
    it('should handle empty files', async () => {
      await fs.writeFile(path.join(TEST_WORKSPACE, 'EMPTY.md'), '', 'utf8');
      
      const results = await oracle.searchContext('test', {
        workspaceRoot: TEST_WORKSPACE,
        files: ['EMPTY.md']
      });

      expect(results.summary.total_matches).toBe(0);
    });

    it('should handle very long queries', async () => {
      const longQuery = 'test '.repeat(100);
      const results = await oracle.searchContext(longQuery, {
        workspaceRoot: TEST_WORKSPACE
      });

      expect(results.query).toBe(longQuery.trim());
    });

    it('should handle special characters in query', async () => {
      const results = await oracle.searchContext('CI/CD (test) [coverage]', {
        workspaceRoot: TEST_WORKSPACE
      });

      expect(results.query).toBe('CI/CD (test) [coverage]');
    });

    it('should handle unicode in query', async () => {
      const results = await oracle.searchContext('test 测试 тест', {
        workspaceRoot: TEST_WORKSPACE
      });

      expect(results.query).toContain('测试');
    });

    it('should handle files with no newlines', async () => {
      await fs.writeFile(
        path.join(TEST_WORKSPACE, 'SINGLE.md'),
        'Single line file with test keyword',
        'utf8'
      );

      const results = await oracle.searchContext('test', {
        workspaceRoot: TEST_WORKSPACE,
        files: ['SINGLE.md']
      });

      expect(results.summary.total_matches).toBeGreaterThan(0);
    });

    it('should handle very large files', async () => {
      const largeContent = 'test line\n'.repeat(10000);
      await fs.writeFile(
        path.join(TEST_WORKSPACE, 'LARGE.md'),
        largeContent,
        'utf8'
      );

      const results = await oracle.searchContext('test', {
        workspaceRoot: TEST_WORKSPACE,
        files: ['LARGE.md'],
        maxResults: 5
      });

      expect(results.matches.length).toBe(5); // Should respect maxResults
    });
  });
});
