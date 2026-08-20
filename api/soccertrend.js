const API_BASE = "https://v3.football.api-sports.io";

function numberOrZero(value) {
  if (value === null || value === undefined) return 0;

  if (typeof value === "string" && value.includes("%")) {
    value = value.replace("%", "");
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getQuota(response) {
  const remaining =
    response.headers.get("x-ratelimit-requests-remaining");

  const limit =
    response.headers.get("x-ratelimit-requests-limit");

  return {
    remaining:
      remaining !== null
        ? Number(remaining)
        : null,

    limit:
      limit !== null
        ? Number(limit)
        : null
  };
}

async function apiRequest(path, apiKey) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "x-apisports-key": apiKey
    }
  });

  const data = await response.json();

  return {
    response,
    data
  };
}


/*
==========================================
TREND FREE

NON è RTG.

Usa solo eventi recenti disponibili nel feed:
- goal
- rigori
- rossi
- gialli
- sostituzioni

Serve come indicatore di "attività/eventi"
e non come vera pressione da tiri.
==========================================
*/

function calculateTrendFree(matchMinute, events = []) {

  let score = 0;

  let recentEvents = 0;

  const now =
    Number(matchMinute || 0);

  for (const event of events) {

    const minute =
      Number(event?.time?.elapsed || 0);

    const diff =
      now - minute;

    /*
      Consideriamo soprattutto
      gli ultimi 10 minuti.
    */

    if (diff < 0 || diff > 10) {
      continue;
    }

    recentEvents++;

    const type =
      String(event?.type || "")
        .toLowerCase();

    const detail =
      String(event?.detail || "")
        .toLowerCase();


    /*
      Peso maggiore agli eventi
      molto recenti.
    */

    let recencyMultiplier = 1;

    if (diff <= 2) {
      recencyMultiplier = 1.6;
    } else if (diff <= 5) {
      recencyMultiplier = 1.3;
    }


    /*
      EVENTI
    */

    if (type === "goal") {

      if (detail.includes("missed penalty")) {
        score += 15 * recencyMultiplier;
      } else if (detail.includes("penalty")) {
        score += 18 * recencyMultiplier;
      } else {
        score += 12 * recencyMultiplier;
      }

    } else if (type === "card") {

      if (
        detail.includes("red") ||
        detail.includes("second yellow")
      ) {
        score += 11 * recencyMultiplier;
      } else {
        score += 3 * recencyMultiplier;
      }

    } else if (type.includes("subst")) {

      score += 2 * recencyMultiplier;

    }

  }


  /*
    Piccolo bonus per fase calda
    della partita.
  */

  if (now >= 70 && now <= 88) {
    score += 8;
  } else if (now >= 55) {
    score += 4;
  } else if (now >= 30) {
    score += 2;
  }


  /*
    Normalizziamo 0 - 100
  */

  score =
    Math.min(
      100,
      Math.round(score)
    );


  let label = "COLD";

  if (score >= 65) {
    label = "HOT";
  } else if (score >= 40) {
    label = "ACTIVE";
  } else if (score >= 20) {
    label = "WATCH";
  }


  return {
    score,
    label,
    recentEvents
  };
}


/*
==========================================
STATISTICHE VERE
restano disponibili per test futuri
==========================================
*/

function getStat(stats, name) {

  const found =
    (stats || []).find(
      s =>
        String(s.type || "")
          .toLowerCase() ===
        name.toLowerCase()
    );

  return found
    ? numberOrZero(found.value)
    : 0;
}

function parseStats(teamBlock) {

  const stats =
    teamBlock?.statistics || [];

  return {

    shotsOnGoal:
      getStat(stats, "Shots on Goal"),

    shotsOffGoal:
      getStat(stats, "Shots off Goal"),

    totalShots:
      getStat(stats, "Total Shots"),

    blockedShots:
      getStat(stats, "Blocked Shots"),

    shotsInsideBox:
      getStat(stats, "Shots insidebox"),

    shotsOutsideBox:
      getStat(stats, "Shots outsidebox"),

    corners:
      getStat(stats, "Corner Kicks"),

    possession:
      getStat(stats, "Ball Possession"),

    goalkeeperSaves:
      getStat(stats, "Goalkeeper Saves")
  };
}

function calculateRtg(home, away) {

  const rtg =
      ((home.shotsOnGoal + away.shotsOnGoal) * 1.8)
    + ((home.shotsInsideBox + away.shotsInsideBox) * 0.65)
    + ((home.totalShots + away.totalShots) * 0.18)
    + ((home.corners + away.corners) * 0.55)
    + ((home.blockedShots + away.blockedShots) * 0.20);

  return Math.round(rtg * 10) / 10;
}


