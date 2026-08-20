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
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",

      "Accept":
        "application/json,text/plain,*/*",

      "Accept-Language":
        "it-IT,it;q=0.9,en;q=0.8",

      "Referer":
        "https://www.fotmob.com/"
    }
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `FotMob ${response.status}: ${text.slice(0, 300)}`
    );
  }

  return JSON.parse(text);
}

function findStat(statsRoot, wantedKey) {
  const allPeriod =
    statsRoot?.Periods?.All?.stats || [];

  for (const group of allPeriod) {
    const stats =
      Array.isArray(group?.stats)
        ? group.stats
        : [];

    for (const stat of stats) {
      if (stat?.key === wantedKey) {
        return stat.stats || [0, 0];
      }
    }
  }

  return [0, 0];
}

function num(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  if (typeof value === "string") {
    const clean =
      value
        .replace("%", "")
        .split(" ")[0];

    const n = Number(clean);

    return Number.isFinite(n)
      ? n
      : 0;
  }

  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : 0;
}

function pair(statsRoot, key) {
  const values =
    findStat(statsRoot, key);

  return {
    home: num(values?.[0]),
    away: num(values?.[1]),
    total:
      num(values?.[0]) +
      num(values?.[1])
  };
}

function calculateRtg(stats) {
  const totalShots =
    stats.totalShots.total;

  const shotsOnTarget =
    stats.shotsOnTarget.total;

  const corners =
    stats.corners.total;

  const touchesBox =
    stats.touchesBox.total;

  const bigChances =
    stats.bigChances.total;

  const raw =
      (shotsOnTarget * 4)
    + (totalShots * 1)
    + (corners * 1.5)
    + (touchesBox * 0.6)
    + (bigChances * 5);

  return Math.round(raw * 10) / 10;
}

function normalizeMomentum(rawMomentum) {
  if (!rawMomentum) {
    return [];
  }

  if (Array.isArray(rawMomentum)) {
    return rawMomentum;
  }

  if (Array.isArray(rawMomentum?.main)) {
    return rawMomentum.main;
  }

  if (Array.isArray(rawMomentum?.data)) {
    return rawMomentum.data;
  }

  return [];
}

function lastMomentumValue(momentum) {
  const arr =
    normalizeMomentum(momentum);

  if (!arr.length) {
    return null;
  }

  const last =
    arr[arr.length - 1];

  if (typeof last === "number") {
    return last;
  }

  if (typeof last?.value === "number") {
    return last.value;
  }

  return null;
}

module.exports = async (req, res) => {
  try {

    const matchId =
      String(req.query.matchId || "").trim();


    /*
    ==========================================
    DETTAGLIO PARTITA
    ==========================================
    */

    if (matchId) {

      const data =
        await fotmobFetch(
          `${FOTMOB_BASE}/matchDetails?matchId=${encodeURIComponent(matchId)}`
        );

      const content =
        data?.content || {};

      const statsRoot =
        content?.stats || {};

      const stats = {

        possession:
          pair(
            statsRoot,
            "BallPossesion"
          ),

        totalShots:
          pair(
            statsRoot,
            "total_shots"
          ),

        shotsOnTarget:
          pair(
            statsRoot,
            "ShotsOnTarget"
          ),

        shotsOffTarget:
          pair(
            statsRoot,
            "ShotsOffTarget"
          ),

        corners:
          pair(
            statsRoot,
            "corners"
          ),

        touchesBox:
          pair(
            statsRoot,
            "touches_opp_box"
          ),

        bigChances:
          pair(
            statsRoot,
            "big_chance"
          ),

        bigChancesMissed:
          pair(
            statsRoot,
            "big_chance_missed_title"
          )

      };

      const rtg =
        calculateRtg(stats);

      const momentum =
        content?.momentum ||
        content?.matchMomentum ||
        null;

      const momentumArray =
        normalizeMomentum(momentum);

      const latestMomentum =
        lastMomentumValue(momentum);

      const events =
        content?.matchFacts?.events || [];

      const shotmap =
        content?.shotmap || null;

      return res.status(200).json({

        success: true,

        mode: "DETAIL",

        matchId,

        matchName:
          data?.general?.matchName || "",

        status:
          data?.general?.matchStatus || "",

        stats,

        rtg,

        momentum: {
          latest:
            latestMomentum,

          history:
            momentumArray
        },

        events,

        shotmap,

        hasStats:
          !!content?.stats,

        hasMomentum:
          !!momentum,

        hasShotmap:
          !!shotmap,

        hasEvents:
          Array.isArray(events)

      });

    }


    /*
    ==========================================
    PARTITE LIVE DI OGGI
    ==========================================
    */

    const date =
      String(
        req.query.date ||
        todayYYYYMMDD()
      );

    const data =
      await fotmobFetch(
        `${FOTMOB_BASE}/matches?date=${encodeURIComponent(date)}`
      );

    const leagues =
      Array.isArray(data?.leagues)
        ? data.leagues
        : [];

    const matches =
      [];

    for (const league of leagues) {

      const leagueMatches =
        Array.isArray(league.matches)
          ? league.matches
          : [];

      for (const match of leagueMatches) {

        const status =
          match.status || {};

        matches.push({

          matchId:
            match.id,

          leagueId:
            league.primaryId ||
            league.id ||
            match.leagueId ||
            null,

          league:
            league.name || "",

          country:
            league.ccode || "",

          home:
            match.home?.name || "",

          away:
            match.away?.name || "",

          homeGoals:
            match.home?.score ?? null,

          awayGoals:
            match.away?.score ?? null,

          started:
            status.started === true,

          finished:
            status.finished === true,

          cancelled:
            status.cancelled === true,

          score:
            status.scoreStr || "",

          reason:
            status.reason || "",

          utcTime:
            status.utcTime || null

        });

      }

    }

    const liveMatches =
      matches.filter(match =>
        match.started &&
        !match.finished &&
        !match.cancelled
      );

    return res.status(200).json({

      success: true,

      mode: "TODAY",

      date,

      totalMatches:
        matches.length,

      liveCount:
        liveMatches.length,

      liveMatches

    });

  } catch (error) {

    return res.status(500).json({

      success: false,

      error:
        "Errore FotMob",

      details:
        String(
          error?.message ||
          error
        )

    });

  }
};
