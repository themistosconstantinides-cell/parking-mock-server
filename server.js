const express = require("express");
const app = express();

app.use(express.json());

/* =========================================================
   In-memory state
========================================================= */
const state = {
  config: {
    scenario: "free",          // free | capture | topup | fail
    mode: "Entrance",          // Entrance | Exit
    entranceResult: "success", // success | denied
    paymentResult: "success",  // success | fail
    vehiclePresent: "1"        // 1 | 0
  },
  tickets: {},
  lastRecordId: 1000
};

function nowYmdHms() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function nextRecordId() {
  state.lastRecordId += 1;
  return `REC${String(state.lastRecordId).padStart(12, "0")}`;
}

function getConfigFromRequest(req) {
  return {
    scenario: req.query.scenario || state.config.scenario,
    mode: req.query.mode || state.config.mode,
    entranceResult: req.query.entranceResult || state.config.entranceResult,
    paymentResult: req.query.paymentResult || state.config.paymentResult,
    vehiclePresent: req.query.vehiclePresent || state.config.vehiclePresent
  };
}

function createOrUpdateTicketFromEntrance(body) {
  const ticketKey = body.token || body.tokenCode || `${body.lastDigits || "0000"}-${Date.now()}`;

  state.tickets[ticketKey] = {
    token: body.token || ticketKey,
    tokenCode: body.tokenCode || "",
    outlet: body.outlet || "0000259010",
    terminal: body.terminal || "000025901025",
    installationPoint: "Entrance",
    lastDigits: body.lastDigits || "",
    firstDigits: body.firstDigits || "",
    expiryDate: body.expiryDate || "",
    authCode: body.authCode || "",
    rrn: body.rrn || "",
    receiptNumber: body.receiptNumber || "",
    preAuthAmount: body.preAuthAmount || "300",
    timeOfInput: body.timeOfInput || nowYmdHms(),
    paid: false,
    amountDue: "0",
    recordId: ""
  };

  return state.tickets[ticketKey];
}

function findTicket(body) {
  return (
    state.tickets[body.token] ||
    state.tickets[body.tokenCode] ||
    Object.values(state.tickets).find(
      (t) =>
        (body.lastDigits && t.lastDigits === body.lastDigits) ||
        (body.token && t.token === body.token)
    ) ||
    null
  );
}

