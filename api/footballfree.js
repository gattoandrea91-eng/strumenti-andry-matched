const FOTMOB_BASE = "https://www.fotmob.com/api/data";

function todayYYYYMMDD() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}${map.month}${map.day}`;
}

async function fotmobFetch(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept": "application/json,text/plain,*/*",
      "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
      "Referer": "https://www.fotmob.com/"
    },
    cache: "no-store"
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`FotMob ${response.status}: ${text.slice(0,300)}`);

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`FotMob risposta non JSON: ${text.slice(0,300)}`);
  }
}

function findStat(statsRoot, wantedKey) {
  const allPeriod = statsRoot?.Periods?.All?.stats || [];
  for (const group of allPeriod) {
    const stats = Array.isArray(group?.stats) ? group.stats : [];
    for (const stat of stats) {
      if (stat?.key === wantedKey) return stat.stats || [0,0];
    }
  }
  return [0,0];
}

function num(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "string") {
    const clean = value.replace("%", "").split(" ")[0];
    const x = Number(clean);
    return Number.isFinite(x) ? x : 0;
  }
  const x = Number(value);
  return Number.isFinite(x) ? x : 0;
}

function pair(statsRoot,key){
  const values=findStat(statsRoot,key);
  const home=num(values?.[0]);
  const away=num(values?.[1]);
  return {home,away,total:home+away};
}

function calculateRtg(stats){
  const raw=(stats.shotsOnTarget.total*4)+(stats.totalShots.total)+(stats.corners.total*1.5)+(stats.touchesBox.total*.6)+(stats.bigChances.total*5);
  return Math.round(raw*10)/10;
}

function normalizeMomentum(raw){
  if(!raw)return[];
  if(Array.isArray(raw))return raw;
  if(Array.isArray(raw?.main))return raw.main;
  if(Array.isArray(raw?.data))return raw.data;
  return[];
}

function lastMomentumValue(momentum){
  const arr=normalizeMomentum(momentum);
  if(!arr.length)return null;
  const last=arr[arr.length-1];
  if(typeof last==="number")return last;
  if(typeof last?.value==="number")return last.value;
  return null;
}

function stringCandidates(value){
  if(value===null||value===undefined)return[];
  if(typeof value==="string"||typeof value==="number")return[String(value)];
  if(typeof value==="object")return[value.short,value.long,value.shortKey,value.longKey,value.value,value.text].filter(v=>v!==null&&v!==undefined).map(String);
  return[];
}

function getLiveMinute(status){
  if(!status)return"";
  const candidates=[...stringCandidates(status.liveTime),...stringCandidates(status.reason),...stringCandidates(status.matchTime),...stringCandidates(status.time)];
  for(const raw of candidates){
    const s=String(raw).trim();
    if(!s)continue;
    const added=s.match(/(\d{1,2})\s*\+\s*(\d{1,2})/);
    if(added)return `${Number(added[1])+Number(added[2])}'`;
    const minute=s.match(/(\d{1,3})(?:\s*['’]|\s*min|\s*$)/i);
    if(minute)return `${Number(minute[1])}'`;
  }
  return"";
}

function statusReasonText(status){
  return stringCandidates(status?.reason).join(" ")||"";
}

module.exports=async(req,res)=>{
  try{
    const matchId=String(req.query.matchId||"").trim();

    if(matchId){
      const data=await fotmobFetch(`${FOTMOB_BASE}/matchDetails?matchId=${encodeURIComponent(matchId)}`);
      const content=data?.content||{};
      const statsRoot=content?.stats||{};
      const stats={
        possession:pair(statsRoot,"BallPossesion"),
        totalShots:pair(statsRoot,"total_shots"),
        shotsOnTarget:pair(statsRoot,"ShotsOnTarget"),
        shotsOffTarget:pair(statsRoot,"ShotsOffTarget"),
        corners:pair(statsRoot,"corners"),
        touchesBox:pair(statsRoot,"touches_opp_box"),
        bigChances:pair(statsRoot,"big_chance"),
        bigChancesMissed:pair(statsRoot,"big_chance_missed_title")
      };
      const momentum=content?.momentum||content?.matchMomentum||null;
      const events=Array.isArray(content?.matchFacts?.events)?content.matchFacts.events:[];
      const shotmap=content?.shotmap||null;
      return res.status(200).json({success:true,mode:"DETAIL",matchId,matchName:data?.general?.matchName||"",status:data?.general?.matchStatus||data?.general?.status||"",minute:data?.general?.matchTime||data?.general?.liveTime||"",stats,rtg:calculateRtg(stats),momentum:{latest:lastMomentumValue(momentum),history:normalizeMomentum(momentum)},events,shotmap,hasStats:!!content?.stats,hasMomentum:!!momentum,hasShotmap:!!shotmap,hasEvents:Array.isArray(events)});
    }

    const date=String(req.query.date||todayYYYYMMDD());
    const data=await fotmobFetch(`${FOTMOB_BASE}/matches?date=${encodeURIComponent(date)}`);
    const leagues=Array.isArray(data?.leagues)?data.leagues:[];
    const matches=[];

    for(const league of leagues){
      const leagueMatches=Array.isArray(league.matches)?league.matches:[];
      for(const match of leagueMatches){
        const status=match.status||{};
        const minute=getLiveMinute(status);
        const started=status.started===true||!!minute;
        const finished=status.finished===true;
        const cancelled=status.cancelled===true;
        matches.push({matchId:match.id,leagueId:league.primaryId||league.id||match.leagueId||null,league:league.name||"",country:league.ccode||"",home:match.home?.name||"",away:match.away?.name||"",homeGoals:match.home?.score??null,awayGoals:match.away?.score??null,started,finished,cancelled,score:status.scoreStr||"",minute,reason:statusReasonText(status),utcTime:status.utcTime||null});
      }
    }

    const liveMatches=matches.filter(m=>m.started&&!m.finished&&!m.cancelled);
    return res.status(200).json({success:true,mode:"TODAY",source:"FotMob",date,totalMatches:matches.length,liveCount:liveMatches.length,liveMatches});
  }catch(error){
    return res.status(500).json({success:false,error:"Errore FotMob",details:String(error?.message||error)});
  }
};