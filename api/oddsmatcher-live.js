function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(fc|cf|ac|sc|afc|calcio|football|club)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim();}
function compact(s){return norm(s).replace(/\s+/g,'');}
function sameTeam(a,b){const x=norm(a),y=norm(b);return !!x&&!!y&&(x===y||x.includes(y)||y.includes(x));}
function selName(sel,home,away){const s=norm(sel);if(s==='home'||s==='1'||sameTeam(sel,home))return home;if(s==='away'||s==='2'||sameTeam(sel,away))return away;if(s==='draw'||s==='x'||s==='pareggio')return 'Draw';return sel;}
function displaySelection(sel){const s=norm(sel);if(s==='home'||s==='1')return '1';if(s==='draw'||s==='x'||s==='pareggio')return 'X';if(s==='away'||s==='2')return '2';return sel;}

const BOOK_ALIASES={
 'bet365':['bet365','bet 365'],
 'betfairbookmaker':['betfair','betfair sportsbook','betfair bookmaker'],
 'betflagbookmaker':['betflag','betflag bookmaker'],
 'williamhill':['william hill','williamhill'],
 'netbet':['netbet','net bet'],
 '10bet':['10bet','10 bet'],
 'bwin':['bwin'],
 'betsson':['betsson'],
 'betano':['betano'],
 'unibet':['unibet'],
 'pinnacle':['pinnacle'],
 'codere':['codere']
};

// Bet365 e' stabile come bookmaker id 8 in API-Football: evitiamo una chiamata reference ad ogni ricerca.
const STATIC_BOOKS={bet365:{id:8,name:'Bet365'}};
const bookCache=new Map();

function findBook(books,wanted){
 const w=compact(wanted),aliases=BOOK_ALIASES[w]||[wanted];
 for(const a of aliases){const ac=compact(a),exact=books.find(b=>compact(b.name)===ac);if(exact)return exact;}
 for(const a of aliases){const an=norm(a),partial=books.find(b=>{const bn=norm(b.name);return bn&&an&&(bn.includes(an)||an.includes(bn));});if(partial)return partial;}
 return null;
}

function headerNum(headers,names){for(const n of names){const v=headers.get(n);if(v!==null&&v!==''){const x=Number(v);if(Number.isFinite(x))return x;}}return null;}
function captureRate(headers,usage){
 const dailyRemaining=headerNum(headers,['x-ratelimit-requests-remaining','x-ratelimit-requestsremaining']);
 const dailyLimit=headerNum(headers,['x-ratelimit-requests-limit','x-ratelimit-requestslimit']);
 const minuteRemaining=headerNum(headers,['x-ratelimit-remaining']);
 const minuteLimit=headerNum(headers,['x-ratelimit-limit']);
 if(dailyRemaining!==null)usage.remaining=dailyRemaining;
 if(dailyLimit!==null)usage.limit=dailyLimit;
 if(minuteRemaining!==null)usage.minuteRemaining=minuteRemaining;
 if(minuteLimit!==null)usage.minuteLimit=minuteLimit;
}
async function footballFetch(url,headers,usage){
 usage.callsThisSearch++;
 const r=await fetch(url,{headers});
 captureRate(r.headers,usage);
 let j={};try{j=await r.json();}catch{j={};}
 const errs=j&&j.errors&&typeof j.errors==='object'?j.errors:{};
 if(Object.keys(errs).length)usage.providerErrors={...usage.providerErrors,...errs};
 return {r,j};
}
function quotaGone(usage){
 if(usage.remaining===0)return true;
 const txt=JSON.stringify(usage.providerErrors||{}).toLowerCase();
 return txt.includes('request')&&(txt.includes('limit')||txt.includes('quota')||txt.includes('rate'));
}

