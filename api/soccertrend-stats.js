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
const PROGRESSION_START_UTC='2026-11-02T15:03:00.000Z';
const STAKE_CHANGE_UTC='2026-11-01T23:00:00.000Z'; // 02/11/2026 00:00 Europe/Rome
function stakeForDate(iso){return String(iso||'')>=STAKE_CHANGE_UTC?50:20}
const TRACKING_START_UTC='2026-10-26T23:00:00.000Z'; // 27/10/2026 00:00 Europe/Rome
const MAX_SIGNAL_MINUTE=99;
function supaConfig(){const url=process.env.SUPABASE_URL||'https://aihwrkqfzhwedqdbxbxh.supabase.co',key=process.env.SOCCERTREND_SUPABASE_SECRET_KEY;if(!key)throw new Error('Manca SOCCERTREND_SUPABASE_SECRET_KEY su Vercel');return{url,key}}
async function db(path){const{url,key}=supaConfig();const r=await fetch(`${url}/rest/v1/${path}`,{headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},cache:'no-store'});const text=await r.text();if(!r.ok)throw new Error(`Supabase ${r.status}: ${text.slice(0,300)}`);return text?JSON.parse(text):null}
function entryQuote(score){const x=Math.abs(n(score));return x>=10000?(x%10000)/100:0}
module.exports=async(req,res)=>{if(String(req.query?.oddsMBrain||'')==='1')return oddsCacheHandler(req,res,getAdmin);if(String(req.query?.nba||'')==='1')return nbaMatrixHandler(req,res);try{
const signals=await db(`soccertrend_signals?message_id=lt.0&created_at=gte.${encodeURIComponent(TRACKING_START_UTC)}&signal_minute=lte.${MAX_SIGNAL_MINUTE}&select=score,signal_minute,match_id,home,away,market,created_at&order=created_at.asc&limit=1000`)||[];
const savedStakes=await db('soccertrend_signals?market=eq.PROGRESSION_STAKE&select=match_id,corners&limit=1000')||[];
const stakeByMatch=new Map(savedStakes.map(r=>[String(r.match_id).replace(/^STAKE_/,''),n(r.corners)/100]));
let profit=0,wins=0,losses=0;const bets=[];
for(const s of signals){
  if(String(s.market||'')==='DAILY_REPORT')continue;
  const q=entryQuote(s.score);
  if(!q)continue;
  const result=n(s.score)>0?'WIN':'LOSS';
  const savedStake=stakeByMatch.get(String(s.match_id));
  const betStake=String(s.created_at||'')>=PROGRESSION_START_UTC&&savedStake>0?savedStake:stakeForDate(s.created_at);
  if(result==='WIN'){wins++;profit+=betStake*(q-1)}else{losses++;profit-=betStake}
  bets.push({match_id:String(s.match_id),match:`${s.home||''} - ${s.away||''}`,market:s.market||'',minute:n(s.signal_minute),quote:q,result,stake:betStake,created_at:s.created_at})
}
profit=Math.round(profit*100)/100;
const total=wins+losses;
const winRate=total?Math.round((wins/total)*1000)/10:0;
const capital=Math.round((INITIAL_CAPITAL+profit)*100)/100;
res.setHeader('Cache-Control','no-store');
return res.status(200).json({success:true,wins,losses,total,winRate,initialCapital:INITIAL_CAPITAL,stake:STAKE,stakeChangedOn:'2026-11-02',previousStake:20,stakingStrategy:'50_EUR_THEN_70_AFTER_TWO_CONSECUTIVE_LOSSES_UNTIL_WIN',maxSignalMinute:MAX_SIGNAL_MINUTE,trackingFrom:'2026-10-27',profit,capital,source:'NEW_CYCLE_FROM_2026_10_27',bets});
}catch(error){return res.status(500).json({success:false,error:String(error?.message||error)})}};