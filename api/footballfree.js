const FOTMOB_BASE = "https://www.fotmob.com/api";

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

module.exports = async (req, res) => {
  try {

    /*
    ==========================================
    MODALITÀ DETTAGLIO

    /api/footballfree?matchId=XXXX
    ==========================================
    */

    const matchId =
      String(req.query.matchId || "").trim();

    if (matchId) {

      const data = await fotmobFetch(
        `${FOTMOB_BASE}/matchDetails?matchId=${encodeURIComponent(matchId)}`
      );

      const content =
        data?.content || {};

      return res.status(200).json({
        success: true,

        mode: "DETAIL",

        matchId,

        matchName:
          data?.general?.matchName || "",

        hasStats:
          !!content?.stats,

        hasShotmap:
          !!content?.shotmap,

        hasEvents:
          !!content?.matchFacts?.events,

        hasMomentum:
          !!content?.momentum ||
          !!content?.matchMomentum,

        contentKeys:
          Object.keys(content),

        stats:
          content?.stats || null,

        shotmap:
          content?.shotmap || null,

        events:
          content?.matchFacts?.events || null,

        momentum:
          content?.momentum ||
          content?.matchMomentum ||
          null
      });
    }


    /*
    ==========================================
    MODALITÀ PARTITE DI OGGI

    /api/footballfree
    ==========================================
    */

    const date =
      String(req.query.date || todayYYYYMMDD());

    const data = await fotmobFetch(
      `${FOTMOB_BASE}/matches?date=${encodeURIComponent(date)}`
    );

    const leagues =
      Array.isArray(data?.leagues)
        ? data.leagues
        : [];

    const matches = [];

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


    /*
      Solo partite attualmente LIVE.
    */

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
