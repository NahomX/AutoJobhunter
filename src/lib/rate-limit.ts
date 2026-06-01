/**
 * Client-side soft daily rate limit (Contract — shared).
 *
 * PRD: 4 questions per guest per day, per device, resets at LOCAL midnight.
 * Trust-based. No server state, no database, no auth. localStorage only.
 *
 * This module is the SINGLE SOURCE OF TRUTH for the cap. The frontend imports
 * the functions; the /api/chat route imports only OUT_OF_QUOTA_MESSAGE (a pure
 * string constant) for its defensive fallback. The localStorage-touching
 * functions are guarded for SSR so this module is safe to import on the server.
 *
 * Canonical import path: @/lib/rate-limit
 */

/** Maximum questions a guest may ask per local day. */
export const MAX_QUESTIONS_PER_DAY = 4;

/** localStorage key holding `${YYYY-MM-DD}:${count}` for the current local day. */
const STORAGE_KEY = "concierge.questions";

/**
 * Warm "you're out of questions for today" copy (PRD system-prompt persona).
 * Pure string — importable on both client and server.
 */
export const OUT_OF_QUOTA_MESSAGE =
  "You've used all of today's questions — I want to keep this useful for every guest, " +
  "so the concierge resets at midnight. In the meantime, the guide above has the grocery, " +
  "food, beach, and getting-around picks for the neighborhood. Come back tomorrow and ask away! 🌙";

/** Local calendar day as YYYY-MM-DD (NOT UTC — resets at the guest's local midnight). */
function localDayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Read today's used count, treating any stale (previous-day) record as 0. */
function readUsedToday(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const [day, countStr] = raw.split(":");
    if (day !== localDayKey()) return 0; // stale → new day, counter reset
    const count = Number.parseInt(countStr, 10);
    return Number.isFinite(count) && count > 0 ? count : 0;
  } catch {
    return 0; // localStorage unavailable (private mode etc.) — fail open, don't block.
  }
}

/** Persist today's used count. */
function writeUsedToday(count: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, `${localDayKey()}:${count}`);
  } catch {
    /* ignore — trust-based cap, never hard-fail on storage errors */
  }
}

/** Questions the guest has left today (0..MAX). */
export function getQuestionsRemaining(): number {
  return Math.max(0, MAX_QUESTIONS_PER_DAY - readUsedToday());
}

/** True when the guest still has at least one question today. */
export function canAsk(): boolean {
  return getQuestionsRemaining() > 0;
}

/**
 * Record one asked question and return the NEW remaining count.
 * Call this right after a question is successfully sent.
 */
export function recordQuestion(): number {
  const used = Math.min(MAX_QUESTIONS_PER_DAY, readUsedToday() + 1);
  writeUsedToday(used);
  return Math.max(0, MAX_QUESTIONS_PER_DAY - used);
}

/**
 * Give back one question and return the NEW remaining count. Call this when a
 * send that was optimistically recorded via recordQuestion() ultimately fails,
 * so a failed question never costs the guest a slot. Clamped at 0..MAX.
 */
export function refundQuestion(): number {
  const used = Math.max(0, readUsedToday() - 1);
  writeUsedToday(used);
  return Math.max(0, MAX_QUESTIONS_PER_DAY - used);
}
