import { describe, expect, it } from "vitest";
import { formatTime, parseTime, pollQuestionFromArg } from "../src/core/pollQuestion.js";

describe("parseTime", () => {
  it.each([
    ["8pm", 20 * 60],
    ["8 PM", 20 * 60],
    ["8:30pm", 20 * 60 + 30],
    ["8.30pm", 20 * 60 + 30],
    ["12am", 0],
    ["12pm", 12 * 60],
    ["midnight", 0],
    ["noon", 12 * 60],
    ["20:00", 20 * 60],
    ["07:15", 7 * 60 + 15],
  ])("%s", (input, minutes) => expect(parseTime(input)).toBe(minutes));

  it.each(["13pm", "0am", "8:75pm", "25:00", "8", "Friday game?", ""])("rejects %j", (input) =>
    expect(parseTime(input)).toBeNull(),
  );
});

describe("formatTime", () => {
  it.each([
    [20 * 60, "8 PM"],
    [20 * 60 + 30, "8:30 PM"],
    [9 * 60 + 5, "9:05 AM"],
    [0, "midnight"],
    [12 * 60, "noon"],
  ])("%i → %s", (minutes, text) => expect(formatTime(minutes)).toBe(text));
});

describe("pollQuestionFromArg", () => {
  // 2026-10-28 03:00 UTC = Wed 28 Oct 12:00 in Seoul, Tue 27 Oct 20:00 in Los Angeles.
  const now = new Date("2026-10-28T03:00:00Z");

  it("uses the default question without an argument", () => {
    expect(pollQuestionFromArg("", now, "Asia/Seoul")).toBe("🏐 Volleyball, Wed 28 Oct: are you in?");
  });

  it("adds the time when the argument is a time", () => {
    expect(pollQuestionFromArg("8pm", now, "Asia/Seoul")).toBe("🏐 Volleyball, Wed 28 Oct at 8 PM: are you in?");
    expect(pollQuestionFromArg("12am", now, "Asia/Seoul")).toBe("🏐 Volleyball, Wed 28 Oct at midnight: are you in?");
  });

  it("uses the date in the configured time zone", () => {
    expect(pollQuestionFromArg("", now, "America/Los_Angeles")).toBe("🏐 Volleyball, Tue 27 Oct: are you in?");
  });

  it("keeps a custom question as is", () => {
    expect(pollQuestionFromArg("Beach game on Saturday?", now, "Asia/Seoul")).toBe("Beach game on Saturday?");
  });
});
