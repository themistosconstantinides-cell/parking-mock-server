const express = require("express");
const https   = require("https");
const app     = express();

app.use(express.json());
app.use(express.static("public"));

// ── State ─────────────────────────────────────────────────────────────────────
let logs          = [];
let activeEntries = {};

let config = {
  // ── POS Devices ──────────────────────────────────────────────────────────────
  // Entrance POS — configured in Android Settings on the entrance device
  entranceOutlet:   "0000259010",
  entranceTerminal: "000025901025",
  // Exit POS — configured in Android Settings on the exit device
  exitOutlet:       "0000259011",
  exitTerminal:     "000025901026",

  // ── parkingInit fields ────────────────────────────────────────────────────────
  keepAliveFreq:          10,
  minimumAmountPreAuth:   300,
  defaultAmount:          800,
  phoneForHelp:           "99375545",
  displayMessageEntrance: "Welcome to Limassol Parking!",
  displayMessageExit:     "Please prepare the card that was used during Entrance.",
  charges: [
    {from:"30",  to:"120", fee:"200"},
    {from:"120", to:"180", fee:"400"},
    {from:"180", to:"240", fee:"500"},
    {from:"240", fee:"1000"}
  ],
  exitScenario:          1,
  vehiclePresent:        true,
  availablePlacesNormal: 20,
  availablePlaceMonthly: -1,
  monthlyEnabled:        false,
  showRates:             true,
  responseCode:          "00",
  companyCode:           "MarinaParking",

  // ── TELL Gate Control PRO ─────────────────────────────────────────────────────
  tellEnabled:       false,
  tellApiKey:        "f2nIrJ8DBf4Gc8ar99IQeCVVm3pnWrVP",
  tellHwId:          "",
  tellHwName:        "ParkingBarrier",
  tellAppId:         "",
  tellVehicleInput:  "in1",
  tellBarrierOutput: 1,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function addLog(req, response) {
  logs.unshift({
    id:       Date.now(),
    time:     new Date().toLocaleTimeString(),
    endpoint: req.originalUrl,
    method:   req.method,
    request:  req.body || {},
    response: response
  });
  if (logs.length > 500) logs.pop();
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
}

function addTellLog(action, request, response, error) {
  logs.unshift({
    id:       Date.now(),
    time:     new Date().toLocaleTimeString(),
    endpoint: `[TELL] ${action}`,
    method:   "TELL",
    request:  request,
    response: error ? { error: error.message || String(error) } : response
  });
  if (logs.length > 500) logs.pop();
  console.log(`[${new Date().toLocaleTimeString()}] TELL ${action}`);
}

function ts() {
  return new Date().toISOString().replace(/[-:T.Z]/g,"").slice(0,14);
}

function scenarioName(n) {
  return {1:"Free",2:"Capture Only",3:"TopUp Needed",4:"Barrier Failed"}[n]||"?";
}

/**
 * Determine which POS is calling based on outlet+terminal in the request body.
 * Returns "Entrance", "Exit", or "Unknown".
 * If neither is configured yet, falls back to "Entrance" gracefully.
 */
function detectMode(reqBody) {
  const outlet   = reqBody.outlet   || "";
  const terminal = reqBody.terminal || "";
  if (outlet === config.entranceOutlet && terminal === config.entranceTerminal) return "Entrance";
  if (outlet === config.exitOutlet     && terminal === config.exitTerminal)     return "Exit";
  return "Unknown";
}

// ── TELL API client ───────────────────────────────────────────────────────────
function tellRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: "api.tell.hu",
      port:     443,
      path:     path,
      method:   method,
      headers:  {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "api-key":        config.tellApiKey
      }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error("Invalid JSON from TELL: " + data)); }
      });
    });
    req.on("error", reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error("TELL API timeout")); });
    req.write(payload);
    req.end();
  });
}

async function tellCheckVehicle() {
  const body = { hwId: config.tellHwId, hwName: config.tellHwName, appId: config.tellAppId };
  const result = await tellRequest("POST", "/gc/getgeneral", body);
  addTellLog("getgeneral", body, result, null);
  if (result.result !== "OK") throw new Error("TELL getgeneral: " + JSON.stringify(result));
  const status = result.statusResult && result.statusResult.deviceStatus;
  if (!status) throw new Error("No deviceStatus in TELL response");
  const val = config.tellVehicleInput === "in2" ? status.in2 : status.in1;
  return val === 1;
}

