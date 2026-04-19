const express = require("express");
const app = express();

app.use(express.json());

/* =========================
   LOG SYSTEM
========================= */
const logs = [];

app.use((req, res, next) => {
  const start = Date.now();

  const originalJson = res.json.bind(res);

  res.json = (data) => {
    const logEntry = {
      time: new Date().toISOString(),
      method: req.method,
      url: req.url,
      request: req.body,
      response: data,
      duration: Date.now() - start
    };

    logs.unshift(logEntry);
    if (logs.length > 200) logs.pop();

    console.log("LOG:", logEntry);

    return originalJson(data);
  };

  next();
});

/* =========================
   STATE
========================= */
const tickets = {};
let recordCounter = 1;

/* =========================
   UI
========================= */
app.get("/", (req, res) => {
  res.send(`
  <html>
  <head>
    <title>Parking Backend Simulator</title>
    <style>
      body { font-family: Arial; padding:20px; background:#1e1e1e; color:white;}
      button { padding:10px; margin:5px; cursor:pointer; }
      input, select { padding:8px; margin:5px; }
      .box { background:#2a2a2a; padding:15px; margin-bottom:20px; border-radius:10px; }
      pre { background:#000; color:#0f0; padding:10px; height:250px; overflow:auto;}
      .log { padding:8px; margin-bottom:5px; border-radius:5px; }
      .ok { background:#0f5132; }
      .error { background:#842029; }
    </style>
  </head>
  <body>

    <h2>🚗 Parking Backend Simulator</h2>

    <div class="box">
      <h3>Configuration</h3>
      Outlet: <input id="outlet" value="0000259010"/>
      Terminal: <input id="terminal" value="000025901025"/>
      Token: <input id="token" value="abc123"/>
    </div>

    <div class="box">
      <h3>Actions</h3>
      <button onclick="callApi('/parkingInit')">parkingInit</button>
      <button onclick="callApi('/entranceCall')">entranceCall</button>
      <button onclick="exitCall()">exitCall</button>
      <button onclick="callApi('/exitPayment')">exitPayment</button>
    </div>

    <div class="box">
      <h3>Response</h3>
      <pre id="output">Ready...</pre>
    </div>

    <div class="box">
      <h3>📊 Logs Dashboard</h3>
      <button onclick="loadLogs()">Refresh Logs</button>
      <button onclick="clearLogs()">Clear Logs</button>

      Filter:
      <select id="filter" onchange="loadLogs()">
        <option value="">All</option>
        <option value="/parkingInit">Init</option>
        <option value="/entranceCall">Entrance</option>
        <option value="/exitCall">Exit</option>
        <option value="/exitPayment">Payment</option>
      </select>

      <div id="logs"></div>
    </div>

    <script>
      function baseData() {
        return {
          application: "Parking",
          outlet: document.getElementById("outlet").value,
          terminal: document.getElementById("terminal").value,
          token: document.getElementById("token").value
        };
      }

      async function callApi(endpoint) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(baseData())
        });

        const text = await res.text();
        document.getElementById("output").innerText = text;

        loadLogs();
      }

      async function exitCall() {
        const res = await fetch("/exitCall?scenario=free", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(baseData())
        });

        const text = await res.text();
        document.getElementById("output").innerText = text;

        loadLogs();
      }

      async function loadLogs() {
        const res = await fetch('/logs');
        let data = await res.json();

        const filter = document.getElementById("filter").value;
        if (filter) {
          data = data.filter(l => l.url.includes(filter));
        }

        const container = document.getElementById("logs");
        container.innerHTML = "";

        data.forEach(log => {
          const div = document.createElement("div");

          const ok = log.response.responseCode === "00";
          div.className = "log " + (ok ? "ok" : "error");

          div.innerHTML = \`
            <b>\${log.method} \${log.url}</b><br/>
            Time: \${log.time}<br/>
            Duration: \${log.duration} ms<br/>
            <details>
              <summary>Request</summary>
              <pre>\${JSON.stringify(log.request, null, 2)}</pre>
            </details>
            <details>
              <summary>Response</summary>
              <pre>\${JSON.stringify(log.response, null, 2)}</pre>
            </details>
          \`;

          container.appendChild(div);
        });
      }

      async function clearLogs() {
        await fetch('/logs/clear', { method: 'POST' });
        loadLogs();
      }

      // auto refresh every 3 sec
      setInterval(loadLogs, 3000);
    </script>

  </body>
  </html>
  `);
});

/* =========================
   LOG ENDPOINTS
========================= */
app.get("/logs", (req, res) => {
  res.json(logs);
});

app.post("/logs/clear", (req, res) => {
  logs.length = 0;
  res.json({ cleared: true });
});

/* =========================
   API ENDPOINTS
========================= */
app.post("/parkingInit", (req, res) => {
  res.json({
    responseCode: "00",
    responseDescription: "Init OK"
  });
});

app.post("/entranceCall", (req, res) => {
  const ticketId = req.body.token || "T" + Date.now();

  tickets[ticketId] = { paid: false };

  res.json({
    responseCode: "00",
    displayMessage: "Welcome",
    ticketId
  });
});

app.post("/exitCall", (req, res) => {
  const ticket = tickets[req.body.token];

  if (!ticket) {
    return res.json({
      responseCode: "08",
      displayMessage: "Ticket not found"
    });
  }

  res.json({
    barrierOpen: "1",
    moneyToPay: "0",
    responseCode: "00"
  });
});

app.post("/exitPayment", (req, res) => {
  res.json({
    responseCode: "00",
    displayMessage: "Payment success"
  });
});

/* ========================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});