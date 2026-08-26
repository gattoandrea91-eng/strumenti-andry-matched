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

function calculateTeamRtg(stats, side){
  const shotsOnTarget = n(stats?.shotsOnTarget?.[side]);
  const totalShots = n(stats?.totalShots?.[side]);
  const corners = n(stats?.corners?.[side]);
  const touchesBox = n(stats?.touchesBox?.[side]);
  const bigChances = n(stats?.bigChances?.[side]);
  const possession = n(stats?.possession?.[side]);

  let rtg =
      shotsOnTarget * 4
    + totalShots
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

function getShotArray(shotmap){
  if(Array.isArray(shotmap)) return shotmap;
  if(Array.isArray(shotmap?.shots)) return shotmap.shots;
  if(Array.isArray(shotmap?.Periods?.All)) return shotmap.Periods.All;
  return [];
}

function getShotMinute(shot){
  return minuteNumber(
    shot?.min ??
    shot?.minute ??
    shot?.time ??
    shot?.eventTime ??
    shot?.matchTime
  );
}

function shotSide(shot){
  const raw = String(
    shot?.teamSide ??
    shot?.side ??
    shot?.team ??
    shot?.teamType ??
    ""
  ).toLowerCase();

  if(raw.includes("home")) return "home";
  if(raw.includes("away")) return "away";

  // FotMob spesso usa teamId, ma senza mappa certa non forziamo il lato.
  return "unknown";
}

function isShotOnTarget(shot){
  if(shot?.isOnTarget === true) return true;
  if(shot?.onTarget === true) return true;
  const type = String(
    shot?.eventType ??
    shot?.type ??
    shot?.shotType ??
    shot?.result ??
    ""
  ).toLowerCase();

  return (
    type.includes("goal") ||
    type.includes("saved") ||
    type.includes("save") ||
    type.includes("on target") ||
    type.includes("ontarget")
  );
}

function recentShotPressure(shotmap, minute, windowMinutes = 15){
  const fromMinute = Math.max(0, minute - windowMinutes);
  const shots = getShotArray(shotmap).filter(shot => {
    const sm = getShotMinute(shot);
    return sm > 0 && sm >= fromMinute && sm <= minute;
  });

  const result = {
    total: shots.length,
    onTarget: 0,
    home: 0,
    away: 0,
    homeOnTarget: 0,
    awayOnTarget: 0
  };

  for(const shot of shots){
    const side = shotSide(shot);
    const onTarget = isShotOnTarget(shot);
    if(onTarget) result.onTarget++;
    if(side === "home"){
      result.home++;
      if(onTarget) result.homeOnTarget++;
    } else if(side === "away"){
      result.away++;
      if(onTarget) result.awayOnTarget++;
    }
  }

  return result;
}

function choosePressureSide(recent, stats){
  if(recent.homeOnTarget !== recent.awayOnTarget){
    return recent.homeOnTarget > recent.awayOnTarget ? "home" : "away";
  }
  if(recent.home !== recent.away){
    return recent.home > recent.away ? "home" : "away";
  }

  const homeRtg = calculateTeamRtg(stats, "home");
  const awayRtg = calculateTeamRtg(stats, "away");
  return homeRtg >= awayRtg ? "home" : "away";
}

function pushSnapshot(matchId, minute, rtg, stats){
  const key = String(matchId);
  const history = state.history.get(key) || [];
  const snapshot = {
    minute,
    rtg,
    cornersHome: n(stats?.corners?.home),
    cornersAway: n(stats?.corners?.away),
    touchesHome: n(stats?.touchesBox?.home),
    touchesAway: n(stats?.touchesBox?.away),
    at: Date.now()
  };

  const last = history[history.length - 1];
  if(last && last.minute === minute){
    history[history.length - 1] = snapshot;
  } else {
    history.push(snapshot);
  }

  while(history.length > 10) history.shift();
  state.history.set(key, history);
  return history;
}

function deltaFromWindow(history, minute, windowMinutes = 15){
  if(history.length < 2){
    return { rtg:0, cornersHome:0, cornersAway:0, touchesHome:0, touchesAway:0, hasBase:false };
  }

  const targetMinute = minute - windowMinutes;
  let base = history[0];
  for(const item of history){
    if(item.minute <= targetMinute) base = item;
  }

  const last = history[history.length - 1];
  return {
    rtg: Math.round((last.rtg - base.rtg) * 10) / 10,
    cornersHome: Math.max(0, last.cornersHome - base.cornersHome),
    cornersAway: Math.max(0, last.cornersAway - base.cornersAway),
    touchesHome: Math.max(0, last.touchesHome - base.touchesHome),
    touchesAway: Math.max(0, last.touchesAway - base.touchesAway),
    hasBase: true
  };
}

function evaluateRecentPressure(minute, stats, shotmap, history){
  if(minute < 30 || minute > 88){
    return { hot:false, reason:"minute_outside" };
  }

  const recent = recentShotPressure(shotmap, minute, 15);
  const side = choosePressureSide(recent, stats);
  const other = side === "home" ? "away" : "home";
  const possession = n(stats?.possession?.[side]);
  const totalCorners = n(stats?.corners?.total);
  const sideCorners = n(stats?.corners?.[side]);
  const delta = deltaFromWindow(history, minute, 15);
  const recentCorners = side === "home" ? delta.cornersHome : delta.cornersAway;
  const recentTouches = side === "home" ? delta.touchesHome : delta.touchesAway;
  const sideRecentShots = side === "home" ? recent.home : recent.away;
  const sideRecentOnTarget = side === "home" ? recent.homeOnTarget : recent.awayOnTarget;

  // Se la shotmap non espone il lato, usiamo comunque i totali recenti.
  const sideUnknown = recent.home === 0 && recent.away === 0 && recent.total > 0;
  const effectiveShots = sideUnknown ? recent.total : sideRecentShots;
  const effectiveOnTarget = sideUnknown ? recent.onTarget : sideRecentOnTarget;

  const lotsOfRecentShots = effectiveShots >= 4 || recent.total >= 6;
  const strongRecentOnTarget = effectiveOnTarget >= 2 || recent.onTarget >= 3;
  const cornerSupport = recentCorners >= 1 || sideCorners >= 3 || totalCorners >= 5;
  const possessionGood = possession >= 53;
  const boxPressure = recentTouches >= 3 || n(stats?.touchesBox?.[side]) >= 10;
  const rtgGrowing = !delta.hasBase || delta.rtg >= 2;

  // Deve superare tutte le colonne principali: tiri, in porta, possesso.
  // Corner / tocchi area / crescita RTG fungono da ulteriore conferma.
  const confirmations = [cornerSupport, boxPressure, rtgGrowing].filter(Boolean).length;
  const hot =
    lotsOfRecentShots &&
    strongRecentOnTarget &&
    possessionGood &&
    confirmations >= 2;

  return {
    hot,
    side,
    other,
    possession,
    recent,
    recentCorners,
    recentTouches,
    deltaRtg: delta.rtg,
    checks: {
      lotsOfRecentShots,
      strongRecentOnTarget,
      cornerSupport,
      possessionGood,
      boxPressure,
      rtgGrowing,
      confirmations
    }
  };
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
        "✅ <b>SoccerTrend Telegram collegato</b>\n\nScanner pressione recente 15' attivo."
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
        return minute >= 30 && minute <= 88 && goals <= 3;
      })
      .slice(0, 14);

    const alerts = [];
    const checked = [];

    for(const match of candidates){
      try {
        const detail = await getJson(
          `${base}/api/footballfree?matchId=${encodeURIComponent(match.matchId)}`
        );

        const stats = detail.stats || {};
        const minute = minuteNumber(match.minute || detail.minute);
        const homeRtg = calculateTeamRtg(stats, "home");
        const awayRtg = calculateTeamRtg(stats, "away");
        const rtg = Math.round((homeRtg + awayRtg) * 10) / 10;
        const history = pushSnapshot(match.matchId, minute, rtg, stats);
        const pressure = evaluateRecentPressure(minute, stats, detail.shotmap, history);

        checked.push({
          id: match.matchId,
          minute,
          rtg,
          hot: pressure.hot,
          side: pressure.side,
          possession: pressure.possession,
          recentShots: pressure.recent?.total || 0,
          recentOnTarget: pressure.recent?.onTarget || 0,
          recentCorners: pressure.recentCorners || 0,
          deltaRtg: pressure.deltaRtg || 0,
          checks: pressure.checks || null
        });

        if(!pressure.hot) continue;

        const signalKey = String(match.matchId);
        if(state.sent.has(signalKey)) continue;

        const sideName = pressure.side === "home" ? match.home : match.away;
        const sideRecentShots = pressure.side === "home" ? pressure.recent.home : pressure.recent.away;
        const sideRecentOnTarget = pressure.side === "home" ? pressure.recent.homeOnTarget : pressure.recent.awayOnTarget;
        const sideUnknown = pressure.recent.home === 0 && pressure.recent.away === 0 && pressure.recent.total > 0;
        const shownShots = sideUnknown ? pressure.recent.total : sideRecentShots;
        const shownOnTarget = sideUnknown ? pressure.recent.onTarget : sideRecentOnTarget;

        const text =
          `🔥 <b>SOCCERTREND — GOL NELL'ARIA</b>\n\n` +
          `⚽ <b>${match.home} - ${match.away}</b>\n` +
          `⏱ ${minute}'   |   ${match.homeGoals ?? 0}-${match.awayGoals ?? 0}\n\n` +
          `🚨 Pressione: <b>${sideName}</b>\n` +
          `⏳ Ultimi 15': <b>${shownShots} tiri</b> • <b>${shownOnTarget} in porta</b>\n` +
          `🚩 Corner recenti: <b>${pressure.recentCorners}</b> (totali ${n(stats?.corners?.home)}-${n(stats?.corners?.away)})\n` +
          `📦 Tocchi area recenti: <b>${pressure.recentTouches}</b>\n` +
          `📊 Possesso: <b>${n(stats?.possession?.home)}%-${n(stats?.possession?.away)}%</b>\n` +
          `📈 RTG: <b>${rtg.toFixed(1)}</b> • Δ15': <b>${pressure.deltaRtg >= 0 ? "+" : ""}${pressure.deltaRtg.toFixed(1)}</b>\n\n` +
          `✅ <b>Pressione recente confermata — valuta ingresso Over corrente.</b>\n` +
          `⚠️ Segnale statistico, non garanzia di gol.`;

        await telegramSend(text);
        state.sent.add(signalKey);
        alerts.push({
          id: match.matchId,
          match: `${match.home} - ${match.away}`,
          minute,
          side: sideName,
          recentShots: shownShots,
          recentOnTarget: shownOnTarget,
          possession: pressure.possession
        });
      } catch (error) {
        checked.push({ id: match.matchId, error: String(error?.message || error) });
      }
    }

    const liveIds = new Set(matches.map(m => String(m.matchId)));
    for(const key of state.history.keys()) if(!liveIds.has(key)) state.history.delete(key);
    for(const key of state.sent) if(!liveIds.has(key)) state.sent.delete(key);

    return res.status(200).json({
      success:true,
      mode:"RECENT_PRESSURE_SCAN",
      windowMinutes:15,
      live:matches.length,
      candidates:candidates.length,
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
