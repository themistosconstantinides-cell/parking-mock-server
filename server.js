const express = require("express");
const app = express();

app.use(express.json());

/* =========================
   LOG SYSTEM
========================= */
const logs = [];

app.use((req, res, next) => {
  const start = Date.now();

  const logEntry = {
    time: new Date().toISOString(),
    method: req.method,
    url: req.url,
    requestBody: req.body,
    response: null,
    duration: 0
  };

  const originalSend = res.send.bind(res);

  res.send = (data) => {
    logEntry.response = data;
    logEntry.duration = Date.now() - start;

    logs.unshift(logEntry);
    if (logs.length > 100) logs.pop();

    console.log("LOG:", logEntry);

    return originalSend(data);
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
    <title>Parking Simulator</title>
    <style>
      body { font-family: Arial; padding:20px; background:#f4f4f4;}
      button { padding:10px; margin:5px; }
      input, select { padding:8px; margin:5px; }
      pre { background:#111; color:#0f0; padding:10px; height:300px; overflow:auto;}
    </style>
  </head>
  <body>

    <h2>🚗 Parking Simulator</h2>

    <h3>Config</h3>
    Outlet: <input id="outlet" value="0000259010"/>
    Terminal: <input id="terminal" value="000025901025"/>
    Token: <input id="token" value="abc123"/>

    <h3>Init</h3>
    <button onclick="callApi('/parkingInit')">INIT</button>

    <h3>Entrance</h3>
    <button onclick="callApi('/entranceCall')">ENTRANCE</button>

    <h3>Exit</h3>
    <select id="scenario">
      <option value="free">Free</option>
      <option value="capture">Capture</option>
      <option value="topup">TopUp</option>
      <option value="fail">Fail</option>
    </select>
    <button onclick="exitCall()">EXIT</button>

    <h3>Payment</h3>
    <button onclick="callApi('/exitPayment')">PAY</button>

    <h3>Logs</h3>
    <button onclick="loadLogs()">VIEW LOGS</button>

    <pre id="output">Ready...</pre>

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
      }

      async function exitCall() {
        const scenario = document.getElementById("scenario").value;

        const res = await fetch("/exitCall?scenario=" + scenario, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(baseData())
        });

        const text = await res.text();
        document.getElementById("output").innerText = text;
      }

      async function loadLogs() {
        const res = await fetch("/logs");
        const data = await res.json();

        document.getElementById("output").innerText =
          JSON.stringify(data, null, 2);
      }
    </script>

  </body>
  </html>
  `);
});

/* =========================
   LOGS ENDPOINT
========================= */
app.get("/logs", (req, res) => {
  res.json(logs);
});

/* =========================
   parkingInit
========================= */
app.post("/parkingInit", (req, res) => {
  res.json({
    responseCode: "00",
    responseDescription: "Successful Response"
  });
});

/* =========================
   entranceCall
========================= */
app.post("/entranceCall", (req, res) => {
  const ticketId = req.body.token || "T" + Date.now();

  tickets[ticketId] = {
    paid: false,
    amount: 356
  };

  res.json({
    responseCode: "00",
    displayMessage: "Welcome",
    ticketId
  });
});

/* =========================
   exitCall
========================= */
app.post("/exitCall", (req, res) => {
  const scenario = req.query.scenario || "free";
  const ticket = tickets[req.body.token];

  if (!ticket) {
    return res.json({
      responseCode: "08",
      displayMessage: "Ticket not found"
    });
  }

  if (scenario === "free") {
    return res.json({
      barrierOpen: "1",
      moneyToPay: "0",
      responseCode: "00"
    });
  }

  if (scenario === "capture") {
    ticket.paid = true;
    return res.json({
      barrierOpen: "1",
      moneyToPay: "200",
      responseCode: "00"
    });
  }

  if (scenario === "topup") {
    const recordId = "REC" + recordCounter++;
    ticket.recordId = recordId;

    return res.json({
      barrierOpen: "-2",
      moneyToPay: "356",
      recordId,
      responseCode: "31"
    });
  }

  return res.json({
    barrierOpen: "0",
    responseCode: "08",
    displayMessage: "Barrier error"
  });
});

/* =========================
   exitPayment
========================= */
app.post("/exitPayment", (req, res) => {
  const ticket = tickets[req.body.token];

  if (!ticket) {
    return res.json({
      responseCode: "08",
      displayMessage: "Ticket not found"
    });
  }

  ticket.paid = true;

  res.json({
    barrierOpen: "1",
    responseCode: "00",
    displayMessage: "Payment success"
  });
});

/* ========================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});