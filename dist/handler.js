/**
 * minimax-1008-guard — OpenClaw internal hook
 *
 * MiniMax returns HTTP 500 {"type":"error","error":{"type":"api_error",
 * "message":"insufficient balance (1008)"}} both when the account has no
 * credits AND when the context window is exceeded.  OpenClaw currently
 * classifies this as a fatal billing error, which can cause the gateway to
 * hang (issue #24622).
 *
 * This hook:
 *  1. Detects the 1008 pattern on session:patch events
 *  2. Pushes a clear notification to the chat channel (front-end visible)
 *  3. Logs a structured warning to the gateway log (back-end visible)
 *  4. Checks context utilisation
 *  5. Issues /compact (or /new) so the session recovers automatically
 *  6. Never throws — keeps the gateway loop alive
 */
// ── helpers ──────────────────────────────────────────────────────────────────
function is1008Error(msg) {
    if (!msg)
        return false;
    return (msg.includes("1008") ||
        msg.toLowerCase().includes("insufficient balance") ||
        // openclaw wraps the raw error in its own billing message in some paths
        msg.toLowerCase().includes("billing error"));
}
function contextPct(sessionEntry) {
    if (!sessionEntry)
        return 0;
    const limit = sessionEntry.contextTokens ??
        sessionEntry.contextWindow ??
        0;
    const used = sessionEntry.currentContextTokens ??
        (sessionEntry.lastCallUsage?.input ?? 0);
    if (limit <= 0 || used <= 0)
        return 0;
    return Math.round((used / limit) * 100);
}
// ── main handler ─────────────────────────────────────────────────────────────
const handler = async (event) => {
    try {
        if (event.type !== "session" || event.action !== "patch")
            return;
        const patch = event.context?.patch;
        const sessionEntry = event.context?.sessionEntry;
        const message = patch?.message;
        const stopReason = message?.stopReason;
        const errorMessage = message?.errorMessage;
        const provider = message?.provider ?? "";
        const model = message?.model ?? "";
        if (stopReason !== "error")
            return;
        if (!is1008Error(errorMessage))
            return;
        // Read optional config
        const cfg = event.context?.cfg;
        const hookCfg = cfg?.hooks?.internal?.entries;
        const myConf = hookCfg?.["minimax-1008-guard"] ?? {};
        const thresholdPct = myConf.contextThresholdPct ?? 85;
        const autoAction = myConf.autoAction ?? "compact";
        // Compute context utilisation
        const pct = contextPct(sessionEntry);
        const isContextOverflow = pct >= thresholdPct;
        const providerLabel = provider
            ? `${provider}/${model}`.replace(/\/$/, "")
            : model || "MiniMax";
        // Back-end log
        console.warn(`[minimax-1008-guard] ⚠️  Caught 1008 error from ${providerLabel}` +
            ` | context ${pct > 0 ? pct + "%" : "unknown"}` +
            ` | isContextOverflow=${isContextOverflow}` +
            ` | sessionKey=${event.sessionKey}` +
            ` | rawError="${errorMessage}"`);
        // Front-end notification
        const contextNote = pct > 0
            ? `当前上下文使用率约 **${pct}%**。`
            : "无法读取当前上下文使用率。";
        const actionNote = isContextOverflow
            ? autoAction === "compact"
                ? "上下文已超阈值，正在自动执行 `/compact` 压缩历史记录…"
                : "上下文已超阈值，正在自动开启新会话 `/new`…"
            : "上下文使用率未超阈值，可能是账户余额不足，请检查 MiniMax 控制台。若余额充足，请手动执行 `/compact`。";
        event.messages.push(`⚠️ **MiniMax 返回了 1008 错误**（insufficient balance）\n\n` +
            `这通常不是真的欠费，而是本次请求的 token 数量超过了模型上下文窗口限制。\n\n` +
            `${contextNote}\n\n` +
            `${actionNote}\n\n` +
            `_Provider: \`${providerLabel}\` | Raw: \`${errorMessage ?? "1008"}\`_`);
        // Auto-recover
        if (isContextOverflow) {
            await new Promise((r) => setTimeout(r, 800));
            if (autoAction === "compact") {
                event.messages.push("/compact");
            }
            else {
                event.messages.push("/new");
            }
            console.log(`[minimax-1008-guard] ✅ Triggered auto-${autoAction} for session ${event.sessionKey}`);
        }
    }
    catch (err) {
        console.error("[minimax-1008-guard] Hook error (non-fatal):", err);
    }
};
export default handler;
