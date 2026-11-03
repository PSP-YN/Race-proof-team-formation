// Matching weights uncovered skill fit, time-zone compatibility (when both sides provide it), and team capacity.
export type TeamMatchScore={score:number;reason:string;addedSkills:string[];capacity:number;timeZoneScore:number|null};
export function isValidTimeZone(value:string):boolean{
 try{new Intl.DateTimeFormat("en-US",{timeZone:value}).format();return true}catch{return false}
}
function utcOffsetMinutes(timeZone:string,at=new Date()):number{
 const parts=new Intl.DateTimeFormat("en-US",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(at);
 const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 const localAsUtc=Date.UTC(Number(values.year),Number(values.month)-1,Number(values.day),Number(values.hour),Number(values.minute),Number(values.second));
 return Math.round((localAsUtc-at.getTime())/60000);
}
export function scoreTimeZoneCompatibility(candidate:string,team:string,at=new Date()):number{
 if(!isValidTimeZone(candidate)||!isValidTimeZone(team))return 0;
 if(candidate===team)return 100;
 const hours=Math.abs(utcOffsetMinutes(candidate,at)-utcOffsetMinutes(team,at))/60;
 if(hours<=2)return 90;
 if(hours<=4)return 75;
 if(hours<=6)return 55;
 if(hours<=8)return 35;
 if(hours<=10)return 15;
 return 0;
}
export function scoreTeamMatch(userSkills:string[],requiredSkills:string[],representedSkills:string[],memberCount:number,maxSize:number,userTimeZone?:string,teamTimeZone?:string):TeamMatchScore{
 const mine=[...new Set(userSkills.map(s=>s.trim().toLowerCase()).filter(Boolean))];
 const required=[...new Set(requiredSkills.map(s=>s.trim().toLowerCase()).filter(Boolean))];
 const represented=new Set(representedSkills.map(s=>s.trim().toLowerCase()).filter(Boolean));
 const unmet=new Set(required.filter(s=>!represented.has(s)));
 const addedSkills=mine.filter(s=>unmet.has(s));
 const fit=required.length?addedSkills.length/required.length:0.5;
 const capacity=maxSize>0?Math.max(0,Math.min(1,(maxSize-memberCount)/maxSize)):0;
 const timeZoneScore=userTimeZone&&teamTimeZone?scoreTimeZoneCompatibility(userTimeZone,teamTimeZone):null;
 const score=timeZoneScore===null?Math.round((fit*0.75+capacity*0.25)*100):Math.round((fit*0.65+(timeZoneScore/100)*0.15+capacity*0.20)*100);
 const skillReason=addedSkills.length?"Your "+addedSkills.slice(0,3).join(", ")+ " skill"+(addedSkills.length===1?"":"s")+" fill"+(addedSkills.length===1?"s":"")+" an unmet team need":required.length&&!unmet.size?"The team's listed skill needs are already covered":required.length?"Your listed skills do not match the team's remaining skill needs":"The team has not listed specific skill needs yet";
 const timeReason=timeZoneScore===null?" Time-zone compatibility was not included because one side has not provided a time zone.":timeZoneScore>=75?" Time zones are close enough for strong working-hour overlap.":timeZoneScore>=35?" Time zones have moderate overlap; coordinate async work.":" Time zones have limited overlap; async collaboration may be needed.";
 return{score,reason:skillReason+timeReason,addedSkills,capacity,timeZoneScore};
}
