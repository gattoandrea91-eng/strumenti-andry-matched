const state = globalThis.__SOCCERTREND_TELEGRAM_STATE__ || { sent:new Set(), signals:new Map(), day:'' };
if(!state.sent)state.sent=new Set();
if(!state.signals)state.signals=new Map();
globalThis.__SOCCERTREND_TELEGRAM_STATE__ = state;

function n(v){ const x=Number(v); return Number.isFinite(x)?x:0; }
function minuteNumber(v){ const m=String(v||'').match(/\d+/); return m?Number(m[0]):0; }
function overMarket(h,a){ return (n(h)+n(a)+0.5).toFixed(1); }
function calculateScore(minute,stats,hg,ag){
 const corners=n(stats?.corners?.total ?? (n(stats?.corners?.home)+n(stats?.corners?.away)));
 const touches=n(stats?.touchesBox?.total ?? (n(stats?.touchesBox?.home)+n(stats?.touchesBox?.away)));
 const big=n(stats?.bigChances?.total ?? (n(stats?.bigChances?.home)+n(stats?.bigChances?.away)));
 const shots=n(stats?.totalShots?.total ?? (n(stats?.totalShots?.home)+n(stats?.totalShots?.away)));
 const sot=n(stats?.shotsOnTarget?.total ?? (n(stats?.shotsOnTarget?.home)+n(stats?.shotsOnTarget?.away)));
 const pace=Math.max(25,minute||25); let score=0;
 score+=Math.min(24,touches*.9); score+=Math.min(20,big*6); score+=Math.min(18,corners*2.5);
 if(shots>0&&shots<60)score+=Math.min(12,(shots/pace*90)*.45);
 if(sot>0&&sot<=25)score+=Math.min(12,(sot/pace*90)*1.05);
 if(minute>=30&&minute<=70)score+=12;else if(minute>=25&&minute<=78)score+=9;else if(minute<=84)score+=5;else score-=8;
 const goals=n(hg)+n(ag);if(goals<=2)score+=6;else if(goals===3)score+=3;
 const activity=corners+big*2+touches/4;if(activity<3)score-=18;else if(activity>=8)score+=5;if((big>=2&&touches>=8)||(corners>=5&&touches>=10))score+=7;
 score=Math.max(0,Math.min(100,Math.round(score)));
 return {score,market:`Over ${overMarket(hg,ag)}`,corners,touches,big,shots,sot};
}
function telegramConfig(){const token=process.env.TELEGRAM_BOT_TOKEN,chatId=process.env.TELEGRAM_CHAT_ID;if(!token||!chatId)throw new Error('Telegram env mancanti');return{token,chatId}}
async function telegramSend(text){const {token,chatId}=telegramConfig();const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text,parse_mode:'HTML',disable_web_page_preview:true})});const data=await response.json();if(!response.ok||!data.ok)throw new Error(`Telegram: ${JSON.stringify(data).slice(0,500)}`);return data.result}
async function telegramEdit(messageId,text){const {token,chatId}=telegramConfig();const response=await fetch(`https://api.telegram.org/bot${token}/editMessageText`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,message_id:messageId,text,parse_mode:'HTML',disable_web_page_preview:true})});const data=await response.json();if(!response.ok||!data.ok)throw new Error(`Telegram edit: ${JSON.stringify(data).slice(0,500)}`);return data.result}
async function getJson(url){const response=await fetch(url,{cache:'no-store'});const text=await response.text();let data;try{data=JSON.parse(text)}catch{throw new Error(`API ${response.status}: risposta non JSON ${text.slice(0,180)}`)}if(!response.ok||!data?.success)throw new Error(`API ${response.status}: ${JSON.stringify(data).slice(0,500)}`);return data}
function signalText(match,minute,over,result=''){const resultLine=result==='WIN'?'\n\n✅ <b>WIN — GOL ARRIVATO DOPO IL SEGNALE</b>':result==='LOSS'?'\n\n❌ <b>LOSS — NESSUN ALTRO GOL</b>':'';return `🔥 <b>SOCCERTREND — SEGNALE FORTE</b>\n\n⚽ <b>${match.home} - ${match.away}</b>\n⏱ ${minute}' | ${match.homeGoals??0}-${match.awayGoals??0}\n🎯 Mercato: <b>${over.market}</b>\n📊 Over Score: <b>${over.score}/100</b>\n\n🚩 Corner: <b>${over.corners}</b>\n📦 Tocchi in area: <b>${over.touches}</b>\n⭐ Big chances: <b>${over.big}</b>${over.shots>0?`\n🥅 Tiri: <b>${over.shots}</b>`:''}${over.sot>0?` • in porta: <b>${over.sot}</b>`:''}${resultLine}\n\n⚠️ Segnale statistico.`}

