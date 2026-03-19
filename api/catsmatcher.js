const ODDS_API_BASE = "https://api.the-odds-api.com/v4";

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getH2HMarket(bookmaker) {
  return bookmaker?.markets?.find((m) => m.key === "h2h");
}

function getOutcomePrice(bookmaker, outcomeName) {
  const market = getH2HMarket(bookmaker);
  const outcome = market?.outcomes?.find((o) => o.name === outcomeName);
  return toNum(outcome?.price);
}

function formatMatch(home, away) {
  return `${home} vs ${away}`;
}

module.exports = async (req, res) => {
  try {
    const apiKey = process.env.ODDS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Manca ODDS_API_KEY su Vercel"
      });
    }

    const sport = String(req.query.sport || "soccer_italy_serie_a");
    const bookmaker = String(req.query.bookmaker || "bet365");
    const until = String(req.query.until || "");
    const search = String(req.query.search || "").trim().toLowerCase();
    const stake = Number(req.query.stake || 100);

    const url =
      `${ODDS_API_BASE}/sports/${sport}/odds` +
      `?apiKey=${apiKey}` +
      `&regions=eu` +
      `&markets=h2h` +
      `&oddsFormat=decimal` +
      `&bookmakers=${bookmaker},pinnacle`;

    const response = await fetch(url);
    const rawText = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Errore The Odds API",
        details: rawText
      });
    }

    let events = [];
    try {
      events = JSON.parse(rawText);
    } catch (e) {
      return res.status(500).json({
        error: "Risposta API non valida",
        details: rawText
      });
    }

    const rows = [];

    for (const event of events) {
      const home = event?.home_team;
      const away = event?.away_team;
      if (!home || !away) continue;

      if (until) {
        const eventDate = new Date(event.commence_time);
        const maxDate = new Date(`${until}T23:59:59`);
        if (eventDate > maxDate) continue;
      }

      const book = event.bookmakers?.find((b) => b.key === bookmaker);
      const pin = event.bookmakers?.find((b) => b.key === "pinnacle");

      if (!book || !pin) continue;

      const outcomes = [
        { label: "1", outcomeName: home },
        { label: "X", outcomeName: "Draw" },
        { label: "2", outcomeName: away }
      ];

      for (const item of outcomes) {
        const bookOdds = getOutcomePrice(book, item.outcomeName);
        const refOdds = getOutcomePrice(pin, item.outcomeName);

        if (!bookOdds || !refOdds) continue;

        const rating = (bookOdds / refOdds) * 100;
        const estimatedProfit = (stake * (rating - 100)) / 100;
        const match = formatMatch(home, away);

        if (search && !match.toLowerCase().includes(search)) {
          continue;
        }

        rows.push({
          id: `${event.id}-${item.label}`,
          match,
          commence_time: event.commence_time,
          league: event.sport_title || sport,
          bookmaker_title: book.title || bookmaker,
          bet_label: item.label,
          book_odds: bookOdds,
          ref_odds: refOdds,
          rating,
          estimated_profit: estimatedProfit
        });
      }
    }

    rows.sort((a, b) => b.rating - a.rating);

    return res.status(200).json({ rows });
  } catch (error) {
    return res.status(500).json({
      error: "Errore interno server",
      details: String(error && error.message ? error.message : error)
    });
  }
};