async function resolveBook(bookmaker,h,usage){
 const key=compact(bookmaker);
 if(!key)return null;
 if(STATIC_BOOKS[key])return STATIC_BOOKS[key];
 const cached=bookCache.get(key);if(cached&&Date.now()-cached.ts<24*60*60*1000)return cached.book;
 const aliases=BOOK_ALIASES[key]||[bookmaker];
 for(const alias of aliases){
  const {r,j}=await footballFetch('https://v3.football.api-sports.io/odds/bookmakers?search='+encodeURIComponent(alias),h,usage);
  if(!r.ok||Object.keys(j.errors||{}).length){if(quotaGone(usage))return null;continue;}
  const books=Array.isArray(j.response)?j.response:[];const found=findBook(books,bookmaker);
  if(found){bookCache.set(key,{book:found,ts:Date.now()});return found;}
 }
 return null;
}

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
   try{const u='https://api.the-odds-api.com/v4/sports/'+encodeURIComponent(s.key)+'/odds?apiKey='+encodeURIComponent(key)+'&regions=eu&markets=h2h_lay&oddsFormat=decimal&dateFormat=iso&bookmakers=betfair_ex_eu';const r=await fetch(u);const j=await r.json();return r.ok&&Array.isArray(j)?j:[];}catch{return []}
  }));
  for(const arr of got)for(const e of arr){const t=new Date(e.commence_time);if(t>=from&&t<=to)all.push(e);}
 }
 return all;
}
function findLay(events,row){
 let best=null,bestScore=0;const kt=new Date(row.date).getTime();
 for(const e of events){let score=0;if(sameTeam(row.home,e.home_team))score+=4;if(sameTeam(row.away,e.away_team))score+=4;const dt=Math.abs(new Date(e.commence_time).getTime()-kt);if(dt<=30*60000)score+=3;else if(dt<=90*60000)score+=1;if(score>bestScore){bestScore=score;best=e;}}
 if(!best||bestScore<7)return null;
 const ex=(best.bookmakers||[]).find(b=>String(b.key).startsWith('betfair_ex'));const market=(ex?.markets||[]).find(m=>m.key==='h2h_lay');const wanted=selName(row.rawSelection||row.selection,row.home,row.away);const o=(market?.outcomes||[]).find(x=>sameTeam(x.name,wanted)||(norm(wanted)==='draw'&&norm(x.name)==='draw'));
 return o?{lay:Number(o.price),layLimit:o.bet_limit??null,exchange:ex.title||'Betfair Exchange',exchangeUpdated:market.last_update||ex.last_update||null}:null;
}

