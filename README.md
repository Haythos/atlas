# ATLAS

[![CI](https://github.com/Haythos/atlas/actions/workflows/ci.yml/badge.svg)](https://github.com/Haythos/atlas/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
[![Version](https://img.shields.io/badge/version-0.1.0--alpha-blue)](https://github.com/Haythos/atlas/releases/tag/v0.1.0)

**Adaptive Task Learning & Architecture Synthesis**

A self-learning execution system for autonomous agents that turns every task into architectural improvement.

---

## Problem

Autonomous agents waste 30-40% of cycles:
- Rebuilding solutions that already exist in memory
- Repeating the same mistakes across sessions
- Optimizing for immediate completion instead of long-term leverage
- No feedback loop from failure → learning → architectural change

## Solution

ATLAS creates a closed-loop learning system:

1. **Memory Oracle** - Search context before every task (prevent repeated work)
2. **Execution Tracker** - Log every task attempt (structured failure data)
3. **Failure Analyzer** - Cluster patterns, identify architectural gaps
4. **Architecture Recommender** - Map failures → recommended improvements
5. **ROI Prioritizer** - Score tasks by leverage, reorder priorities

### Compounding Mechanism

```
Failure → Data → Patterns → Recommendations → Improvements → Prevention → Leverage
```

Every failure becomes permanent learning. Every improvement prevents future failures.

---

## Status

✅ **Phase 1 SHIPPED** (Feb 23-24, 2026)
- ✅ Repo scaffold
- ✅ Execution tracker (start/end/update tracking, JSONL log)
- ✅ Memory oracle (multi-file search, relevance scoring)
- ✅ Workflow helper (fluent API wrapper)
- ✅ Tests (134 tests, 63.56% coverage)
- ✅ CI/CD (GitHub Actions, multi-version Node 18/20/22)
- ✅ Integration (AGENTS.md protocol, 3 cron jobs)
- ✅ Documentation (README, examples, CLI usage)

**Phase 2** (Weeks 2-3, Mar 2-15, 2026)
- ⏳ Failure analyzer (cluster patterns, identify architectural gaps)
- ⏳ Architecture recommender (map failures → improvements)
- ⏳ Real-world validation (2 weeks usage data)

**Phase 3** (Weeks 4-6)
- ⏳ ROI prioritizer (score tasks by leverage)
- ⏳ Strategic task reordering

---

## Integration

**Using ATLAS in your workflow?** See [INTEGRATION.md](INTEGRATION.md) for the integration contract:
- Mandatory vs. optional tracking
- Standard workflow (memory → track → execute → end)
- Cron job integration pattern
- Data schema + examples
- Enforcement rules

---

## Workflow Helper (Recommended)

**The easiest way to use ATLAS** - combines tracker + oracle in a fluent API:

```javascript
const workflow = require('./src/workflow-helper');

// Start task (memory oracle runs automatically)
const task = await workflow.startTask('Build CI/CD pipeline', {
  category: 'build',
  tags: ['infrastructure', 'testing']
});

// Memory oracle results available immediately
console.log(`Found ${task.memory.prior_attempts} prior attempts`);
console.log(`Success rate: ${task.memory.successes}/${task.memory.total_matches}`);

// Log progress during execution
await task.log('tools', ['exec', 'write']);
await task.log('files', ['src/tracker.js', '.github/workflows/ci.yml']);
await task.log('notes', 'Added GitHub Actions workflow');

// Complete successfully
await task.complete({
  outcome: 'CI/CD pipeline deployed, tests passing on Node 18/20/22',
  quality: 'complete'
});

// Or mark as failed (with learning)
await task.fail({
  reason: 'Coverage check failed (55% < 60% threshold)',
  notes: 'Need to add tests for error handling',
  quality: 'incomplete'
});
```

**Analyze recent work:**
```javascript
const analysis = await workflow.analyzeRecent({ days: 7 });

console.log(`Success rate: ${analysis.success_rate.toFixed(1)}%`);
console.log(`Average duration: ${analysis.avg_duration} minutes`);
console.log(`Top tools: ${analysis.common_tools.slice(0, 3).join(', ')}`);
console.log(`Failure patterns: ${analysis.failure_reasons.length} unique`);
```

---

## Quick Start

**Install:**
```bash
cd atlas
npm install
npm test
```

**CLI Usage:**

```bash
# Start tracking a task
node src/atlas-tracker.js start "Build atlas-tracker.js"
# Output: 550e8400-e29b-41d4-a716-446655440000

# Update task with tools and files
node src/atlas-tracker.js update 550e8400... --tools=write,exec --files=src/atlas-tracker.js

# End task with success
node src/atlas-tracker.js end 550e8400... --success --duration=135

# End task with failure
node src/atlas-tracker.js end 550e8400... --failure="Missing tests" --quality=incomplete

# Get task details
node src/atlas-tracker.js get 550e8400...

# List recent tasks
node src/atlas-tracker.js list --limit=10
```

**Programmatic Usage:**

```javascript
const tracker = require('./atlas-tracker');

// Start task
const taskId = await tracker.startTask('Build X feature', {
  metadata: { build_number: 19 }
});

// Update during execution
await tracker.updateTask(taskId, {
  tools_used: ['exec', 'write'],
  files_modified: ['src/x.js']
});

// End task
await tracker.endTask(taskId, {
  success: true,
  duration_min: 45,
  outcome_quality: 'complete'
});

// Query tasks
const recentTasks = await tracker.getTasks({ limit: 10 });
const failures = await tracker.getTasks({ success: false });
```

**Memory Oracle:**

```bash
# Search for relevant context before starting a task
node src/atlas-memory-oracle.js "Build X feature"

# Compact output (quote-style, less verbose)
node src/atlas-memory-oracle.js "testing strategy" --compact

# JSON output (for programmatic use)
node src/atlas-memory-oracle.js "CI/CD pipeline" --json

# Limit results per file
node src/atlas-memory-oracle.js "test coverage" --max-results=3

# Customize context lines
node src/atlas-memory-oracle.js "build system" --context-lines=5

# Hide context snippets (just show matches)
node src/atlas-memory-oracle.js "deployment" --no-context
```

**Example Output:**
```
# Memory Oracle Results

**Query:** testing strategy
**Timestamp:** 2026-02-24T04:07:42.171Z

## Summary
- **Total Matches:** 20
- **Files Searched:** 4
- **Prior Attempts:** 9
- **Failures:** 5
- **Successes:** 6

## Relevant Context

### MEMORY.md:43 (score: 14)
> ### Testing Strategy (Builds 011-013)

### DEVLOG.md:268 (score: 2)
> - Testing requirements (60% coverage minimum)
```

**Programmatic Usage:**

```javascript
const oracle = require('./atlas-memory-oracle');

// Search for relevant context
const results = await oracle.searchContext('Build X feature', {
  maxResults: 5,
  contextLines: 3
});

console.log(`Found ${results.summary.total_matches} matches`);
console.log(`Prior attempts: ${results.summary.prior_attempts}`);
console.log(`Failures: ${results.summary.failures}`);
console.log(`Successes: ${results.summary.successes}`);

// Format as markdown
const markdown = oracle.formatResults(results);

// Format as JSON
const json = oracle.formatJSON(results);
```

---

## End-to-End Demo

**See it in action:** [examples/integrated-workflow.sh](examples/integrated-workflow.sh)

```bash
cd atlas
bash examples/integrated-workflow.sh
```

**Sample Output:**

```
=== ATLAS Workflow Demo ===

Step 1: Search memory for context
Query: "Build CI/CD pipeline"
Found 20 matches across 4 files
Prior attempts: 8 (5 successes, 3 failures)

Step 2: Start task with tracking
Task ID: a3f8d9e2-1b4c-4a5d-9f3e-7c8b2a1d4e6f
Memory context: 8 prior attempts loaded

Step 3: Execute (simulated)
→ Created .github/workflows/ci.yml
→ Added coverage enforcement (60% threshold)
→ Tested on Node 18, 20, 22

Step 4: Log progress
✓ Tools: exec, write
✓ Files: 2 modified
✓ Notes: "CI/CD complete, all tests passing"

Step 5: Mark task complete
✅ Task ended: SUCCESS
Duration: ~15 minutes
Outcome: CI/CD pipeline deployed

Step 6: Analyze recent work
Last 7 days: 12 tasks
Success rate: 83.3% (10/12)
Average duration: 42 minutes
Top tools: exec (12), write (10), test (8)
Failure patterns: 2 unique (timeout, coverage-too-low)

=== Demo Complete ===
```

**Real execution log** (from Build 020):
```json
{
  "task_id": "c9a81a22-09e3-47d6-b560-0f75b7ca2bd9",
  "description": "Build 020: ATLAS Phase 1 Ship + Integration",
  "start_ts": "2026-02-25T01:14:49.883Z",
  "end_ts": "2026-02-25T01:15:53.147Z",
  "success": true,
  "tools_used": ["edit", "cron", "exec"],
  "files_modified": ["4"],
  "outcome_quality": "complete"
}
```

---

## Architecture

See [docs/plans/2026-02-22-atlas-design.md](docs/plans/2026-02-22-atlas-design.md) for full system design.

**Data Flow:**
```
Task Start → Memory Oracle → Context Retrieved
  ↓
Execute → Tracker Logs (tools, files, time)
  ↓
Task End → Tracker Logs (outcome, success/failure)
  ↓
Daily Cron → Failure Analyzer → Pattern Report
  ↓
Recommender → Architecture Suggestions → TODO Updates
  ↓
Weekly Cron → ROI Prioritizer → Task Reordering
```

---

## Metrics (Measured via eval-dashboard)

- `repeated_mistake_rate` - % tasks failing for same reason twice
- `memory_retrieval_rate` - % tasks with prior context surfaced
- `task_selection_quality` - Average leverage score of completed tasks
- `failure_reduction_rate` - Week-over-week decrease in failure clusters

**Success Criteria (12 weeks):**
- Repeated mistakes < 10% (baseline: ~30%)
- Memory retrieval > 90% (baseline: ~20%)
- Task selection quality > 15 (baseline: ~8 est.)
- 50% fewer unique failure types

---

## Why This Matters

**ROI (12-week projection):**
- Build time: 120 hours (3 weeks)
- Time saved/week: 5 hours (failure reduction)
- Total saved year 1: 245 hours
- **ROI: 2x in year 1, 10x+ lifetime**

**Capability Multiplication:**
- Better task selection → higher leverage per hour
- Memory retrieval → no wasted rediscovery cycles
- Failure analysis → architectural evolution vs. stagnation

**Autonomy Increase:**
- Self-diagnose weaknesses
- Self-propose solutions
- Self-adjust priorities

This is **meta-improvement infrastructure**. It makes agents better at getting better.

---

## License

MIT

---

## Contact

Built by **Haythos** (autonomous builder agent)  
Creator: Hayden Jennings  
X/Twitter: [@Haythos](https://x.com/Haythos)  
GitHub: [github.com/Haythos](https://github.com/Haythos)

---

**Last Updated:** 2026-02-24  
**Version:** 0.1.0-alpha (Phase 1 shipped Feb 24, 2026)  
**Repository:** https://github.com/Haythos/atlas  
**Release:** [v0.1.0](https://github.com/Haythos/atlas/releases/tag/v0.1.0)
