# ATLAS Execution Log Schema

## Overview

ATLAS uses JSONL (JSON Lines) format for execution logs. Each line is a complete JSON object representing one task execution.

**File:** `data/atlas_executions.jsonl`

---

## Schema v1.0

```json
{
  "task_id": "string (UUID v4)",
  "description": "string (task description in natural language)",
  "start_ts": "string (ISO 8601 timestamp with timezone)",
  "end_ts": "string (ISO 8601 timestamp with timezone, null if not ended)",
  "duration_min": "number (minutes, calculated from start_ts to end_ts)",
  "success": "boolean (true if task completed successfully)",
  "failure_reason": "string (why task failed, null if success=true)",
  "tools_used": "array of strings (OpenClaw tool names: exec, write, read, etc.)",
  "files_modified": "array of strings (file paths modified during task)",
  "outcome_quality": "string enum (complete|incomplete|partial|abandoned)",
  "metadata": "object (flexible JSON for additional context)",
  "schema_version": "string (schema version, currently '1.0')"
}
```

---

## Field Definitions

### Required Fields

**task_id** (`string`)
- UUID v4 format
- Generated automatically on task start
- Unique identifier for task tracking

**description** (`string`)
- Natural language description of task
- Should be concise but specific
- Example: "Build atlas-tracker.js with 30 unit tests"

**start_ts** (`string`)
- ISO 8601 timestamp with timezone
- Example: `"2026-02-22T19:30:00-06:00"`
- Generated automatically on task start

**schema_version** (`string`)
- Currently `"1.0"`
- Allows schema evolution without breaking old logs

### Optional Fields (Present After Task End)

**end_ts** (`string | null`)
- ISO 8601 timestamp with timezone
- `null` if task not yet ended
- Set automatically when task ends

**duration_min** (`number | null`)
- Task duration in minutes (decimal precision)
- Calculated as `(end_ts - start_ts) / 60000`
- `null` if task not yet ended

**success** (`boolean`)
- `true` if task completed successfully
- `false` if task failed or was abandoned
- Default: `false`

**failure_reason** (`string | null`)
- Why task failed (if `success=false`)
- Should be specific and actionable
- Examples: "Missing tests, broke CI", "API rate limited", "Incorrect approach"
- `null` if `success=true`

**tools_used** (`array<string>`)
- OpenClaw tools invoked during task
- Examples: `["exec", "write", "edit"]`, `["memory_search", "read"]`
- Empty array if no tools tracked

**files_modified** (`array<string>`)
- File paths modified during task
- Relative to workspace root
- Example: `["tools/atlas-tracker.js", "__tests__/tracker.test.js"]`
- Empty array if no files tracked

**outcome_quality** (`enum`)
- `"complete"` - Task fully finished as intended
- `"incomplete"` - Task partially done, more work needed
- `"partial"` - Some goals achieved, some not
- `"abandoned"` - Task stopped without meaningful progress

**metadata** (`object`)
- Flexible JSON for additional context
- No fixed schema
- Examples:
  ```json
  {
    "build_number": 19,
    "test_coverage": 65,
    "lines_of_code": 458,
    "dependencies_added": ["uuid"],
    "git_commit": "a1b2c3d"
  }
  ```

---

## Example Logs

### Successful Task
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "description": "Build atlas-tracker.js with 30 unit tests",
  "start_ts": "2026-02-22T19:30:00-06:00",
  "end_ts": "2026-02-22T21:45:00-06:00",
  "duration_min": 135,
  "success": true,
  "failure_reason": null,
  "tools_used": ["write", "exec", "edit"],
  "files_modified": ["src/atlas-tracker.js", "__tests__/tracker.test.js"],
  "outcome_quality": "complete",
  "metadata": {
    "test_coverage": 72,
    "lines_of_code": 245
  },
  "schema_version": "1.0"
}
```

### Failed Task
```json
{
  "task_id": "660e8400-e29b-41d4-a716-446655440001",
  "description": "Deploy to production without testing",
  "start_ts": "2026-02-23T10:00:00-06:00",
  "end_ts": "2026-02-23T10:15:00-06:00",
  "duration_min": 15,
  "success": false,
  "failure_reason": "CI pipeline failed: missing tests, coverage below 60%",
  "tools_used": ["exec"],
  "files_modified": [],
  "outcome_quality": "abandoned",
  "metadata": {
    "ci_error": "Coverage 45%, threshold 60%"
  },
  "schema_version": "1.0"
}
```

### In-Progress Task
```json
{
  "task_id": "770e8400-e29b-41d4-a716-446655440002",
  "description": "Research AdaptOrch multi-agent topology",
  "start_ts": "2026-02-23T14:00:00-06:00",
  "end_ts": null,
  "duration_min": null,
  "success": false,
  "failure_reason": null,
  "tools_used": [],
  "files_modified": [],
  "outcome_quality": "incomplete",
  "metadata": {},
  "schema_version": "1.0"
}
```

---

## File Format

**JSONL (JSON Lines):**
- One JSON object per line
- No commas between objects
- Each line is valid JSON
- Append-only (never modify existing lines)

**Example file:**
```
{"task_id":"550e8400-e29b-41d4-a716-446655440000","description":"Build tracker","start_ts":"2026-02-22T19:30:00-06:00",...}
{"task_id":"660e8400-e29b-41d4-a716-446655440001","description":"Deploy","start_ts":"2026-02-23T10:00:00-06:00",...}
```

**Why JSONL:**
- Simple append (no array parsing)
- Streaming-friendly (read line-by-line)
- Fault-tolerant (corrupted line doesn't break entire file)
- Standard format (widely supported)

---

## Schema Evolution

**Version 2.0 (future):**
- Backward compatible (all v1.0 fields preserved)
- New fields added (e.g., `cost_usd`, `model_used`)
- Old logs still readable

**Migration strategy:**
- No migration needed (JSONL supports mixed versions)
- New fields default to `null` when reading old logs
- `schema_version` field enables version detection

---

**Last Updated:** 2026-02-22  
**Version:** 1.0
