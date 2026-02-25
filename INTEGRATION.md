# ATLAS Integration Contract

**Version:** 1.0  
**Last Updated:** 2026-02-24  
**Target:** Autonomous agents, AI systems, build automation

---

## Overview

ATLAS is a self-learning execution system that tracks tasks, retrieves memory context, and enables failure analysis. This document defines **how agents should integrate ATLAS** into their workflow.

---

## Mandatory vs. Optional

### Mandatory (Required for All Builds/Research/Synthesis Tasks)

✅ **Task tracking** - All tasks >30 minutes MUST use ATLAS tracker  
✅ **Memory search** - Check context BEFORE starting any task  
✅ **Outcome logging** - Mark success or failure WITH learning notes  

### Optional (Recommended but Not Required)

🔹 Progress updates during execution (`update` command)  
🔹 Metadata tagging (category, tags)  
🔹 Analytics review (`analyzeRecent`)  

---

## Standard Workflow

**Step 0: Memory Oracle (BEFORE starting)**
```bash
cd ~/.openclaw/workspace/atlas
node src/atlas-memory-oracle.js "task description" -n 10
```

**Purpose:** Avoid repeating mistakes, surface prior attempts, learn from failures.

**When to skip:** Never. Always check memory first.

---

**Step 1: Start Tracking**
```bash
TASK_ID=$(node src/atlas-tracker.js start "Task description" --category=build|research|synthesis --tags=tag1,tag2)
```

**Required fields:**
- `description` - What you're building/researching

**Optional but recommended:**
- `--category` - build, research, synthesis
- `--tags` - Comma-separated tags for grouping

**Output:** UUID (save this for later steps)

---

**Step 2-N: Execute Task**

During execution, optionally log progress:

```bash
node src/atlas-tracker.js update $TASK_ID --tools=exec,write,test --files=3 --notes="Progress update"
```

**When to update:**
- Significant progress (50% complete, major milestone)
- Tool changes (switched from manual to automated)
- Blockers encountered

**Frequency:** 1-3 updates per task (not every line of code)

---

**Step N+1: End Tracking**

**On success:**
```bash
node src/atlas-tracker.js end $TASK_ID --success --outcome="What was shipped (1-2 sentences)"
```

**On failure:**
```bash
node src/atlas-tracker.js end $TASK_ID --failure="Error message" --notes="What was learned"
```

**Required:**
- `--success` OR `--failure` (exactly one)
- `--outcome` (for success) OR `--failure` (for failure)

**Critical:** ALWAYS include learning notes on failure. This enables pattern detection.

---

## Workflow Helper (Fluent API)

**Recommended for programmatic integration:**

```javascript
const workflow = require('./src/workflow-helper');

// Start (memory oracle runs automatically)
const task = await workflow.startTask('Build X', {
  category: 'build',
  tags: ['feature', 'infrastructure']
});

// Check memory results
if (task.memory.failures > 0) {
  console.log('Warning: Prior failures detected');
  console.log(task.memory.matches.slice(0, 3)); // Review top 3
}

// Log progress
await task.log('tools', ['exec', 'write']);
await task.log('files', ['src/x.js', 'tests/x.test.js']);
await task.log('notes', 'Implemented core logic + tests');

// Complete
await task.complete({
  outcome: 'Feature X shipped with 90% test coverage',
  quality: 'complete'
});

// Or fail
await task.fail({
  reason: 'Dependency incompatibility (Node 18 vs 20)',
  notes: 'Need to add version matrix to CI',
  quality: 'incomplete'
});
```

---

## Integration Checklist

**Before you ship code that uses ATLAS:**

- [ ] Task tracking added (start/end)
- [ ] Memory oracle called before task start
- [ ] Success/failure logged with learning notes
- [ ] Tested with real task (validate execution log)
- [ ] Cron jobs updated (if applicable)
- [ ] Documentation updated (AGENTS.md, workflow guides)

---

## Cron Job Integration

**Pattern for automated tasks:**

