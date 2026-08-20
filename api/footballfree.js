const FOTMOB_BASE = "https://www.fotmob.com/api";

module.exports = async (req, res) => {
  try {
    const matchId = String(req.query.matchId || "").trim();

    if (!matchId) {
      return res.status(400).json({
        success: false,
        error: "Manca matchId"
      });
    }

    const response = await fetch(
      `${FOTMOB_BASE}/matchDetails?matchId=${encodeURIComponent(matchId)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          "Accept": "application/json",
          "Referer": "https://www.fotmob.com/"
        }
      }
    );

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        status: response.status,
        error: "Errore FotMob",
        details: text.slice(0, 500)
      });
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return res.status(500).json({
        success: false,
        error: "Risposta FotMob non JSON",
        details: text.slice(0, 500)
      });
    }

    return res.status(200).json({
      success: true,

      matchId,

      hasStats: !!data?.content?.stats,
      hasShotmap: !!data?.content?.shotmap,
      hasEvents: !!data?.content?.matchFacts?.events,
      hasMomentum:
        !!data?.content?.momentum ||
        !!data?.content?.matchMomentum,

      keys: {
        content: data?.content
          ? Object.keys(data.content)
          : []
      },

      stats:
        data?.content?.stats || null,

      shotmap:
        data?.content?.shotmap || null,

      events:
        data?.content?.matchFacts?.events || null,

      momentum:
        data?.content?.momentum ||
        data?.content?.matchMomentum ||
        null
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Errore interno FotMob",
      details: String(error?.message || error)
    });
  }
};
