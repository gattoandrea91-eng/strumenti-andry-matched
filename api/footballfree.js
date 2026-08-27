const FOTMOB_BASE = "https://www.fotmob.com/api/data";

function todayYYYYMMDD() {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

async function fotmobFetch(url) {
  const response = await fetch(url, { headers: { "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36", "Accept":"application/json,text/plain,*/*", "Accept-Language":"it-IT,it;q=0.9,en;q=0.8", "Referer":"https://www.fotmob.com/" } });
  const text = await response.text();
  if (!response.ok) throw new Error(`FotMob ${response.status}: ${text.slice(0,300)}`);
  return JSON.parse(text);
}
function num(value){if(value===null||value===undefined||value==="")return 0;if(typeof value==="string"){const n=Number(value.replace("%","").replace(",",".").trim().split(" ")[0]);return Number.isFinite(n)?n:0}const n=Number(value);return Number.isFinite(n)?n:0}
function normalizeKey(value){return String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"")}
function extractPairFromNode(node){
  if(!node||typeof node!=="object")return null;
  const candidates=[node.stats,node.values,node.value,node.data];
  for(const c of candidates){
    if(Array.isArray(c)&&c.length>=2){
      // FotMob può usare [homeStat, awayStat] come oggetti {value: N}
      const unwrap=v=>v&&typeof v==="object"?(v.value??v.stat??v.displayValue??0):v;
      return [num(unwrap(c[0])),num(unwrap(c[1]))];
    }
  }
  if(node.home!==undefined||node.away!==undefined)return [num(node.home?.value??node.home),num(node.away?.value??node.away)];
  if(node.homeValue!==undefined||node.awayValue!==undefined)return [num(node.homeValue),num(node.awayValue)];
  return null;
}
function findStatFlexible(root,aliases){
  const wanted=aliases.map(normalizeKey).filter(Boolean),queue=[root],visited=new Set();
  while(queue.length){const node=queue.shift();if(!node||typeof node!=="object"||visited.has(node))continue;visited.add(node);
    if(!Array.isArray(node)){
      const names=[node.key,node.title,node.name,node.label,node.statName,node.localizedTitle].map(normalizeKey).filter(Boolean);
      const matches=names.some(name=>wanted.some(w=>name===w||name.includes(w)||w.includes(name)));
      if(matches){const pair=extractPairFromNode(node);if(pair)return pair}
      // Alcune sezioni FotMob sono oggetti: {"Total shots":[10,8], ...}
      for(const [k,v] of Object.entries(node)){
        const nk=normalizeKey(k);
        if(wanted.some(w=>nk===w||nk.includes(w)||w.includes(nk))){
          if(Array.isArray(v)&&v.length>=2)return [num(v[0]?.value??v[0]),num(v[1]?.value??v[1])];
          if(v&&typeof v==="object"){const p=extractPairFromNode(v);if(p)return p}
        }
      }
    }
    if(Array.isArray(node))for(const item of node)queue.push(item);else for(const value of Object.values(node))if(value&&typeof value==="object")queue.push(value);
  }
  return [0,0];
}
function pairFlexible(root,aliases){const v=findStatFlexible(root,aliases);const home=num(v?.[0]),away=num(v?.[1]);return{home,away,total:home+away}}
function shotmapStats(shotmap){
  const shots=Array.isArray(shotmap?.shots)?shotmap.shots:Array.isArray(shotmap)?shotmap:[];
  let hShots=0,aShots=0,hSot=0,aSot=0;
  for(const s of shots){
    const isHome=s.isHome===true||s.teamId===shotmap?.homeTeamId;
    if(isHome)hShots++;else aShots++;
    const event=normalizeKey(s.eventType||s.result||s.type||s.shotType);
    const onTarget=event.includes("goal")||event.includes("save")||event.includes("attemptsaved")||event.includes("ontarget");
    if(onTarget){if(isHome)hSot++;else aSot++}
  }
  return {totalShots:{home:hShots,away:aShots,total:hShots+aShots},shotsOnTarget:{home:hSot,away:aSot,total:hSot+aSot}};
}
function calculateRtg(s){const raw=s.shotsOnTarget.total*4+s.totalShots.total+s.corners.total*1.5+s.touchesBox.total*.6+s.bigChances.total*5;return Math.round(raw*10)/10}
function normalizeMomentum(m){if(!m)return[];if(Array.isArray(m))return m;if(Array.isArray(m?.main))return m.main;if(Array.isArray(m?.data))return m.data;return[]}
function lastMomentumValue(m){const a=normalizeMomentum(m);if(!a.length)return null;const l=a[a.length-1];if(typeof l==="number")return l;if(typeof l?.value==="number")return l.value;return null}
function getLiveMinute(status){if(!status)return"";if(status.liveTime?.short)return String(status.liveTime.short);if(status.liveTime?.long)return String(status.liveTime.long);if(typeof status.liveTime==="string")return status.liveTime;if(status.reason&&String(status.reason).includes("'"))return String(status.reason);return""}

