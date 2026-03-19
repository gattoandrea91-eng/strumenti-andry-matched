const ODDS_API_BASE = "https://api.the-odds-api.com/v4";

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getH2HMarket(bookmaker) {
  return bookmaker?.markets?.find((m) => m.key === "h2h");
}

function getDoubleChanceMarket(bookmaker) {
  return bookmaker?.markets?.find((m) => m.key === "double_chance");
}

function getOutcomePriceFromMarket(market, outcomeName) {
  const outcome = market?.outcomes?.find(
    (o) => String(o.name || "").toLowerCase() === String(outcomeName || "").toLowerCase()
  );
  return toNum(outcome?.price);
}

function getH2HPrice(bookmaker, outcomeName) {
  return getOutcomePriceFromMarket(getH2HMarket(bookmaker), outcomeName);
}

function getDoubleChanceNameForBookPick(bookPick, home, away) {
  if (bookPick === "1") return `${away} or Draw`;     // X2
  if (bookPick === "X") return `${home} or ${away}`;  // 12
  if (bookPick === "2") return `${home} or Draw`;     // 1X
  return null;
}

function getBookOutcomeName(bookPick, home, away) {
  if (bookPick === "1") return home;
  if (bookPick === "X") return "Draw";
  if (bookPick === "2") return away;
  return null;
}

function formatMatch(home, away) {
  return `${home} vs ${away}`;
}

function simulatePuntaPunta(stake, bookOdds, dcOdds) {
  const s = Number(stake || 0);
  const qBook = Number(bookOdds || 0);
  const qDc = Number(dcOdds || 0);

  if (!s || !qBook || !qDc) {
    return {
      stake_ref: 0,
      profit_book: 0,
      profit_ref: 0,
      profit_min: 0
    };
  }

  const stakeRef = s / qDc;
  const profitBook = s * (qBook - 1) - stakeRef;
  const profitRef = stakeRef * (qDc - 1) - s;

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
    const bookmaker = String(req.query.bookmaker || "bet365");
    const until = String(req.query.until || "");
    const search = String(req.query.search || "").trim().toLowerCase();
    const stake = Number(req.query.stake || 100);

    // Lista eventi col solo book scelto
    const listUrl =
      `${ODDS_API_BASE}/sports/${sport}/odds` +
      `?apiKey=${apiKey}` +
      `&regions=eu` +
      `&markets=h2h` +
      `&oddsFormat=decimal` +
      `&bookmakers=${bookmaker}`;

    const listResponse = await fetch(listUrl);
    const listRaw = await listResponse.text();

    if (!listResponse.ok) {
      return res.status(listResponse.status).json({
        error: "Errore lista eventi The Odds API",
        details: listRaw
      });
    }

    let events = [];
    try {
      events = JSON.parse(listRaw);
    } catch (e) {
      return res.status(500).json({
        error: "Risposta lista eventi non valida",
        details: listRaw
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
      if (!book) continue;

      // provo a prendere la DC di Pinnacle per questo evento
      let dcMarket = null;

      const eventUrl =
        `${ODDS_API_BASE}/sports/${sport}/events/${event.id}/odds` +
        `?apiKey=${apiKey}` +
        `&regions=eu` +
        `&markets=double_chance` +
        `&oddsFormat=decimal` +
        `&bookmakers=pinnacle`;

      try {
        const eventResponse = await fetch(eventUrl);
        const eventRaw = await eventResponse.text();

        if (eventResponse.ok) {
          const eventOdds = JSON.parse(eventRaw);
          const pinnacle = eventOdds?.bookmakers?.find((b) => b.key === "pinnacle");
          dcMarket = getDoubleChanceMarket(pinnacle);
        }
      } catch (e) {
        dcMarket = null;
      }

      for (const pick of ["1", "X", "2"]) {
        const bookOutcomeName = getBookOutcomeName(pick, home, away);
        const bookOdds = getH2HPrice(book, bookOutcomeName);
        if (!bookOdds) continue;

        const dcOutcomeName = getDoubleChanceNameForBookPick(pick, home, away);
        const refOdds = dcMarket
          ? getOutcomePriceFromMarket(dcMarket, dcOutcomeName)
          : null;

        if (!refOdds) {
          rows.push({
            id: `${event.id}-${pick}`,
            match,
            commence_time: event.commence_time,
            bookmaker_title: book.title || bookmaker,
            bet_label: pick,
            hedge_label: dcOutcomeName,
            book_odds: bookOdds,
            ref_odds: null,
            stake_book: stake,
            stake_ref: null,
            profit_book: null,
            profit_ref: null,
            profit_min: null,
            status: "DC non disponibile"
          });
          continue;
        }

        const sim = simulatePuntaPunta(stake, bookOdds, refOdds);

        rows.push({
          id: `${event.id}-${pick}`,
          match,
          commence_time: event.commence_time,
          bookmaker_title: book.title || bookmaker,
          bet_label: pick,
          hedge_label: dcOutcomeName,
          book_odds: bookOdds,
          ref_odds: refOdds,
          stake_book: stake,
          stake_ref: sim.stake_ref,
          profit_book: sim.profit_book,
          profit_ref: sim.profit_ref,
          profit_min: sim.profit_min,
          status: "OK"
        });
      }
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
