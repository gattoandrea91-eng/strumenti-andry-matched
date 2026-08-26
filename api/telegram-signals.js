const state = globalThis.__SOCCERTREND_TELEGRAM_STATE__ || {
  history: new Map(),
  sent: new Set()
};
globalThis.__SOCCERTREND_TELEGRAM_STATE__ = state;

function n(value){
  const x = Number(value);
  return Number.isFinite(x) ? x : 0;
}

function minuteNumber(value){
  const m = String(value || "").match(/\d+/);
  return m ? Number(m[0]) : 0;
}

function threshold(minute){
  if(minute < 25) return 999;
  if(minute <= 44) return .40;
  if(minute <= 64) return .45;
  if(minute <= 79) return .50;
  return .55;
}

function calculateTeamRtg(stats, side){
  const shotsOnTarget = n(stats?.shotsOnTarget?.[side]);
  const totalShots = n(stats?.totalShots?.[side]);
  const corners = n(stats?.corners?.[side]);
  const touchesBox = n(stats?.touchesBox?.[side]);
  const bigChances = n(stats?.bigChances?.[side]);
  const possession = n(stats?.possession?.[side]);

  let rtg =
      shotsOnTarget * 4
    + totalShots * 1
    + corners * 1.5
    + touchesBox * .6
    + bigChances * 5;

  const attackingActivity =
       shotsOnTarget >= 2
    || totalShots >= 3
    || touchesBox >= 6;

  if(possession >= 55 && attackingActivity){
    rtg += Math.min(4, (possession - 50) * .15);
  }

  return Math.round(rtg * 10) / 10;
}

function isReady(minute, rtg, stats){
  if(minute < 25) return false;
  const rate = minute > 0 ? rtg / minute : 0;
  const strongConfirmation =
       n(stats?.shotsOnTarget?.total) >= 3
    || n(stats?.touchesBox?.total) >= 12
    || n(stats?.bigChances?.total) >= 2
    || n(stats?.corners?.total) >= 5;
  return rate >= threshold(minute) && strongConfirmation;
}

function pushHistory(matchId, minute, rtg){
  const key = String(matchId);
  const history = state.history.get(key) || [];
  const last = history[history.length - 1];

  if(last && last.minute === minute){
    last.rtg = rtg;
  } else {
    history.push({ minute, rtg, at: Date.now() });
  }

  while(history.length > 6) history.shift();
  state.history.set(key, history);
  return history;
}

function recentDelta(history){
  if(history.length < 2) return 0;
  const last = history[history.length - 1].rtg;
  const base = history[Math.max(0, history.length - 4)].rtg;
  return Math.round((last - base) * 10) / 10;
}

async function telegramSend(text){
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if(!token || !chatId) throw new Error("Telegram env mancanti");

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });

  const data = await response.json();
  if(!response.ok || !data.ok){
    throw new Error(`Telegram: ${JSON.stringify(data).slice(0,500)}`);
  }
  return data;
}

async function getJson(url){
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if(!response.ok || !data?.success){
    throw new Error(`API ${response.status}: ${JSON.stringify(data).slice(0,500)}`);
  }
  return data;
}

module.exports = async (req, res) => {
  try {
    if(req.query?.test === "1"){
      await telegramSend(
        "✅ <b>SoccerTrend Telegram collegato</b>\n\nIl bot è online e può pubblicare i segnali nel canale."
      );
      return res.status(200).json({ success:true, mode:"TEST", sent:true });
    }

    const protocol = (req.headers["x-forwarded-proto"] || "https").split(",")[0];
    const host = req.headers.host;
    const base = `${protocol}://${host}`;

    const live = await getJson(`${base}/api/footballfree`);
    const matches = Array.isArray(live.liveMatches) ? live.liveMatches : [];

    const candidates = matches
      .filter(match => {
        const minute = minuteNumber(match.minute);
        const goals = n(match.homeGoals) + n(match.awayGoals);
        return minute >= 25 && minute <= 85 && goals <= 2;
      })
      .slice(0, 12);

    const alerts = [];
    const checked = [];

    for(const match of candidates){
      try {
        const detail = await getJson(
          `${base}/api/footballfree?matchId=${encodeURIComponent(match.matchId)}`
        );
        const stats = detail.stats || {};
        const homeRtg = calculateTeamRtg(stats, "home");
        const awayRtg = calculateTeamRtg(stats, "away");
        const rtg = Math.round((homeRtg + awayRtg) * 10) / 10;
        const minute = minuteNumber(match.minute || detail.minute);
        const rate = minute > 0 ? rtg / minute : 0;
        const history = pushHistory(match.matchId, minute, rtg);
        const delta = recentDelta(history);
        const ready = isReady(minute, rtg, stats);
        const hot = ready && delta >= 3;

        checked.push({
          id: match.matchId,
          minute,
          rtg,
          rate: Math.round(rate * 100) / 100,
          delta,
          ready,
          hot
        });

        if(!hot) continue;

        const signalKey = String(match.matchId);
        if(state.sent.has(signalKey)) continue;

        const text =
          `🔥 <b>SOCCERTREND — OVER CORRENTE</b>\n\n` +
          `⚽ <b>${match.home} - ${match.away}</b>\n` +
          `⏱ ${minute}'   |   ${match.homeGoals ?? 0}-${match.awayGoals ?? 0}\n` +
          `📈 RTG: <b>${rtg.toFixed(1)}</b>   |   RTG/min: <b>${rate.toFixed(2)}</b>\n` +
          `🚀 Δ RTG recente: <b>+${delta.toFixed(1)}</b>\n\n` +
          `🎯 Tiri: ${n(stats?.totalShots?.home)}-${n(stats?.totalShots?.away)}\n` +
          `🥅 In porta: ${n(stats?.shotsOnTarget?.home)}-${n(stats?.shotsOnTarget?.away)}\n` +
          `🚩 Corner: ${n(stats?.corners?.home)}-${n(stats?.corners?.away)}\n` +
          `📦 Tocchi area: ${n(stats?.touchesBox?.home)}-${n(stats?.touchesBox?.away)}\n` +
          `⭐ Big chances: ${n(stats?.bigChances?.home)}-${n(stats?.bigChances?.away)}\n` +
          `📊 Possesso: ${n(stats?.possession?.home)}%-${n(stats?.possession?.away)}%\n\n` +
          `⚠️ Segnale statistico, non garanzia di gol.`;

        await telegramSend(text);
        state.sent.add(signalKey);
        alerts.push({ id: match.matchId, match: `${match.home} - ${match.away}`, minute, rtg, delta });
      } catch (error) {
        checked.push({ id: match.matchId, error: String(error?.message || error) });
      }
    }

    // Pulizia semplice: rimuove storico/segnali di partite non più live.
    const liveIds = new Set(matches.map(m => String(m.matchId)));
    for(const key of state.history.keys()) if(!liveIds.has(key)) state.history.delete(key);
    for(const key of state.sent) if(!liveIds.has(key)) state.sent.delete(key);

    return res.status(200).json({
      success:true,
      mode:"SCAN",
      live: matches.length,
      candidates: candidates.length,
      alerts,
      checked
    });
  } catch (error) {
    return res.status(500).json({
      success:false,
      error:String(error?.message || error)
    });
  }
};