module.exports=async(req,res)=>{try{
 if(req.query?.test==='1'){await telegramSend('✅ <b>SoccerTrend Telegram attivo</b>\n\nSolo segnali forti 78+. Un segnale per partita + aggiornamento WIN/LOSS.');return res.status(200).json({success:true,mode:'TEST',sent:true})}
 const protocol=(req.headers['x-forwarded-proto']||'https').split(',')[0],host=req.headers.host,base=`${protocol}://${host}`;
 const feed=await getJson(`${base}/api/footballfree`),matches=Array.isArray(feed.liveMatches)?feed.liveMatches:[],allMatches=Array.isArray(feed.allMatches)?feed.allMatches:matches;
 const day=String(feed.date||new Date().toISOString().slice(0,10));if(state.day&&state.day!==day){state.sent.clear();state.signals.clear()}state.day=day;
 const settled=[];
 for(const [id,sig] of state.signals){if(sig.result)continue;const current=allMatches.find(m=>String(m.matchId)===String(id));if(!current)continue;const goals=n(current.homeGoals)+n(current.awayGoals);let result='';if(goals>sig.startGoals)result='WIN';else if(current.finished||current.cancelled)result=current.cancelled?'VOID':'LOSS';if(!result)continue;sig.result=result;if(result!=='VOID'){try{await telegramEdit(sig.messageId,signalText(sig.match,sig.minute,sig.over,result));settled.push({id,result})}catch(e){settled.push({id,result,error:String(e?.message||e)})}}}
 const candidates=matches.filter(m=>{const min=minuteNumber(m.minute);return min>=25&&min<=84}).slice(0,24),alerts=[],checked=[];
 for(const match of candidates){try{
  const signalKey=String(match.matchId);if(state.sent.has(signalKey))continue;
  const detail=await getJson(`${base}/api/footballfree?matchId=${encodeURIComponent(match.matchId)}`),minute=minuteNumber(match.minute||detail.minute),over=calculateScore(minute,detail.stats||{},match.homeGoals,match.awayGoals);
  checked.push({id:match.matchId,match:`${match.home} - ${match.away}`,minute,score:over.score,market:over.market});if(over.score<78)continue;
  const text=signalText(match,minute,over),sent=await telegramSend(text);state.sent.add(signalKey);state.signals.set(signalKey,{messageId:sent.message_id,startGoals:n(match.homeGoals)+n(match.awayGoals),minute,over,match:{home:match.home,away:match.away,homeGoals:match.homeGoals,awayGoals:match.awayGoals},result:''});alerts.push({id:match.matchId,score:over.score,market:over.market,match:`${match.home} - ${match.away}`});
 }catch(error){checked.push({id:match.matchId,error:String(error?.message||error)})}}
 return res.status(200).json({success:true,mode:'STRONG_RESULT_V4',telegramThreshold:78,live:matches.length,candidates:candidates.length,alerts,settled,tracked:state.signals.size,checked});
}catch(error){return res.status(500).json({success:false,error:String(error?.message||error)})}};