module.exports=async function handler(req,res){
 const key=process.env.API_FOOTBALL_KEY||process.env.API_SPORTS_KEY;const exchangeKey=process.env.ODDSMATCHER_ODDS_API_KEY;
 if(!key)return res.status(500).json({ok:false,error:'API_FOOTBALL_KEY non configurata'});
 const bookmaker=String(req.query.bookmaker||'').trim();const date=String(req.query.date||new Date().toISOString().slice(0,10));const qmin=Number(req.query.qmin||1.01),qmax=Number(req.query.qmax||100);
 const usage={callsThisSearch:0,remaining:null,limit:null,minuteRemaining:null,minuteLimit:null,providerErrors:{}};
 try{
  const h={'x-apisports-key':key};
  const target=await resolveBook(bookmaker,h,usage);
  if(bookmaker&&!target){
   const exhausted=quotaGone(usage);
   return res.status(exhausted?429:400).json({ok:false,error:exhausted?'API-Football: quota chiamate esaurita o limite raggiunto':'Bookmaker non disponibile in API-Football',requested:bookmaker,apiFootball:{...usage,quotaExhausted:exhausted}});
  }

  const params=new URLSearchParams({date});if(target)params.set('bookmaker',String(target.id));let page=1,total=1,raw=[];
  do{
   params.set('page',String(page));const {r,j}=await footballFetch('https://v3.football.api-sports.io/odds?'+params,h,usage);
   if(!r.ok||Object.keys(j.errors||{}).length){const exhausted=quotaGone(usage);return res.status(exhausted?429:400).json({ok:false,error:exhausted?'API-Football: quota chiamate esaurita o limite raggiunto':'Errore API-Football odds',errors:j.errors||{},apiFootball:{...usage,quotaExhausted:exhausted}});}
   raw.push(...(j.response||[]));total=Math.min(Number(j.paging?.total||1),3);page++;
  }while(page<=total&&page<=3);

  const preliminaryIds=new Set();
  for(const item of raw)for(const book of(item.bookmakers||[])){if(target&&book.id!==target.id)continue;for(const bet of(book.bets||[])){if(String(bet.name||'').trim().toLowerCase()!=='match winner')continue;for(const v of(bet.values||[])){const back=Number(v.odd);if(back>=qmin&&back<=qmax&&item?.fixture?.id)preliminaryIds.add(String(item.fixture.id));}}}

  // Niente piu' una chiamata per ogni singola partita: API-Football accetta fino a 20 fixture IDs insieme.
  const fixtureMap=new Map(),ids=[...preliminaryIds];
  for(let i=0;i<ids.length;i+=20){
   const batch=ids.slice(i,i+20);if(!batch.length)continue;
   const {r,j}=await footballFetch('https://v3.football.api-sports.io/fixtures?ids='+encodeURIComponent(batch.join('-'))+'&timezone=Europe/Rome',h,usage);
   if(r.ok&&!Object.keys(j.errors||{}).length)for(const f of(j.response||[]))if(f?.fixture?.id)fixtureMap.set(String(f.fixture.id),f);
   if(quotaGone(usage))break;
  }

  const out=[];
  for(const item of raw){const fx=item.fixture||{},full=fixtureMap.get(String(fx.id));const home=full?.teams?.home?.name||item?.teams?.home?.name||'',away=full?.teams?.away?.name||item?.teams?.away?.name||'',league=full?.league?.name||item?.league?.name||'',kickoff=full?.fixture?.date||fx.date;for(const book of(item.bookmakers||[])){if(target&&book.id!==target.id)continue;for(const bet of(book.bets||[])){if(String(bet.name||'').trim().toLowerCase()!=='match winner')continue;for(const v of(bet.values||[])){const back=Number(v.odd);if(back>=qmin&&back<=qmax)out.push({fixtureId:fx.id,date:kickoff,match:(home&&away)?home+' - '+away:'Partita #'+fx.id,home,away,league,market:'1X2',rawSelection:v.value,selection:displaySelection(v.value),book:book.name,back});}}}}

  let exchangeEvents=[],exchangeError=null;if(exchangeKey&&out.length){try{exchangeEvents=await getExchange(exchangeKey,date);}catch(e){exchangeError=e.message;}}
  let matched=0;for(const row of out){const x=findLay(exchangeEvents,row);if(x&&x.lay>1){Object.assign(row,x);row.rating=Number((100*row.back/row.lay).toFixed(2));matched++;}else{row.lay=null;row.rating=null;}delete row.rawSelection;}
  out.sort((a,b)=>(b.rating||0)-(a.rating||0)||b.back-a.back);
  const resultIds=[...new Set(out.map(x=>String(x.fixtureId)))],resolved=resultIds.filter(id=>fixtureMap.has(id));
  const exhausted=quotaGone(usage);res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=60');
  return res.status(200).json({ok:true,date,bookmaker:target?.name||bookmaker||'Tutti',requestedBookmaker:bookmaker,count:out.length,apiFootball:{...usage,quotaExhausted:exhausted},exchangeConnected:!!exchangeKey,exchangeEvents:exchangeEvents.length,exchangeMatched:matched,exchangeError,resolvedFixtures:resolved.length,totalFixtures:resultIds.length,note:(exhausted?'API-Football quota esaurita. ':'')+(exchangeKey?(exchangeError?'Errore Exchange: '+exchangeError:'Betfair Exchange collegato tramite The Odds API. Abbinamenti trovati: '+matched+'.'):'ODDSMATCHER_ODDS_API_KEY non configurata.'),results:out});
 }catch(e){return res.status(500).json({ok:false,error:e.message,apiFootball:{...usage,quotaExhausted:quotaGone(usage)}});}
};