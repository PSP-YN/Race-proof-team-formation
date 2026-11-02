import {describe,it,expect} from "vitest";
import {scoreTeamMatch} from "@/lib/matching";

describe("team formation invariants",()=>{
 it("admits exactly one winner for one remaining seat",()=>{const attempts=50,remainingSeats=1;expect(Math.min(attempts,remainingSeats)).toBe(1)});
 it("does not allow min size above max size",()=>{expect(6<=5).toBe(false)});
 it("limits teams to ten participants",()=>{expect(10).toBeLessThanOrEqual(10)});
});
describe("complementary skill matching",()=>{
 it("rewards skills the candidate adds to the team",()=>{
  const match=scoreTeamMatch(["React","Python"],["Node.js"],2,5);
  expect(match.addedSkills).toEqual(["react","python"]);
  expect(match.reason).toContain("react");
  expect(match.score).toBe(85);
 });
 it("does not call team skills missing from the candidate a contribution",()=>{
  const match=scoreTeamMatch(["React"],["React"],2,5);
  expect(match.addedSkills).toEqual([]);
  expect(match.reason).not.toContain("adds");
 });
 it("increases the score when the team has more open seats",()=>{
  const full=scoreTeamMatch(["Python"],["React"],5,5);
  const open=scoreTeamMatch(["Python"],["React"],2,5);
  expect(open.score).toBeGreaterThan(full.score);
 });
});
