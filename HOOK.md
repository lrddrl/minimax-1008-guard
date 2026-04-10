---
name: minimax-1008-guard
description: "Intercepts MiniMax 1008 billing errors (often context overflow), notifies the user, auto-compacts the session, and prevents gateway hangs. Solves openclaw issue #24622."
metadata:
  {
    "openclaw": {
      "emoji": "🦞",
      "events": ["session:patch", "agent:bootstrap"],
      "requires": { "bins": ["node"] },
      "install": [
        { "id": "bundled", "kind": "bundled", "label": "Bundled with OpenClaw" },
        { "id": "npm", "kind": "hook-pack", "label": "@lrddrl/minimax-1008-guard" }
      ]
    }
  }
---

# MiniMax 1008 Guard

> Hooks into MiniMax's `insufficient balance (1008)` errors — the ones that actually mean "context window exceeded", not "you owe money". Auto-recovers so your gateway never hangs.

## The Problem

MiniMax returns HTTP 500 with `{"type":"error","error":{"type":"api_error","message":"insufficient balance (1008)"}}` in **two very different situations**:

1. **True billing error** — account has no credits (rare with their token-plan)
2. **Context overflow** — request exceeded the model's context window (20M tokens for M2.7) (very common in long conversations)

OpenClaw treats both the same way: a fatal billing error that causes the gateway to hang indefinitely, requiring manual SIGTERM to restart.

This affects **every long-running OpenClaw session** using MiniMax, not just users with empty accounts.

See: [openclaw issue #24622](https://github.com/openclaw/openclaw/issues/24622)

## What This Hook Does

1. **Detects** the 1008 error via `session:patch` events (`stopReason=error` + billing message in `errorMessage`)
2. **Notifies** both the frontend (chat channel) and backend (gateway logs) with a clear explanation
3. **Checks** whether context utilisation is ≥ 85% of the model's window
4. **Auto-compacts** the session via `/compact` if context is high (auto-recovery)
5. **Falls back** to `/new` if context is not high (likely true billing issue)
6. **Never throws** — keeps the gateway loop alive, no manual restart needed

## Installation

### Option A: npm hook pack (recommended)

```bash
openclaw plugins install @lrddrl/minimax-1008-guard
openclaw gateway restart
```

### Option B: Clone and install locally

```bash
git clone https://github.com/lrddrl/minimax-1008-guard.git
openclaw plugins install ./minimax-1008-guard
openclaw gateway restart
```

## Configuration

Add to `openclaw.json` under `hooks.internal.entries`:

```json
{
  "minimax-1008-guard": {
    "enabled": true,
    "contextThresholdPct": 85,
    "autoAction": "compact"
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `contextThresholdPct` | number | 85 | Compact when context exceeds this % of the model window |
| `autoAction` | string | `"compact"` | `"compact"` (auto-recover via /compact) or `"new"` (start fresh session) |

## How It Works

```
User sends long conversation
  → MiniMax returns 1008 "insufficient balance"
    → Hook catches it in session:patch event
      → Calculates context utilisation
        → If context overflow (≥85%): /compact auto-triggered
        → If true billing issue: user notified to check MiniMax console
  → Gateway stays alive ✅
```

## Requirements

- **OpenClaw** (any recent version)
- **Node.js** ≥ 18
- MiniMax as your LLM provider

## Author

**lrddrl** — [GitHub](https://github.com/lrddrl)

For questions or issues, open a ticket at [github.com/lrddrl/minimax-1008-guard](https://github.com/lrddrl/minimax-1008-guard).
