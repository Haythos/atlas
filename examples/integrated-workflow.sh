#!/bin/bash
# ATLAS Integrated Workflow Example
# Demonstrates using Memory Oracle + Execution Tracker together

set -e

ATLAS_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ORACLE="$ATLAS_ROOT/src/atlas-memory-oracle.js"
TRACKER="$ATLAS_ROOT/src/atlas-tracker.js"

echo "==================================="
echo "ATLAS Integrated Workflow Demo"
echo "==================================="
echo ""

# Step 1: Define the task
TASK_DESCRIPTION="Build CI/CD pipeline"

echo "📋 Task: $TASK_DESCRIPTION"
echo ""

# Step 2: Search memory for relevant context
echo "🔍 Step 1: Searching memory for prior context..."
echo ""
node "$ORACLE" "$TASK_DESCRIPTION" --compact
echo ""
echo "-----------------------------------"
echo ""

# Step 3: Start tracking execution
echo "📊 Step 2: Starting execution tracking..."
TASK_ID=$(node "$TRACKER" start "$TASK_DESCRIPTION")
echo "   Task ID: $TASK_ID"
echo ""

# Step 4: Simulate work
echo "⚙️  Step 3: Executing task..."
echo "   - Installing dependencies..."
sleep 1
node "$TRACKER" update "$TASK_ID" --tools=exec

echo "   - Writing configuration files..."
sleep 1
node "$TRACKER" update "$TASK_ID" --tools=write --files=.github/workflows/ci.yml

echo "   - Running tests..."
sleep 1
node "$TRACKER" update "$TASK_ID" --tools=exec

echo ""
echo "-----------------------------------"
echo ""

# Step 5: End tracking with outcome
echo "✅ Step 4: Task completed successfully!"
node "$TRACKER" end "$TASK_ID" --success --quality=complete
echo ""

# Step 6: View the logged execution
echo "📖 Step 5: Execution log:"
echo ""
node "$TRACKER" get "$TASK_ID"
echo ""

echo "==================================="
echo "Workflow complete!"
echo ""
echo "Key points:"
echo "1. Memory oracle prevented rediscovering prior work"
echo "2. Execution tracker logged all activities"
echo "3. Future tasks can learn from this execution"
echo "==================================="
