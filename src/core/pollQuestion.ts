/** Parses "8pm", "8:30 pm", "8.30pm", "20:00", "midnight", "noon" into minutes after midnight. */
export function parseTime(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, "");
  if (s === "midnight") return 0;
  if (s === "noon") return 12 * 60;

  const ampm = s.match(/^(\d{1,2})(?:[:.](\d{2}))?(am|pm)$/);
  if (ampm) {
    const h = Number(ampm[1]);
    const m = Number(ampm[2] ?? 0);
    if (h < 1 || h > 12 || m > 59) return null;
    return ((h % 12) + (ampm[3] === "pm" ? 12 : 0)) * 60 + m;
  }

  const h24 = s.match(/^(\d{1,2})[:.](\d{2})$/);
  if (h24) {
    const h = Number(h24[1]);
    const m = Number(h24[2]);
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
  }
  return null;
}

/** 0 → "midnight", 720 → "noon", 1230 → "8:30 PM". */
export function formatTime(minutes: number): string {
  if (minutes === 0) return "midnight";
  if (minutes === 12 * 60) return "noon";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

/** "🏐 Volleyball, Wed 28 Oct at 8 PM: are you in?" (time part only when given). */
export function defaultPollQuestion(now: Date, timeZone: string, minutes?: number): string {
  const date = now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone });
  const at = minutes === undefined ? "" : ` at ${formatTime(minutes)}`;
  return `🏐 Volleyball, ${date}${at}: are you in?`;
}

/**
 * `/poll` argument → poll question. Empty → default question; a time ("8pm") → default question with
 * that time; anything else is used as a custom question.
 */
export function pollQuestionFromArg(arg: string, now: Date, timeZone: string): string {
  const text = arg.trim();
  if (!text) return defaultPollQuestion(now, timeZone);
  const minutes = parseTime(text);
  return minutes === null ? text : defaultPollQuestion(now, timeZone, minutes);
}
