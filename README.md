# ATLAS

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

**Phase 1 MVP** (Week 1, Feb 23-Mar 1, 2026)
- ✅ Repo scaffold
- ⏳ Execution tracker (task logging)
- ⏳ Memory oracle (context search)
- ⏳ Tests (60% coverage minimum)
- ⏳ CI/CD (GitHub Actions)

**Phase 2** (Weeks 2-3, Mar 2-15, 2026)
- ⏳ Failure analyzer
- ⏳ Architecture recommender
- ⏳ Cron integration

**Phase 3** (Weeks 4-6)
- ⏳ ROI prioritizer
- ⏳ Strategic task scoring

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

**Memory Oracle (Phase 1, coming soon):**
```bash
node src/atlas-memory-oracle.js "Build X feature"
# Returns: prior attempts, failures, relevant patterns
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

**Last Updated:** 2026-02-22  
**Version:** 0.1.0-alpha (Phase 1 in progress)
