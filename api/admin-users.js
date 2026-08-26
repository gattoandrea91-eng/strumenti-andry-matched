export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key) return res.status(500).json({success:false,error:'SUPABASE_SERVICE_ROLE_KEY mancante'});
  try{
    const r=await fetch('https://aihwrkqfzhwedqdbxbxh.supabase.co/auth/v1/admin/users?page=1&per_page=1000',{headers:{apikey:key,Authorization:`Bearer ${key}`}});
    const data=await r.json();
    if(!r.ok) return res.status(r.status).json({success:false,error:data});
    const users=(data.users||[]).map(u=>({id:u.id,email:u.email,created_at:u.created_at,last_sign_in_at:u.last_sign_in_at}));
    return res.status(200).json({success:true,count:users.length,users});
  }catch(e){return res.status(500).json({success:false,error:e.message})}
}