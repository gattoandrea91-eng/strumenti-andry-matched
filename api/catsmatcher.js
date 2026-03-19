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

  if (exact) return exact;

  return null;
}

function simulatePuntaPunta(stakeBook, oddsBook, oddsRef) {
  const s1 = Number(stakeBook || 0);
  const q1 = Number(oddsBook || 0);
  const q2 = Number(oddsRef || 0);

  if (!s1 || !q1 || !q2) {
    return {
      stake_ref: null,
      profit_book: null,
      profit_ref: null,
      profit_min: null
    };
  }

  const stakeRef = s1 / q2;
  const profitBook = s1 * (q1 - 1) - stakeRef;
  const profitRef = stakeRef * (q2 - 1) - s1;

  return {
    stake_ref: stakeRef,
    profit_book: profitBook,
    profit_ref: profitRef,
    profit_min: Math.min(profitBook, profitRef)
  };
}

module.exports = async (req, res) => {
  try {
    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Manca ODDS_API_KEY su Vercel" });
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
      if (search && !match.toLowerCase().includes(search)) continue;

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
          bet_label: "Over 2.5",
          hedge_label: "Under 2.5",
          book_odds: over25?.price ?? null,
          ref_odds: under25?.price ?? null,
          line: 2.5,
          stake_book: stake,
          stake_ref: null,
          profit_book: null,
          profit_ref: null,
          profit_min: null,
          status: "2.5 non disponibile"
        });
        continue;
      }

      const sim = simulatePuntaPunta(stake, over25.price, under25.price);

      rows.push({
        id: `${event.id}-over25`,
        match,
        commence_time: event.commence_time,
        league: event.sport_title || sport,
        bookmaker_title: book.title || bookmaker,
        bet_label: "Over 2.5",
        hedge_label: "Under 2.5",
        book_odds: Number(over25.price),
        ref_odds: Number(under25.price),
        line: 2.5,
        stake_book: stake,
        stake_ref: sim.stake_ref,
        profit_book: sim.profit_book,
        profit_ref: sim.profit_ref,
        profit_min: sim.profit_min,
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
