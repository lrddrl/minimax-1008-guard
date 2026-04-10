# minimax-1008-guard

**Author: [lrddrl](https://github.com/lrddrl)**

OpenClaw hook that intercepts MiniMax `insufficient balance (1008)` errors — the ones that usually mean "context window exceeded", not "you're out of money". Auto-compacts the session and prevents gateway hangs.

## The Problem

MiniMax returns HTTP 500 `insufficient balance (1008)` both when:
- Your account has no credits (true billing error — rare)
- Your request exceeded the model's 20M token context window (very common in long conversations)

OpenClaw treats both the same: a fatal billing error that **hangs the gateway indefinitely**, requiring manual SIGTERM to restart. This affects every long-running OpenClaw + MiniMax session.

Related issues: [#24622](https://github.com/openclaw/openclaw/issues/24622), [#30484](https://github.com/openclaw/openclaw/issues/30484)

## Features

- 🦞 Detects 1008 errors via `session:patch` events
- 📊 Checks context utilisation before deciding action
- ⚡ Auto-compacts session via `/compact` (context overflow recovery)
- 💬 Clear Chinese + English notification to user
- 🔒 Never crashes the gateway — always keeps it alive

## Install

```bash
openclaw plugins install @lrddrl/minimax-1008-guard
openclaw gateway restart
```

## Config

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "minimax-1008-guard": {
          "enabled": true,
          "contextThresholdPct": 85,
          "autoAction": "compact"
        }
      }
    }
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `contextThresholdPct` | 85 | % of context window that triggers auto-compact |
| `autoAction` | `compact` | `compact` or `new` (start fresh session) |

## Requirements

- OpenClaw
- Node.js ≥ 18
- MiniMax as your LLM provider

## License

MIT

---

For the full story behind this hook, see [HOOK.md](HOOK.md).
