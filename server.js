const express = require("express");
const app = express();

app.use(express.json());
app.use(express.static("public"));

// ── State ─────────────────────────────────────────────────────────────────────
let logs = [];
let activeEntries = {};
let config = {
  parkingMode:           "Entrance",
  exitScenario:          1,
  vehiclePresent:        true,
  availablePlacesNormal: 20,
  availablePlaceMonthly: -1,
  monthlyEnabled:        false,
  showRates:             true,
  responseCode:          "00",
  companyCode:           "MarinaParking"
};

function addLog(req, response) {
  logs.unshift({
    id:       Date.now(),
    time:     new Date().toLocaleTimeString(),
    endpoint: req.originalUrl,
    method:   req.method,
    request:  req.body || {},
    response: response
  });
  if (logs.length > 200) logs.pop();
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
}

function ts() {
  return new Date().toISOString().replace(/[-:T.Z]/g,"").slice(0,14);
}

function scenarioName(n) {
  return {1:"Free",2:"Capture Only",3:"TopUp Needed",4:"Barrier Failed"}[n]||"?";
}

// ── Admin ─────────────────────────────────────────────────────────────────────
app.get("/logs", (req, res) => res.json(logs));
app.get("/admin/config", (req, res) => res.json(config));
app.post("/admin/config", (req, res) => {
  const {key, value} = req.body;
  if (key in config) config[key] = value;
  res.json({ok:true, config});
});
app.post("/admin/clear-entries", (req, res) => {
  activeEntries = {};
  res.json({ok:true});
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>Parking RPS Mock</title>
<style>
body{font-family:monospace;background:#0d1117;color:#c9d1d9;padding:20px;margin:0}
h1{color:#1f6feb}h2{color:#8b949e;margin-top:30px;border-bottom:1px solid #21262d;padding-bottom:6px}
table{border-collapse:collapse;width:100%;margin-bottom:10px}
th{background:#161b22;color:#8b949e;padding:8px;text-align:left}
td{padding:6px 8px;border-bottom:1px solid #161b22}
.btn{background:#1f6feb;color:#fff;border:none;padding:5px 12px;cursor:pointer;border-radius:4px;margin:2px;font-size:12px}
.red{background:#c62828}.green{background:#238636}.orange{background:#e65100}.gray{background:#30363d}
pre{background:#161b22;padding:8px;border-radius:4px;overflow-x:auto;max-height:150px;font-size:11px}
input,select{background:#161b22;color:#c9d1d9;border:1px solid #30363d;padding:4px 8px;border-radius:4px;width:70px}
.active{color:#3fb950;font-weight:bold}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px}
</style></head><body>
<h1>&#x1F17F; Parking RPS Mock Server</h1>
<p style="color:#8b949e">All changes take effect immediately — no restart needed.</p>

<h2>&#9881; Configuration</h2>
<table>
<tr><th>Setting</th><th>Value</th><th>Actions</th></tr>
<tr><td>Mode</td><td id="parkingMode" class="active">${config.parkingMode}</td>
<td><button class="btn" onclick="set('parkingMode','Entrance')">Entrance</button>
<button class="btn orange" onclick="set('parkingMode','Exit')">Exit</button></td></tr>
<tr><td>Exit Scenario</td><td id="exitScenario">${config.exitScenario} — ${scenarioName(config.exitScenario)}</td>
<td>
<button class="btn green" onclick="set('exitScenario',1)">1 Free</button>
<button class="btn" onclick="set('exitScenario',2)">2 Capture</button>
<button class="btn orange" onclick="set('exitScenario',3)">3 TopUp</button>
<button class="btn red" onclick="set('exitScenario',4)">4 Barrier Fail</button>
</td></tr>
<tr><td>Vehicle Present</td><td id="vehiclePresent">${config.vehiclePresent}</td>
<td><button class="btn green" onclick="set('vehiclePresent',true)">YES</button>
<button class="btn red" onclick="set('vehiclePresent',false)">NO</button></td></tr>
<tr><td>Normal Spaces</td><td id="availablePlacesNormal">${config.availablePlacesNormal}</td>
<td><input type="number" id="inpN" value="${config.availablePlacesNormal}">
<button class="btn" onclick="set('availablePlacesNormal',+document.getElementById('inpN').value)">Set</button></td></tr>
<tr><td>Monthly Spaces</td><td id="availablePlaceMonthly">${config.availablePlaceMonthly}</td>
<td><input type="number" id="inpM" value="${config.availablePlaceMonthly}">
<button class="btn" onclick="set('availablePlaceMonthly',+document.getElementById('inpM').value)">Set</button></td></tr>
<tr><td>Monthly Cards</td><td id="monthlyEnabled">${config.monthlyEnabled}</td>
<td><button class="btn green" onclick="set('monthlyEnabled',true)">ON</button>
<button class="btn red" onclick="set('monthlyEnabled',false)">OFF</button></td></tr>
<tr><td>Show Rates</td><td id="showRates">${config.showRates}</td>
<td><button class="btn green" onclick="set('showRates',true)">YES</button>
<button class="btn red" onclick="set('showRates',false)">NO</button></td></tr>
<tr><td>Force Init Error</td><td id="responseCode">${config.responseCode}</td>
<td><button class="btn green" onclick="set('responseCode','00')">00 OK</button>
<button class="btn red" onclick="set('responseCode','91')">91 Invalid Outlet</button>
<button class="btn red" onclick="set('responseCode','92')">92 Invalid Company</button>
<button class="btn red" onclick="set('responseCode','08')">08 Technical Error</button></td></tr>
</table>

<h2>&#x1F9FE; Active Entries (${Object.keys(activeEntries).length})</h2>
<table>
<tr><th>Token</th><th>Last4</th><th>Auth</th><th>Time</th></tr>
${Object.values(activeEntries).map(e=>`<tr>
<td>${(e.token||"").slice(0,24)}...</td>
<td>${e.lastDigits||""}</td>
<td>${e.authCode||""}</td>
<td>${e.timeOfInput||""}</td>
</tr>`).join("")||'<tr><td colspan="4" style="color:#8b949e">No active entries</td></tr>'}
</table>
<button class="btn red" onclick="clearE()">Clear All Entries</button>

<h2>&#x1F4CB; Request Log (last 20)</h2>
<div id="logDiv"><p style="color:#8b949e">Loading...</p></div>

<script>
async function set(k,v){
  await fetch('/admin/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k,value:v})});
  location.reload();
}
async function clearE(){
  await fetch('/admin/clear-entries',{method:'POST'});
  location.reload();
}
async function loadLogs(){
  const r=await fetch('/logs');
  const logs=await r.json();
  document.getElementById('logDiv').innerHTML=logs.slice(0,20).map(l=>\`
<table style="margin-bottom:12px">
<tr><th style="width:90px">\${l.time}</th><th>\${l.method} \${l.endpoint}</th></tr>
<tr><td style="color:#8b949e">REQ</td><td><pre>\${JSON.stringify(l.request,null,2)}</pre></td></tr>
<tr><td style="color:#3fb950">RES</td><td><pre>\${JSON.stringify(l.response,null,2)}</pre></td></tr>
</table>\`).join('')||'<p style="color:#8b949e">No requests yet</p>';
}
loadLogs();
setInterval(loadLogs,3000);
</script>
</body></html>`);
});

// ── POST /parkingInit ─────────────────────────────────────────────────────────
app.post("/parkingInit", (req, res) => {
  if (config.responseCode !== "00") {
    const errMap = {"91":"Invalid Outlet Number","92":"Invalid Company Code","93":"Invalid Application","08":"Technical issue. Please wait for assistance."};
    const response = {responseCode:config.responseCode, responseDescription:errMap[config.responseCode]||"Error"};
    addLog(req, response);
    return res.json(response);
  }

  const charges = config.showRates ? [
    {from:"30",to:"120",fee:"200"},
    {from:"120",to:"180",fee:"400"},
    {from:"180",to:"240",fee:"500"},
    {from:"240",fee:"1000"}
  ] : [];

  const response = {
    outlet:                          req.body.outlet||"0000259010",
    terminal:                        req.body.terminal||"000025901025",
    mode:                            config.parkingMode,
    companyCode:                     config.companyCode,
    keepAliveFreq:                   "10",
    minimumAmountPreAuth:            "300",
    defaultAmount:                   "800",
    phoneForHelp:                    "99375545",
    displayMessageOfEntrance:        "Welcome to Limassol Parking!",
    displayMessageOnExit:            "Please prepare the card that was used during Entrance.",
    displayMessageOfAvailablePlaces: "There are {availablePlacesRegular} available places for Normal and {availablePlaceMonthly} for Monthly Customers.",
    availablePlacesNormal:           String(config.availablePlacesNormal),
    availablePlaceMonthly:           String(config.availablePlaceMonthly),
    monthlyCardsBins:                config.monthlyEnabled ? "434343;232323" : "",
    controller:                      "0",
    fixAmountSolution:               "-1",
    charges,
    responseCode:                    "00",
    responseDescription:             "Successful Response"
  };
  addLog(req, response);
  res.json(response);
});

// ── POST /entranceCall ────────────────────────────────────────────────────────
app.post("/entranceCall", (req, res) => {
  const {token, lastDigits, authCode, timeOfInput} = req.body;
  if (token) {
    activeEntries[token] = {token, lastDigits, authCode, timeOfInput};
    config.availablePlacesNormal = Math.max(0, config.availablePlacesNormal-1);
  }
  const response = {
    outlet:                 req.body.outlet||"0000259010",
    terminal:               req.body.terminal||"000025901025",
    availablePlaceMonthly:  String(config.availablePlaceMonthly),
    availablePlacesRegular: String(config.availablePlacesNormal),
    installationPoint:      "Entrance",
    displayMessage:         "Welcome. Have a nice day!!",
    timeToDisplayMessage:   "5",
    responseCode:           "00",
    responseDescription:    "Successful Response"
  };
  addLog(req, response);
  res.json(response);
});

// ── POST /exitCall ────────────────────────────────────────────────────────────
app.post("/exitCall", (req, res) => {
  const {token} = req.body;
  let response;

  switch(config.exitScenario) {
    case 1:
      response = {barrierOpen:"1",moneyToPay:"0",displayMessage:"Thank you! Have a nice day.",timeToDisplayMessage:"5",responseCode:"00",responseDescription:"Successful Response"};
      if(token) delete activeEntries[token];
      config.availablePlacesNormal = Math.min(20, config.availablePlacesNormal+1);
      break;
    case 2:
      response = {barrierOpen:"1",moneyToPay:"200",displayMessage:"Thank you! Your card has been charged EUR 2.00.",timeToDisplayMessage:"5",responseCode:"00",responseDescription:"Successful Response"};
      if(token) delete activeEntries[token];
      config.availablePlacesNormal = Math.min(20, config.availablePlacesNormal+1);
      break;
    case 3:
      response = {barrierOpen:"-2",moneyToPay:"356",recordId:"1234567890ABCDEF1234567890ABCDEF",displayMessage:"Charge is EUR 3.56. Please present your card.",timeToDisplayMessage:"10",responseCode:"31",responseDescription:"TopUp required"};
      break;
    case 4:
    default:
      response = {barrierOpen:"0",moneyToPay:"0",displayMessage:"Technical issue. Please contact staff.",timeToDisplayMessage:"10",responseCode:"08",responseDescription:"Barrier failed to open"};
      break;
  }
  addLog(req, response);
  res.json(response);
});

// ── POST /exitPayment ─────────────────────────────────────────────────────────
app.post("/exitPayment", (req, res) => {
  const {token} = req.body;
  if(token) delete activeEntries[token];
  config.availablePlacesNormal = Math.min(20, config.availablePlacesNormal+1);
  const response = {barrierOpen:"1",displayMessage:"Payment successful. Barrier is open.",timeToDisplayMessage:"5",responseCode:"00",responseDescription:"Successful Response"};
  addLog(req, response);
  res.json(response);
});

// ── POST /vehiclePresent ──────────────────────────────────────────────────────
app.post("/vehiclePresent", (req, res) => {
  const response = {
    outlet:               req.body.outlet||"0000259010",
    terminal:             req.body.terminal||"000025901025",
    installationPoint:    config.parkingMode,
    dayTime:              ts(),
    vehiclePresent:       config.vehiclePresent?"1":"0",
    displayMessage:       config.vehiclePresent?"Vehicle detected. Please proceed.":"No vehicle detected at entrance.",
    timeToDisplayMessage: "3",
    availablePlaceMonthly: String(config.availablePlaceMonthly),
    availablePlacesNormal: String(config.availablePlacesNormal),
    responseCode:         "00",
    responseDescription:  "Successful Response"
  };
  addLog(req, response);
  res.json(response);
});

// ── POST /help ────────────────────────────────────────────────────────────────
app.post("/help", (req, res) => {
  const response = {responseCode:"00",responseDescription:"Successful Response"};
  addLog(req, response);
  res.json(response);
});

// ── START ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Parking RPS Mock running on http://0.0.0.0:${PORT}`);
});