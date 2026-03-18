<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Catsmatcher - Strumenti Andry Matched</title>
  <style>
    :root{
      --bg:#0b1220;
      --bg2:#111827;
      --line:#334155;
      --lineSoft:rgba(255,255,255,.08);
      --text:#ffffff;
      --muted:#cbd5e1;
      --cyan:#06b6d4;
      --cyan2:#0891b2;
      --greenSoft:rgba(34,197,94,.12);
      --goldSoft:rgba(251,191,36,.12);
      --redSoft:rgba(239,68,68,.12);
      --blueSoft:rgba(37,99,235,.16);
      --darkInput:#020617;
      --shadow:0 16px 36px rgba(0,0,0,.22);
      --radius:20px;
    }
    *{box-sizing:border-box}
    body{
      margin:0;
      font-family:Arial, Helvetica, sans-serif;
      background:linear-gradient(180deg,var(--bg) 0%, var(--bg2) 100%);
      color:var(--text);
    }
    .container{max-width:1280px;margin:auto;padding:32px 18px 70px}
    .topbar{text-align:center;margin-bottom:28px}
    h1{margin:0;font-size:40px}
    .subtitle{color:var(--muted);margin:10px 0 0}
    .box{
      background:rgba(17,24,39,.96);
      border:1px solid var(--line);
      border-radius:var(--radius);
      box-shadow:var(--shadow);
      padding:24px;
      margin-bottom:18px;
    }
    .filters-grid{
      display:grid;
      grid-template-columns:1fr 1fr 1fr 1fr;
      gap:16px;
      align-items:end;
    }
    label{
      display:block;
      margin:0 0 8px;
      color:#e2e8f0;
      font-size:15px;
      font-weight:bold;
    }
    input, select{
      width:100%;
      padding:14px;
      border-radius:12px;
      border:1px solid var(--line);
      background:var(--darkInput);
      color:white;
      font-size:16px;
      outline:none;
    }
    .actions{
      display:flex;
      gap:12px;
      flex-wrap:wrap;
      margin-top:18px;
    }
    .action,.action-secondary{
      padding:14px 20px;
      border-radius:14px;
      border:none;
      cursor:pointer;
      font-weight:bold;
      font-size:16px;
      color:white;
    }
    .action{background:linear-gradient(180deg,var(--cyan) 0%, var(--cyan2) 100%)}
    .action-secondary{background:#334155}
    .statusbar{
      display:flex;
      gap:12px;
      flex-wrap:wrap;
      margin-top:16px;
    }
    .pill{
      display:inline-flex;
      align-items:center;
      padding:8px 12px;
      border-radius:999px;
      font-size:13px;
      font-weight:bold;
      border:1px solid rgba(255,255,255,.1);
      background:rgba(255,255,255,.04);
      color:#e2e8f0;
    }
    .pill.green{background:var(--greenSoft);color:#86efac}
    .pill.gold{background:var(--goldSoft);color:#fde68a}
    .pill.blue{background:var(--blueSoft);color:#bfdbfe}
    .toolbar{
      display:flex;
      justify-content:space-between;
      gap:12px;
      align-items:center;
      flex-wrap:wrap;
      margin-bottom:14px;
    }
    .toolbar h3{margin:0;font-size:22px}
    .toolbar span{color:var(--muted);font-size:14px}
    .table-wrap{
      overflow:auto;
      border:1px solid var(--line);
      border-radius:16px;
      background:#0f172a;
    }
    table{
      width:100%;
      border-collapse:collapse;
      min-width:1100px;
    }
    th, td{
      padding:14px 12px;
      text-align:left;
      border-bottom:1px solid var(--lineSoft);
      font-size:14px;
      vertical-align:middle;
    }
    th{
      color:#cbd5e1;
      background:#111827;
      white-space:nowrap;
      position:sticky;
      top:0;
    }
    .rating-badge,.profit-badge,.odd-badge{
      display:inline-block;
      padding:8px 10px;
      border-radius:999px;
      font-size:12px;
      font-weight:bold;
      white-space:nowrap;
    }
    .rating-high{background:var(--greenSoft);color:#86efac}
    .rating-mid{background:var(--goldSoft);color:#fde68a}
    .rating-low{background:var(--redSoft);color:#fca5a5}
    .profit-pos{background:var(--greenSoft);color:#86efac}
    .profit-neg{background:var(--redSoft);color:#fca5a5}
    .odd-badge{background:rgba(255,255,255,.06);color:#fff}
    .event-name{font-weight:bold;color:#fff}
    .event-meta{color:var(--muted);font-size:12px;margin-top:4px}
    .empty-state{padding:30px;text-align:center;color:var(--muted)}
    .back{
      display:inline-block;
      margin-top:12px;
      padding:14px 22px;
      border-radius:14px;
      background:#334155;
      color:white;
      font-size:16px;
      text-decoration:none;
    }
    @media (max-width:1000px){
      .filters-grid{grid-template-columns:1fr}
      h1{font-size:34px}
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="topbar">
      <h1>Catsmatcher</h1>
      <p class="subtitle">Quote reali con rating stile matcher</p>
    </div>

    <div class="box">
      <div class="filters-grid">
        <div>
          <label>Stake</label>
          <input id="stakeInput" type="number" step="0.01" value="100">
        </div>

        <div>
          <label>Fino a data</label>
          <input id="dateInput" type="date">
        </div>

        <div>
          <label>Bookmaker</label>
          <select id="bookmakerInput">
            <option value="bet365">Bet365</option>
            <option value="unibet">Unibet</option>
            <option value="williamhill">William Hill</option>
            <option value="paddypower">Paddy Power</option>
          </select>
        </div>

        <div>
          <label>Sport</label>
          <select id="sportInput">
            <option value="soccer_italy_serie_a">Serie A</option>
            <option value="soccer_epl">Premier League</option>
            <option value="soccer_spain_la_liga">La Liga</option>
            <option value="soccer_germany_bundesliga">Bundesliga</option>
          </select>
        </div>
      </div>

      <div style="margin-top:16px;">
        <label>Cerca partita</label>
        <input id="searchInput" type="text" placeholder="Es. Milan, Roma, Inter...">
      </div>

      <div class="actions">
        <button class="action" onclick="searchMatches()">Cerca</button>
        <button class="action-secondary" onclick="resetFilters()">Reset</button>
      </div>

      <div class="statusbar">
        <div id="statusText" class="pill blue">Pronto</div>
        <div id="stakePill" class="pill">Stake: € 100,00</div>
        <div id="datePill" class="pill">Data: non selezionata</div>
      </div>
    </div>

    <div class="box">
      <div class="toolbar">
        <h3>Risultati</h3>
        <span id="resultsCount">0 match trovati</span>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Evento</th>
              <th>Data</th>
              <th>Lega</th>
              <th>Bookmaker</th>
              <th>Esito</th>
              <th>Quota Book</th>
              <th>Quota Ref</th>
              <th>Rating</th>
              <th>Profitto Stimato</th>
            </tr>
          </thead>
          <tbody id="resultsBody">
            <tr>
              <td colspan="9" class="empty-state">Nessun dato caricato</td>
            </tr>
          </tbody>
        </table>
      </div>

      <a class="back" href="index.html">← Torna al menu</a>
    </div>
  </div>

  <script>
    function formatEuro(value){
      return "€ " + Number(value || 0).toLocaleString("it-IT", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    function formatDate(value){
      if(!value) return "—";
      const d = new Date(value);
      return d.toLocaleString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    }

    function setDefaultDate(){
      const input = document.getElementById("dateInput");
      if(!input.value){
        const today = new Date();
        const future = new Date(today);
        future.setDate(today.getDate() + 7);
        input.value = future.toISOString().slice(0,10);
      }
      updatePills();
    }

    function updatePills(){
      const stake = Number(document.getElementById("stakeInput").value || 0);
      const date = document.getElementById("dateInput").value || "";
      document.getElementById("stakePill").innerHTML = `Stake: ${formatEuro(stake)}`;
      document.getElementById("datePill").innerHTML = date ? `Fino al: ${date}` : "Data: non selezionata";
    }

    function ratingClass(rating){
      if (rating >= 100) return "rating-high";
      if (rating >= 97) return "rating-mid";
      return "rating-low";
    }

    function profitClass(v){
      return Number(v) >= 0 ? "profit-pos" : "profit-neg";
    }

    function renderTable(rows){
      const body = document.getElementById("resultsBody");
      const count = document.getElementById("resultsCount");

      if(!rows || !rows.length){
        body.innerHTML = `<tr><td colspan="9" class="empty-state">Nessun match trovato</td></tr>`;
        count.innerHTML = "0 match trovati";
        return;
      }

      body.innerHTML = rows.map(row => `
        <tr>
          <td>
            <div class="event-name">${row.match || "—"}</div>
            <div class="event-meta">${row.bet_label || "—"}</div>
          </td>
          <td>${formatDate(row.commence_time)}</td>
          <td>${row.league || "—"}</td>
          <td>${row.bookmaker_title || "—"}</td>
          <td>${row.bet_label || "—"}</td>
          <td><span class="odd-badge">${Number(row.book_odds || 0).toFixed(2)}</span></td>
          <td><span class="odd-badge">${Number(row.ref_odds || 0).toFixed(2)}</span></td>
          <td><span class="rating-badge ${ratingClass(row.rating || 0)}">${Number(row.rating || 0).toFixed(2)}%</span></td>
          <td><span class="profit-badge ${profitClass(row.estimated_profit || 0)}">${formatEuro(row.estimated_profit || 0)}</span></td>
        </tr>
      `).join("");

      count.innerHTML = `${rows.length} match trovati`;
    }

    async function searchMatches(){
      const stake = Number(document.getElementById("stakeInput").value || 0);
      const until = document.getElementById("dateInput").value || "";
      const bookmaker = document.getElementById("bookmakerInput").value || "bet365";
      const sport = document.getElementById("sportInput").value || "soccer_italy_serie_a";
      const search = (document.getElementById("searchInput").value || "").trim();
      const status = document.getElementById("statusText");

      updatePills();

      if(!stake || stake <= 0){
        status.className = "pill gold";
        status.innerHTML = "Inserisci uno stake valido";
        return;
      }

      status.className = "pill blue";
      status.innerHTML = "Ricerca in corso...";

      document.getElementById("resultsBody").innerHTML =
        `<tr><td colspan="9" class="empty-state">Caricamento quote reali...</td></tr>`;

      try{
        const params = new URLSearchParams({
          stake: String(stake),
          until,
          bookmaker,
          sport,
          search
        });

        const res = await fetch(`/api/catsmatcher?${params.toString()}`);
        const json = await res.json();

        if(!res.ok){
          throw new Error(json?.details || json?.error || "Errore caricamento");
        }

        renderTable(json.rows || []);
        status.className = "pill green";
        status.innerHTML = `Ricerca completata: ${(json.rows || []).length} risultati`;
      }catch(err){
        document.getElementById("resultsBody").innerHTML =
          `<tr><td colspan="9" class="empty-state">Errore caricamento dati</td></tr>`;
        document.getElementById("resultsCount").innerHTML = "0 match trovati";
        status.className = "pill gold";
        status.innerHTML = err.message || "Errore";
      }
    }

    function resetFilters(){
      document.getElementById("stakeInput").value = "100";
      document.getElementById("bookmakerInput").value = "bet365";
      document.getElementById("sportInput").value = "soccer_italy_serie_a";
      document.getElementById("searchInput").value = "";
      setDefaultDate();
      updatePills();
      document.getElementById("statusText").className = "pill blue";
      document.getElementById("statusText").innerHTML = "Reset completato";
      document.getElementById("resultsBody").innerHTML =
        `<tr><td colspan="9" class="empty-state">Nessun dato caricato</td></tr>`;
      document.getElementById("resultsCount").innerHTML = "0 match trovati";
    }

    setDefaultDate();
    updatePills();
  </script>
</body>
</html>
