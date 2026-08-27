const state = globalThis.__SOCCERTREND_TELEGRAM_STATE__ || { sent:new Set() };
globalThis.__SOCCERTREND_TELEGRAM_STATE__ = state;

function n(v){ const x=Number(v); return Number.isFinite(x)?x:0; }
function minuteNumber(v){ const m=String(v||'').match(/\d+/); return m?Number(m[0]):0; }
function shotsArray(sm){ if(Array.isArray(sm))return sm; if(Array.isArray(sm?.shots))return sm.shots; if(Array.isArray(sm?.Periods?.All))return sm.Periods.All; return []; }
function shotMinute(s){ return minuteNumber(s?.min??s?.minute??s?.time??s?.eventTime??s?.matchTime); }
function isOnTarget(s){ if(s?.isOnTarget===true||s?.onTarget===true)return true; const t=String(s?.eventType??s?.type??s?.shotType??s?.result??'').toLowerCase(); return t.includes('goal')||t.includes('save')||t.includes('on target')||t.includes('ontarget'); }
function recentPressure(shotmap,minute,windowMinutes=15){ let total=0,onTarget=0; for(const s of shotsArray(shotmap)){ const sm=shotMinute(s); if(!sm||sm<minute-windowMinutes||sm>minute)continue; total++; if(isOnTarget(s))onTarget++; } return {total,onTarget}; }
function overMarket(homeGoals,awayGoals){ return (n(homeGoals)+n(awayGoals)+0.5).toFixed(1); }
function overLabel(score){ if(score>=85)return '🔥 ENTRA'; if(score>=75)return '🟢 MOLTO INTERESSANTE'; if(score>=60)return '🟡 WATCH'; return '⚪ ASPETTA'; }
function calculateOverScore(minute,stats,shotmap,homeGoals,awayGoals){
  const recent=recentPressure(shotmap,minute,15);
  const totalShots=n(stats?.totalShots?.home)+n(stats?.totalShots?.away);
  const sot=n(stats?.shotsOnTarget?.home)+n(stats?.shotsOnTarget?.away);
  const corners=n(stats?.corners?.home)+n(stats?.corners?.away);
  const touches=n(stats?.touchesBox?.home)+n(stats?.touchesBox?.away);
  const big=n(stats?.bigChances?.home)+n(stats?.bigChances?.away);
  const possH=n(stats?.possession?.home), possA=n(stats?.possession?.away);
  const paceMinute=Math.max(20,minute||20);
  const shotPace=totalShots/paceMinute*90;
  const sotPace=sot/paceMinute*90;
  let score=0;
  score+=Math.min(24,recent.total*4);
  score+=Math.min(24,recent.onTarget*8);
  score+=Math.min(13,sotPace*1.2);
  score+=Math.min(10,shotPace*.28);
  score+=Math.min(9,touches*.32);
  score+=Math.min(7,corners*1.15);
  score+=Math.min(8,big*3.5);
  if(Math.max(possH,possA)>=56&&(sot>=2||totalShots>=7||touches>=10))score+=3;
  if(minute>=28&&minute<=78)score+=3; else if(minute>=79&&minute<=86)score+=1;
  const goals=n(homeGoals)+n(awayGoals); if(goals<=2)score+=2;
  if(minute>86)score-=10;
  if(recent.total===0&&recent.onTarget===0)score-=8;
  score=Math.max(0,Math.min(100,Math.round(score)));
  return {score,label:overLabel(score),market:`Over ${overMarket(homeGoals,awayGoals)}`,recent,totalShots,sot,corners,touches,big};
}
async function telegramSend(text){
  const token=process.env.TELEGRAM_BOT_TOKEN,chatId=process.env.TELEGRAM_CHAT_ID;
  if(!token||!chatId)throw new Error('Telegram env mancanti');
  const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text,parse_mode:'HTML',disable_web_page_preview:true})});
  const data=await response.json(); if(!response.ok||!data.ok)throw new Error(`Telegram: ${JSON.stringify(data).slice(0,500)}`); return data;
}
async function getJson(url){ const response=await fetch(url,{cache:'no-store'}); const data=await response.json(); if(!response.ok||!data?.success)throw new Error(`API ${response.status}: ${JSON.stringify(data).slice(0,500)}`); return data; }
module.exports=async(req,res)=>{
  try{
    if(req.query?.test==='1'){ await telegramSend('✅ <b>SoccerTrend Over Score collegato</b>\n\nNuovo rating 0–100 attivo. Telegram: segnali da 75+.'); return res.status(200).json({success:true,mode:'TEST',sent:true}); }
    const protocol=(req.headers['x-forwarded-proto']||'https').split(',')[0],host=req.headers.host,base=`${protocol}://${host}`;
    const live=await getJson(`${base}/api/footballfree`),matches=Array.isArray(live.liveMatches)?live.liveMatches:[];
    const candidates=matches.filter(m=>{const min=minuteNumber(m.minute);return min>=25&&min<=86;}).slice(0,18);
    const alerts=[],checked=[];
    for(const match of candidates){
      try{
        const detail=await getJson(`${base}/api/footballfree?matchId=${encodeURIComponent(match.matchId)}`);
        const minute=minuteNumber(match.minute||detail.minute),stats=detail.stats||{};
        const over=calculateOverScore(minute,stats,detail.shotmap,match.homeGoals,match.awayGoals);
        checked.push({id:match.matchId,match:`${match.home} - ${match.away}`,minute,score:over.score,label:over.label,market:over.market,recentShots:over.recent.total,recentOnTarget:over.recent.onTarget,totalShots:over.totalShots,sot:over.sot,corners:over.corners,touches:over.touches,bigChances:over.big});
        if(over.score<75)continue;
        const signalKey=`${match.matchId}:${over.market}`; if(state.sent.has(signalKey))continue;
        const text=`🔥 <b>SOCCERTREND — OVER SCORE ${over.score}/100</b>\n\n⚽ <b>${match.home} - ${match.away}</b>\n⏱ ${minute}' | ${match.homeGoals??0}-${match.awayGoals??0}\n🎯 Mercato corrente: <b>${over.market}</b>\n📊 Stato: <b>${over.label}</b>\n\n⏳ Ultimi 15': <b>${over.recent.total} tiri</b> • <b>${over.recent.onTarget} in porta</b>\n🥅 Totale tiri: <b>${over.totalShots}</b> • in porta: <b>${over.sot}</b>\n🚩 Corner: <b>${over.corners}</b> • 📦 Tocchi area: <b>${over.touches}</b>\n⭐ Big chances: <b>${over.big}</b>\n\n💰 Valuta ingresso solo se la quota live è adeguata (riferimento ≥ 1,50).\n⚠️ Rating statistico, non garanzia di gol.`;
        await telegramSend(text); state.sent.add(signalKey); alerts.push({id:match.matchId,score:over.score,market:over.market,match:`${match.home} - ${match.away}`});
      }catch(error){checked.push({id:match.matchId,error:String(error?.message||error)});}
    }
    const liveIds=new Set(matches.map(m=>String(m.matchId))); for(const key of [...state.sent]){const id=String(key).split(':')[0]; if(!liveIds.has(id))state.sent.delete(key);}
    return res.status(200).json({success:true,mode:'OVER_SCORE_V1',telegramThreshold:75,live:matches.length,candidates:candidates.length,alerts,checked});
  }catch(error){return res.status(500).json({success:false,error:String(error?.message||error)});}
};