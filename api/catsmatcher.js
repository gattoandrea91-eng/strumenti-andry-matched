const ODDS_API_BASE = "https://api.the-odds-api.com/v4";

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatMatch(home, away) {
  return `${home} vs ${away}`;
}

function getTotalsMarket(bookmaker) {
  return bookmaker?.markets?.find((m) => m.key === "totals");
}

function getOutcomeByNameAndPoint(market, name, pointWanted = 2.5) {
  if (!market?.outcomes?.length) return null;

  const exact = market.outcomes.find((o) => {
    const sameName = String(o.name || "").toLowerCase() === String(name).toLowerCase();
    const samePoint = Number(o.point) === Number(pointWanted);
    return sameName && samePoint;
  });

  return exact || null;
}

function calcContropuntataPuntaPunta(stake, quotaBook, quotaRef) {
  const s = Number(stake || 0);
  const q1 = Number(quotaBook || 0);
  const q2 = Number(quotaRef || 0);

  if (!s || !q1 || !q2) {
    return {
      stake_ref: null,
      profit: null
    };
  }

  const stakeRef = (s * q1) / q2;
  const profit = (s * q1) - s - stakeRef;

  return {
    stake_ref: stakeRef,
    profit
  };
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
    const bookmaker = String(req.query.bookmaker || "williamhill");
    const until = String(req.query.until || "");
    const search = String(req.query.search || "").trim().toLowerCase();
    const stake = Number(req.query.stake || 100);

    const url =
      `${ODDS_API_BASE}/sports/${sport}/odds` +
      `?apiKey=${apiKey}` +
      `&regions=eu` +
      `&markets=totals` +
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

      const match = formatMatch(home, away);

      if (search && !match.toLowerCase().includes(search)) {
        continue;
      }

      const book = event.bookmakers?.find((b) => b.key === bookmaker);
      const pin = event.bookmakers?.find((b) => b.key === "pinnacle");

      if (!book) continue;

      const bookTotals = getTotalsMarket(book);
      const pinTotals = getTotalsMarket(pin);

      const over25 = getOutcomeByNameAndPoint(bookTotals, "Over", 2.5);
      const under25 = getOutcomeByNameAndPoint(pinTotals, "Under", 2.5);

      if (!over25 || !under25) {
        rows.push({
          id: `${event.id}-over25`,
          match,
          commence_time: event.commence_time,
          league: event.sport_title || sport,
          bookmaker_title: book.title || bookmaker,
          book_odds: over25?.price ?? null,
          ref_odds: under25?.price ?? null,
          stake_book: stake,
          stake_ref: null,
          profit_min: null,
          status: "2.5 non disponibile"
        });
        continue;
      }

      const calc = calcContropuntataPuntaPunta(stake, over25.price, under25.price);

      rows.push({
        id: `${event.id}-over25`,
        match,
        commence_time: event.commence_time,
        league: event.sport_title || sport,
        bookmaker_title: book.title || bookmaker,
        book_odds: Number(over25.price),
        ref_odds: Number(under25.price),
        stake_book: stake,
        stake_ref: calc.stake_ref,
        profit_min: calc.profit,
        status: "OK"
      });
    }

    rows.sort((a, b) => {
      const aVal = a.profit_min == null ? -999999 : a.profit_min;
      const bVal = b.profit_min == null ? -999999 : b.profit_min;
      return bVal - aVal;
    });

    return res.status(200).json({ rows });
  } catch (error) {
    return res.status(500).json({
      error: "Errore interno server",
      details: String(error?.message || error)
    });
  }
};