async function tellOpenBarrier() {
  const body = { hwid: config.tellHwId, appId: config.tellAppId, data: config.tellBarrierOutput };
  const result = await tellRequest("GET", "/gc/open", body);
  addTellLog("open", body, result, null);
  if (result.result !== "OK") throw new Error("TELL open: " + JSON.stringify(result));
  return result.data && result.data.status === 0;
}

// ── Admin endpoints ───────────────────────────────────────────────────────────
app.get("/logs", (req, res) => res.json(logs));
app.get("/admin/config", (req, res) => res.json(config));
app.post("/admin/config", (req, res) => {
  const {key, value} = req.body;
  if (key in config) config[key] = value;
  res.json({ok: true, config});
});
app.post("/admin/clear-entries", (req, res) => {
  activeEntries = {};
  res.json({ok: true});
});
app.post("/admin/clear-logs", (req, res) => {
  logs = [];
  res.json({ok: true});
});
app.post("/admin/add-charge", (req, res) => {
  const {from, to, fee} = req.body;
  if (!from || !fee) return res.json({ok:false, error:"from and fee required"});
  const charge = {from: String(from), fee: String(fee)};
  if (to) charge.to = String(to);
  config.charges.push(charge);
  config.charges.sort((a,b) => parseInt(a.from) - parseInt(b.from));
  res.json({ok: true});
});
app.post("/admin/remove-charge", (req, res) => {
  const {index} = req.body;
  if (index >= 0 && index < config.charges.length) {
    config.charges.splice(index, 1);
  }
  res.json({ok: true});
});
app.post("/admin/tell-test", async (req, res) => {
  if (!config.tellHwId || !config.tellAppId)
    return res.json({ok:false, error:"hwId and appId must be configured"});
  try {
    const body = {hwId:config.tellHwId, hwName:config.tellHwName, appId:config.tellAppId};
    const result = await tellRequest("POST", "/gc/getgeneral", body);
    addTellLog("getgeneral [TEST]", body, result, null);
    if (result.result === "OK") {
      const s = result.statusResult.deviceStatus;
      res.json({ok:true, in1:s.in1, in2:s.in2, out1:s.out1, out2:s.out2,
                fw:result.statusResult.fwVersion, model:result.statusResult.deviceTellApiName});
    } else {
      res.json({ok:false, error:JSON.stringify(result)});
    }
  } catch(e) {
    addTellLog("getgeneral [TEST]", {}, null, e);
    res.json({ok:false, error:e.message});
  }
});
app.post("/admin/tell-open", async (req, res) => {
  if (!config.tellHwId || !config.tellAppId)
    return res.json({ok:false, error:"hwId and appId must be configured"});
  try {
    const ok = await tellOpenBarrier();
    res.json({ok});
  } catch(e) {
    res.json({ok:false, error:e.message});
  }
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  const sn = scenarioName(config.exitScenario);
  res.send(`<!DOCTYPE html><html><head><title>Parking RPS Mock</title>
<style>
body{font-family:monospace;background:#0d1117;color:#c9d1d9;padding:20px;margin:0}
h1{color:#1f6feb}
h2{color:#8b949e;margin-top:30px;border-bottom:1px solid #21262d;padding-bottom:6px}
h3{color:#8b949e;margin-top:16px;margin-bottom:6px;font-size:13px}
table{border-collapse:collapse;width:100%;margin-bottom:10px}
th{background:#161b22;color:#8b949e;padding:8px;text-align:left}
td{padding:6px 8px;border-bottom:1px solid #161b22;vertical-align:middle}
.btn{background:#1f6feb;color:#fff;border:none;padding:5px 12px;cursor:pointer;border-radius:4px;margin:2px;font-size:12px}
.red{background:#c62828}.green{background:#238636}.orange{background:#e65100}
.gray{background:#30363d}.yellow{background:#7d5c00;color:#ffd700}
pre{background:#161b22;padding:8px;border-radius:4px;overflow-x:auto;max-height:150px;font-size:11px}
input,select{background:#161b22;color:#c9d1d9;border:1px solid #30363d;padding:4px 8px;border-radius:4px}
input.n{width:60px} input.m{width:160px} input.w{width:260px} input.t{width:140px}
.active{color:#3fb950;font-weight:bold}.inactive{color:#8b949e}
.pos-box{background:#161b22;border:1px solid #30363d;border-radius:6px;padding:14px;margin-bottom:14px}
.entrance-box{border-color:#1f6feb}
.exit-box{border-color:#e65100}
.tell-box{background:#161b22;border:2px solid ${config.tellEnabled?'#238636':'#30363d'};border-radius:6px;padding:16px;margin-top:8px}
#ts{margin-top:8px;padding:8px;border-radius:4px;font-size:12px;display:none}
.ok{background:#0d2818;color:#3fb950;border:1px solid #238636}
.err{background:#2d0a0a;color:#ff6b6b;border:1px solid #c62828}
.tag{display:inline-block;padding:1px 7px;border-radius:10px;font-size:11px;margin-left:6px}
.tag-entrance{background:#0d2030;color:#1f6feb;border:1px solid #1f6feb}
.tag-exit{background:#2d1500;color:#e65100;border:1px solid #e65100}
.tag-unknown{background:#2d2d2d;color:#8b949e;border:1px solid #555}
</style></head><body>
<h1>&#x1F17F; Parking RPS Mock Server</h1>
<p style="color:#8b949e">All changes take effect immediately — no restart needed.</p>

<h2>&#x1F4F1; POS Device Configuration</h2>
<p style="color:#8b949e;font-size:12px;margin-top:-8px">
  The server identifies which POS is calling by matching outlet + terminal from the request.
  Enter the same values here that you configure in the Android app Settings.
</p>

<div class="pos-box entrance-box">
<h3>🔵 Entrance POS</h3>
<table>
<tr><th style="width:160px">Parameter</th><th>Value</th><th style="width:80px"></th></tr>
<tr>
  <td>Outlet Number</td>
  <td><input class="t" id="enOutlet" placeholder="10 digits" value="${config.entranceOutlet}" maxlength="10"></td>
  <td><button class="btn" onclick="sv('entranceOutlet','enOutlet')">Save</button></td>
</tr>
<tr>
  <td>Terminal ID</td>
  <td><input class="t" id="enTerminal" placeholder="12 digits" value="${config.entranceTerminal}" maxlength="12"></td>
  <td><button class="btn" onclick="sv('entranceTerminal','enTerminal')">Save</button></td>
</tr>
</table>
</div>

<div class="pos-box exit-box">
<h3>🟠 Exit POS</h3>
<table>
<tr><th style="width:160px">Parameter</th><th>Value</th><th style="width:80px"></th></tr>
<tr>
  <td>Outlet Number</td>
  <td><input class="t" id="exOutlet" placeholder="10 digits" value="${config.exitOutlet}" maxlength="10"></td>
  <td><button class="btn" onclick="sv('exitOutlet','exOutlet')">Save</button></td>
</tr>
<tr>
  <td>Terminal ID</td>
  <td><input class="t" id="exTerminal" placeholder="12 digits" value="${config.exitTerminal}" maxlength="12"></td>
  <td><button class="btn" onclick="sv('exitTerminal','exTerminal')">Save</button></td>
</tr>
</table>
</div>

<h2>&#9881; Parking Configuration</h2>
<table>
<tr><th>Setting</th><th>Value</th><th>Actions</th></tr>
<tr><td>Company Code</td><td>${config.companyCode}</td>
<td><input class="m" id="inCC" value="${config.companyCode}">
<button class="btn" onclick="sv('companyCode','inCC')">Save</button></td></tr>
<tr><td>Exit Scenario</td><td>${config.exitScenario} — ${sn}</td>
<td><button class="btn green" onclick="set('exitScenario',1)">1 Free</button>
<button class="btn" onclick="set('exitScenario',2)">2 Capture</button>
<button class="btn orange" onclick="set('exitScenario',3)">3 TopUp</button>
<button class="btn red" onclick="set('exitScenario',4)">4 Barrier Fail</button></td></tr>
<tr><td>Vehicle Present (mock)</td><td>${config.vehiclePresent}</td>
<td><button class="btn green" onclick="set('vehiclePresent',true)">YES</button>
<button class="btn red" onclick="set('vehiclePresent',false)">NO</button></td></tr>
<tr><td>Normal Spaces</td><td>${config.availablePlacesNormal}</td>
<td><input class="n" type="number" id="inN" value="${config.availablePlacesNormal}">
<button class="btn" onclick="set('availablePlacesNormal',Number(document.getElementById('inN').value))">Set</button></td></tr>
<tr><td>Monthly Spaces</td><td>${config.availablePlaceMonthly}</td>
<td><input class="n" type="number" id="inM" value="${config.availablePlaceMonthly}">
<button class="btn" onclick="set('availablePlaceMonthly',Number(document.getElementById('inM').value))">Set</button></td></tr>
<tr><td>Monthly Cards</td><td>${config.monthlyEnabled}</td>
<td><button class="btn green" onclick="set('monthlyEnabled',true)">ON</button>
<button class="btn red" onclick="set('monthlyEnabled',false)">OFF</button></td></tr>
<tr><td>Show Rates</td><td>${config.showRates}</td>
<td><button class="btn green" onclick="set('showRates',true)">YES</button>
<button class="btn red" onclick="set('showRates',false)">NO</button></td></tr>
<tr><td>Force Init Error</td><td>${config.responseCode}</td>
<td><button class="btn green" onclick="set('responseCode','00')">00 OK</button>
<button class="btn red" onclick="set('responseCode','91')">91 Outlet</button>
<button class="btn red" onclick="set('responseCode','92')">92 Company</button>
<button class="btn red" onclick="set('responseCode','08')">08 Technical</button></td></tr>
</table>

<h2>&#x1F4E1; parkingInit Response Fields</h2>
<table>
<tr><th style="width:200px">Field</th><th>Value</th><th style="width:220px">Edit</th></tr>
<tr><td>Keep Alive (min)</td><td>${config.keepAliveFreq}</td>
<td><input class="n" type="number" id="inKA" value="${config.keepAliveFreq}">
<button class="btn" onclick="set('keepAliveFreq',Number(document.getElementById('inKA').value))">Set</button></td></tr>
<tr><td>Min Pre-Auth (cents)</td><td>${config.minimumAmountPreAuth} = €${(config.minimumAmountPreAuth/100).toFixed(2)}</td>
<td><input class="n" type="number" id="inPA" value="${config.minimumAmountPreAuth}">
<button class="btn" onclick="set('minimumAmountPreAuth',Number(document.getElementById('inPA').value))">Set</button></td></tr>
<tr><td>Default Amount (cents)</td><td>${config.defaultAmount} = €${(config.defaultAmount/100).toFixed(2)}</td>
<td><input class="n" type="number" id="inDA" value="${config.defaultAmount}">
<button class="btn" onclick="set('defaultAmount',Number(document.getElementById('inDA').value))">Set</button></td></tr>
<tr><td>Phone For Help</td><td>${config.phoneForHelp}</td>
<td><input class="m" id="inPH" value="${config.phoneForHelp}">
<button class="btn" onclick="sv('phoneForHelp','inPH')">Save</button></td></tr>
<tr><td>Display Msg Entrance</td><td style="font-size:11px">${config.displayMessageEntrance}</td>
<td><input class="w" id="inDME" value="${config.displayMessageEntrance}">
<button class="btn" onclick="sv('displayMessageEntrance','inDME')">Save</button></td></tr>
<tr><td>Display Msg Exit</td><td style="font-size:11px">${config.displayMessageExit}</td>
<td><input class="w" id="inDMX" value="${config.displayMessageExit}">
<button class="btn" onclick="sv('displayMessageExit','inDMX')">Save</button></td></tr>
</table>

<h3 style="color:#8b949e;margin-top:16px">Charges (parkingInit)</h3>
<table>
<tr><th>From (min)</th><th>To (min)</th><th>Fee (cents)</th><th>= Euro</th><th></th></tr>
${config.charges.map((c,i)=>`<tr>
<td>${c.from}</td><td>${c.to||'∞'}</td><td>${c.fee}</td><td>€${(parseInt(c.fee)/100).toFixed(2)}</td>
<td><button class="btn red" onclick="removeCharge(${i})">Remove</button></td>
</tr>`).join('')}
</table>
<div style="display:flex;gap:6px;align-items:center;margin-top:8px;flex-wrap:wrap">
  <input class="n" type="number" id="chFrom" placeholder="from">
  <input class="n" type="number" id="chTo" placeholder="to (blank=∞)">
  <input class="n" type="number" id="chFee" placeholder="fee">
  <button class="btn green" onclick="addCharge()">+ Add Charge</button>
</div>

<h2>&#x1F6A7; TELL Gate Control PRO</h2>
<div class="tell-box">
<h3>Mode — currently: <span class="${config.tellEnabled?'active':'inactive'}">${config.tellEnabled?'🟢 REAL TELL API ACTIVE':'⚫ MOCK (TELL disabled)'}</span></h3>
<button class="btn green" onclick="set('tellEnabled',true)">&#x1F7E2; Enable Real TELL API</button>
<button class="btn gray" onclick="set('tellEnabled',false)">⚫ Use Mock</button>
<p style="color:#8b949e;font-size:11px;margin:6px 0 0">When enabled: vehiclePresent reads real IN1/IN2; barrier opens on entranceCall/exitCall(free,capture)/exitPayment.</p>

<h3>Device Settings</h3>
<table>
<tr><th>Parameter</th><th>Value / Input</th><th></th></tr>
<tr><td>Hardware ID (MAC)</td>
<td><input class="w" id="hwId" placeholder="11:22:33:44:55:D1" value="${config.tellHwId}"></td>
<td><button class="btn" onclick="sv('tellHwId','hwId')">Save</button></td></tr>
<tr><td>Device Name (hwName)</td>
<td><input class="m" id="hwName" value="${config.tellHwName}"></td>
<td><button class="btn" onclick="sv('tellHwName','hwName')">Save</button></td></tr>
<tr><td>App ID (40 chars)</td>
<td><input class="w" id="appId" placeholder="from gc/addappid" value="${config.tellAppId}"></td>
<td><button class="btn" onclick="sv('tellAppId','appId')">Save</button></td></tr>
<tr><td>API Key</td>
<td><input class="w" id="apiKey" value="${config.tellApiKey}"></td>
<td><button class="btn" onclick="sv('tellApiKey','apiKey')">Save</button></td></tr>
</table>

<h3>I/O Mapping</h3>
<table>
<tr><th>Function</th><th>Setting</th></tr>
<tr><td>Vehicle detection input</td>
<td><select onchange="set('tellVehicleInput',this.value)">
<option value="in1" ${config.tellVehicleInput==='in1'?'selected':''}>IN1 — dry contact (loop/photocell)</option>
<option value="in2" ${config.tellVehicleInput==='in2'?'selected':''}>IN2 — dry contact (loop/photocell)</option>
</select></td></tr>
<tr><td>Barrier output</td>
<td><select onchange="set('tellBarrierOutput',Number(this.value))">
<option value="1" ${config.tellBarrierOutput===1?'selected':''}>OUT1</option>
<option value="2" ${config.tellBarrierOutput===2?'selected':''}>OUT2</option>
</select></td></tr>
</table>

<h3>Manual Test</h3>
<button class="btn yellow" onclick="testConn()">&#128268; Test Connection &amp; Read Inputs</button>
&nbsp;
<button class="btn orange" onclick="openNow()">&#x1F6AA; Open Barrier NOW</button>
<div id="ts"></div>
</div>

<h2>&#x1F9FE; Active Entries (${Object.keys(activeEntries).length})</h2>
<table><tr><th>Token</th><th>Last4</th><th>Auth</th><th>Time</th></tr>
${Object.values(activeEntries).map(e=>`<tr>
<td>${(e.token||"").slice(0,24)}...</td><td>${e.lastDigits||""}</td>
<td>${e.authCode||""}</td><td>${e.timeOfInput||""}</td>
</tr>`).join("")||'<tr><td colspan="4" style="color:#8b949e">No active entries</td></tr>'}
</table>
<button class="btn red" onclick="clearE()">Clear All Entries</button>

<h2>&#x1F4CB; Request Log</h2>
<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap">
  <span style="color:#8b949e;font-size:12px">Filter:</span>
  <button class="btn gray" onclick="setFilter('')">All</button>
  <button class="btn" style="background:#1f6feb" onclick="setFilter('parkingInit')">Init</button>
  <button class="btn green" onclick="setFilter('entranceCall')">Entrance</button>
  <button class="btn orange" onclick="setFilter('exitCall')">Exit</button>
  <button class="btn" style="background:#6e40c9" onclick="setFilter('exitPayment')">Payment</button>
  <button class="btn yellow" onclick="setFilter('vehiclePresent')">Vehicle</button>
  <button class="btn gray" onclick="setFilter('help')">Help</button>
  <button class="btn" style="background:#b08800" onclick="setFilter('TELL')">TELL</button>
  <span style="margin-left:auto;display:flex;gap:6px">
    <button class="btn green" onclick="exportLogs()">&#x1F4BE; Export .txt</button>
    <button class="btn red" onclick="clearLogs()">&#x1F5D1; Clear</button>
  </span>
</div>
<div id="logCount" style="color:#8b949e;font-size:11px;margin-bottom:8px"></div>
<div id="logDiv"><p style="color:#8b949e">Loading...</p></div>

<script>
let allLogs=[];
let activeFilter='';

function setFilter(f){activeFilter=f;renderLogs();}

function epColor(ep){
  if(ep.includes('parkingInit'))    return '#1f6feb';
  if(ep.includes('entranceCall'))   return '#238636';
  if(ep.includes('exitPayment'))    return '#6e40c9';
  if(ep.includes('exitCall'))       return '#e65100';
  if(ep.includes('vehiclePresent')) return '#9a7c00';
  if(ep.includes('help'))           return '#555';
  if(ep.includes('TELL'))           return '#b08800';
  return '#30363d';
}
function epBg(ep){
  if(ep.includes('parkingInit'))    return '#0d1a2e';
  if(ep.includes('entranceCall'))   return '#0d2010';
  if(ep.includes('exitPayment'))    return '#1a0d2e';
  if(ep.includes('exitCall'))       return '#2d1500';
  if(ep.includes('vehiclePresent')) return '#1c1800';
  if(ep.includes('help'))           return '#1a1a1a';
  if(ep.includes('TELL'))           return '#2a1e00';
  return '#161b22';
}
function rcColor(rc){
  if(!rc) return '#8b949e';
  if(rc==='00') return '#3fb950';
  return '#ff6b6b';
}
function modeTag(outlet){
  if(outlet==='${config.entranceOutlet}') return '<span class="tag tag-entrance">ENTRANCE</span>';
  if(outlet==='${config.exitOutlet}')     return '<span class="tag tag-exit">EXIT</span>';
  return '<span class="tag tag-unknown">UNKNOWN</span>';
}

function renderLogs(){
  const filtered=activeFilter
    ?allLogs.filter(l=>l.endpoint.toLowerCase().includes(activeFilter.toLowerCase()))
    :allLogs;
  document.getElementById('logCount').textContent=
    filtered.length+' of '+allLogs.length+' entries'+(activeFilter?' — filter: '+activeFilter:'');
  if(!filtered.length){
    document.getElementById('logDiv').innerHTML='<p style="color:#8b949e">No entries match filter</p>';
    return;
  }
  document.getElementById('logDiv').innerHTML=filtered.map(function(l){
    const rc=(l.response&&l.response.responseCode)||'';
    const isTell=l.endpoint.includes('TELL');
    const col=epColor(l.endpoint);
    const bg=epBg(l.endpoint);
    const reqJson=JSON.stringify(l.request,null,2);
    const resJson=JSON.stringify(l.response,null,2);
    return '<div style="background:'+bg+';border:1px solid '+col+';border-radius:6px;padding:10px;margin-bottom:10px">'+
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">'+
        '<span style="color:#8b949e;font-size:11px;min-width:130px">'+l.time+'</span>'+
        '<span style="color:'+col+';font-weight:bold;font-size:12px">'+(isTell?'🔌 ':'')+l.method+' '+l.endpoint+'</span>'+
        (l.request&&l.request.outlet?modeTag(l.request.outlet):'')+
        (rc?'<span style="margin-left:auto;color:'+rcColor(rc)+';font-size:12px;font-weight:bold">RC: '+rc+'</span>':'')+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+
        '<div>'+
          '<div style="color:#8b949e;font-size:10px;margin-bottom:2px">REQUEST</div>'+
          '<pre>'+reqJson+'</pre>'+
        '</div>'+
        '<div>'+
          '<div style="color:#3fb950;font-size:10px;margin-bottom:2px">RESPONSE</div>'+
          '<pre style="border-left:3px solid '+rcColor(rc)+'">'+resJson+'</pre>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('')||'<p style="color:#8b949e">No requests yet</p>';
}

async function loadLogs(){
  const r=await fetch('/logs');
  allLogs=await r.json();
  renderLogs();
}

async function clearLogs(){
  if(!confirm('Clear all logs?'))return;
  await fetch('/admin/clear-logs',{method:'POST'});
  allLogs=[];renderLogs();
}

function exportLogs(){
  const filtered=activeFilter
    ?allLogs.filter(l=>l.endpoint.toLowerCase().includes(activeFilter.toLowerCase()))
    :allLogs;
  const lines=filtered.map(l=>[
    '='.repeat(80),
    '['+l.time+'] '+l.method+' '+l.endpoint,
    '--- REQUEST ---',
    JSON.stringify(l.request,null,2),
    '--- RESPONSE ---',
    JSON.stringify(l.response,null,2)
  ].join('\\n')).join('\\n\\n');
  const blob=new Blob([lines],{type:'text/plain'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='parking-logs-'+new Date().toISOString().slice(0,19).replace(/[T:]/g,'-')+'.txt';
  a.click();
}

async function set(k,v){
  await fetch('/admin/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k,value:v})});
  location.reload();
}
async function sv(key,id){
  const v=document.getElementById(id).value.trim();
  await fetch('/admin/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,value:v})});
  showS('✓ Saved '+key,false);
}
async function clearE(){await fetch('/admin/clear-entries',{method:'POST'});location.reload();}
function showS(msg,err){
  const el=document.getElementById('ts');
  el.style.display='block';el.className=err?'err':'ok';el.textContent=msg;
}
async function testConn(){
  showS('Connecting to TELL API...',false);
  try{
    const r=await fetch('/admin/tell-test',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const d=await r.json();
    if(d.ok) showS('✓ OK  Model:'+d.model+'  FW:'+d.fw+'  IN1='+d.in1+'  IN2='+d.in2+'  OUT1='+d.out1+'  OUT2='+d.out2,false);
    else showS('✗ '+d.error,true);
  }catch(e){showS('✗ '+e.message,true);}
}
async function openNow(){
  showS('Sending open command...',false);
  try{
    const r=await fetch('/admin/tell-open',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const d=await r.json();
    if(d.ok) showS('✓ Barrier open command sent OK',false);
    else showS('✗ '+d.error,true);
  }catch(e){showS('✗ '+e.message,true);}
}

async function addCharge(){
  const from=document.getElementById('chFrom').value.trim();
  const to=document.getElementById('chTo').value.trim();
  const fee=document.getElementById('chFee').value.trim();
  if(!from||!fee){alert('From and Fee are required');return;}
  const r=await fetch('/admin/add-charge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from,to,fee})});
  const d=await r.json();
  if(d.ok) location.reload();
  else alert('Error: '+d.error);
}
async function removeCharge(i){
  const r=await fetch('/admin/remove-charge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({index:i})});
  const d=await r.json();
  if(d.ok) location.reload();
}

loadLogs();setInterval(loadLogs,3000);
</script></body></html>`);
});