/* =========================================================
   UI
========================================================= */
app.get("/", (req, res) => {
  res.send(`
  <html>
  <head>
    <title>Parking Backend Simulator</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; background:#f5f6f8; }
      .wrap { max-width: 1100px; margin: 0 auto; }
      .card { background:#fff; border-radius:12px; padding:16px; margin-bottom:16px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
      input, select, button { padding:10px; margin:6px 6px 6px 0; border-radius:8px; border:1px solid #ccc; }
      button { cursor:pointer; }
      pre { background:#111; color:#0f0; padding:12px; border-radius:8px; overflow:auto; min-height:220px; }
      .row { display:flex; flex-wrap:wrap; gap:12px; }
      .col { flex:1; min-width:280px; }
      label { display:block; font-size:12px; color:#444; margin-top:8px; }
      h1, h2, h3 { margin-top:0; }
      .small { color:#666; font-size:12px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>🚗 Parking Backend Simulator</h1>

      <div class="card">
        <h3>Configuration</h3>
        <div class="row">
          <div class="col">
            <label>Outlet</label>
            <input id="outlet" value="0000259010" />
          </div>
          <div class="col">
            <label>Terminal</label>
            <input id="terminal" value="000025901025" />
          </div>
          <div class="col">
            <label>Token</label>
            <input id="token" value="abc123" />
          </div>
          <div class="col">
            <label>Last Digits</label>
            <input id="lastDigits" value="1234" />
          </div>
        </div>

        <div class="row">
          <div class="col">
            <label>Mode</label>
            <select id="mode">
              <option value="Entrance">Entrance</option>
              <option value="Exit">Exit</option>
            </select>
          </div>
          <div class="col">
            <label>Exit Scenario</label>
            <select id="scenario">
              <option value="free">Free Exit</option>
              <option value="capture">Capture Only</option>
              <option value="topup">TopUp Needed</option>
              <option value="fail">Barrier Failed</option>
            </select>
          </div>
          <div class="col">
            <label>Entrance Result</label>
            <select id="entranceResult">
              <option value="success">Success</option>
              <option value="denied">Access Denied</option>
            </select>
          </div>
          <div class="col">
            <label>Payment Result</label>
            <select id="paymentResult">
              <option value="success">Success</option>
              <option value="fail">Payment Failed</option>
            </select>
          </div>
          <div class="col">
            <label>Vehicle Present</label>
            <select id="vehiclePresent">
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </div>
        </div>

        <button onclick="saveConfig()">Save Config</button>
        <button onclick="resetState()">Reset State</button>
        <span class="small">The UI saves scenario settings on the server.</span>
      </div>

      <div class="card">
        <h3>Actions</h3>
        <button onclick="callInit()">parkingInit</button>
        <button onclick="callEntrance()">entranceCall</button>
        <button onclick="callExit()">exitCall</button>
        <button onclick="callPayment()">exitPayment</button>
        <button onclick="callVehicle()">vehiclePresent</button>
        <button onclick="callHelp()">help</button>
        <button onclick="viewState()">View State</button>
      </div>

      <div class="card">
        <h3>Response</h3>
        <pre id="output">Ready...</pre>
      </div>
    </div>

    <script>
      function baseData() {
        return {
          application: "Parking",
          outlet: document.getElementById("outlet").value,
          terminal: document.getElementById("terminal").value,
          token: document.getElementById("token").value,
          lastDigits: document.getElementById("lastDigits").value
        };
      }

      async function api(method, url, body) {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined
        });
        const text = await res.text();
        document.getElementById("output").innerText = text;
      }

      async function saveConfig() {
        await api("POST", "/__config", {
          mode: document.getElementById("mode").value,
          scenario: document.getElementById("scenario").value,
          entranceResult: document.getElementById("entranceResult").value,
          paymentResult: document.getElementById("paymentResult").value,
          vehiclePresent: document.getElementById("vehiclePresent").value
        });
      }

      async function resetState() {
        await api("POST", "/__reset", {});
      }

      async function viewState() {
        const res = await fetch("/__state");
        const text = await res.text();
        document.getElementById("output").innerText = text;
      }

      function callInit() {
        api("POST", "/parkingInit", {
          application: "Parking",
          outlet: document.getElementById("outlet").value,
          terminal: document.getElementById("terminal").value
        });
      }

      function callEntrance() {
        api("POST", "/entranceCall", {
          application: "Parking",
          intallationPoint: "Entrance",
          outlet: document.getElementById("outlet").value,
          terminal: document.getElementById("terminal").value,
          token: document.getElementById("token").value,
          inputType: "Bank Card",
          lastDigits: document.getElementById("lastDigits").value,
          firstDigits: "",
          expiryDate: "2905",
          authCode: "123456",
          rrn: "000001000001",
          receiptNumber: "0001",
          preAuthAmount: "300",
          tokenCode: "0001234561C",
          timeOfInput: "${nowYmdHms()}"
        });
      }

      function callExit() {
        api("POST", "/exitCall", {
          application: "Parking",
          intallationPoint: "Exit",
          outlet: document.getElementById("outlet").value,
          terminal: document.getElementById("terminal").value,
          token: document.getElementById("token").value,
          lastDigits: document.getElementById("lastDigits").value,
          timeOfInput: "${nowYmdHms()}"
        });
      }

      function callPayment() {
        api("POST", "/exitPayment", {
          application: "Parking",
          intallationPoint: "Exit",
          outlet: document.getElementById("outlet").value,
          terminal: document.getElementById("terminal").value,
          token: document.getElementById("token").value,
          lastDigits: document.getElementById("lastDigits").value,
          firstDigits: "",
          timeOfInput: "${nowYmdHms()}",
          amountPayed: "356",
          authCode: "654321",
          responseCode: "00",
          referenceNo: "000002000002",
          originalRefNum: "000001000001",
          recordId: ""
        });
      }

      function callVehicle() {
        api("POST", "/vehiclePresent", {
          outlet: document.getElementById("outlet").value,
          terminal: document.getElementById("terminal").value,
          dateTime: "${nowYmdHms()}"
        });
      }

      function callHelp() {
        api("POST", "/help", {
          application: "Parking",
          outlet: document.getElementById("outlet").value,
          terminal: document.getElementById("terminal").value,
          dateTime: "${nowYmdHms()}"
        });
      }
    </script>
  </body>
  </html>
  `);
});

