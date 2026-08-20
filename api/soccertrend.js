const API_BASE = "https://v3.football.api-sports.io";

function numberOrZero(value) {
  if (value === null || value === undefined) return 0;

  if (typeof value === "string" && value.includes("%")) {
    value = value.replace("%", "");
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getStat(stats, name) {
  const found = (stats || []).find(
    s => String(s.type || "").toLowerCase() === name.toLowerCase()
  );

  return found ? numberOrZero(found.value) : 0;
}

function parseStats(teamBlock) {
  const stats = teamBlock?.statistics || [];

  return {
    shotsOnGoal: getStat(stats, "Shots on Goal"),
    shotsOffGoal: getStat(stats, "Shots off Goal"),
    totalShots: getStat(stats, "Total Shots"),
    blockedShots: getStat(stats, "Blocked Shots"),
    shotsInsideBox: getStat(stats, "Shots insidebox"),
    shotsOutsideBox: getStat(stats, "Shots outsidebox"),
    corners: getStat(stats, "Corner Kicks"),
    possession: getStat(stats, "Ball Possession"),
    goalkeeperSaves: getStat(stats, "Goalkeeper Saves")
  };
}

function calculateRtg(home, away) {
  const shotsOnGoal =
    home.shotsOnGoal + away.shotsOnGoal;

  const shotsInsideBox =
    home.shotsInsideBox + away.shotsInsideBox;

  const totalShots =
    home.totalShots + away.totalShots;

  const corners =
    home.corners + away.corners;

  const blockedShots =
    home.blockedShots + away.blockedShots;

  const rtg =
      (shotsOnGoal * 1.8)
    + (shotsInsideBox * 0.65)
    + (totalShots * 0.18)
    + (corners * 0.55)
    + (blockedShots * 0.20);

  return Math.round(rtg * 10) / 10;
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

module.exports = async (req, res) => {

  try {

    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "API_FOOTBALL_KEY non configurata"
      });
    }


    /*
    ==================================================
    MODALITÀ COVERAGE

    Esempio:
    /api/soccertrend?coverage=135&season=2026

    Serve per capire se una lega supporta
    le statistiche fixture.
    ==================================================
    */

    const coverageLeague =
      String(req.query.coverage || "").trim();

    const coverageSeason =
      String(req.query.season || "").trim();

    if (coverageLeague && coverageSeason) {

      const { response, data } =
        await apiRequest(
          `/leagues?id=${encodeURIComponent(coverageLeague)}&season=${encodeURIComponent(coverageSeason)}`,
          apiKey
        );

      if (
        data.errors &&
        Object.keys(data.errors).length > 0
      ) {

        return res.status(200).json({
          success: false,
          mode: "COVERAGE",
          errors: data.errors,
          api: getQuota(response)
        });

      }

      const item =
        data.response?.[0];

      const seasonData =
        item?.seasons?.find(
          s =>
            Number(s.year) ===
            Number(coverageSeason)
        );

      return res.status(200).json({

        success: true,

        mode: "COVERAGE",

        leagueId:
          Number(coverageLeague),

        season:
          Number(coverageSeason),

        league:
          item?.league?.name || "",

        country:
          item?.country?.name || "",

        statisticsFixtures:
          seasonData?.coverage?.fixtures?.statistics_fixtures === true,

        events:
          seasonData?.coverage?.fixtures?.events === true,

        lineups:
          seasonData?.coverage?.fixtures?.lineups === true,

        playerStatistics:
          seasonData?.coverage?.fixtures?.statistics_players === true,

        api:
          getQuota(response)

      });

    }


    /*
    ==================================================
    MODALITÀ STATISTICHE SINGOLA PARTITA

    Esempio:
    /api/soccertrend?stats=1563650
    ==================================================
    */

    const statsFixture =
      String(req.query.stats || "").trim();

    if (statsFixture) {

      const { response, data } =
        await apiRequest(
          `/fixtures/statistics?fixture=${encodeURIComponent(statsFixture)}`,
          apiKey
        );

      if (
        data.errors &&
        Object.keys(data.errors).length > 0
      ) {

        return res.status(200).json({
          success: false,
          mode: "STATS",
          errors: data.errors,
          api: getQuota(response)
        });

      }

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

      const rtg =
        hasStats
          ? calculateRtg(home, away)
          : 0;

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

            logo:
              homeBlock?.team?.logo || "",

            ...home
          },

          away: {
            name:
              awayBlock?.team?.name || "",

            logo:
              awayBlock?.team?.logo || "",

            ...away
          }

        },

        totals: {

          shotsOnGoal:
            home.shotsOnGoal +
            away.shotsOnGoal,

          shotsOffGoal:
            home.shotsOffGoal +
            away.shotsOffGoal,

          totalShots:
            home.totalShots +
            away.totalShots,

          blockedShots:
            home.blockedShots +
            away.blockedShots,

          shotsInsideBox:
            home.shotsInsideBox +
            away.shotsInsideBox,

          shotsOutsideBox:
            home.shotsOutsideBox +
            away.shotsOutsideBox,

          corners:
            home.corners +
            away.corners

        },

        rtg,

        api:
          getQuota(response)

      });

    }


    /*
    ==================================================
    MODALITÀ LIVE

    /api/soccertrend

    Recupera tutte le partite attualmente live.
    ==================================================
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
        errors: data.errors,
        api: getQuota(response)
      });

    }

    const fixtures =
      data.response || [];

    const matches =
      fixtures.map(item => ({

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

        minute:
          item.fixture?.status?.elapsed || 0,

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
          item.goals?.away ?? 0

      }));


    /*
      Creiamo anche l'elenco unico delle leghe LIVE.

      Così dopo possiamo controllare la coverage
      senza controllare la stessa lega più volte.
    */

    const leaguesMap =
      new Map();

    matches.forEach(match => {

      if (
        !match.leagueId ||
        !match.season
      ) {
        return;
      }

      const key =
        `${match.leagueId}-${match.season}`;

      if (!leaguesMap.has(key)) {

        leaguesMap.set(key, {

          leagueId:
            match.leagueId,

          league:
            match.league,

          country:
            match.country,

          season:
            match.season

        });

      }

    });

    const liveLeagues =
      Array.from(
        leaguesMap.values()
      );


    return res.status(200).json({

      success: true,

      mode: "LIVE",

      count:
        matches.length,

      leagueCount:
        liveLeagues.length,

      api:
        getQuota(response),

      liveLeagues,

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
