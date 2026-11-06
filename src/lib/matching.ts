// Matching is explainable and deterministic for a given date.
// Weights: 65% uncovered skill coverage, 20% timezone proximity, 15% open-seat capacity.
export type TeamMatchScore={
 score:number;
 reason:string;
 addedSkills:string[];
 capacity:number;
 timeZoneFit:number;
 averageTimeZoneDifferenceHours:number|null;
};

function utcOffsetMinutes(timeZone:string,at:Date):number|null{
 try{
  const minute=new Date(Math.floor(at.getTime()/60_000)*60_000);
  const parts=new Intl.DateTimeFormat("en-US",{
   timeZone,hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",
  }).formatToParts(minute);
  const value=(type:string)=>Number(parts.find(p=>p.type===type)?.value);
  const localAsUtc=Date.UTC(value("year"),value("month")-1,value("day"),value("hour"),value("minute"));
  return Math.round((localAsUtc-minute.getTime())/60_000);
 }catch{return null}
}

function circularOffsetDifference(a:number,b:number):number{
 const raw=Math.abs(a-b)%1440;
 return Math.min(raw,1440-raw);
}

export function scoreTeamMatch(
 userSkills:string[],
 requiredSkills:string[],
 representedSkills:string[],
 memberCount:number,
 maxSize:number,
 candidateTimeZone="UTC",
 teamTimeZones:string[]=[],
 at=new Date(),
):TeamMatchScore{
 const mine=[...new Set(userSkills.map(s=>s.trim().toLowerCase()).filter(Boolean))];
 const required=[...new Set(requiredSkills.map(s=>s.trim().toLowerCase()).filter(Boolean))];
 const represented=new Set(representedSkills.map(s=>s.trim().toLowerCase()).filter(Boolean));
 const unmet=new Set(required.filter(s=>!represented.has(s)));
 const addedSkills=mine.filter(s=>unmet.has(s));
 const skillCoverage=required.length?addedSkills.length/required.length:0.5;
 const capacity=maxSize>0?Math.max(0,Math.min(1,(maxSize-memberCount)/maxSize)):0;
 const candidateOffset=utcOffsetMinutes(candidateTimeZone,at);
 const differences=(candidateOffset===null?[]:teamTimeZones.map(zone=>{const offset=utcOffsetMinutes(zone,at);return offset===null?null:circularOffsetDifference(candidateOffset,offset)}))
  .filter((n):n is number=>n!==null);
 const averageDifference=differences.length?differences.reduce((sum,n)=>sum+n,0)/differences.length:null;
 // Missing profile time zones are neutral, never treated as a mismatch.
 const timeZoneFit=averageDifference===null?0.5:Math.max(0,1-averageDifference/720);
 const score=Math.round((skillCoverage*0.65+timeZoneFit*0.20+capacity*0.15)*100);
 const skillReason=addedSkills.length
  ?"Adds "+addedSkills.slice(0,3).join(", ")+" to uncovered team needs"
  :required.length&&!unmet.size?"Listed team skill needs are already covered"
  :required.length?"No listed skill need is filled by this profile":"Team has not listed specific skill needs";
 const zoneReason=averageDifference===null
  ?"Time-zone data incomplete; neutral score used"
  :"Average time-zone offset difference "+(averageDifference/60).toFixed(1)+"h";
 const capacityReason=Math.max(0,maxSize-memberCount)+" open seat"+(maxSize-memberCount===1?"":"s");
 return{
  score,reason:skillReason+" · "+zoneReason+" · "+capacityReason,
  addedSkills,capacity,timeZoneFit,
  averageTimeZoneDifferenceHours:averageDifference===null?null:Number((averageDifference/60).toFixed(1)),
 };
}