/* =========================================================
   Internal helpers
========================================================= */
app.get("/__state", (req, res) => {
  res.json(state);
});

app.post("/__config", (req, res) => {
  state.config = {
    ...state.config,
    ...req.body
  };
  res.json({
    success: true,
    config: state.config
  });
});

app.post("/__reset", (req, res) => {
  state.tickets = {};
  state.lastRecordId = 1000;
  res.json({
    success: true,
    message: "State reset"
  });
});

/* =========================================================
   Routes from Postman collection
========================================================= */

/* parkingInit */
app.post("/parkingInit", (req, res) => {
  const cfg = getConfigFromRequest(req);

  if (cfg.mode === "Exit") {
    return res.json({
      outlet: req.body.outlet || "0000259010",
      terminal: req.body.terminal || "000025901025",
      mode: "Exit",
      companyCode: "MarinaParking",
      keepAliveFreq: "10",
      minimumAmountPreAuth: "300",
      defaultAmount: "800",
      phoneForHelp: "99375545",
      displayMessageOfEntrance: "Welcome to Limassol Parking!",
      displayMessageOnExit: "Please prepare the card that was used during Entrance.",
      displayMessageOfAvailablePlaces: "",
      availablePlacesNormal: "-1",
      availablePlaceMonthly: "-1",
      monthlyCardsBins: "",
      controller: "0",
      fixAmountSolution: "-1",
      charges: [],
      responseCode: "00",
      responseDescription: "Successful Response"
    });
  }

  res.json({
    outlet: req.body.outlet || "0000259010",
    terminal: req.body.terminal || "000025901025",
    mode: "Entrance",
    companyCode: "MarinaParking",
    keepAliveFreq: "10",
    minimumAmountPreAuth: "300",
    defaultAmount: "800",
    phoneForHelp: "99375545",
    displayMessageOfEntrance: "Welcome to Limassol Parking!",
    displayMessageOnExit: "Please prepare the card that was used during Entrance.",
    displayMessageOfAvailablePlaces:
      "There are {availablePlacesRegular} available places for Normal and {availablePlaceMonthly} for Monthly Customers.",
    availablePlacesNormal: "18",
    availablePlaceMonthly: "-1",
    monthlyCardsBins: "434343;232323",
    controller: "0",
    fixAmountSolution: "-1",
    charges: [
      { from: "30", to: "120", fee: "200" },
      { from: "120", to: "180", fee: "400" },
      { from: "180", to: "240", fee: "500" },
      { from: "240", fee: "1000" }
    ],
    responseCode: "00",
    responseDescription: "Successful Response"
  });
});

/* entranceCall */
app.post("/entranceCall", (req, res) => {
  const cfg = getConfigFromRequest(req);

  if (cfg.entranceResult === "denied") {
    return res.json({
      installationPoint: "Entrance",
      displayMessage: "Access denied. Please contact staff.",
      timeToDisplayMessage: "8",
      responseCode: "08",
      responseDescription: "Access Denied"
    });
  }

  createOrUpdateTicketFromEntrance(req.body);

  res.json({
    outlet: req.body.outlet || "0000259010",
    terminal: req.body.terminal || "000025901025",
    availablePlaceMonthly: "9",
    availablePlacesRegular: "19",
    installationPoint: "Entrance",
    displayMessage: "Welcome. Have a nice!!",
    timeToDisplayMessage: "5",
    responseCode: "00",
    responseDescription: "Successful Response"
  });
});

