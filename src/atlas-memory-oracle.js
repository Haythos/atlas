#!/usr/bin/env node

/**
 * ATLAS Memory Oracle
 * 
 * Proactively searches memory before task execution to surface:
 * - Prior attempts (successes and failures)
 * - Relevant patterns and decisions
 * - Related context from MEMORY.md, DEVLOG.md, CHANGELOG.md
 * 
 * Prevents rediscovering solutions and repeating mistakes.
 * 
 * CLI Usage:
 *   atlas-memory-oracle "Build X feature"
 * 
 * Programmatic Usage:
 *   const oracle = require('./atlas-memory-oracle');
 *   const context = await oracle.searchContext('Build X feature');
 */

const fs = require('fs').promises;
const path = require('path');

const DEFAULT_MEMORY_FILES = [
  'MEMORY.md',
  'DEVLOG.md',
  'CHANGELOG.md',
  'TODO.md'
];

const WORKSPACE_ROOT = path.join(__dirname, '../..');

/**
 * Search memory for relevant context before starting a task
 * @param {string} query - Task description or search query
 * @param {object} options - Search options
 * @param {string[]} options.files - Files to search (default: MEMORY.md, DEVLOG.md, CHANGELOG.md, TODO.md)
 * @param {number} options.maxResults - Max results per file (default: 5)
 * @param {number} options.contextLines - Lines of context around match (default: 3)
 * @param {string} options.workspaceRoot - Workspace root path
 * @returns {Promise<object>} Search results with formatted context
 */
async function searchContext(query, options = {}) {
  if (!query || typeof query !== 'string') {
    throw new Error('Query is required and must be a string');
  }

  const files = options.files || DEFAULT_MEMORY_FILES;
  const maxResults = options.maxResults || 5;
  const contextLines = options.contextLines || 3;
  const workspaceRoot = options.workspaceRoot || WORKSPACE_ROOT;

  const results = {
    query: query.trim(),
    timestamp: new Date().toISOString(),
    matches: [],
    summary: {
      total_matches: 0,
      files_searched: 0,
      prior_attempts: 0,
      failures: 0,
      successes: 0
    }
  };

  for (const file of files) {
    const filePath = path.join(workspaceRoot, file);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const fileMatches = await searchFile(content, query, {
        maxResults,
        contextLines,
        fileName: file
      });

      if (fileMatches.length > 0) {
        results.matches.push(...fileMatches);
        results.summary.files_searched++;
        results.summary.total_matches += fileMatches.length;
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // File doesn't exist, skip it
        console.warn(`Warning: Could not read ${file}: ${err.message}`);
      }
    }
  }

  // Analyze matches for patterns
  analyzePatterns(results);

  return results;
}

/**
 * Search a single file for matches
 * @param {string} content - File content
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {Promise<object[]>} Array of matches
 */
async function searchFile(content, query, options) {
  const lines = content.split('\n');
  const matches = [];
  const queryLower = query.toLowerCase();
  const keywords = extractKeywords(query);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    // Simple relevance scoring
    let score = 0;
    if (lineLower.includes(queryLower)) {
      score += 10; // Exact phrase match
    }
    keywords.forEach(keyword => {
      if (lineLower.includes(keyword)) {
        score += 2; // Keyword match
      }
    });

    if (score > 0) {
      const startLine = Math.max(0, i - options.contextLines);
      const endLine = Math.min(lines.length - 1, i + options.contextLines);
      const context = lines.slice(startLine, endLine + 1).join('\n');

      matches.push({
        file: options.fileName,
        line: i + 1,
        score,
        match_line: line.trim(),
        context: context.trim()
      });

      if (matches.length >= options.maxResults) {
        break;
      }
    }
  }

  // Sort by score (highest first)
  matches.sort((a, b) => b.score - a.score);

  return matches;
}

/**
 * Extract keywords from query
 * @param {string} query - Search query
 * @returns {string[]} Keywords
 */
function extractKeywords(query) {
  // Remove common words and split
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been'];
  
  return query
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ') // Remove punctuation except hyphens
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word));
}

