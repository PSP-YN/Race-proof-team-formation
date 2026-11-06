import { describe, it, expect } from "vitest";
import { scoreTeamMatch } from "../../src/lib/matching";
import { isValidTeamSize } from "../../src/lib/team-invariants";

describe("team size validation", () => {
  it("accepts a valid minimum and maximum", () => { expect(isValidTeamSize(2, 5)).toBe(true); });
  it("rejects a minimum greater than the maximum", () => { expect(isValidTeamSize(6, 5)).toBe(false); });
  it("rejects a team size below two", () => { expect(isValidTeamSize(1, 5)).toBe(false); });
  it("rejects a maximum above ten", () => { expect(isValidTeamSize(2, 11)).toBe(false); });
});

describe("explainable skill and time-zone matching", () => {
  it("rewards uncovered skills, matching time zones and available seats", () => {
    const match = scoreTeamMatch(["React", "Python"], ["React", "Python"], [], 2, 5, "Asia/Kolkata", ["Asia/Kolkata"]);
    expect(match.addedSkills).toEqual(["react", "python"]);
    expect(match.timeZoneFit).toBe(1);
    expect(match.averageTimeZoneDifferenceHours).toBe(0);
    expect(match.score).toBe(94);
    expect(match.reason).toContain("react");
    expect(match.reason).toContain("0.0h");
  });

  it("does not reward skills already represented by team members", () => {
    const match = scoreTeamMatch(["React"], ["React"], ["React"], 2, 5, "Asia/Kolkata", ["Asia/Kolkata"]);
    expect(match.addedSkills).toEqual([]);
    expect(match.reason).toContain("already covered");
  });

  it("does not reward unrelated skills that do not fill a listed need", () => {
    const match = scoreTeamMatch(["Go"], ["React"], [], 2, 5, "Asia/Kolkata", ["Asia/Kolkata"]);
    expect(match.addedSkills).toEqual([]);
    expect(match.score).toBe(29);
  });

  it("scores time-zone proximity using the circular UTC-offset distance", () => {
    const close = scoreTeamMatch([], [], [], 2, 5, "Asia/Kolkata", ["Asia/Singapore"]);
    const far = scoreTeamMatch([], [], [], 2, 5, "Asia/Kolkata", ["America/Los_Angeles"]);
    expect(close.timeZoneFit).toBeGreaterThan(far.timeZoneFit);
    expect(close.averageTimeZoneDifferenceHours).toBeLessThan(far.averageTimeZoneDifferenceHours!);
  });

  it("handles the UTC-12 to UTC+14 date-line gap without negative offsets", () => {
    const match = scoreTeamMatch([], [], [], 2, 5, "Etc/GMT+12", ["Pacific/Kiritimati"]);
    expect(match.averageTimeZoneDifferenceHours).toBe(2);
    expect(match.timeZoneFit).toBeCloseTo(1 - 2 / 12);
    expect(match.score).toBeLessThanOrEqual(100);
  });

  it("uses a neutral time-zone component when team profile data is missing", () => {
    const match = scoreTeamMatch(["Python"], ["React"], [], 2, 5, "Asia/Kolkata", []);
    expect(match.timeZoneFit).toBe(0.5);
    expect(match.averageTimeZoneDifferenceHours).toBeNull();
    expect(match.reason).toContain("neutral score used");
  });

  it("increases the score when the team has more open seats", () => {
    const full = scoreTeamMatch(["Python"], ["React"], [], 5, 5, "Asia/Kolkata", ["Asia/Kolkata"]);
    const open = scoreTeamMatch(["Python"], ["React"], [], 2, 5, "Asia/Kolkata", ["Asia/Kolkata"]);
    expect(open.score).toBeGreaterThan(full.score);
  });
});