// ── POST /parkingInit ─────────────────────────────────────────────────────────
app.post("/parkingInit", (req, res) => {
  if (config.responseCode !== "00") {
    const errMap = {"91":"Invalid Outlet Number","92":"Invalid Company Code","93":"Invalid Application","08":"Technical issue. Please wait for assistance."};
    const response = {responseCode:config.responseCode, responseDescription:errMap[config.responseCode]||"Error"};
    addLog(req, response); return res.json(response);
  }

  // Identify which POS is calling — determines mode returned
  const mode = detectMode(req.body);

  // Validate outlet — return 91 if unrecognised (both POS configured and neither matches)
  if (mode === "Unknown" && config.entranceOutlet && config.exitOutlet) {
    const response = {responseCode:"91", responseDescription:"Invalid Outlet Number"};
    addLog(req, response); return res.json(response);
  }

  const charges = config.showRates ? config.charges : [];

  const response = {
    outlet:                          req.body.outlet   || config.entranceOutlet,
    terminal:                        req.body.terminal || config.entranceTerminal,
    mode:                            mode === "Exit" ? "Exit" : "Entrance",
    companyCode:                     config.companyCode,
    keepAliveFreq:                   String(config.keepAliveFreq),
    minimumAmountPreAuth:            String(config.minimumAmountPreAuth),
    defaultAmount:                   String(config.defaultAmount),
    phoneForHelp:                    config.phoneForHelp,
    displayMessageOfEntrance:        config.displayMessageEntrance,
    displayMessageOnExit:            config.displayMessageExit,
    displayMessageOfAvailablePlaces: "There are {availablePlacesRegular} available places for Normal and {availablePlaceMonthly} for Monthly Customers.",
    availablePlacesNormal:           String(config.availablePlacesNormal),
    availablePlaceMonthly:           String(config.availablePlaceMonthly),
    monthlyCardsBins:                config.monthlyEnabled ? "434343;232323" : "",
    controller:                      config.tellEnabled ? "A" : "0",
    fixAmountSolution:               "-1",
    charges,
    responseCode:                    "00",
    responseDescription:             "Successful Response"
  };
  addLog(req, response); res.json(response);
});

