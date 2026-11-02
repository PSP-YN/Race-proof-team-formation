export function isValidTeamSize(minSize:number,maxSize:number):boolean{
 return Number.isInteger(minSize)&&Number.isInteger(maxSize)&&minSize>=2&&maxSize<=10&&minSize<=maxSize;
}
