const FOTMOB_BASE = "https://www.fotmob.com/api";

function todayYYYYMMDD() {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return `${map.year}${map.month}${map.day}`;
}

async function fotmobFetch(url){
  const response=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36","Accept":"application/json,text/plain,*/*","Accept-Language":"it-IT,it;q=0.9,en;q=0.8","Referer":"https://www.fotmob.com/"},cache:"no-store"});
  const text=await response.text();
  if(!response.ok)throw new Error(`FotMob ${response.status}: ${text.slice(0,300)}`);
  try{return JSON.parse(text)}catch{throw new Error(`FotMob risposta non JSON: ${text.slice(0,300)}`)}
}

function findStat(root,key){const groups=root?.Periods?.All?.stats||[];for(const g of groups){for(const s of(Array.isArray(g?.stats)?g.stats:[])){if(s?.key===key)return s.stats||[0,0]}}return[0,0]}
function num(v){if(v==null||v==="")return 0;const x=Number(typeof v==="string"?v.replace("%","").split(" ")[0]:v);return Number.isFinite(x)?x:0}
function pair(root,key){const v=findStat(root,key),home=num(v?.[0]),away=num(v?.[1]);return{home,away,total:home+away}}
function calculateRtg(s){return Math.round(((s.shotsOnTarget.total*4)+s.totalShots.total+(s.corners.total*1.5)+(s.touchesBox.total*.6)+(s.bigChances.total*5))*10)/10}
function normalizeMomentum(r){if(!r)return[];if(Array.isArray(r))return r;if(Array.isArray(r?.main))return r.main;if(Array.isArray(r?.data))return r.data;return[]}
function lastMomentumValue(r){const a=normalizeMomentum(r);if(!a.length)return null;const x=a[a.length-1];return typeof x==="number"?x:(typeof x?.value==="number"?x.value:null)}
function strings(v){if(v==null)return[];if(typeof v==="string"||typeof v==="number")return[String(v)];if(typeof v==="object")return[v.short,v.long,v.shortKey,v.longKey,v.value,v.text].filter(x=>x!=null).map(String);return[]}
function getLiveMinute(status){
  const candidates=[...strings(status?.liveTime),...strings(status?.reason),...strings(status?.matchTime),...strings(status?.time)];
  for(const raw of candidates){const s=String(raw).trim();const add=s.match(/(\d{1,2})\s*\+\s*(\d{1,2})/);if(add)return `${Number(add[1])+Number(add[2])}'`;const m=s.match(/(?:^|\D)(\d{1,3})(?:\s*['’]|\s*min|$)/i);if(m)return `${Number(m[1])}'`}
  return"";
}
function reasonText(s){return strings(s?.reason).join(" ")||""}
function looksLive(status,minute){const reason=reasonText(status).toUpperCase();return status?.started===true||!!minute||/1ST|2ND|FIRST HALF|SECOND HALF|HALF TIME|HT|LIVE|EXTRA TIME|PENALT/.test(reason)}

module.exports=async(req,res)=>{
 try{
  const matchId=String(req.query.matchId||"").trim();
  if(matchId){
   const data=await fotmobFetch(`${FOTMOB_BASE}/matchDetails?matchId=${encodeURIComponent(matchId)}`),content=data?.content||{},root=content?.stats||{};
   const stats={possession:pair(root,"BallPossesion"),totalShots:pair(root,"total_shots"),shotsOnTarget:pair(root,"ShotsOnTarget"),shotsOffTarget:pair(root,"ShotsOffTarget"),corners:pair(root,"corners"),touchesBox:pair(root,"touches_opp_box"),bigChances:pair(root,"big_chance"),bigChancesMissed:pair(root,"big_chance_missed_title")};
   const momentum=content?.momentum||content?.matchMomentum||null,events=content?.matchFacts?.events?.events||content?.matchFacts?.events||[],shotmap=content?.shotmap||null;
   return res.status(200).json({success:true,mode:"DETAIL",matchId,matchName:data?.general?.matchName||"",status:data?.general?.matchStatus||data?.general?.status||"",minute:data?.general?.matchTime||data?.general?.liveTime||"",stats,rtg:calculateRtg(stats),momentum:{latest:lastMomentumValue(momentum),history:normalizeMomentum(momentum)},events,shotmap,hasStats:!!content?.stats,hasMomentum:!!momentum,hasShotmap:!!shotmap,hasEvents:Array.isArray(events)});
  }
  const date=String(req.query.date||todayYYYYMMDD());
  const data=await fotmobFetch(`${FOTMOB_BASE}/matches?date=${encodeURIComponent(date)}&includeNextDayLateNight=true`);
  const leagues=Array.isArray(data?.leagues)?data.leagues:[],matches=[];
  for(const league of leagues){for(const match of(Array.isArray(league.matches)?league.matches:[])){const status=match.status||{},minute=getLiveMinute(status),started=looksLive(status,minute),finished=status.finished===true,cancelled=status.cancelled===true;matches.push({matchId:match.id,leagueId:league.primaryId||league.id||match.leagueId||null,league:league.name||"",country:league.ccode||"",home:match.home?.name||"",away:match.away?.name||"",homeGoals:match.home?.score??null,awayGoals:match.away?.score??null,started,finished,cancelled,score:status.scoreStr||"",minute,reason:reasonText(status),utcTime:status.utcTime||null})}}
  const liveMatches=matches.filter(m=>m.started&&!m.finished&&!m.cancelled);
  return res.status(200).json({success:true,mode:"TODAY",source:"FotMob",date,totalMatches:matches.length,liveCount:liveMatches.length,liveMatches});
 }catch(error){return res.status(500).json({success:false,error:"Errore FotMob",details:String(error?.message||error)})}
};