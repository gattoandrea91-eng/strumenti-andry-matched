function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(fc|cf|ac|sc|afc|calcio|football|club)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim();}
function sameTeam(a,b){const x=norm(a),y=norm(b);return !!x&&!!y&&(x===y||x.includes(y)||y.includes(x));}
function selName(sel,home,away){const s=norm(sel);if(s==='home'||s==='1'||sameTeam(sel,home))return home;if(s==='away'||s==='2'||sameTeam(sel,away))return away;if(s==='draw'||s==='x'||s==='pareggio')return 'Draw';return sel;}
async function getExchange(key,date){
 const sr=await fetch('https://api.the-odds-api.com/v4/sports?apiKey='+encodeURIComponent(key));
 const sports=await sr.json();
 if(!sr.ok)throw new Error(sports?.message||sports?.error_code||'Errore The Odds API');
 const soccer=(Array.isArray(sports)?sports:[]).filter(s=>s.active&&String(s.key||'').startsWith('soccer_'));
 const from=new Date(date+'T00:00:00+02:00'),to=new Date(date+'T23:59:59+02:00');
 const all=[];
 for(let i=0;i<soccer.length;i+=8){
  const batch=soccer.slice(i,i+8);
  const got=await Promise.all(batch.map(async s=>{
   try{
    const u='https://api.the-odds-api.com/v4/sports/'+encodeURIComponent(s.key)+'/odds?apiKey='+encodeURIComponent(key)+'&regions=eu&markets=h2h&oddsFormat=decimal&dateFormat=iso&bookmakers=betfair_ex_eu';
    const r=await fetch(u);const j=await r.json();return r.ok&&Array.isArray(j)?j:[];
   }catch{return []}
  }));
  for(const arr of got)for(const e of arr){const t=new Date(e.commence_time);if(t>=from&&t<=to)all.push(e);}
 }
 return all;
}
function findLay(events,row){
 let best=null,bestScore=0;
 const kt=new Date(row.date).getTime();
 for(const e of events){
  let score=0;if(sameTeam(row.home,e.home_team))score+=4;if(sameTeam(row.away,e.away_team))score+=4;
  const dt=Math.abs(new Date(e.commence_time).getTime()-kt);if(dt<=30*60000)score+=3;else if(dt<=90*60000)score+=1;
  if(score>bestScore){bestScore=score;best=e;}
 }
 if(!best||bestScore<7)return null;
 const ex=(best.bookmakers||[]).find(b=>String(b.key).startsWith('betfair_ex'));
 const market=(ex?.markets||[]).find(m=>m.key==='h2h_lay');
 const wanted=selName(row.selection,row.home,row.away);
 const o=(market?.outcomes||[]).find(x=>sameTeam(x.name,wanted)||(norm(wanted)==='draw'&&norm(x.name)==='draw'));
 return o?{lay:Number(o.price),layLimit:o.bet_limit??null,exchange:ex.title||'Betfair Exchange',exchangeUpdated:market.last_update||ex.last_update||null}:null;
}
module.exports = async function handler(req,res){
 const key=process.env.API_FOOTBALL_KEY||process.env.API_SPORTS_KEY;
 const exchangeKey=process.env.ODDSMATCHER_ODDS_API_KEY;
 if(!key)return res.status(500).json({ok:false,error:'API_FOOTBALL_KEY non configurata'});
 const bookmaker=String(req.query.bookmaker||'').trim();
 const date=String(req.query.date||new Date().toISOString().slice(0,10));
 const qmin=Number(req.query.qmin||1.01),qmax=Number(req.query.qmax||100);
 try{
  const h={'x-apisports-key':key};
  const br=await fetch('https://v3.football.api-sports.io/odds/bookmakers',{headers:h});const bj=await br.json();const books=Array.isArray(bj.response)?bj.response:[];
  const target=books.find(b=>String(b.name||'').toLowerCase()===bookmaker.toLowerCase())||books.find(b=>String(b.name||'').toLowerCase().includes(bookmaker.toLowerCase()));
  if(bookmaker&&!target)return res.status(400).json({ok:false,error:'Bookmaker non disponibile in API-Football',available:books.map(b=>b.name).filter(Boolean)});
  const params=new URLSearchParams({date});if(target)params.set('bookmaker',String(target.id));let page=1,total=1,raw=[];
  do{params.set('page',String(page));const r=await fetch('https://v3.football.api-sports.io/odds?'+params,{headers:h});const j=await r.json();if(j.errors&&Object.keys(j.errors).length)return res.status(400).json({ok:false,errors:j.errors});raw.push(...(j.response||[]));total=Math.min(Number(j.paging?.total||1),3);page++;}while(page<=total&&page<=3);
  const fixtureMap=new Map();
  try{const fr=await fetch('https://v3.football.api-sports.io/fixtures?date='+encodeURIComponent(date)+'&timezone=Europe/Rome',{headers:h});const fj=await fr.json();if(!(fj.errors&&Object.keys(fj.errors).length))for(const f of(fj.response||[]))if(f?.fixture?.id)fixtureMap.set(String(f.fixture.id),f);}catch{}
  const preliminaryIds=new Set();for(const item of raw)for(const book of(item.bookmakers||[])){if(target&&book.id!==target.id)continue;for(const bet of(book.bets||[])){if(String(bet.name||'').trim().toLowerCase()!=='match winner')continue;for(const v of(bet.values||[])){const back=Number(v.odd);if(back>=qmin&&back<=qmax&&item?.fixture?.id)preliminaryIds.add(String(item.fixture.id));}}}
  const missing=[...preliminaryIds].filter(id=>!fixtureMap.has(id)).slice(0,12);if(missing.length){const rr=await Promise.all(missing.map(async id=>{try{const r=await fetch('https://v3.football.api-sports.io/fixtures?id='+id+'&timezone=Europe/Rome',{headers:h});const j=await r.json();return(j.response||[])[0]||null;}catch{return null}}));for(const f of rr)if(f?.fixture?.id)fixtureMap.set(String(f.fixture.id),f);}
  const out=[];for(const item of raw){const fx=item.fixture||{},full=fixtureMap.get(String(fx.id));const home=full?.teams?.home?.name||item?.teams?.home?.name||'',away=full?.teams?.away?.name||item?.teams?.away?.name||'',league=full?.league?.name||item?.league?.name||'',kickoff=full?.fixture?.date||fx.date;for(const book of(item.bookmakers||[])){if(target&&book.id!==target.id)continue;for(const bet of(book.bets||[])){if(String(bet.name||'').trim().toLowerCase()!=='match winner')continue;for(const v of(bet.values||[])){const back=Number(v.odd);if(back>=qmin&&back<=qmax)out.push({fixtureId:fx.id,date:kickoff,match:(home&&away)?home+' - '+away:'Partita #'+fx.id,home,away,league,market:bet.name,selection:v.value,book:book.name,back});}}}}
  let exchangeEvents=[],exchangeError=null;if(exchangeKey){try{exchangeEvents=await getExchange(exchangeKey,date);}catch(e){exchangeError=e.message;}}
  let matched=0;for(const row of out){const x=findLay(exchangeEvents,row);if(x&&x.lay>1){Object.assign(row,x);row.rating=Number((100*row.back/row.lay).toFixed(2));matched++;}else{row.lay=null;row.rating=null;}}
  out.sort((a,b)=>(b.rating||0)-(a.rating||0)||b.back-a.back);const resultIds=[...new Set(out.map(x=>String(x.fixtureId)))];const resolved=resultIds.filter(id=>fixtureMap.has(id));
  res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=20');
  return res.status(200).json({ok:true,date,bookmaker:target?.name||'Tutti',count:out.length,exchangeConnected:!!exchangeKey,exchangeEvents:exchangeEvents.length,exchangeMatched:matched,exchangeError,resolvedFixtures:resolved.length,totalFixtures:resultIds.length,note:exchangeKey?'Betfair Exchange collegato tramite The Odds API. Solo mercato Match Winner 1X2 viene abbinato.':'ODDSMATCHER_ODDS_API_KEY non configurata.',results:out});
 }catch(e){return res.status(500).json({ok:false,error:e.message});}
};