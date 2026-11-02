import {describe,it,expect} from "vitest";
import {scoreTeamMatch} from "../../src/lib/matching";
import {isValidTeamSize} from "../../src/lib/team-invariants";

describe("team size validation",()=>{
 it("accepts a valid minimum and maximum",()=>{expect(isValidTeamSize(2,5)).toBe(true)});
 it("rejects a minimum greater than the maximum",()=>{expect(isValidTeamSize(6,5)).toBe(false)});
 it("rejects a team size below two",()=>{expect(isValidTeamSize(1,5)).toBe(false)});
 it("rejects a maximum above ten",()=>{expect(isValidTeamSize(2,11)).toBe(false)});
});
describe("complementary skill matching",()=>{
 it("rewards skills the candidate adds to the team",()=>{
  const match=scoreTeamMatch(["React","Python"],["Node.js"],2,5);
  expect(match.addedSkills).toEqual(["react","python"]);
  expect(match.reason).toContain("react");
  expect(match.score).toBe(90);
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
