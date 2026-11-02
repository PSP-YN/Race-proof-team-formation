export type TeamMatchScore={score:number;reason:string;addedSkills:string[];capacity:number};
export function scoreTeamMatch(userSkills:string[],teamSkills:string[],memberCount:number,maxSize:number):TeamMatchScore{
 const mine=[...new Set(userSkills.map(s=>s.trim().toLowerCase()).filter(Boolean))];
 const existing=new Set(teamSkills.map(s=>s.trim().toLowerCase()).filter(Boolean));
 const addedSkills=mine.filter(s=>!existing.has(s));
 const fit=mine.length?addedSkills.length/mine.length:0.5;
 const capacity=maxSize>0?Math.max(0,Math.min(1,(maxSize-memberCount)/maxSize)):0;
 const score=Math.round((fit*0.75+capacity*0.25)*100);
 const reason=addedSkills.length
  ?"Your profile adds "+addedSkills.slice(0,3).join(", ")+" to this team's skill mix"
  :mine.length?"Your listed skills already overlap with this team's skill mix":"Add your skills for a more useful recommendation";
 return{score,reason,addedSkills,capacity};
}
