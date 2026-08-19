const API_BASE = "https://v3.football.api-sports.io";

module.exports = async (req, res) => {
  try {

    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "API_FOOTBALL_KEY non configurata su Vercel"
      });
    }

    // Prendiamo tutte le partite attualmente LIVE
    const response = await fetch(`${API_BASE}/fixtures?live=all`, {
      headers: {
        "x-apisports-key": apiKey
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Errore API-Football",
        details: data
      });
    }

    const fixtures = data.response || [];

    const matches = fixtures.map(item => {

      return {
        id: item.fixture?.id,

        league: item.league?.name || "",

        country: item.league?.country || "",

        minute: item.fixture?.status?.elapsed || 0,

        status: item.fixture?.status?.short || "",

        home: item.teams?.home?.name || "",

        away: item.teams?.away?.name || "",

        homeLogo: item.teams?.home?.logo || "",

        awayLogo: item.teams?.away?.logo || "",

        homeGoals: item.goals?.home ?? 0,

        awayGoals: item.goals?.away ?? 0
      };

    });

    return res.status(200).json({
      success: true,
      count: matches.length,
      matches
    });

  } catch (error) {

    return res.status(500).json({
      error: "Errore interno SoccerTrend",
      details: String(error?.message || error)
    });

  }
};