/* exitCall */
app.post("/exitCall", (req, res) => {
  const cfg = getConfigFromRequest(req);
  const ticket = findTicket(req.body);

  if (!ticket) {
    return res.json({
      barrierOpen: "0",
      moneyToPay: "0",
      displayMessage: "Ticket/token not found. Please contact staff.",
      timeToDisplayMessage: "10",
      responseCode: "08",
      responseDescription: "Ticket not found"
    });
  }

  if (cfg.scenario === "free") {
    ticket.amountDue = "0";
    return res.json({
      barrierOpen: "1",
      moneyToPay: "0",
      displayMessage: "Thank you! Have a nice day.",
      timeToDisplayMessage: "5",
      responseCode: "00",
      responseDescription: "Successful Response"
    });
  }

  if (cfg.scenario === "capture") {
    ticket.amountDue = "200";
    ticket.paid = true;
    return res.json({
      barrierOpen: "1",
      moneyToPay: "200",
      displayMessage: "Thank you! Your card has been charged EUR 2.00.",
      timeToDisplayMessage: "5",
      responseCode: "00",
      responseDescription: "Successful Response"
    });
  }

  if (cfg.scenario === "topup") {
    const recordId = nextRecordId();
    ticket.amountDue = "356";
    ticket.recordId = recordId;
    ticket.paid = false;

    return res.json({
      barrierOpen: "-2",
      moneyToPay: "356",
      recordId: recordId,
      displayMessage: "Charge is EUR 3.56. Please present your card.",
      timeToDisplayMessage: "10",
      responseCode: "31",
      responseDescription: "TopUp required"
    });
  }

  return res.json({
    barrierOpen: "0",
    moneyToPay: "0",
    displayMessage: "Technical issue. Please contact staff.",
    timeToDisplayMessage: "10",
    responseCode: "08",
    responseDescription: "Barrier failed to open"
  });
});

/* exitPayment */
app.post("/exitPayment", (req, res) => {
  const cfg = getConfigFromRequest(req);
  const ticket = findTicket(req.body);

  if (cfg.paymentResult === "fail") {
    return res.json({
      barrierOpen: "0",
      displayMessage: "Payment failed. Please contact staff.",
      timeToDisplayMessage: "10",
      responseCode: "08",
      responseDescription: "Payment failed"
    });
  }

  if (ticket) {
    ticket.paid = true;
    if (req.body.recordId) {
      ticket.recordId = req.body.recordId;
    }
    if (req.body.amountPayed) {
      ticket.amountDue = req.body.amountPayed;
    }
  }

  res.json({
    barrierOpen: "1",
    displayMessage: "Payment successful. Barrier is open.",
    timeToDisplayMessage: "5",
    responseCode: "00",
    responseDescription: "Successful Response"
  });
});

/* vehiclePresent */
app.post("/vehiclePresent", (req, res) => {
  const cfg = getConfigFromRequest(req);

  if (cfg.vehiclePresent === "0") {
    return res.json({
      outlet: req.body.outlet || "0000259010",
      terminal: req.body.terminal || "000025901025",
      installationPoint: "Entrance",
      dayTime: req.body.dateTime || nowYmdHms(),
      vehiclePresent: "0",
      displayMessage: "No vehicle detected at entrance.",
      timeToDisplayMessage: "5",
      availablePlaceMonthly: "-1",
      availablePlacesNormal: "20",
      responseCode: "00",
      responseDescription: "Successful Response"
    });
  }

  res.json({
    outlet: req.body.outlet || "0000259010",
    terminal: req.body.terminal || "000025901025",
    installationPoint: "Entrance",
    dayTime: req.body.dateTime || nowYmdHms(),
    vehiclePresent: "1",
    displayMessage: "Vehicle detected. Please proceed.",
    timeToDisplayMessage: "3",
    availablePlaceMonthly: "-1",
    availablePlacesNormal: "20",
    responseCode: "00",
    responseDescription: "Successful Response"
  });
});

/* help */
app.post("/help", (req, res) => {
  res.json({
    responseCode: "00",
    responseDescription: "Successful Response"
  });
});

/* optional health */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Parking mock server is running"
  });
});

/* =========================================================
   Start
========================================================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Parking mock server running on port", PORT);
});