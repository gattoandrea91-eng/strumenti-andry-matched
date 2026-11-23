const SUPABASE_URL='https://aihwrkqfzhwedqdbxbxh.supabase.co';
const ADMIN_EMAIL='gattoandrea91@gmail.com';
const json=(res,status,data)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(data)};
async function getAdmin(req){
 const header=String(req.headers.authorization||'');
 const token=header.startsWith('Bearer ')?header.slice(7):'';
 if(!token||token.length>5000)return false;
 const response=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:'sb_publishable_G_glT9ld2cqENlVSup38NQ_q8HWyZPd',Authorization:'Bearer '+token},cache:'no-store'});
 if(!response.ok)return false;
 const user=await response.json();
 return Boolean(user?.id&&String(user.email||'').toLowerCase()===ADMIN_EMAIL&&user.email_confirmed_at);
}
const oddsCacheHandler=require('../oddsmbrain-cache-handler');

const nbaMatrixHandler=require('../nba-matrix-handler');
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
const INITIAL_CAPITAL=1000;
const STAKE=50;
const NEW_RULE_START_UTC='2026-11-22T02:21:00.000Z'; // 22 Nov 2026 03:21 Italy; do not rewrite historical entries
const LATE_MINUTE=89;
const LATE_STAKE=20;
const FIXED_30_START_UTC='2026-11-14T23:00:00.000Z'; // 15 novembre 2026, ora italiana
const PROGRESSION_START_UTC='2026-11-02T15:03:00.000Z';
const STAKE_CHANGE_UTC='2026-11-01T23:00:00.000Z'; // 02/11/2026 00:00 Europe/Rome
function stakeForDate(iso){return String(iso||'')>=STAKE_CHANGE_UTC?50:20}
const TRACKING_START_UTC='2026-10-26T23:00:00.000Z'; // 27/10/2026 00:00 Europe/Rome
const MAX_SIGNAL_MINUTE=99;
function supaConfig(){const url=process.env.SUPABASE_URL||'https://aihwrkqfzhwedqdbxbxh.supabase.co',key=process.env.SOCCERTREND_SUPABASE_SECRET_KEY;if(!key)throw new Error('Manca SOCCERTREND_SUPABASE_SECRET_KEY su Vercel');return{url,key}}
async function db(path){const{url,key}=supaConfig();const r=await fetch(`${url}/rest/v1/${path}`,{headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},cache:'no-store'});const text=await r.text();if(!r.ok)throw new Error(`Supabase ${r.status}: ${text.slice(0,300)}`);return text?JSON.parse(text):null}
function entryQuote(score){const x=Math.abs(n(score));return x>=10000?(x%10000)/100:0}
async function dbPages(path,pageSize=1000){const rows=[];for(let offset=0;offset<20000;offset+=pageSize){const sep=path.includes('?')?'&':'?';const page=await db(`${path}${sep}limit=${pageSize}&offset=${offset}`)||[];rows.push(...page);if(page.length<pageSize)return rows}throw new Error('Archivio SoccerTrend troppo grande: aumentare il limite di paginazione')}
const euroRound=x=>Math.round((x+Number.EPSILON)*100)/100;
module.exports=async(req,res)=>{if(String(req.query?.oddsMBrain||'')==='1')return oddsCacheHandler(req,res,getAdmin);if(String(req.query?.nba||'')==='1')return nbaMatrixHandler(req,res);try{
const signals=await dbPages(`soccertrend_signals?message_id=lt.0&created_at=gte.${encodeURIComponent(TRACKING_START_UTC)}&signal_minute=lte.${MAX_SIGNAL_MINUTE}&select=score,signal_minute,match_id,home,away,market,created_at&order=created_at.asc`);
const savedStakes=await dbPages('soccertrend_signals?market=eq.PROGRESSION_STAKE&select=match_id,corners&order=created_at.asc');
const officialRows=await db('soccertrend_signals?market=eq.OFFICIAL_RECAP&select=match_id,away,score,corners,touches,big_chances,shots,sot&order=created_at.desc&limit=1')||[];
const official=officialRows[0]||null;
const officialDay=official?String(official.away||''):'';
const officialCapital=official?n(official.score)/100:null;
const stakeByMatch=new Map(savedStakes.map(r=>[String(r.match_id).replace(/^STAKE_/,''),n(r.corners)/100]));
let profit=0,postOfficialProfit=0,wins=0,losses=0;const bets=[];
const byDay=new Map();
const romeDate=iso=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
for(const s of signals){
  if(['DAILY_REPORT','OFFICIAL_RECAP','PROGRESSION_STAKE','KELLY_STAKE'].includes(String(s.market||'')))continue;
  const q=entryQuote(s.score);
  if(!q)continue;
  const result=n(s.score)>0?'WIN':'LOSS';
  const savedStake=stakeByMatch.get(String(s.match_id));
  const betStake=String(s.created_at||'')>=NEW_RULE_START_UTC
   ?(savedStake>0?savedStake:(n(s.signal_minute)>=LATE_MINUTE?LATE_STAKE:STAKE))
   :(savedStake>0?savedStake:(String(s.created_at||'')>=FIXED_30_START_UTC?30:stakeForDate(s.created_at)));
  const betProfit=result==='WIN'?betStake*(q-1):-betStake;
  if(result==='WIN')wins++;else losses++;
  profit+=betProfit;
  const day=romeDate(s.created_at);
  const daily=byDay.get(day)||{date:day,wins:0,losses:0,winProfit:0,lossAmount:0,profit:0};
  if(result==='WIN'){daily.wins++;daily.winProfit+=betProfit}else{daily.losses++;daily.lossAmount+=-betProfit}
  daily.profit+=betProfit;byDay.set(day,daily);
  if(official&&day>officialDay)postOfficialProfit+=betProfit;
  bets.push({match_id:String(s.match_id),match:`${s.home||''} - ${s.away||''}`,market:s.market||'',minute:n(s.signal_minute),quote:q,result,stake:betStake,created_at:s.created_at})
}
const calculatedProfit=Math.round(profit*100)/100;
if(official&&Number.isFinite(officialCapital)&&/^\d{4}-\d{2}-\d{2}$/.test(officialDay))profit=Math.round(((officialCapital-INITIAL_CAPITAL)+postOfficialProfit)*100)/100;
else profit=calculatedProfit;
const daily=Array.from(byDay.values()).sort((a,b)=>a.date.localeCompare(b.date)).map(d=>({date:d.date,wins:d.wins,losses:d.losses,winProfit:euroRound(d.winProfit),lossAmount:euroRound(d.lossAmount),profit:euroRound(d.profit)}));
const latestDay=daily[daily.length-1]||null;
const todayRome=romeDate(new Date().toISOString());
const today=daily.find(d=>d.date===todayRome)||{date:todayRome,wins:0,losses:0,winProfit:0,lossAmount:0,profit:0};
const total=wins+losses;
const winRate=total?Math.round((wins/total)*1000)/10:0;
const capital=Math.round((INITIAL_CAPITAL+profit)*100)/100;
res.setHeader('Cache-Control','no-store');
return res.status(200).json({success:true,wins,losses,total,winRate,initialCapital:INITIAL_CAPITAL,stake:STAKE,stakeChangedOn:'2026-11-22',previousStake:30,lateStake:LATE_STAKE,lateFromMinute:LATE_MINUTE,lossStreakStake:70,stakingStrategy:'BASE_50_AFTER_2_LOSSES_70_FROM_89_20',maxSignalMinute:MAX_SIGNAL_MINUTE,trackingFrom:'2026-10-27',profit,capital,today,latestDay,source:official?'OFFICIAL_RECAP_RECONCILED':'NEW_CYCLE_FROM_2026_10_27',officialRecap:official?{date:officialDay,wins:n(official.touches),losses:n(official.big_chances),winProfit:n(official.shots)/100,lossAmount:n(official.sot)/100,dayProfit:n(official.corners)/100,previousCapital:Math.round((officialCapital-n(official.corners)/100)*100)/100,closingCapital:officialCapital,postRecapProfit:Math.round(postOfficialProfit*100)/100,calculatedRawProfit:calculatedProfit}:null,bets});
}catch(error){return res.status(500).json({success:false,error:String(error?.message||error)})}};