// ── POST /entranceCall ────────────────────────────────────────────────────────
app.post("/entranceCall", async (req, res) => {
  const {token, lastDigits, authCode, timeOfInput} = req.body;
  if (token) {
    activeEntries[token] = {token, lastDigits, authCode, timeOfInput};
    config.availablePlacesNormal = Math.max(0, config.availablePlacesNormal - 1);
  }
  let barrier = "mock-ok";
  if (config.tellEnabled && config.tellHwId && config.tellAppId) {
    try { barrier = await tellOpenBarrier() ? "tell-ok" : "tell-failed"; }
    catch(e) { barrier = "tell-error: " + e.message; console.error("TELL entrance:", e.message); }
  }
  const response = {
    outlet:                 req.body.outlet   || config.entranceOutlet,
    terminal:               req.body.terminal || config.entranceTerminal,
    availablePlaceMonthly:  String(config.availablePlaceMonthly),
    availablePlacesRegular: String(config.availablePlacesNormal),
    installationPoint:      "Entrance",
    displayMessage:         "Welcome. Have a nice day!!",
    timeToDisplayMessage:   "5",
    responseCode:           "00",
    responseDescription:    "Successful Response",
    _barrier:               barrier
  };
  addLog(req, response); res.json(response);
});

// ── POST /exitCall ────────────────────────────────────────────────────────────
app.post("/exitCall", async (req, res) => {
  const {token} = req.body;
  let response;
  async function openReal() {
    if (config.tellEnabled && config.tellHwId && config.tellAppId) {
      try { return await tellOpenBarrier() ? "tell-ok" : "tell-failed"; }
      catch(e) { console.error("TELL exit:", e.message); return "tell-error: "+e.message; }
    }
    return "mock-ok";
  }
  switch(config.exitScenario) {
    case 1: {
      const b = await openReal();
      response = {barrierOpen:"1",moneyToPay:"0",
        displayMessage:"Thank you! Have a nice day.",timeToDisplayMessage:"5",
        responseCode:"00",responseDescription:"Successful Response",_barrier:b};
      if(token) delete activeEntries[token];
      config.availablePlacesNormal = Math.min(20, config.availablePlacesNormal+1); break;
    }
    case 2: {
      const b = await openReal();
      response = {barrierOpen:"1",moneyToPay:"200",
        displayMessage:"Thank you! Your card has been charged EUR 2.00.",timeToDisplayMessage:"5",
        responseCode:"00",responseDescription:"Successful Response",_barrier:b};
      if(token) delete activeEntries[token];
      config.availablePlacesNormal = Math.min(20, config.availablePlacesNormal+1); break;
    }
    case 3:
      response = {barrierOpen:"-2",moneyToPay:"356",recordId:"1234567890ABCDEF1234567890ABCDEF",
        displayMessage:"Charge is EUR 3.56. Please present your card.",timeToDisplayMessage:"10",
        responseCode:"31",responseDescription:"TopUp required"}; break;
    case 4: default:
      response = {barrierOpen:"0",moneyToPay:"0",
        displayMessage:"Technical issue. Please contact staff.",timeToDisplayMessage:"10",
        responseCode:"08",responseDescription:"Barrier failed to open"}; break;
  }
  addLog(req, response); res.json(response);
});

