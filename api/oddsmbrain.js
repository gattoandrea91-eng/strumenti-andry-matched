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
module.exports=async(req,res)=>{
 if(req.method!=='GET')return json(res,405,{success:false,error:'Metodo non consentito'});
 try{if(!(await getAdmin(req)))return json(res,403,{success:false,error:'Accesso riservato all’amministratore'});
 const apiKey=process.env.ODDSPAPI_API_KEY;
 const mode=String(req.query?.action||'status');
 if(mode==='status')return json(res,200,{success:true,configured:Boolean(apiKey),mode:'PRIVATE_BETA',dataSource:'OddsPapi v4',message:apiKey?'Chiave disponibile. Inserisci un fixtureId per un test dati.':'In attesa della chiave OddsPapi e del collegamento VPS. Calcolatore manuale disponibile.'});
 if(mode==='odds'){
   if(!apiKey)return json(res,503,{success:false,error:'Chiave OddsPapi non ancora configurata sulla piattaforma.'});
   const fixtureId=String(req.query?.fixtureId||'').trim();
   if(!/^id[0-9]{6,22}$/.test(fixtureId))return json(res,400,{success:false,error:'Fixture ID non valido (es. id1000003969653792)'});
   const url=new URL('https://api.oddspapi.io/v4/odds');url.searchParams.set('fixtureId',fixtureId);url.searchParams.set('apiKey',apiKey);url.searchParams.set('oddsFormat','decimal');url.searchParams.set('verbosity','2');
   const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
   let response;
   try{response=await fetch(url,{cache:'no-store',signal:controller.signal})}finally{clearTimeout(timeout)}
   if(!response.ok)return json(res,502,{success:false,error:'OddsPapi ha restituito HTTP '+response.status});
   const data=await response.json();return json(res,200,{success:true,fixtureId,data});
 }
 return json(res,400,{success:false,error:'Azione sconosciuta'});
 }catch(error){return json(res,500,{success:false,error:'Impossibile contattare il servizio: '+String(error?.name==='AbortError'?'timeout':error?.message||'errore')})}
};