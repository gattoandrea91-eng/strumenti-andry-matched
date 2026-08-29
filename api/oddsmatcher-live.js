module.exports = async function handler(req,res){
 const key=process.env.API_FOOTBALL_KEY||process.env.API_SPORTS_KEY;
 if(!key)return res.status(500).json({ok:false,error:'API_FOOTBALL_KEY non configurata'});
 const bookmaker=String(req.query.bookmaker||'').trim();
 const date=String(req.query.date||new Date().toISOString().slice(0,10));
 const qmin=Number(req.query.qmin||1.01),qmax=Number(req.query.qmax||100);
 try{
  const h={'x-apisports-key':key};
  const br=await fetch('https://v3.football.api-sports.io/odds/bookmakers',{headers:h});
  const bj=await br.json();
  const books=Array.isArray(bj.response)?bj.response:[];
  const target=books.find(b=>String(b.name||'').toLowerCase()===bookmaker.toLowerCase())||books.find(b=>String(b.name||'').toLowerCase().includes(bookmaker.toLowerCase()));
  if(bookmaker&&!target)return res.status(400).json({ok:false,error:'Bookmaker non disponibile in API-Football',available:books.map(b=>b.name).filter(Boolean)});
  const params=new URLSearchParams({date});
  if(target)params.set('bookmaker',String(target.id));
  let page=1,total=1,raw=[];
  do{
   params.set('page',String(page));
   const r=await fetch('https://v3.football.api-sports.io/odds?'+params.toString(),{headers:h});
   const j=await r.json();
   if(j.errors&&Object.keys(j.errors).length)return res.status(400).json({ok:false,errors:j.errors});
   raw.push(...(j.response||[]));
   total=Math.min(Number(j.paging?.total||1),3);
   page++;
  }while(page<=total&&page<=3);

  // Odds non include sempre i nomi squadra. Recuperiamo le fixture a gruppi,
  // usando l'endpoint /fixtures?id=... che e' supportato in modo affidabile.
  const fixtureIds=[...new Set(raw.map(x=>x?.fixture?.id).filter(Boolean))];
  const fixtureMap=new Map();
  const chunks=[];
  for(let i=0;i<fixtureIds.length;i+=12)chunks.push(fixtureIds.slice(i,i+12));
  for(const chunk of chunks.slice(0,5)){
   const results=await Promise.all(chunk.map(async id=>{
    try{
     const fr=await fetch('https://v3.football.api-sports.io/fixtures?id='+encodeURIComponent(id)+'&timezone=Europe/Rome',{headers:h});
     const fj=await fr.json();
     return (fj.response||[])[0]||null;
    }catch{return null}
   }));
   for(const f of results){if(f?.fixture?.id)fixtureMap.set(String(f.fixture.id),f)}
  }

  const out=[];
  for(const item of raw){
   const fx=item.fixture||{};
   const full=fixtureMap.get(String(fx.id));
   const home=full?.teams?.home?.name||item?.teams?.home?.name||'';
   const away=full?.teams?.away?.name||item?.teams?.away?.name||'';
   const league=full?.league?.name||item?.league?.name||'';
   const kickoff=full?.fixture?.date||fx.date;
   for(const book of (item.bookmakers||[])){
    if(target&&book.id!==target.id)continue;
    for(const bet of (book.bets||[])){
     const bn=String(bet.name||'');
     if(!/match winner|winner|1x2/i.test(bn))continue;
     for(const v of (bet.values||[])){
      const back=Number(v.odd);
      if(!(back>=qmin&&back<=qmax))continue;
      out.push({fixtureId:fx.id,date:kickoff,match:(home&&away)?home+' - '+away:'Partita #'+fx.id,home,away,league,market:bn,selection:v.value,book:book.name,back});
     }
    }
   }
  }
  out.sort((a,b)=>b.back-a.back);
  res.setHeader('Cache-Control','s-maxage=120, stale-while-revalidate=30');
  return res.status(200).json({ok:true,date,bookmaker:target?.name||'Tutti',count:out.length,exchangeConnected:false,resolvedFixtures:fixtureMap.size,totalFixtures:fixtureIds.length,note:'Quote bookmaker reali. Nomi delle partite risolti tramite Fixtures API; per rating matched betting serve una quota BANCA Exchange reale.',results:out});
 }catch(e){return res.status(500).json({ok:false,error:e.message});}
};