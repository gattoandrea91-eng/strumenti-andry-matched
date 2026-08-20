const SOFASCORE_BASE = "https://www.sofascore.com/api/v1";

module.exports = async (req, res) => {
  try {
    const response = await fetch(
      `${SOFASCORE_BASE}/sport/football/events/live`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          "Accept": "application/json"
        }
      }
    );

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "Errore SofaScore",
        status: response.status,
        details: text.slice(0, 500)
      });
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({
        success: false,
        error: "Risposta SofaScore non JSON",
        details: text.slice(0, 500)
      });
    }

    const events = Array.isArray(data.events)
      ? data.events
      : [];

    const matches = events.map(event => ({
      sofaId: event.id,

      tournament:
        event.tournament?.name || "",

      country:
        event.tournament?.category?.name || "",

      home:
        event.homeTeam?.name || "",

      away:
        event.awayTeam?.name || "",

      homeGoals:
        event.homeScore?.current ?? 0,

      awayGoals:
        event.awayScore?.current ?? 0,

      status:
        event.status?.description ||
        event.status?.type ||
        "",

      startTimestamp:
        event.startTimestamp || null
    }));

    return res.status(200).json({
      success: true,
      count: matches.length,
      matches
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Errore interno SofaScore",
      details: String(error?.message || error)
    });
  }
};
