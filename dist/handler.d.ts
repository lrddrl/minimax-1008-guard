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
type HookHandler = (event: HookEvent) => Promise<void>;
interface HookEvent {
    type: string;
    action: string;
    sessionKey: string;
    timestamp: number;
    messages: string[];
    context?: HookContext;
}
interface HookContext {
    sessionEntry?: Record<string, unknown>;
    patch?: Record<string, unknown>;
    cfg?: Record<string, unknown>;
}
declare const handler: HookHandler;
export default handler;
