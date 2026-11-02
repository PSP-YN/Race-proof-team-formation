export type TeamMatchScore={score:number;reason:string;addedSkills:string[];capacity:number};
export function scoreTeamMatch(userSkills:string[],requiredSkills:string[],representedSkills:string[],memberCount:number,maxSize:number):TeamMatchScore{
 const mine=[...new Set(userSkills.map(s=>s.trim().toLowerCase()).filter(Boolean))];
 const required=[...new Set(requiredSkills.map(s=>s.trim().toLowerCase()).filter(Boolean))];
 const represented=new Set(representedSkills.map(s=>s.trim().toLowerCase()).filter(Boolean));
 const unmet=new Set(required.filter(s=>!represented.has(s)));
 const addedSkills=mine.filter(s=>unmet.has(s));
 const fit=required.length?addedSkills.length/required.length:0.5;
 const capacity=maxSize>0?Math.max(0,Math.min(1,(maxSize-memberCount)/maxSize)):0;
 const score=Math.round((fit*0.75+capacity*0.25)*100);
 const reason=addedSkills.length
  ?"Your "+addedSkills.slice(0,3).join(", ")+" skill"+(addedSkills.length===1?"":"s")+" fill"+(addedSkills.length===1?"s":"")+" an unmet team need"
  :required.length&&!unmet.size?"The team's listed skill needs are already covered"
  :required.length?"Your listed skills do not match the team's remaining skill needs"
  :"The team has not listed specific skill needs yet";
 return{score,reason,addedSkills,capacity};
}
