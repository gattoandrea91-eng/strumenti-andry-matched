const AUTHORIZED_USER_ID='1041101935';

function telegramToken(){const token=process.env.TELEGRAM_BOT_TOKEN;if(!token)throw new Error('TELEGRAM_BOT_TOKEN mancante');return token}
async function tg(method,body){const token=telegramToken();const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok||!d.ok)throw new Error(`${method}: ${JSON.stringify(d).slice(0,500)}`);return d.result}
async function answer(id,text,show_alert=false){try{return await tg('answerCallbackQuery',{callback_query_id:id,text,show_alert})}catch{return null}}
async function removeKeyboard(chatId,messageId){try{return await tg('editMessageReplyMarkup',{chat_id:chatId,message_id:messageId,reply_markup:{inline_keyboard:[]}})}catch{return null}}
async function sendAudit(chatId,messageId,text){try{return await tg('sendMessage',{chat_id:chatId,reply_to_message_id:messageId,text,parse_mode:'HTML',disable_web_page_preview:true})}catch{return null}}

module.exports=async(req,res)=>{
  try{
    if(req.method==='GET'){
      if(String(req.query?.setup||'')==='1'){
        const proto=(req.headers['x-forwarded-proto']||'https').split(',')[0];
        const host=req.headers.host;
        const url=`${proto}://${host}/api/telegram-bet-confirm`;
        const result=await tg('setWebhook',{url,allowed_updates:['callback_query'],drop_pending_updates:false});
        return res.status(200).json({success:true,webhook:url,result});
      }
      return res.status(200).json({success:true,service:'TELEGRAM_BET_CONFIRM',authorizedUserId:AUTHORIZED_USER_ID});
    }
    if(req.method!=='POST')return res.status(405).json({success:false,error:'POST required'});
    const cq=req.body?.callback_query;
    if(!cq)return res.status(200).json({success:true,ignored:true});
    const fromId=String(cq?.from?.id||'');
    const data=String(cq?.data||'');
    const msg=cq?.message;
    const chatId=msg?.chat?.id;
    const messageId=msg?.message_id;
    if(!data.startsWith('st_confirm:')&&!data.startsWith('st_cancel:')){
      await answer(cq.id,'Comando non riconosciuto');
      return res.status(200).json({success:true,ignored:true});
    }
    if(fromId!==AUTHORIZED_USER_ID){
      await answer(cq.id,'⛔ Non autorizzato',true);
      return res.status(200).json({success:true,authorized:false});
    }
    const [action,matchId]=data.split(':',2);
    if(!chatId||!messageId){
      await answer(cq.id,'Messaggio non disponibile',true);
      return res.status(200).json({success:true,authorized:true,error:'message_missing'});
    }
    await removeKeyboard(chatId,messageId);
    if(action==='st_confirm'){
      await answer(cq.id,'✅ Conferma registrata');
      await sendAudit(chatId,messageId,`✅ <b>CONFERMATA DA ANDREA</b>\nMatch ID: <code>${String(matchId||'')}</code>\n\nLa conferma è manuale. Nessun ordine Betfair viene inviato da questo endpoint.`);
      return res.status(200).json({success:true,authorized:true,status:'CONFIRMED',matchId});
    }
    await answer(cq.id,'❌ Segnale annullato');
    await sendAudit(chatId,messageId,`❌ <b>ANNULLATA DA ANDREA</b>\nMatch ID: <code>${String(matchId||'')}</code>`);
    return res.status(200).json({success:true,authorized:true,status:'CANCELLED',matchId});
  }catch(e){return res.status(500).json({success:false,error:String(e?.message||e)})}
};