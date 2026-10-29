const fs=require('fs');const path=require('path');
const INITIAL=1000;
function money(v){return Math.round(v*100)/100}
function calc(rows){let bank=INITIAL,wins=0,losses=0,pending=0,staked=0;const bets=[];
for(const r of rows.slice().sort((a,b)=>String(a.timestamp||'').localeCompare(String(b.timestamp||'')))){
 const odds=Number(r.odds),prob=Number(r.probability),status=String(r.result||'PENDING').toUpperCase();
 if(!Number.isFinite(odds)||odds<=1||!Number.isFinite(prob)||prob<=0||prob>=1)continue;
 const full=Math.max(0,(odds*prob-1)/(odds-1)),kelly=money(Math.min(bank*0.02,bank*full*0.25)),stake=kelly>0?kelly:Math.min(20,money(bank));let pl=0;
 if(status==='WIN'){pl=money(stake*(odds-1));bank=money(bank+pl);wins++}
 else if(status==='LOSS'){pl=-stake;bank=money(bank+pl);losses++}
 else {pending++}
 if(status==='WIN'||status==='LOSS')staked=money(staked+stake);
 bets.push({id:String(r.id||''),match:String(r.match||''),selection:String(r.selection||''),timestamp:String(r.timestamp||''),odds,probability:prob,kellyStake:kelly,stake,strategy:kelly>0?'QUARTER_KELLY':'FLAT_FALLBACK_20',result:status,profit:pl,bankrollAfter:bank});
}
const closed=wins+losses;return{success:true,initialCapital:INITIAL,capital:bank,profit:money(bank-INITIAL),roi:staked?money((bank-INITIAL)/staked*100):0,total:bets.length,closed,wins,losses,pending,winRate:closed?money(wins/closed*100):0,bets:bets.slice(-25).reverse(),rules:{quarterKelly:true,capPercent:2,fallbackStake:20,probabilityRequired:true,commissionIncluded:false}}}
module.exports=async(req,res)=>{if(req.method!=='GET')return res.status(405).json({success:false,error:'Method not allowed'});try{const filename=path.join(process.cwd(),'nba-bets.json');let rows=[];if(fs.existsSync(filename))rows=JSON.parse(fs.readFileSync(filename,'utf8'));if(!Array.isArray(rows))throw Error('nba-bets.json must be an array');res.setHeader('Cache-Control','no-store');return res.status(200).json(calc(rows))}catch(e){return res.status(500).json({success:false,error:String(e.message||e)})}};
