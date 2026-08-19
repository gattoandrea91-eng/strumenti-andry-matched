const API_BASE = "https://v3.football.api-sports.io";

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function statValue(statistics, name) {
  const item = statistics?.find(
    s => String(s.type || "").toLowerCase() === name.toLowerCase()
  );

  if (!item) return 0;

  if (typeof item.value === "string" && item.value.includes("%")) {
    return numberOrZero(item.value.replace("%", ""));
  }

  return numberOrZero(item.value);
}

function parseTeamStats(teamBlock) {
  const stats = teamBlock?.statistics || [];

  return {
    shotsOnGoal: statValue(stats, "Shots on Goal"),
    shotsOffGoal: statValue(stats, "Shots off Goal"),
    totalShots: statValue(stats, "Total Shots"),
    blockedShots: statValue(stats, "Blocked Shots"),
    shotsInsideBox: statValue(stats, "Shots insidebox"),
    shotsOutsideBox: statValue(stats, "Shots outsidebox"),
    corners: statValue(stats, "Corner Kicks"),
    possession: statValue(stats, "Ball Possession")
  };
}

function calculateRtg(home, away) {
  const totalTarget = home.shotsOnGoal + away.shotsOnGoal;
  const totalInside = home.shotsInsideBox + away.shotsInsideBox;
  const totalShots = home.totalShots + away.totalShots;
  const totalCorners = home.corners + away.corners;

  const raw =
    (totalTarget * 1.8) +
    (totalInside * 0.65) +
    (totalShots * 0.18) +
    (totalCorners * 0.55);

  return Math.round(raw * 10) / 10;
}

module.exports = async (req, res) => {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "API_FOOTBALL_KEY non configurata"
      });
    }

    const idsParam = String(req.query.ids || "").trim();

    let url;

    if (idsParam) {
      const ids = idsParam
        .split("-")
        .filter(Boolean)
        .slice(0, 20);

      // Se c'è una sola partita usiamo ?id=
      if (ids.length === 1) {
        url = `${API_BASE}/fixtures?id=${ids[0]}`;
      } else {
        url = `${API_BASE}/fixtures?ids=${ids.join("-")}`;
      }

    } else {
      url = `${API_BASE}/fixtures?live=all`;
    }

    const response = await fetch(url, {
      headers: {
        "x-apisports-key": apiKey
      }
    });

    const data = await response.json();

    // Mostriamo eventuali errori API-Football
    if (
      data.errors &&
      Object.keys(data.errors).length > 0
    ) {
      return res.status(200).json({
        success: false,
        apiErrors: data.errors,
        parameters: data.parameters || {},
        results: data.results ?? null
      });
    }

    const fixtures = data.response || [];

    const matches = fixtures.map(item => {
      const teamStats =
        Array.isArray(item.statistics)
          ? item.statistics
          : [];

      const homeStats = parseTeamStats(teamStats[0]);
      const awayStats = parseTeamStats(teamStats[1]);

      const hasStats = teamStats.length >= 2;

      const rtg =
        hasStats
          ? calculateRtg(homeStats, awayStats)
          : 0;

      return {
        id: item.fixture?.id,

        league: item.league?.name || "",
        country: item.league?.country || "",

        minute: item.fixture?.status?.elapsed || 0,
        status: item.fixture?.status?.short || "",

        home: item.teams?.home?.name || "",
        away: item.teams?.away?.name || "",

        homeGoals: item.goals?.home ?? 0,
        awayGoals: item.goals?.away ?? 0,

        hasStats,
        rtg,

        stats: {
          home: homeStats,
          away: awayStats,

          totalShots:
            homeStats.totalShots + awayStats.totalShots,

          shotsOnGoal:
            homeStats.shotsOnGoal + awayStats.shotsOnGoal,

          shotsInsideBox:
            homeStats.shotsInsideBox + awayStats.shotsInsideBox,

          corners:
            homeStats.corners + awayStats.corners
        }
      };
    });

    const remaining =
      response.headers.get("x-ratelimit-requests-remaining");

    const limit =
      response.headers.get("x-ratelimit-requests-limit");

    return res.status(200).json({
      success: true,

      queryMode:
        idsParam
          ? "DETAIL"
          : "LIVE",

      count: matches.length,

      api: {
        remaining:
          remaining !== null
            ? Number(remaining)
            : null,

        limit:
          limit !== null
            ? Number(limit)
            : null
      },

      matches
    });

  } catch (error) {
    return res.status(500).json({
      error: "Errore interno SoccerTrend",
      details: String(error?.message || error)
    });
  }
};