/**
 * Analyze matches for patterns (failures, successes, etc.)
 * @param {object} results - Search results object (mutated)
 */
function analyzePatterns(results) {
  for (const match of results.matches) {
    const text = (match.match_line + ' ' + match.context).toLowerCase();

    // Detect prior attempts
    if (text.includes('build') || text.includes('implement') || text.includes('create')) {
      results.summary.prior_attempts++;
    }

    // Detect failures
    if (text.includes('fail') || text.includes('error') || text.includes('bug') || 
        text.includes('broke') || text.includes('issue') || text.includes('problem')) {
      results.summary.failures++;
    }

    // Detect successes
    if (text.includes('complete') || text.includes('success') || text.includes('ship') ||
        text.includes('✅') || text.includes('done')) {
      results.summary.successes++;
    }
  }
}

/**
 * Format search results for display
 * @param {object} results - Search results from searchContext
 * @param {object} options - Formatting options
 * @param {boolean} options.compact - Compact output (default: false)
 * @param {boolean} options.includeContext - Include context snippets (default: true)
 * @returns {string} Formatted output
 */
function formatResults(results, options = {}) {
  const compact = options.compact || false;
  const includeContext = options.includeContext !== undefined ? options.includeContext : true;

  let output = [];

  // Header
  output.push('# Memory Oracle Results');
  output.push('');
  output.push(`**Query:** ${results.query}`);
  output.push(`**Timestamp:** ${results.timestamp}`);
  output.push('');

  // Summary
  output.push('## Summary');
  output.push(`- **Total Matches:** ${results.summary.total_matches}`);
  output.push(`- **Files Searched:** ${results.summary.files_searched}`);
  output.push(`- **Prior Attempts:** ${results.summary.prior_attempts}`);
  output.push(`- **Failures:** ${results.summary.failures}`);
  output.push(`- **Successes:** ${results.summary.successes}`);
  output.push('');

  if (results.matches.length === 0) {
    output.push('**No relevant context found.** This appears to be a new task.');
    return output.join('\n');
  }

  // Matches
  output.push('## Relevant Context');
  output.push('');

  for (const match of results.matches) {
    output.push(`### ${match.file}:${match.line} (score: ${match.score})`);
    
    if (compact) {
      output.push(`> ${match.match_line}`);
    } else {
      output.push('```');
      if (includeContext) {
        output.push(match.context);
      } else {
        output.push(match.match_line);
      }
      output.push('```');
    }
    output.push('');
  }

  return output.join('\n');
}

/**
 * Format search results as JSON
 * @param {object} results - Search results from searchContext
 * @returns {string} JSON string
 */
function formatJSON(results) {
  return JSON.stringify(results, null, 2);
}

/**
 * CLI entry point
 */
async function cli() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: atlas-memory-oracle <query> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --json                Output as JSON');
    console.log('  --compact             Compact output format');
    console.log('  --no-context          Hide context snippets');
    console.log('  --max-results=N       Max results per file (default: 5)');
    console.log('  --context-lines=N     Lines of context (default: 3)');
    console.log('');
    console.log('Examples:');
    console.log('  atlas-memory-oracle "Build X feature"');
    console.log('  atlas-memory-oracle "testing strategy" --compact');
    console.log('  atlas-memory-oracle "CI/CD" --json');
    process.exit(0);
  }

  const query = args[0];
  const jsonOutput = args.includes('--json');
  const compact = args.includes('--compact');
  const includeContext = !args.includes('--no-context');
  const maxResults = parseInt(args.find(a => a.startsWith('--max-results='))?.split('=')[1]) || 5;
  const contextLines = parseInt(args.find(a => a.startsWith('--context-lines='))?.split('=')[1]) || 3;

  try {
    const results = await searchContext(query, { maxResults, contextLines });

    if (jsonOutput) {
      console.log(formatJSON(results));
    } else {
      console.log(formatResults(results, { compact, includeContext }));
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
  searchContext,
  formatResults,
  formatJSON,
  extractKeywords,
  DEFAULT_MEMORY_FILES
};