// ── POST /exitPayment ─────────────────────────────────────────────────────────
app.post("/exitPayment", async (req, res) => {
  const {token} = req.body;
  if(token) delete activeEntries[token];
  config.availablePlacesNormal = Math.min(20, config.availablePlacesNormal+1);
  let barrier = "mock-ok";
  if (config.tellEnabled && config.tellHwId && config.tellAppId) {
    try { barrier = await tellOpenBarrier() ? "tell-ok" : "tell-failed"; }
    catch(e) { barrier = "tell-error: "+e.message; }
  }
  const response = {barrierOpen:"1",displayMessage:"Payment successful. Barrier is open.",
    timeToDisplayMessage:"5",responseCode:"00",responseDescription:"Successful Response",_barrier:barrier};
  addLog(req, response); res.json(response);
});

// ── POST /vehiclePresent ──────────────────────────────────────────────────────
app.post("/vehiclePresent", async (req, res) => {
  let detected = config.vehiclePresent;
  if (config.tellEnabled && config.tellHwId && config.tellAppId) {
    try {
      detected = await tellCheckVehicle();
      console.log(`TELL ${config.tellVehicleInput} = ${detected}`);
    } catch(e) {
      console.error("TELL vehiclePresent:", e.message);
      const errRes = {responseCode:"99",responseDescription:"Controller error: "+e.message,vehiclePresent:"0"};
      addLog(req, errRes); return res.json(errRes);
    }
  }
  const mode = detectMode(req.body);
  const response = {
    outlet:               req.body.outlet   || config.entranceOutlet,
    terminal:             req.body.terminal || config.entranceTerminal,
    installationPoint:    mode,
    dayTime:              ts(),
    vehiclePresent:       detected ? "1" : "0",
    displayMessage:       detected ? "Vehicle detected. Please proceed." : "No vehicle detected.",
    timeToDisplayMessage: "3",
    availablePlaceMonthly: String(config.availablePlaceMonthly),
    availablePlacesNormal: String(config.availablePlacesNormal),
    responseCode:         "00",
    responseDescription:  "Successful Response"
  };
  addLog(req, response); res.json(response);
});

// ── POST /help ────────────────────────────────────────────────────────────────
app.post("/help", (req, res) => {
  const response = {responseCode:"00",responseDescription:"Successful Response"};
  addLog(req, response); res.json(response);
});

// ── START ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Parking RPS Mock running on http://0.0.0.0:${PORT}`);
});