module.exports = async (req, res) => {

  try {

    const apiKey =
      process.env.API_FOOTBALL_KEY;

    if (!apiKey) {

      return res.status(500).json({
        error:
          "API_FOOTBALL_KEY non configurata"
      });

    }


    /*
    ==========================================
    STATS SINGOLA PARTITA

    /api/soccertrend?stats=ID
    ==========================================
    */

    const statsFixture =
      String(req.query.stats || "")
        .trim();

    if (statsFixture) {

      const { response, data } =
        await apiRequest(
          `/fixtures/statistics?fixture=${encodeURIComponent(statsFixture)}`,
          apiKey
        );

      const blocks =
        data.response || [];

      const homeBlock =
        blocks[0] || null;

      const awayBlock =
        blocks[1] || null;

      const home =
        parseStats(homeBlock);

      const away =
        parseStats(awayBlock);

      const hasStats =
        blocks.length >= 2;

      return res.status(200).json({

        success: true,

        mode: "STATS",

        fixture:
          Number(statsFixture),

        hasStats,

        teams: {

          home: {
            name:
              homeBlock?.team?.name || "",
            ...home
          },

          away: {
            name:
              awayBlock?.team?.name || "",
            ...away
          }

        },

        totals: {

          shotsOnGoal:
            home.shotsOnGoal +
            away.shotsOnGoal,

          totalShots:
            home.totalShots +
            away.totalShots,

          shotsInsideBox:
            home.shotsInsideBox +
            away.shotsInsideBox,

          corners:
            home.corners +
            away.corners

        },

        rtg:
          hasStats
            ? calculateRtg(home, away)
            : 0,

        api:
          getQuota(response)

      });

    }


    /*
    ==========================================
    LIVE + EVENTI

    UNA sola chiamata
    ==========================================
    */

    const { response, data } =
      await apiRequest(
        "/fixtures?live=all",
        apiKey
      );

    if (
      data.errors &&
      Object.keys(data.errors).length > 0
    ) {

      return res.status(200).json({

        success: false,

        mode: "LIVE",

        errors:
          data.errors,

        api:
          getQuota(response)

      });

    }


    const matches =
      (data.response || [])
        .map(item => {

          const minute =
            item.fixture?.status?.elapsed || 0;

          /*
            API-Football può includere
            gli eventi dentro la fixture live.
          */

          const events =
            Array.isArray(item.events)
              ? item.events
              : [];

          const trend =
            calculateTrendFree(
              minute,
              events
            );


          return {

            id:
              item.fixture?.id,

            leagueId:
              item.league?.id || null,

            league:
              item.league?.name || "",

            country:
              item.league?.country || "",

            season:
              item.league?.season || null,

            round:
              item.league?.round || "",

            minute,

            status:
              item.fixture?.status?.short || "",

            home:
              item.teams?.home?.name || "",

            away:
              item.teams?.away?.name || "",

            homeLogo:
              item.teams?.home?.logo || "",

            awayLogo:
              item.teams?.away?.logo || "",

            homeGoals:
              item.goals?.home ?? 0,

            awayGoals:
              item.goals?.away ?? 0,


            /*
            ==========================
            SOCCERTREND FREE
            ==========================
            */

            trendFree:
              trend.score,

            trendLabel:
              trend.label,

            recentEvents:
              trend.recentEvents,


            /*
              Manteniamo RTG separato.
              0 = statistiche avanzate
              non disponibili.
            */

            rtg:
              0,

            momentum:
              trend.score,


            /*
            ==========================
            EVENTI
            ==========================
            */

            events:
              events.map(event => ({

                minute:
                  event?.time?.elapsed || 0,

                extra:
                  event?.time?.extra || null,

                team:
                  event?.team?.name || "",

                player:
                  event?.player?.name || "",

                assist:
                  event?.assist?.name || "",

                type:
                  event?.type || "",

                detail:
                  event?.detail || ""

              }))

          };

        });


    /*
    Ordiniamo prima le partite
    con Trend Free più alto.
    */

    matches.sort(
      (a, b) =>
        b.trendFree -
        a.trendFree
    );


    return res.status(200).json({

      success: true,

      mode: "LIVE",

      count:
        matches.length,

      api:
        getQuota(response),

      matches

    });


  } catch (error) {

    return res.status(500).json({

      error:
        "Errore interno SoccerTrend",

      details:
        String(
          error?.message ||
          error
        )

    });

  }

};