module.exports=async(req,res)=>{try{
 const matchId=String(req.query.matchId||"").trim();
 if(matchId){
  const data=await fotmobFetch(`${FOTMOB_BASE}/matchDetails?matchId=${encodeURIComponent(matchId)}`),content=data?.content||{},statsRoot=content?.stats||{};
  const shotmap=content?.shotmap||null;
  const stats={
   possession:pairFlexible(statsRoot,["BallPossesion","BallPossession","Possession","Possesso","Possesso palla"]),
   totalShots:pairFlexible(statsRoot,["total_shots","TotalShots","Total shots","Shots total","Tiri","Tiri totali","Total attempts"]),
   shotsOnTarget:pairFlexible(statsRoot,["ShotsOnTarget","shots_on_target","Shots on target","On target","Tiri in porta","Tiri nello specchio"]),
   shotsOffTarget:pairFlexible(statsRoot,["ShotsOffTarget","shots_off_target","Shots off target","Tiri fuori"]),
   corners:pairFlexible(statsRoot,["corners","Corner","Corner kicks","Calci d'angolo"]),
   touchesBox:pairFlexible(statsRoot,["touches_opp_box","TouchesInOppositionBox","Touches in opposition box","Touches in box","Tocchi in area"]),
   bigChances:pairFlexible(statsRoot,["big_chance","BigChances","Big chances","Grandi occasioni"]),
   bigChancesMissed:pairFlexible(statsRoot,["big_chance_missed_title","BigChancesMissed","Big chances missed","Grandi occasioni sbagliate"])
  };
  // Fallback robusto: se le due statistiche tiri non sono esposte nella tabella, ricaviamole dalla shotmap.
  const sm=shotmapStats(shotmap);
  if(stats.totalShots.total===0&&sm.totalShots.total>0)stats.totalShots=sm.totalShots;
  if(stats.shotsOnTarget.total===0&&sm.shotsOnTarget.total>0)stats.shotsOnTarget=sm.shotsOnTarget;
  const rtg=calculateRtg(stats),momentum=content?.momentum||content?.matchMomentum||null,momentumArray=normalizeMomentum(momentum),latestMomentum=lastMomentumValue(momentum),events=content?.matchFacts?.events||[];
  return res.status(200).json({success:true,mode:"DETAIL",matchId,matchName:data?.general?.matchName||"",status:data?.general?.matchStatus||data?.general?.status||"",minute:data?.general?.matchTime||data?.general?.liveTime||"",stats,rtg,momentum:{latest:latestMomentum,history:momentumArray},events,shotmap,hasStats:!!content?.stats,hasMomentum:!!momentum,hasShotmap:!!shotmap,hasEvents:Array.isArray(events)});
 }
 const date=String(req.query.date||todayYYYYMMDD()),data=await fotmobFetch(`${FOTMOB_BASE}/matches?date=${encodeURIComponent(date)}`),leagues=Array.isArray(data?.leagues)?data.leagues:[],matches=[];
 for(const league of leagues){for(const match of(Array.isArray(league.matches)?league.matches:[])){const status=match.status||{},minute=getLiveMinute(status);matches.push({matchId:match.id,leagueId:league.primaryId||league.id||match.leagueId||null,league:league.name||"",country:league.ccode||"",home:match.home?.name||"",away:match.away?.name||"",homeGoals:match.home?.score??null,awayGoals:match.away?.score??null,started:status.started===true,finished:status.finished===true,cancelled:status.cancelled===true,score:status.scoreStr||"",minute,reason:status.reason||"",utcTime:status.utcTime||null})}}
 const liveMatches=matches.filter(m=>m.started&&!m.finished&&!m.cancelled);return res.status(200).json({success:true,mode:"TODAY",date,totalMatches:matches.length,liveCount:liveMatches.length,liveMatches});
}catch(error){return res.status(500).json({success:false,error:"Errore FotMob",details:String(error?.message||error)})}};