export default async function handler(req, res) {
  const key = process.env.API_FOOTBALL_KEY || process.env.API_SPORTS_KEY;
  if (!key) return res.status(500).json({ ok:false, error:'API_FOOTBALL_KEY non configurata su Vercel' });
  try {
    const r = await fetch('https://v3.football.api-sports.io/odds/bookmakers', { headers: { 'x-apisports-key': key } });
    const j = await r.json();
    if (!r.ok || (j.errors && Object.keys(j.errors).length)) return res.status(r.status || 500).json({ok:false, errors:j.errors || j});
    const wanted = ['sisal','snai','eurobet','goldbet','lottomatica','betflag','betfair'];
    const all = Array.isArray(j.response) ? j.response : [];
    const italian = all.filter(b => wanted.some(w => String(b.name||'').toLowerCase().includes(w)));
    res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate');
    return res.status(200).json({ok:true,total:all.length,italian,bookmakers:all});
  } catch (e) {
    return res.status(500).json({ok:false,error:e.message});
  }
}