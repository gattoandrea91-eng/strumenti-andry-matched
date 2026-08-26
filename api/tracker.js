export default async function handler(req,res){
  try{
    const r=await fetch('https://raw.githubusercontent.com/gattoandrea91-eng/strumenti-andry-matched/main/trackergatto-v2.html',{cache:'no-store'});
    if(!r.ok) throw new Error('Impossibile caricare TrackerGatto');
    let html=await r.text();

    const loginStart=html.indexOf('<div id="loginBox"');
    const appMarker='<div id="app" class="hidden">';
    const appStart=html.indexOf(appMarker,loginStart);
    if(loginStart!==-1&&appStart!==-1){
      html=html.slice(0,loginStart)+'<div id="app">'+html.slice(appStart+appMarker.length);
    }

    html=html.replace("<button onclick=\"location.href='index.html'\">← Strumenti</button>","<button onclick=\"location.href='/'\">← Strumenti</button>");

    const oldLogin="async function login(){loginMsg.textContent='Accesso...';const r=await SUPA.auth.signInWithPassword({email:email.value.trim(),password:password.value});if(r.error){loginMsg.textContent=r.error.message;return}await boot()}";
    html=html.replace(oldLogin,'');

    const oldLogout="async function logout(){await SUPA.auth.signOut();location.reload()}";
    html=html.replace(oldLogout,"async function logout(){await SUPA.auth.signOut();location.replace('/')} ");

    const oldBoot="async function boot(){const r=await SUPA.auth.getUser();user=r.data?.user||null;if(!user)return;loginBox.classList.add('hidden');app.classList.remove('hidden');logoutBtn.classList.remove('hidden');const m=user.user_metadata?.trackergatto;if(m&&typeof m==='object')data={holders:Array.isArray(m.holders)?m.holders:[],bets:Array.isArray(m.bets)?m.bets:[],movements:Array.isArray(m.movements)?m.movements:[]};render()}";
    const newBoot="async function boot(){const r=await SUPA.auth.getSession();user=r.data?.session?.user||null;if(!user){location.replace('/');return}logoutBtn.classList.remove('hidden');const m=user.user_metadata?.trackergatto;if(m&&typeof m==='object')data={holders:Array.isArray(m.holders)?m.holders:[],bets:Array.isArray(m.bets)?m.bets:[],movements:Array.isArray(m.movements)?m.movements:[]};render()}";
    html=html.replace(oldBoot,newBoot);

    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store');
    return res.status(200).send(html);
  }catch(e){
    return res.status(500).send('Errore TrackerGatto: '+e.message);
  }
}