```bash
#!/bin/bash
cd ~/.openclaw/workspace/atlas

# Start tracking
TASK_ID=$(node src/atlas-tracker.js start "Daily Build" --category=build --tags=daily,cron)

# Execute task
# ... your build logic here ...

# End tracking
if [ $? -eq 0 ]; then
  node src/atlas-tracker.js end $TASK_ID --success --outcome="Build complete"
else
  node src/atlas-tracker.js end $TASK_ID --failure="Build failed: $ERROR" --notes="$LEARNING"
fi
```

**Key points:**
- Wrap existing logic (don't rewrite)
- Capture exit codes
- Log failures with context

---

## Enforcement

**AGENTS.md protocol:**
- Step 0: Start ATLAS tracking
- Steps 1-6: Execute task
- Step 7: Complete ATLAS tracking

**Accountability metrics:**
- Tasks without ATLAS tracking **do not count** toward daily/weekly goals
- Failure analysis depends on complete logs
- Improvement recommendations blocked without tracking data

**Why enforce?** ATLAS only works with complete data. Partial tracking = no learning.

---

## Data Schema

**Execution log format** (JSONL):

```json
{
  "task_id": "uuid",
  "description": "string",
  "start_ts": "ISO8601",
  "end_ts": "ISO8601 | null",
  "duration_min": "number | null",
  "success": "boolean",
  "failure_reason": "string | null",
  "tools_used": ["string"],
  "files_modified": ["string"],
  "outcome_quality": "complete | incomplete | partial",
  "metadata": {},
  "schema_version": "1.0"
}
```

**Memory oracle output:**

```json
{
  "query": "string",
  "timestamp": "ISO8601",
  "summary": {
    "total_matches": "number",
    "files_searched": "number",
    "prior_attempts": "number",
    "failures": "number",
    "successes": "number"
  },
  "matches": [
    {
      "file": "string",
      "line": "number",
      "score": "number",
      "content": "string"
    }
  ]
}
```

---

## FAQ

**Q: Do I need to track every task?**  
A: Track tasks >30 minutes. Short debugging sessions (<10 min) are optional.

**Q: What if I forget to start tracking?**  
A: Start tracking mid-task. Better late than never. Mark outcome as "partial" if significant work was untracked.

**Q: Can I use ATLAS without memory oracle?**  
A: Yes, but you lose the primary benefit (avoiding repeated mistakes). Always check memory first.

**Q: What if memory oracle returns 0 matches?**  
A: Good! Proceed with task. This means it's genuinely new work.

**Q: How do I know if ATLAS is working?**  
A: Check `data/atlas_executions.jsonl` - should have entries after each task. Run `node src/atlas-tracker.js list` to see recent tasks.

**Q: Can I run ATLAS in parallel tasks?**  
A: Yes. Each task gets a unique UUID. Log file uses append-only writes (safe for concurrent access).

---

## Examples

**Example 1: Daily research scan**

```bash
cd ~/.openclaw/workspace/atlas

# Check memory
node src/atlas-memory-oracle.js "agent systems papers" -n 5

# Start tracking
TASK_ID=$(node src/atlas-tracker.js start "Daily Research Scan" --category=research --tags=arxiv,daily)

# Execute research
# ... search arXiv, read papers, add to TODO ...

# End tracking
node src/atlas-tracker.js end $TASK_ID --success --outcome="Found 3 papers, 1 actionable (PCAS policy engine)"
```

**Example 2: Build with failure**

```bash
cd ~/.openclaw/workspace/atlas

# Memory check
node src/atlas-memory-oracle.js "CI/CD setup" -n 10

# Start tracking
TASK_ID=$(node src/atlas-tracker.js start "Build CI/CD Pipeline" --category=build --tags=infrastructure,ci)

# Execute (fails)
npm test  # Exits with code 1

# End tracking with failure
node src/atlas-tracker.js end $TASK_ID --failure="Coverage below 60% threshold (55% actual)" --notes="Need to add tests for error handling in tracker.js"
```

**Example 3: Programmatic (workflow helper)**

See [examples/integrated-workflow.sh](examples/integrated-workflow.sh) for full demo.

---

## Support

**Issues:** https://github.com/Haythos/atlas/issues  
**Discussions:** https://github.com/Haythos/atlas/discussions  
**X/Twitter:** [@Haythos](https://x.com/Haythos)  

---

**Integration contract version:** 1.0  
**ATLAS version:** 0.1.0-alpha  
**Last updated:** 2026-02-24
