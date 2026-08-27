const FOTMOB_BASE = "https://www.fotmob.com/api/data";

function todayYYYYMMDD() {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

async function fotmobFetch(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept": "application/json,text/plain,*/*",
      "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
      "Referer": "https://www.fotmob.com/"
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`FotMob ${response.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

function num(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "string") {
    const clean = value.replace("%", "").replace(",", ".").trim().split(" ")[0];
    const n = Number(clean);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function extractPairFromNode(node) {
  if (!node || typeof node !== "object") return null;

  const candidates = [node.stats, node.values, node.value, node.data];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length >= 2) {
      return [num(c[0]), num(c[1])];
    }
  }

  if (node.home !== undefined || node.away !== undefined) {
    return [num(node.home), num(node.away)];
  }

  if (node.homeValue !== undefined || node.awayValue !== undefined) {
    return [num(node.homeValue), num(node.awayValue)];
  }

  return null;
}

function findStatFlexible(root, aliases) {
  const wanted = aliases.map(normalizeKey).filter(Boolean);
  const queue = [root];
  const visited = new Set();

  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== "object" || visited.has(node)) continue;
    visited.add(node);

    if (!Array.isArray(node)) {
      const names = [node.key, node.title, node.name, node.label, node.statName, node.localizedTitle]
        .map(normalizeKey)
        .filter(Boolean);

      const matches = names.some(name => wanted.some(w => name === w || name.includes(w) || w.includes(name)));
      if (matches) {
        const pair = extractPairFromNode(node);
        if (pair) return pair;
      }
    }

    if (Array.isArray(node)) {
      for (const item of node) queue.push(item);
    } else {
      for (const value of Object.values(node)) {
        if (value && typeof value === "object") queue.push(value);
      }
    }
  }

  return [0, 0];
}

function pairFlexible(statsRoot, aliases) {
  const values = findStatFlexible(statsRoot, aliases);
  const home = num(values?.[0]);
  const away = num(values?.[1]);
  return { home, away, total: home + away };
}

function calculateRtg(stats) {
  // Il possesso NON pesa nel rating: preferiamo azioni concrete e pressione offensiva.
  const raw =
      (stats.shotsOnTarget.total * 4)
    + (stats.totalShots.total * 1)
    + (stats.corners.total * 1.5)
    + (stats.touchesBox.total * 0.6)
    + (stats.bigChances.total * 5);
  return Math.round(raw * 10) / 10;
}

function normalizeMomentum(rawMomentum) {
  if (!rawMomentum) return [];
  if (Array.isArray(rawMomentum)) return rawMomentum;
  if (Array.isArray(rawMomentum?.main)) return rawMomentum.main;
  if (Array.isArray(rawMomentum?.data)) return rawMomentum.data;
  return [];
}

function lastMomentumValue(momentum) {
  const arr = normalizeMomentum(momentum);
  if (!arr.length) return null;
  const last = arr[arr.length - 1];
  if (typeof last === "number") return last;
  if (typeof last?.value === "number") return last.value;
  return null;
}

function getLiveMinute(status) {
  if (!status) return "";
  if (status.liveTime?.short) return String(status.liveTime.short);
  if (status.liveTime?.long) return String(status.liveTime.long);
  if (typeof status.liveTime === "string") return status.liveTime;
  if (status.reason && String(status.reason).includes("'")) return String(status.reason);
  return "";
}

module.exports = async (req, res) => {
  try {
    const matchId = String(req.query.matchId || "").trim();

    if (matchId) {
      const data = await fotmobFetch(`${FOTMOB_BASE}/matchDetails?matchId=${encodeURIComponent(matchId)}`);
      const content = data?.content || {};
      const statsRoot = content?.stats || {};

      const stats = {
        possession: pairFlexible(statsRoot, [
          "BallPossesion", "BallPossession", "Possession", "Possesso", "Possesso palla"
        ]),
        totalShots: pairFlexible(statsRoot, [
          "total_shots", "TotalShots", "Total shots", "Shots", "Tiri", "Tiri totali"
        ]),
        shotsOnTarget: pairFlexible(statsRoot, [
          "ShotsOnTarget", "shots_on_target", "Shots on target", "Tiri in porta"
        ]),
        shotsOffTarget: pairFlexible(statsRoot, [
          "ShotsOffTarget", "shots_off_target", "Shots off target", "Tiri fuori"
        ]),
        corners: pairFlexible(statsRoot, [
          "corners", "Corner", "Corner kicks", "Calci d'angolo"
        ]),
        touchesBox: pairFlexible(statsRoot, [
          "touches_opp_box", "TouchesInOppositionBox", "Touches in opposition box", "Touches in box", "Tocchi in area"
        ]),
        bigChances: pairFlexible(statsRoot, [
          "big_chance", "BigChances", "Big chances", "Grandi occasioni"
        ]),
        bigChancesMissed: pairFlexible(statsRoot, [
          "big_chance_missed_title", "BigChancesMissed", "Big chances missed", "Grandi occasioni sbagliate"
        ])
      };

      const rtg = calculateRtg(stats);
      const momentum = content?.momentum || content?.matchMomentum || null;
      const momentumArray = normalizeMomentum(momentum);
      const latestMomentum = lastMomentumValue(momentum);
      const events = content?.matchFacts?.events || [];
      const shotmap = content?.shotmap || null;
      const matchStatus = data?.general?.matchStatus || data?.general?.status || "";
      const matchTime = data?.general?.matchTime || data?.general?.liveTime || "";

      return res.status(200).json({
        success: true,
        mode: "DETAIL",
        matchId,
        matchName: data?.general?.matchName || "",
        status: matchStatus,
        minute: matchTime,
        stats,
        rtg,
        momentum: { latest: latestMomentum, history: momentumArray },
        events,
        shotmap,
        hasStats: !!content?.stats,
        hasMomentum: !!momentum,
        hasShotmap: !!shotmap,
        hasEvents: Array.isArray(events)
      });
    }

    // FEED LIVE: volutamente lasciato identico alla versione che funzionava.
    const date = String(req.query.date || todayYYYYMMDD());
    const data = await fotmobFetch(`${FOTMOB_BASE}/matches?date=${encodeURIComponent(date)}`);
    const leagues = Array.isArray(data?.leagues) ? data.leagues : [];
    const matches = [];

    for (const league of leagues) {
      const leagueMatches = Array.isArray(league.matches) ? league.matches : [];
      for (const match of leagueMatches) {
        const status = match.status || {};
        const minute = getLiveMinute(status);
        matches.push({
          matchId: match.id,
          leagueId: league.primaryId || league.id || match.leagueId || null,
          league: league.name || "",
          country: league.ccode || "",
          home: match.home?.name || "",
          away: match.away?.name || "",
          homeGoals: match.home?.score ?? null,
          awayGoals: match.away?.score ?? null,
          started: status.started === true,
          finished: status.finished === true,
          cancelled: status.cancelled === true,
          score: status.scoreStr || "",
          minute,
          reason: status.reason || "",
          utcTime: status.utcTime || null
        });
      }
    }

    const liveMatches = matches.filter(match => match.started && !match.finished && !match.cancelled);
    return res.status(200).json({
      success: true,
      mode: "TODAY",
      date,
      totalMatches: matches.length,
      liveCount: liveMatches.length,
      liveMatches
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Errore FotMob",
      details: String(error?.message || error)
    });
  }
};