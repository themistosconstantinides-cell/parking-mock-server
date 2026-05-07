const express = require("express");
const https   = require("https");
const app     = express();

app.use(express.json());

// ── Email alerts via Resend HTTP API ─────────────────────────────────────────
async function sendHelpAlert(req) {
  const apiKey = process.env.RESEND_KEY;
  const to     = config.alertEmail || process.env.ALERT_EMAIL;
  if (!apiKey) { console.log("[EMAIL] RESEND_KEY not set — skipping"); return; }
  if (!to)     { console.log("[EMAIL] No alert email configured — skipping"); return; }

  const outlet   = req.body.outlet           || "?";
  const terminal = req.body.terminal         || "?";
  const point    = req.body.intallationPoint || "?";
  const action   = req.body.action           || "Help Button";
  const company  = req.body.companyCode      || config.companyCode;
  const time     = new Date().toLocaleString("en-GB", { timeZone: "Europe/Nicosia" });

  console.log(`[EMAIL] Sending help alert to: ${to}`);

  const payload = JSON.stringify({
    from:    "ParkTec Alerts <onboarding@resend.dev>",
    to:      [to],
    subject: `ParkTec Help Alert - ${point} (${outlet})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px">
        <h2 style="color:#c0392b">Help Called at ${point}</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px;color:#666">Company</td><td style="padding:6px"><b>${company}</b></td></tr>
          <tr><td style="padding:6px;color:#666">Outlet</td><td style="padding:6px"><b>${outlet}</b></td></tr>
          <tr><td style="padding:6px;color:#666">Terminal</td><td style="padding:6px"><b>${terminal}</b></td></tr>
          <tr><td style="padding:6px;color:#666">Location</td><td style="padding:6px"><b>${point}</b></td></tr>
          <tr><td style="padding:6px;color:#666">Action</td><td style="padding:6px"><b>${action}</b></td></tr>
          <tr><td style="padding:6px;color:#666">Time</td><td style="padding:6px"><b>${time}</b></td></tr>
        </table>
        <p style="color:#888;font-size:12px;margin-top:16px">ParkTec Parking System</p>
      </div>
    `
  });

  return new Promise((resolve) => {
    const req2 = https.request({
      hostname: "api.resend.com",
      path:     "/emails",
      method:   "POST",
      headers:  {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`[EMAIL] Alert sent -> ${to}`);
          config.lastAlertSent = time;
        } else {
          console.error(`[EMAIL] Failed: HTTP ${res.statusCode} — ${data}`);
        }
        resolve();
      });
    });
    req2.on("error", e => {
      console.error("[EMAIL] Request error:", e.message);
      resolve();
    });
    req2.write(payload);
    req2.end();
  });
}
app.use(express.static("public"));

// ── State ─────────────────────────────────────────────────────────────────────
let logs          = [];
let activeEntries = {};
let rejectionLog  = [];
let ecrDeclineLog = [];

function addRejection(reason, cardType, cardId, code) {
  rejectionLog.unshift({ time: Date.now(), reason, cardType, cardId, code });
  if (rejectionLog.length > 50) rejectionLog.pop();
}

function addEcrDecline(outlet, terminal, point, action) {
  ecrDeclineLog.unshift({
    time:     Date.now(),
    outlet,
    terminal,
    point,
    action,
    ts:       new Date().toLocaleString("en-GB", { timeZone: "Europe/Nicosia" })
  });
  if (ecrDeclineLog.length > 100) ecrDeclineLog.pop();
}

let config = {
  entranceOutlet:   "0000259010",
  entranceTerminal: "000025901090",
  exitOutlet:       "0000259010",
  exitTerminal:     "000025901091",
  keepAliveFreq:          10,
  minimumAmountPreAuth:   300,
  defaultAmount:          800,
  fixAmountSolution:      -1,
  phoneForHelp:           "99123456",
  helpMessage:            "Help has been called. Staff will assist you shortly. For immediate assistance call: 99123456",
  helpDisplayTime:        "10",
  lastAlertSent:          null,
  alertEmail:             process.env.ALERT_EMAIL || "",
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
  monthlyCardsBins:      "123456;12345678910111213453",
  showRates:             true,
  responseCode:          "00",
  flagsForAction:        "0000",
  voiceAssistant:        true,
  defaultLanguage:       "EN",
  companyCode:           "MarinaParking",
  tellEnabled:       false,
  tellApiKey:        "f2nIrJ8DBf4Gc8ar99IQeCVVm3pnWrVP",
  tellPassword:      "1234",
  tellHwId:          "",
  tellHwName:        "ParkingBarrier",
  tellAppId:         "",
  tellVehicleInputEntrance: "in1",
  tellVehicleInputExit:     "in2",
  tellBarrierOutput: 1,
  jccBaseUrl:   "https://test-apis.jccsecure.com",
  jccUseMock:          true,
  parkingName:         "ParkTec",
  topupAmount:         500,
  captureRetryMins:    15,
  captureMaxRetries:   5,
};

let pendingCaptures = [];

function addPendingCapture(entry, amountCents) {
  const id = require("crypto").randomBytes(8).toString("hex").toUpperCase();
  pendingCaptures.unshift({
    id, entry, amountCents,
    createdAt:   new Date().toLocaleString("en-GB", { timeZone: "Europe/Nicosia" }),
    retries:     0,
    status:      "PENDING",
    lastAttempt: null,
    lastError:   null
  });
  console.log(`[PENDING_CAPTURE] Added ${id} — €${(amountCents/100).toFixed(2)} last4=${entry.lastDigits}`);
}

async function retrySingleCapture(pc) {
  pc.lastAttempt = new Date().toLocaleString("en-GB", { timeZone: "Europe/Nicosia" });
  pc.retries++;
  try {
    const r = await jccCapture(pc.entry, pc.amountCents);
    if (r && r.responseCode === "00") {
      pc.status = "RESOLVED";
      console.log(`[PENDING_CAPTURE] ${pc.id} RESOLVED on retry ${pc.retries}`);
    } else {
      pc.lastError = r ? `${r.responseCode} ${r.responseText}` : "No response";
      if (pc.retries >= config.captureMaxRetries) {
        pc.status = "FAILED";
      }
    }
  } catch(e) {
    pc.lastError = e.message;
  }
}

function startCaptureRetryLoop() {
  let lastRun = Date.now();
  setInterval(async () => {
    const intervalMs = (config.captureRetryMins || 15) * 60 * 1000;
    if (Date.now() - lastRun < intervalMs) return;
    lastRun = Date.now();
    const pending = pendingCaptures.filter(pc => pc.status === "PENDING");
    if (pending.length === 0) return;
    for (const pc of pending) await retrySingleCapture(pc);
  }, 60 * 1000);
}

function addLog(req, response) {
  logs.unshift({
    id:       Date.now(),
    time:     new Date().toLocaleString(),
    endpoint: req.originalUrl,
    method:   req.method,
    request:  req.body || {},
    response: response
  });
  if (logs.length > 500) logs.pop();
  console.log(`[${new Date().toLocaleString()}] ${req.method} ${req.originalUrl}`);
  console.log(`  REQ: ${JSON.stringify(req.body)}`);
  console.log(`  RES: ${JSON.stringify(response)}`);
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
}

function ts() {
  return new Date().toISOString().replace(/[-:T.Z]/g,"").slice(0,14);
}

function buildHmacHeader(method, fullUrl, body, endpointType) {
  const creds     = jccConfig[endpointType] || jccConfig.topup;
  const appId     = creds.appId;
  const apiKey    = creds.apiKey;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce     = crypto.randomBytes(16).toString("hex");
  const bodyStr   = JSON.stringify(body);
  const bodyHash  = crypto.createHash("sha256").update(bodyStr).digest("base64");
  const encodedUrl = encodeURIComponent(fullUrl).toLowerCase();
  const sigRaw    = appId + method.toUpperCase() + encodedUrl + timestamp + nonce + bodyHash;
  const keyBytes  = Buffer.from(apiKey, "base64");
  const signature = crypto.createHmac("sha256", keyBytes)
                          .update(Buffer.from(sigRaw, "utf8"))
                          .digest("base64");
  return `hmacauth ${appId}:${signature}:${nonce}:${timestamp}`;
}

function jccPost(path, body, endpointType) {
  return new Promise((resolve, reject) => {
    const baseUrl = config.jccUseMock
      ? "https://parking-mock-server.onrender.com"
      : config.jccBaseUrl;
    const fullUrl = baseUrl + path;
    const auth    = buildHmacHeader("POST", fullUrl, body, endpointType);
    const bodyStr = JSON.stringify(body);
    const isHttps = fullUrl.startsWith("https");
    const lib     = isHttps ? require("https") : require("http");
    const url     = new URL(fullUrl);
    const opts    = {
      hostname:           url.hostname,
      port:               url.port || (isHttps ? 443 : 80),
      path:               url.pathname,
      method:             "POST",
      rejectUnauthorized: false,
      headers:  {
        "Content-Type":  "application/json",
        "Authorization": auth,
        "Content-Length": Buffer.byteLength(bodyStr)
      }
    };
    const reqHttp = lib.request(opts, (r) => {
      let data = "";
      r.on("data", c => data += c);
      r.on("end", () => {
        if (!data || data.trim() === "" || data.trim() === "{}") {
          if (r.statusCode === 200) {
            resolve({ responseCode: "00", responseDescription: "Successful Response", _httpStatus: 200 });
          } else {
            resolve({ responseCode: String(r.statusCode), responseDescription: `HTTP ${r.statusCode} empty body` });
          }
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve({ responseCode: "parse-error", responseDescription: data.substring(0,100) }); }
      });
    });
    reqHttp.on("error", reject);
    reqHttp.write(bodyStr);
    reqHttp.end();
  });
}

function jccDateTime() {
  const now    = new Date();
  const offset = '+03:00';
  const pad    = n => String(n).padStart(2, '0');
  const cy = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return cy.getUTCFullYear() + '-' +
    pad(cy.getUTCMonth() + 1) + '-' +
    pad(cy.getUTCDate()) + 'T' +
    pad(cy.getUTCHours()) + ':' +
    pad(cy.getUTCMinutes()) + ':' +
    pad(cy.getUTCSeconds()) + offset;
}

async function jccTopup(entry, topupAmountCents) {
  const body = {
    amount:       topupAmountCents,
    currency:     "978",
    originalRef:  entry.originalRefNum || entry.receiptNumber,
    authID:       entry.authCode,
    messageNo:    entry.receiptNumber,
    messageType:  "topup",
    dateTime:     jccDateTime(),
    ippiVersion:  "2021-01-06",
    merchantNo:   entry.outlet,
    stationID:    config.parkingName,
    merchantType: "1",
    posSoftware:  "ParkTec",
    reasonCode:   "G",
    userID:       "ParkTec",
    invoiceNo:    entry.receiptNumber,
    tokenCode:    entry.tokenCode,
    cardType:     "02",
    maskedPAN:    "XXXXXXXXXXXX" + entry.lastDigits,
    cardExpiry:   entry.expiryDate || "0000"
  };
  addJccLog("topup", body, {}, true);
  const r = await jccPost("/financialservices/v1/ippi/auth/topup", body, "topup");
  addJccLog("topup-response", body, r, true);
  return r;
}

async function jccCapture(entry, captureAmountCents) {
  const body = {
    messageNo:       entry.receiptNumber,
    messageType:     "capture",
    amount:          String(captureAmountCents),
    surchargeAmount: "000",
    currency:        "978",
    originalRef:     entry.originalRefNum || entry.receiptNumber,
    authID:          entry.authCode,
    dateTime:        jccDateTime(),
    ippiVersion:     "2021-01-06",
    merchantNo:      entry.outlet,
    stationID:       config.parkingName,
    tokenCode:       entry.tokenCode,
    merchantType:    "1",
    posSoftware:     "ParkTec",
    reasonCode:      "E",
    userID:          "ParkTec",
    invoiceNo:       entry.receiptNumber,
    cardType:        "02",
    maskedPAN:       "XXXXXXXXXXXX" + entry.lastDigits,
    cardExpiry:      entry.expiryDate || "0000",
    citIndicator:    "1234************"
  };
  addJccLog("capture", body, {}, true);
  const r = await jccPost("/financialservices/v1/ippi/auth/capture", body, "capture");
  addJccLog("capture-response", body, r, true);
  return r;
}

async function jccRelease(entry) {
  const body = {
    messageNo:    entry.receiptNumber,
    messageType:  "release",
    amount:       String(entry.preAuthAmountCents || 300),
    originalRef:  entry.originalRefNum || entry.receiptNumber,
    authID:       entry.authCode,
    currency:     "978",
    dateTime:     jccDateTime(),
    ippiVersion:  "2021-01-06",
    tokenCode:    entry.tokenCode,
    merchantNo:   entry.outlet,
    stationID:    config.parkingName,
    merchantType: "1",
    posSoftware:  "ParkTec",
    reasonCode:   "G",
    userID:       "ParkTec",
    invoiceNo:    entry.receiptNumber,
    cardType:     "02",
    maskedPAN:    "XXXXXXXXXXXX" + entry.lastDigits,
    cardExpiry:   entry.expiryDate || "0000"
  };
  addJccLog("release", body, {}, true);
  const r = await jccPost("/financialservices/v1/ippi/auth/release", body, "release");
  addJccLog("release-response", body, r, true);
  return r;
}

function scenarioName(n) {
  return {1:"Free",2:"Capture Only",3:"TopUp Approved",4:"TopUp Declined",5:"Barrier Failed"}[n]||"?";
}

function detectMode(reqBody) {
  const outlet   = reqBody.outlet   || "";
  const terminal = reqBody.terminal || "";
  if (outlet === config.entranceOutlet && terminal === config.entranceTerminal) return "Entrance";
  if (outlet === config.exitOutlet     && terminal === config.exitTerminal)     return "Exit";
  return "Unknown";
}

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

async function tellCheckVehicle(vehicleInput) {
  const body = { hwId: config.tellHwId, hwName: config.tellHwName, appId: config.tellAppId };
  const result = await tellRequest("POST", "/gc/getgeneral", body);
  addTellLog("getgeneral", body, result, null);
  if (result.result !== "OK") throw new Error("TELL getgeneral: " + JSON.stringify(result));
  const status = result.statusResult && result.statusResult.deviceStatus;
  if (!status) throw new Error("No deviceStatus in TELL response");
  const input = vehicleInput || config.tellVehicleInputEntrance;
  const val = input === "in2" ? status.in2 : status.in1;
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
app.get("/admin/entries", (req, res) => res.json(Object.values(activeEntries)));
app.get("/admin/rejections", (req, res) => res.json(rejectionLog));
app.get("/admin/ecr-declines", (req, res) => res.json(ecrDeclineLog));
app.get("/admin/pending-captures", (req, res) => res.json(pendingCaptures));

app.post("/admin/retry-capture/:id", async (req, res) => {
  const pc = pendingCaptures.find(p => p.id === req.params.id);
  if (!pc) return res.json({ ok: false, error: "Not found" });
  if (pc.status === "RESOLVED") return res.json({ ok: false, error: "Already resolved" });
  pc.status = "PENDING";
  await retrySingleCapture(pc);
  res.json({ ok: true, status: pc.status, retries: pc.retries, lastError: pc.lastError });
});

app.delete("/admin/pending-captures/:id", (req, res) => {
  const idx = pendingCaptures.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.json({ ok: false, error: "Not found" });
  pendingCaptures.splice(idx, 1);
  res.json({ ok: true });
});

app.get("/admin/tell-status", async (req, res) => {
  if (!config.tellEnabled || !config.tellHwId || !config.tellAppId) {
    return res.json({ available: false, reason: "TELL not configured" });
  }
  try {
    const body = { hwId: config.tellHwId, hwName: config.tellHwName, appId: config.tellAppId };
    const result = await tellRequest("POST", "/gc/getgeneral", body);
    const status = result.statusResult && result.statusResult.deviceStatus;
    res.json({ available: true, status,
      lastIp: result.statusResult && result.statusResult.lastIp,
      pingMs: result.statusResult && result.statusResult.pingTimeMs });
  } catch(e) {
    res.json({ available: false, reason: e.message });
  }
});

app.post("/admin/config", (req, res) => {
  const {key, value} = req.body;
  if (!(key in config)) {
    return res.json({ok: false, error: `Unknown key: ${key}`});
  }
  const existing = config[key];
  if (typeof existing === "boolean") {
    config[key] = value === true || value === "true" || value === 1;
  } else if (typeof existing === "number") {
    const n = parseFloat(value);
    config[key] = isNaN(n) ? existing : n;
  } else {
    config[key] = value;
  }
  res.json({ok: true, config});
});

app.post("/admin/clear-entries", (req, res) => { activeEntries = {}; res.json({ok: true}); });
app.post("/admin/clear-logs",    (req, res) => { logs = []; res.json({ok: true}); });

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
  if (index >= 0 && index < config.charges.length) config.charges.splice(index, 1);
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
      res.json({ok:true, in1:s.in1, in2:s.in2, out1:s.out1, out2:s.out2});
    } else {
      res.json({ok:false, error:JSON.stringify(result)});
    }
  } catch(e) {
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

app.post("/admin/tell-register", async (req, res) => {
  if (!config.tellHwId)
    return res.json({ok:false, error:"hwId must be configured first"});
  try {
    const body = { hwId: config.tellHwId, hwName: config.tellHwName, password: config.tellPassword };
    const result = await tellRequest("POST", "/gc/addappid", body);
    if (result.result === "OK" && result.appId) {
      config.tellAppId = result.appId;
      res.json({ok:true, appId: result.appId});
    } else {
      res.json({ok:false, error: JSON.stringify(result)});
    }
  } catch(e) {
    res.json({ok:false, error:e.message});
  }
});

// ── EOD Capture ───────────────────────────────────────────────────────────────
app.post("/admin/eod-capture", async (req, res) => {
  const entries = Object.values(activeEntries);
  let processed = 0;
  const results = [];
  for (const entry of entries) {
    if (entry.inputType === "Monthly Card") continue;
    try {
      const amt = entry.preAuthAmountCents || config.minimumAmountPreAuth || 300;
      const r = await jccCapture(entry, amt);
      results.push({ last4: entry.lastDigits, rc: r.responseCode });
      processed++;
    } catch(e) {
      results.push({ last4: entry.lastDigits, error: e.message });
    }
  }
  res.json({ ok: true, processed, results: JSON.stringify(results) });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PARKING DASHBOARD  GET /
// ═══════════════════════════════════════════════════════════════════════════════
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
.entrance-box{border-color:#1f6feb}.exit-box{border-color:#e65100}
.tab-nav{display:flex;gap:4px;margin-bottom:24px;border-bottom:2px solid #21262d;padding-bottom:0}
.tab-btn{background:none;border:none;color:#8b949e;padding:10px 20px;cursor:pointer;font-size:14px;border-bottom:2px solid transparent;margin-bottom:-2px}
.tab-btn.active{color:#1f6feb;border-bottom-color:#1f6feb;font-weight:bold}
.tab-content{display:none}.tab-content.active{display:block}
#ts{margin-top:8px;padding:8px;border-radius:4px;font-size:12px;display:none}
.ok{background:#0d2818;color:#3fb950;border:1px solid #238636}
.err{background:#2d0a0a;color:#ff6b6b;border:1px solid #c62828}
</style></head><body>
<h1>&#x1F17F; Parking RPS Mock Server</h1>

<div class="tab-nav">
  <button class="tab-btn active" onclick="showTab('parking',this)">&#x1F697; Parking</button>
  <button class="tab-btn" onclick="showTab('rental',this)">&#x1F6B2; Rental</button>
</div>

<div id="tab-parking" class="tab-content active">
<p style="color:#8b949e">All changes take effect immediately.</p>

<h2>&#x1F4F1; POS Device Configuration</h2>
<div class="pos-box entrance-box">
<h3>🔵 Entrance POS</h3>
<table>
<tr><th style="width:160px">Parameter</th><th>Value</th><th style="width:80px"></th></tr>
<tr><td>Outlet Number</td>
  <td><input class="t" id="enOutlet" value="${config.entranceOutlet}" maxlength="10"></td>
  <td><button class="btn" onclick="sv('entranceOutlet','enOutlet')">Save</button></td></tr>
<tr><td>Terminal ID</td>
  <td><input class="t" id="enTerminal" value="${config.entranceTerminal}" maxlength="12"></td>
  <td><button class="btn" onclick="sv('entranceTerminal','enTerminal')">Save</button></td></tr>
</table></div>

<div class="pos-box exit-box">
<h3>🟠 Exit POS</h3>
<table>
<tr><th style="width:160px">Parameter</th><th>Value</th><th style="width:80px"></th></tr>
<tr><td>Outlet Number</td>
  <td><input class="t" id="exOutlet" value="${config.exitOutlet}" maxlength="10"></td>
  <td><button class="btn" onclick="sv('exitOutlet','exOutlet')">Save</button></td></tr>
<tr><td>Terminal ID</td>
  <td><input class="t" id="exTerminal" value="${config.exitTerminal}" maxlength="12"></td>
  <td><button class="btn" onclick="sv('exitTerminal','exTerminal')">Save</button></td></tr>
</table></div>

<h2>&#9881; Configuration</h2>
<table>
<tr><th>Setting</th><th>Value</th><th>Actions</th></tr>
<tr><td>Exit Scenario</td><td>${config.exitScenario} - ${sn}</td>
<td><button class="btn green" onclick="set('exitScenario',1)">1 Free</button>
<button class="btn" onclick="set('exitScenario',2)">2 Capture</button>
<button class="btn orange" onclick="set('exitScenario',3)">3 TopUp OK</button>
<button class="btn red" onclick="set('exitScenario',4)">4 TopUp Declined</button>
<button class="btn red" onclick="set('exitScenario',5)">5 Barrier Fail</button></td></tr>
<tr><td>Vehicle Present</td><td>${config.vehiclePresent}</td>
<td><button class="btn green" onclick="set('vehiclePresent',true)">YES</button>
<button class="btn red" onclick="set('vehiclePresent',false)">NO</button></td></tr>
<tr><td>Normal Spaces</td><td>${config.availablePlacesNormal}</td>
<td><input class="n" type="number" id="inN" value="${config.availablePlacesNormal}">
<button class="btn" onclick="set('availablePlacesNormal',Number(document.getElementById('inN').value))">Set</button></td></tr>
<tr><td>Force Init Error</td><td>${config.responseCode}</td>
<td><button class="btn green" onclick="set('responseCode','00')">00 OK</button>
<button class="btn red" onclick="set('responseCode','91')">91 Outlet</button>
<button class="btn red" onclick="set('responseCode','08')">08 Technical</button></td></tr>
</table>

<h2>&#x1F9FE; Active Entries <span id="activeEntriesCount"></span></h2>
<div id="activeEntriesDiv"><table><tr><td style="color:#8b949e">Loading...</td></tr></table></div>
<button class="btn red" onclick="clearE()">Clear All Entries</button>

<h2>&#x1F4CB; Request Log</h2>
<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap">
  <button class="btn gray" onclick="setFilter('')">All</button>
  <button class="btn" style="background:#1f6feb" onclick="setFilter('parkingInit')">Init</button>
  <button class="btn green" onclick="setFilter('entranceCall')">Entrance</button>
  <button class="btn orange" onclick="setFilter('exitCall')">Exit</button>
  <button class="btn" style="background:#6e40c9" onclick="setFilter('exitPayment')">Payment</button>
  <button class="btn yellow" onclick="setFilter('vehiclePresent')">Vehicle</button>
  <span style="margin-left:auto">
    <button class="btn green" onclick="exportLogs()">Export</button>
    <button class="btn red" onclick="clearLogs()">Clear</button>
  </span>
</div>
<div id="logDiv"><p style="color:#8b949e">Loading...</p></div>
</div>

<!-- ═══ RENTAL TAB ═══ -->
<div id="tab-rental" class="tab-content">
<p style="color:#8b949e">Rental RPS — separate from parking. All changes take effect immediately.</p>

<h2>&#x1F4F1; Rental Terminal Configuration</h2>
<div class="pos-box" style="border-color:#1D9E75">
<h3>🟢 Rental POS</h3>
<table>
<tr><th style="width:160px">Parameter</th><th>Value</th><th style="width:80px"></th></tr>
<tr><td>Outlet Number</td>
  <td><input class="t" id="rentalOutlet" value="" maxlength="10" placeholder="10 digits"></td>
  <td><button class="btn" onclick="saveRentalCfg('rentalOutlet','rentalOutlet')">Save</button></td></tr>
<tr><td>Terminal ID</td>
  <td><input class="t" id="rentalTerminal" value="" maxlength="12" placeholder="12 digits"></td>
  <td><button class="btn" onclick="saveRentalCfg('rentalTerminal','rentalTerminal')">Save</button></td></tr>
<tr><td>Station ID</td>
  <td><input class="t" id="rentalStationId" value="" placeholder="e.g. LIM-001"></td>
  <td><button class="btn" onclick="saveRentalCfg('rentalStationId','rentalStationId')">Save</button></td></tr>
<tr><td>Station Name</td>
  <td><input class="m" id="rentalStationName" value="" placeholder="e.g. Limassol Marina"></td>
  <td><button class="btn" onclick="saveRentalCfg('rentalStationName','rentalStationName')">Save</button></td></tr>
</table></div>

<h2>&#9881; Rental Tariff (RPS calculates)</h2>
<table>
<tr><th>Up to (min)</th><th>Rate</th><th>Action</th></tr>
<tr><td>60</td><td>€3.00</td><td><span style="color:#8b949e">fixed for demo</span></td></tr>
<tr><td>120</td><td>€4.50</td><td></td></tr>
<tr><td>180</td><td>€6.00</td><td></td></tr>
<tr><td>∞</td><td>€6.00 + €1.50/hr</td><td></td></tr>
</table>

<h2>&#x1F6B2; Active Rentals <span id="rentalCount"></span></h2>
<div id="rentalsDiv"><table><tr><td style="color:#8b949e">Loading...</td></tr></table></div>

<h2>&#x1F4CB; Rental Request Log</h2>
<div style="display:flex;gap:6px;margin-bottom:10px">
  <button class="btn green" onclick="setRentalFilter('rental/start')">Start</button>
  <button class="btn orange" onclick="setRentalFilter('rental/exit')">Exit</button>
  <button class="btn gray" onclick="setRentalFilter('')">All</button>
  <button class="btn red" style="margin-left:auto" onclick="clearRentalLogs()">Clear</button>
</div>
<div id="rentalLogDiv"><p style="color:#8b949e">Loading...</p></div>
</div>

<script>
// ── Tab switching ──────────────────────────────────────────────────────────
function showTab(name, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  btn.classList.add('active');
}

// ── Parking tab JS ─────────────────────────────────────────────────────────
let allLogs=[], activeFilter='';
function setFilter(f){activeFilter=f;renderLogs();}
function renderLogs(){
  const filtered=activeFilter?allLogs.filter(l=>l.endpoint.toLowerCase().includes(activeFilter.toLowerCase())):allLogs;
  if(!filtered.length){document.getElementById('logDiv').innerHTML='<p style="color:#8b949e">No entries match filter</p>';return;}
  document.getElementById('logDiv').innerHTML=filtered.map(function(l){
    const rc=(l.response&&l.response.responseCode)||'';
    const rcCol=rc==='00'?'#3fb950':rc?'#ff6b6b':'#8b949e';
    return '<div style="background:#161b22;border:1px solid #21262d;border-radius:6px;padding:10px;margin-bottom:8px">'+
      '<div style="display:flex;gap:8px;margin-bottom:6px">'+
        '<span style="color:#8b949e;font-size:11px">'+l.time+'</span>'+
        '<span style="color:#58a6ff;font-weight:bold;font-size:12px">'+l.method+' '+l.endpoint+'</span>'+
        (rc?'<span style="margin-left:auto;color:'+rcCol+';font-size:12px">RC: '+rc+'</span>':'')+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+
        '<div><div style="color:#8b949e;font-size:10px">REQUEST</div><pre>'+JSON.stringify(l.request,null,2)+'</pre></div>'+
        '<div><div style="color:#3fb950;font-size:10px">RESPONSE</div><pre>'+JSON.stringify(l.response,null,2)+'</pre></div>'+
      '</div></div>';
  }).join('');
}
async function loadLogs(){const r=await fetch('/logs');allLogs=await r.json();renderLogs();}
async function clearLogs(){if(!confirm('Clear?'))return;await fetch('/admin/clear-logs',{method:'POST'});allLogs=[];renderLogs();}
function exportLogs(){
  const lines=allLogs.map(l=>'['+l.time+'] '+l.method+' '+l.endpoint+'\n'+JSON.stringify(l.request)+'\n'+JSON.stringify(l.response)).join('\n\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([lines],{type:'text/plain'}));
  a.download='parking-logs.txt';a.click();
}
async function set(k,v){await fetch('/admin/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k,value:v})});location.reload();}
async function sv(key,id){
  const v=document.getElementById(id).value.trim();
  const r=await fetch('/admin/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,value:v})});
  const d=await r.json();
  if(d.ok) location.reload(); else alert('Error: '+d.error);
}
async function clearE(){await fetch('/admin/clear-entries',{method:'POST'});location.reload();}
async function loadActiveEntries(){
  try{
    const r=await fetch('/admin/entries');const entries=await r.json();
    const el=document.getElementById('activeEntriesDiv');const cnt=document.getElementById('activeEntriesCount');
    if(!el)return;cnt.textContent='('+entries.length+')';
    if(!entries.length){el.innerHTML='<table><tr><td style="color:#8b949e">No active entries</td></tr></table>';return;}
    const now=Date.now();
    el.innerHTML='<table><tr><th>Type</th><th>Last4</th><th>Auth</th><th>Entry Time</th><th>Duration</th></tr>'+
      entries.map(function(e){
        const mins=Math.floor((now-(e.entryTime||now))/60000);
        return '<tr style="background:#0a1628"><td style="color:#58a6ff">'+(e.inputType||'Bank Card')+'</td>'+
          '<td>*'+(e.lastDigits||'')+'</td><td style="font-family:monospace;font-size:11px">'+(e.authCode||'')+'</td>'+
          '<td>'+(e.timeOfInput||'').substring(8,14)+'</td><td>'+mins+'m</td></tr>';
      }).join('')+'</table>';
  }catch(e){}
}

// ── Rental tab JS ────────────────────────────────────────────────────────────
let rentalFilter='', rentalLogs=[];
function setRentalFilter(f){rentalFilter=f;renderRentalLogs();}
function renderRentalLogs(){
  const filtered=rentalFilter?rentalLogs.filter(l=>l.endpoint.includes(rentalFilter)):rentalLogs;
  if(!filtered.length){document.getElementById('rentalLogDiv').innerHTML='<p style="color:#8b949e">No rental requests yet</p>';return;}
  document.getElementById('rentalLogDiv').innerHTML=filtered.map(function(l){
    const rc=(l.response&&l.response.responseCode)||'';
    const rcCol=rc==='00'?'#3fb950':rc?'#ff6b6b':'#8b949e';
    const isExit=l.endpoint.includes('exit');
    const borderCol=isExit?'#e65100':'#1D9E75';
    return '<div style="background:#161b22;border-left:3px solid '+borderCol+';border-radius:4px;padding:10px;margin-bottom:8px">'+
      '<div style="display:flex;gap:8px;margin-bottom:6px">'+
        '<span style="color:#8b949e;font-size:11px">'+l.time+'</span>'+
        '<span style="color:'+borderCol+';font-weight:bold;font-size:12px">'+l.method+' '+l.endpoint+'</span>'+
        (rc?'<span style="margin-left:auto;color:'+rcCol+';font-size:12px">RC: '+rc+'</span>':'')+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+
        '<div><div style="color:#8b949e;font-size:10px">REQUEST</div><pre>'+JSON.stringify(l.request,null,2)+'</pre></div>'+
        '<div><div style="color:#3fb950;font-size:10px">RESPONSE</div><pre>'+JSON.stringify(l.response,null,2)+'</pre></div>'+
      '</div></div>';
  }).join('');
}
async function loadRentalLogs(){
  try{const r=await fetch('/rental/logs');rentalLogs=await r.json();renderRentalLogs();}catch(e){}
}
async function clearRentalLogs(){
  await fetch('/rental/logs',{method:'DELETE'});rentalLogs=[];renderRentalLogs();
}
async function saveRentalCfg(key, id){
  const v=document.getElementById(id).value.trim();
  const r=await fetch('/rental/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,value:v})});
  const d=await r.json();
  if(d.ok) alert('Saved: '+key+' = '+v); else alert('Error: '+d.error);
}
async function loadRentals(){
  try{
    const r=await fetch('/rental/rentals');const items=await r.json();
    const el=document.getElementById('rentalsDiv');const cnt=document.getElementById('rentalCount');
    if(!el)return;cnt.textContent='('+items.length+')';
    if(!items.length){el.innerHTML='<table><tr><td style="color:#8b949e">No active rentals</td></tr></table>';return;}
    const now=Date.now();
    el.innerHTML='<table><tr><th>Rental ID</th><th>Item</th><th>Last4</th><th>Start</th><th>Duration</th><th>Auth</th></tr>'+
      items.map(function(r){
        const mins=Math.floor((now-r.startTime)/60000);
        return '<tr style="background:#0a1a0a">'+
          '<td style="font-family:monospace;font-size:11px;color:#1D9E75">'+r.rentalId+'</td>'+
          '<td style="color:#FAC775">Item #'+r.bikeId+'</td>'+
          '<td>****'+r.last4+'</td>'+
          '<td style="font-size:11px">'+new Date(r.startTime).toLocaleTimeString()+'</td>'+
          '<td style="color:#3fb950">'+mins+'m</td>'+
          '<td style="font-family:monospace;font-size:11px">'+r.authCode+'</td>'+
          '</tr>';
      }).join('')+'</table>';
  }catch(e){}
}
async function loadRentalConfig(){
  try{
    const r=await fetch('/rental/config');const d=await r.json();
    if(d.rentalOutlet)    document.getElementById('rentalOutlet').value=d.rentalOutlet;
    if(d.rentalTerminal)  document.getElementById('rentalTerminal').value=d.rentalTerminal;
    if(d.rentalStationId) document.getElementById('rentalStationId').value=d.rentalStationId;
    if(d.rentalStationName) document.getElementById('rentalStationName').value=d.rentalStationName;
  }catch(e){}
}

loadLogs();setInterval(loadLogs,3000);
loadActiveEntries();setInterval(loadActiveEntries,5000);
loadRentalLogs();setInterval(loadRentalLogs,3000);
loadRentals();setInterval(loadRentals,5000);
loadRentalConfig();
</script></body></html>`);
});

// ── Parking endpoints (unchanged) ─────────────────────────────────────────────
app.post("/parkingInit", (req, res) => {
  const versionName   = req.body.versionName   || "";
  const versionNumber = req.body.versionNumber || "";
  if (versionName) {
    config.lastAppVersionName   = versionName;
    config.lastAppVersionNumber = versionNumber;
  }
  if (config.responseCode !== "00") {
    const errMap = {"91":"Invalid Outlet Number","92":"Invalid Company Code","93":"Invalid Application","08":"Technical issue. Please wait for assistance."};
    const response = {responseCode:config.responseCode, responseDescription:errMap[config.responseCode]||"Error"};
    addLog(req, response); return res.json(response);
  }
  const mode = detectMode(req.body);
  if (mode === "Unknown" && config.entranceOutlet && config.exitOutlet) {
    const response = {responseCode:"91", responseDescription:"Invalid Outlet Number"};
    addLog(req, response); return res.json(response);
  }
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
    displayMessageOfAvailablePlaces: "There are {availablePlacesRegular} available places.",
    availablePlacesNormal:           String(config.availablePlacesNormal),
    availablePlaceMonthly:           String(config.availablePlaceMonthly),
    monthlyCardsBins:                config.monthlyEnabled ? config.monthlyCardsBins : "",
    controller:                      config.tellEnabled ? "A" : "0",
    fixAmountSolution:               String(config.fixAmountSolution),
    charges:                         config.charges,
    ...(config.tellEnabled && config.tellHwId ? {
      tellApiUrl:        "https://api.tell.hu/gc",
      tellHwId:          config.tellHwId,
      tellApiKey:        config.tellApiKey,
      tellAppId:         config.tellAppId,
      tellPassword:      config.tellPassword,
      tellVehicleInput:  mode === "Exit" ? config.tellVehicleInputExit : config.tellVehicleInputEntrance
    } : {}),
    responseCode:                    "00",
    responseDescription:             "Successful Response",
    timeOfServer:                    ts(),
    flagsForAction:                  config.flagsForAction,
    voiceAssistant:                  config.voiceAssistant ? "1" : "0",
    defaultLanguage:                 config.defaultLanguage
  };
  if (config.flagsForAction !== "0000") config.flagsForAction = "0000";
  addLog(req, response); res.json(response);
});

app.post("/entranceCall", async (req, res) => {
  const { token, lastDigits, authCode, timeOfInput, tokenCode,
          receiptNumber, referenceNo, preAuthAmount, expiryDate,
          outlet, terminal, inputType } = req.body;

  if (inputType === "Monthly Card" && config.monthlyEnabled && config.monthlyCardsBins) {
    const allowedCards = config.monthlyCardsBins.split(";").map(c => c.trim()).filter(Boolean);
    const cardNumber = req.body.lastDigits || "";
    if (allowedCards.length > 0 && !allowedCards.includes(cardNumber)) {
      const response = { outlet: outlet || config.entranceOutlet, terminal: terminal || config.entranceTerminal,
        installationPoint: "Entrance", displayMessage: "Monthly card not recognised. Please contact staff.",
        timeToDisplayMessage: "8", responseCode: "56", responseDescription: "Monthly card not in allowed list" };
      addRejection("Not in allowed list", "Monthly Card", cardNumber, "56");
      addLog(req, response); return res.json(response);
    }
  }

  if (token && activeEntries[token] && inputType === "Monthly Card") {
    const existing = activeEntries[token];
    const entryTime = new Date(existing.entryTime).toISOString().substring(11,19);
    const response = { outlet: outlet || config.entranceOutlet, terminal: terminal || config.entranceTerminal,
      installationPoint: "Entrance", displayMessage: `This card is already inside since ${entryTime}. Please exit first.`,
      timeToDisplayMessage: "8", responseCode: "41", responseDescription: "Card already inside" };
    addRejection("Already inside since "+entryTime, "Monthly Card", existing.lastDigits, "41");
    addLog(req, response); return res.json(response);
  }

  if (inputType === "Bank Card") {
    const { lastDigits: ld, expiryDate: exp } = req.body;
    const duplicate = Object.values(activeEntries).find(e => e.lastDigits === ld && e.expiryDate === exp && e.inputType === "Bank Card");
    if (duplicate) {
      const entryTime = new Date(duplicate.entryTime).toISOString().substring(11,19);
      try {
        const releaseEntry = { tokenCode, authCode, receiptNumber, originalRefNum: referenceNo || receiptNumber,
          preAuthAmountCents: parseInt(preAuthAmount || config.minimumAmountPreAuth || 300), outlet, terminal, lastDigits: ld, expiryDate: exp };
        await jccRelease(releaseEntry);
      } catch(e) { console.error("[entranceCall] jccRelease failed:", e.message); }
      const response = { outlet: outlet || config.entranceOutlet, terminal: terminal || config.entranceTerminal,
        installationPoint: "Entrance", displayMessage: `This card is already inside since ${entryTime}. Please exit first.`,
        timeToDisplayMessage: "8", responseCode: "41", responseDescription: "Card already inside" };
      addRejection("Already inside since "+entryTime, "Bank Card", "*"+ld, "41");
      addLog(req, response); return res.json(response);
    }
  }

  if (token) {
    activeEntries[token] = {
      token, lastDigits, authCode, timeOfInput,
      tokenCode: tokenCode || token, receiptNumber: receiptNumber || "",
      originalRefNum: referenceNo || receiptNumber || "",
      preAuthAmountCents: parseInt(preAuthAmount || config.minimumAmountPreAuth || 300),
      expiryDate: expiryDate || "0000", outlet: outlet || config.entranceOutlet,
      terminal: terminal || config.entranceTerminal, inputType: inputType || "Bank Card", entryTime: Date.now()
    };
    if (inputType === "Monthly Card") config.availablePlaceMonthly = Math.max(0, config.availablePlaceMonthly - 1);
    else config.availablePlacesNormal = Math.max(0, config.availablePlacesNormal - 1);
  }

  let barrier = "mock-ok";
  if (config.tellEnabled && config.tellHwId && config.tellAppId) {
    try { barrier = await tellOpenBarrier() ? "tell-ok" : "tell-failed"; }
    catch(e) { barrier = "tell-error: " + e.message; }
  }

  const response = {
    outlet: req.body.outlet || config.entranceOutlet, terminal: req.body.terminal || config.entranceTerminal,
    availablePlaceMonthly: String(config.availablePlaceMonthly), availablePlacesRegular: String(config.availablePlacesNormal),
    installationPoint: "Entrance", displayMessage: "Welcome. Have a nice day!!",
    timeToDisplayMessage: "5", responseCode: "00", responseDescription: "Successful Response", _barrier: barrier
  };
  addLog(req, response); res.json(response);
});

function releaseSpace(entry) {
  if (entry && entry.inputType === "Monthly Card") config.availablePlaceMonthly = Math.min(config.availablePlaceMonthly + 1, 99);
  else config.availablePlacesNormal = Math.min(config.availablePlacesNormal + 1, 99);
}

async function openBarrierWithRetry(maxRetries = 3, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (config.tellEnabled && config.tellHwId && config.tellAppId) {
        const ok = await tellOpenBarrier();
        if (ok) return "tell-ok";
      } else { return "mock-ok"; }
    } catch(e) { console.error(`[BARRIER] Attempt ${attempt} error: ${e.message}`); }
    if (attempt < maxRetries) await new Promise(r => setTimeout(r, delayMs));
  }
  return "failed";
}

function calculateFee(entryTime) {
  if (!entryTime) return config.minimumAmountPreAuth || 300;
  const mins = Math.floor((Date.now() - entryTime) / 60000);
  const charges = config.charges || [];
  for (const c of charges) {
    const from = parseInt(c.from);
    const to   = c.to ? parseInt(c.to) : Infinity;
    if (mins >= from && mins < to) return parseInt(c.fee);
  }
  return 0;
}

app.post("/exitCall", async (req, res) => {
  const { token } = req.body;
  const entry = token ? activeEntries[token] : null;
  const inputType = req.body.inputType || (entry && entry.inputType) || "Bank Card";

  if (inputType === "Monthly Card") {
    if (!token || !activeEntries[token]) {
      const response = { barrierOpen:"0", moneyToPay:"0", displayMessage:"No entry record found. Please contact staff.",
        timeToDisplayMessage:"10", responseCode:"41", responseDescription:"No entry record found" };
      addLog(req, response); return res.json(response);
    }
    releaseSpace(activeEntries[token]); delete activeEntries[token];
    const bm = await openBarrierWithRetry();
    const response = bm === "failed"
      ? { barrierOpen:"0", moneyToPay:"0", displayMessage:"Technical issue. Please contact staff.", timeToDisplayMessage:"10", responseCode:"08", responseDescription:"Barrier failed" }
      : { barrierOpen:"1", moneyToPay:"0", displayMessage:"Thank you! Have a nice day.", timeToDisplayMessage:"5", responseCode:"00", responseDescription:"Successful Response" };
    addLog(req, response); return res.json(response);
  }

  const feeCents     = entry ? calculateFee(entry.entryTime) : 0;
  const preAuthCents = entry ? (entry.preAuthAmountCents || config.minimumAmountPreAuth || 300) : 0;

  function staffResponse(msg) {
    return { barrierOpen:"0", moneyToPay:"0", displayMessage: msg || "Technical issue. Please contact staff.",
      timeToDisplayMessage:"10", responseCode:"08", responseDescription:"Barrier failed" };
  }

  let response;
  switch(config.exitScenario) {
    case 1: {
      if (!entry) { response = staffResponse("Entry not found."); break; }
      try { await jccRelease(entry); } catch(e) {}
      delete activeEntries[token]; releaseSpace(entry);
      const b1 = await openBarrierWithRetry();
      response = b1 === "failed" ? staffResponse()
        : { barrierOpen:"1", moneyToPay:"0", displayMessage:"Thank you! Have a nice day.", timeToDisplayMessage:"5", responseCode:"00", responseDescription:"Successful Response" };
      break;
    }
    case 2: {
      if (!entry) { response = staffResponse("Entry not found."); break; }
      const captureAmt = feeCents > 0 ? feeCents : preAuthCents;
      let captureResult = null;
      try { captureResult = await jccCapture(entry, captureAmt); } catch(e) {}
      if (!captureResult || captureResult.responseCode !== "00") addPendingCapture(entry, captureAmt);
      delete activeEntries[token]; releaseSpace(entry);
      const b2 = await openBarrierWithRetry();
      response = b2 === "failed" ? staffResponse()
        : { barrierOpen:"1", moneyToPay:String(captureAmt), displayMessage:`Thank you! Charged €${(captureAmt/100).toFixed(2)}.`, timeToDisplayMessage:"5", responseCode:"00", responseDescription:"Successful Response" };
      break;
    }
    case 3: {
      if (!entry) { response = staffResponse("Entry not found."); break; }
      const totalFee3 = feeCents > 0 ? feeCents : (config.topupAmount || 500);
      const topupAmt3 = Math.max(0, totalFee3 - preAuthCents);
      let topupResult3 = null;
      try { topupResult3 = await jccTopup(entry, topupAmt3); } catch(e) {}
      const topupApproved = topupResult3 && topupResult3.responseCode === "00";
      if (topupApproved) {
        let captureResult3 = null;
        try { captureResult3 = await jccCapture(entry, totalFee3); } catch(e) {}
        if (!captureResult3 || captureResult3.responseCode !== "00") addPendingCapture(entry, totalFee3);
        delete activeEntries[token]; releaseSpace(entry);
        const b3 = await openBarrierWithRetry();
        response = b3 === "failed" ? staffResponse()
          : { barrierOpen:"1", moneyToPay:String(totalFee3), displayMessage:`Thank you! Total €${(totalFee3/100).toFixed(2)}.`, timeToDisplayMessage:"5", responseCode:"00", responseDescription:"Successful Response" };
      } else {
        if (!entry.recordId) entry.recordId = require("crypto").randomBytes(16).toString("hex").toUpperCase();
        try { await jccRelease(entry); } catch(e) {}
        response = { barrierOpen:"-2", moneyToPay:String(totalFee3), recordId: entry.recordId,
          displayMessage:`Card declined. Please tap card for full €${(totalFee3/100).toFixed(2)}.`,
          timeToDisplayMessage:"10", responseCode:"31", responseDescription:"TopUp declined" };
      }
      break;
    }
    case 4: {
      if (!entry) { response = staffResponse("Entry not found."); break; }
      const totalFee4 = feeCents > 0 ? feeCents : (config.topupAmount || 500);
      if (!entry.recordId) entry.recordId = require("crypto").randomBytes(16).toString("hex").toUpperCase();
      try { await jccRelease(entry); } catch(e) {}
      response = { barrierOpen:"-2", moneyToPay:String(totalFee4), recordId: entry.recordId,
        displayMessage:`Card declined. Please tap card for full €${(totalFee4/100).toFixed(2)}.`,
        timeToDisplayMessage:"10", responseCode:"31", responseDescription:"TopUp declined" };
      break;
    }
    case 5: default:
      response = staffResponse("Technical issue. Please contact staff.");
      break;
  }
  addLog(req, response); res.json(response);
});

app.post("/exitPayment", async (req, res) => {
  const { token } = req.body;
  const exitEntry = token ? activeEntries[token] : null;
  if (token) delete activeEntries[token];
  if (exitEntry) releaseSpace(exitEntry);
  const b = await openBarrierWithRetry();
  const response = b === "failed"
    ? { barrierOpen:"0", displayMessage:"Payment processed. Barrier failed - staff called.", timeToDisplayMessage:"10", responseCode:"08", responseDescription:"Barrier failed" }
    : { barrierOpen:"1", displayMessage:"Payment successful. Barrier is open.", timeToDisplayMessage:"5", responseCode:"00", responseDescription:"Successful Response", _barrier:b };
  addLog(req, response); res.json(response);
});

app.post("/vehiclePresent", async (req, res) => {
  let detected = config.vehiclePresent;
  if (config.tellEnabled && config.tellHwId && config.tellAppId) {
    const mode = detectMode(req.body);
    const vehicleInput = mode === "Exit" ? config.tellVehicleInputExit : config.tellVehicleInputEntrance;
    try { detected = await tellCheckVehicle(vehicleInput); }
    catch(e) {
      const errRes = {responseCode:"99",responseDescription:"Controller error: "+e.message,vehiclePresent:"0"};
      addLog(req, errRes); return res.json(errRes);
    }
  }
  const mode = detectMode(req.body);
  const response = {
    outlet: req.body.outlet || config.entranceOutlet, terminal: req.body.terminal || config.entranceTerminal,
    installationPoint: mode, dayTime: ts(), vehiclePresent: detected ? "1" : "0",
    displayMessage: detected ? "Vehicle detected." : "No vehicle detected.", timeToDisplayMessage: "3",
    availablePlaceMonthly: String(config.availablePlaceMonthly), availablePlacesNormal: String(config.availablePlacesNormal),
    responseCode: "00", responseDescription: "Successful Response"
  };
  addLog(req, response); res.json(response);
});

app.post("/help", (req, res) => {
  const action = req.body.action || "";
  const isManualHelp = action === "Help Button";
  const isEcrDecline = action.toLowerCase().includes("ecr decline") || action.toLowerCase().includes("ecr_decline");
  if (isManualHelp) {
    Promise.race([sendHelpAlert(req), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000))]).catch(e => {});
  } else if (isEcrDecline) {
    addEcrDecline(req.body.outlet||"?", req.body.terminal||"?", req.body.intallationPoint||"?", action);
  }
  const response = {
    outlet: req.body.outlet||config.entranceOutlet, terminal: req.body.terminal||config.entranceTerminal,
    installationPoint: req.body.intallationPoint||"", daytime: ts(),
    displayMessage: config.helpMessage, timeToDisplayMessage: config.helpDisplayTime,
    availablePlacesNormal: String(config.availablePlacesNormal), availablePlaceMonthly: String(config.availablePlaceMonthly),
    responseCode: "00", responseDescription: "Successful Response"
  };
  addLog(req, response); res.json(response);
});

// ═══════════════════════════════════════════════════════════════════════════════
// JCC IPPI (unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
const crypto = require("crypto");

let jccConfig = {
  topup:   { appId: "1cbb351c501647ef8f855335d2017dbc", apiKey: "CbGMgGAnQp1Hk+qeXSqjOsiRcN4P54skp32VWOav+ti=" },
  capture: { appId: "c677c1ba0bc349cfb04e2d10d67763f6", apiKey: "jzHup+gUjZo4XDKm54DtoIE9oK51THQ+Vp1AStzIfvI=" },
  release: { appId: "df4124bcd39a42ffb1b375c8d7af4bf8", apiKey: "a6t7zeZ9l+QqwZh9cQyQjCzqIFzwbWtCp62LijGe76L=" },
  void:    { appId: "1cbb351c501647ef8f855335d2017dbc", apiKey: "CbGMgGAnQp1Hk+qeXSqjOsiRcN4P54skp32VWOav+ti=" },
  reversal:{ appId: "1cbb351c501647ef8f855335d2017dbc", apiKey: "CbGMgGAnQp1Hk+qeXSqjOsiRcN4P54skp32VWOav+ti=" },
  validateHmac: false
};

let activeTransaction = null;
let jccLogs = [];

function addJccLog(endpoint, req, res, hmacValid) {
  jccLogs.unshift({ time: new Date().toISOString(), endpoint, hmacValid, request: req, response: res || {} });
  if (jccLogs.length > 100) jccLogs.pop();
}

function validateHmac(req) {
  try {
    const auth = req.headers["authorization"] || "";
    if (!auth.startsWith("hmacauth ")) return { valid: false, reason: "Missing hmacauth prefix" };
    const parts = auth.substring(9).split(":");
    if (parts.length < 4) return { valid: false, reason: "Invalid auth format" };
    const [appId, signature, nonce, timestamp] = parts;
    const now = Date.now();
    const tsval = parseInt(timestamp);
    const tsMs = tsval < 10000000000 ? tsval * 1000 : tsval;
    if (Math.abs(now - tsMs) > 300000) return { valid: false, reason: "Timestamp too old" };
    const bodyStr  = JSON.stringify(req.body);
    const bodyHash = crypto.createHash("sha256").update(bodyStr).digest("base64");
    const fullUrl  = `https://parking-mock-server.onrender.com${req.path}`;
    const encodedUrl = encodeURIComponent(fullUrl).toLowerCase();
    const creds = Object.values(jccConfig).find(c => c && c.appId === appId);
    if (!creds) return { valid: false, reason: `Unknown appId: ${appId}` };
    const sigRaw  = appId + req.method.toUpperCase() + encodedUrl + timestamp + nonce + bodyHash;
    const keyBytes = Buffer.from(creds.apiKey, "base64");
    const computed = crypto.createHmac("sha256", keyBytes).update(Buffer.from(sigRaw, "utf8")).digest("base64");
    return { valid: computed === signature, reason: computed === signature ? "OK" : "Sig mismatch" };
  } catch(e) { return { valid: false, reason: e.message }; }
}

function jccAuth(req, res, next) {
  const check = validateHmac(req);
  req.hmacValid = check.valid;
  if (jccConfig.validateHmac && !check.valid) {
    const r = { responseCode: "401", responseDescription: `HMAC validation failed: ${check.reason}` };
    addJccLog(req.path, req.body, r, false);
    return res.status(401).json(r);
  }
  next();
}

function jccOk(extra = {}) { return { responseCode: "00", responseDescription: "Successful Response", ...extra }; }

app.post("/financialservices/v1/ippi/auth/topup", jccAuth, (req, res) => {
  const b = req.body;
  const response = jccOk({ messageType:"topup", messageNo:b.messageNo, originalRef:b.originalRef, authID:b.authID, amount:b.amount, currency:b.currency, tokenCode:b.tokenCode, dateTime:jccDateTime() });
  activeTransaction = { type: "topup", ...b, processedAt: new Date().toISOString() };
  addJccLog("topup", b, response, req.hmacValid); res.json(response);
});

app.post("/financialservices/v1/ippi/auth/capture", jccAuth, (req, res) => {
  const b = req.body;
  const response = jccOk({ messageType:"capture", messageNo:b.messageNo, originalRef:b.originalRef, authID:b.authID, amount:b.amount, currency:b.currency, tokenCode:b.tokenCode, dateTime:jccDateTime() });
  activeTransaction = { type: "capture", ...b, processedAt: new Date().toISOString() };
  addJccLog("capture", b, response, req.hmacValid); res.json(response);
});

app.post("/financialservices/v1/ippi/auth/release", jccAuth, (req, res) => {
  const b = req.body;
  const response = jccOk({ messageType:"release", messageNo:b.messageNo, originalRef:b.originalRef, authID:b.authID, amount:b.amount, currency:b.currency, tokenCode:b.tokenCode, dateTime:jccDateTime() });
  activeTransaction = null;
  addJccLog("release", b, response, req.hmacValid); res.json(response);
});

app.post("/financialservices/v1/ippi/void", jccAuth, (req, res) => {
  const b = req.body;
  const response = jccOk({ messageType:"void", messageNo:b.messageNo, originalRef:b.originalRef, currency:b.currency, tokenCode:b.tokenCode, dateTime:jccDateTime() });
  activeTransaction = null;
  addJccLog("void", b, response, req.hmacValid); res.json(response);
});

app.post("/financialservices/v1/ippi/reversal", jccAuth, (req, res) => {
  const b = req.body;
  const response = jccOk({ messageType:"reversal", messageNo:b.messageNo, amount:b.amount, currency:b.currency, dateTime:jccDateTime() });
  activeTransaction = null;
  addJccLog("reversal", b, response, req.hmacValid); res.json(response);
});

app.get("/jcc/transaction",    (req, res) => res.json({ activeTransaction }));
app.delete("/jcc/transaction", (req, res) => { activeTransaction = null; res.json({ cleared: true }); });
app.get("/jcc/logs",           (req, res) => res.json(jccLogs));
app.get("/jcc/config",         (req, res) => res.json({ validateHmac: jccConfig.validateHmac }));
app.post("/jcc/config", (req, res) => {
  const { topupAppId, topupApiKey, captureAppId, captureApiKey, releaseAppId, releaseApiKey, validateHmac } = req.body;
  if (topupAppId)    jccConfig.topup.appId    = topupAppId;
  if (topupApiKey)   jccConfig.topup.apiKey   = topupApiKey;
  if (captureAppId)  jccConfig.capture.appId  = captureAppId;
  if (captureApiKey) jccConfig.capture.apiKey = captureApiKey;
  if (releaseAppId)  jccConfig.release.appId  = releaseAppId;
  if (releaseApiKey) jccConfig.release.apiKey = releaseApiKey;
  if (validateHmac !== undefined) jccConfig.validateHmac = validateHmac;
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RENTAL — completely separate state and endpoints
// ═══════════════════════════════════════════════════════════════════════════════

let rentalConfig = {
  rentalOutlet:      "",
  rentalTerminal:    "",
  rentalStationId:   "LIM-001",
  rentalStationName: "Limassol Marina"
};

let activeRentals = {};  // key: rentalId
let rentalLogs      = [];

function addRentalLog(req, response) {
  rentalLogs.unshift({
    id:       Date.now(),
    time:     new Date().toLocaleString(),
    endpoint: req.originalUrl,
    method:   req.method,
    request:  req.body || {},
    response: response
  });
  if (rentalLogs.length > 200) rentalLogs.pop();
  console.log(`[RENTAL] ${req.method} ${req.originalUrl}`);
  console.log(`  REQ: ${JSON.stringify(req.body)}`);
  console.log(`  RES: ${JSON.stringify(response)}`);
}

// ── Mock nextbike API ─────────────────────────────────────────────────────────
function mockBikeApiStart(bikeId) {
  const rentalId   = "NB-" + Math.floor(1000 + Math.random() * 9000);
  const unlockCode = String(Math.floor(1000 + Math.random() * 9000));
  const startTime  = Date.now();
  return { rentalId, unlockCode, startTime };
}

function mockRentalApiStatus(rentalId) {
  const rental = Object.values(activeRentals).find(r => r.rentalId === rentalId);
  if (!rental) return { status: "not_found" };
  return { status: "active", startTime: rental.startTime };
}

// ── Rental tariff calculation ───────────────────────────────────────────────────
function calculateRentalFee(startTime) {
  const mins = Math.floor((Date.now() - startTime) / 60000);
  if (mins <= 60)  return 300;   // €3.00
  if (mins <= 120) return 450;   // €4.50
  if (mins <= 180) return 600;   // €6.00
  return 600 + Math.ceil((mins - 180) / 60) * 150;  // €6.00 + €1.50/hr
}

// ── GET /rental/config ──────────────────────────────────────────────────────────
app.get("/rental/config", (req, res) => res.json(rentalConfig));

// ── POST /rental/config ─────────────────────────────────────────────────────────
app.post("/rental/config", (req, res) => {
  const { key, value } = req.body;
  if (!(key in rentalConfig)) return res.json({ ok: false, error: `Unknown key: ${key}` });
  rentalConfig[key] = value;
  console.log(`[RENTAL_CONFIG] ${key} = ${value}`);
  res.json({ ok: true });
});

// ── GET /rental/rentals ─────────────────────────────────────────────────────────
app.get("/rental/rentals", (req, res) => res.json(Object.values(activeRentals)));

// ── GET /rental/logs ────────────────────────────────────────────────────────────
app.get("/rental/logs", (req, res) => res.json(rentalLogs));

// ── DELETE /rental/logs ─────────────────────────────────────────────────────────
app.delete("/rental/logs", (req, res) => { rentalLogs = []; res.json({ ok: true }); });

// ── GET /rental/stations — mock available items at station ──────────────────────
app.get("/rental/stations/:stationId/bikes", (req, res) => {
  const bikes = [
    { bikeId: "1042", type: "Regular", dock: "Dock 3", available: true },
    { bikeId: "1078", type: "Regular", dock: "Dock 5", available: true },
    { bikeId: "2011", type: "E-bike",  dock: "Dock 1", available: true },
    { bikeId: "1055", type: "Regular", dock: "Dock 7", available: true },
    { bikeId: "2034", type: "E-bike",  dock: "Dock 2", available: true }
  ];
  res.json({ stationId: req.params.stationId, bikes, responseCode: "00" });
});

// ── POST /rental/start ────────────────────────────────────────────────────
// Called by terminal after Pre-Auth approved
// Request: { terminalId, outlet, bikeId, bikeType, authCode, receiptNumber,
//            tokenCode, lastDigits, expiryDate, preAuthAmount }
// Response: { responseCode, unlockCode, rentalId }
app.post("/rental/start", (req, res) => {
  const { terminalId, outlet, bikeId, bikeType, authCode,
          receiptNumber, tokenCode, lastDigits, expiryDate, preAuthAmount } = req.body;

  if (!bikeId || !authCode) {
    const response = { responseCode: "99", responseDescription: "Missing itemId or authCode" };
    addRentalLog(req, response); return res.json(response);
  }

  // Check item not already rented
  const alreadyRented = Object.values(activeRentals).find(r => r.bikeId === bikeId);
  if (alreadyRented) {
    const response = { responseCode: "41", responseDescription: "Item already rented" };
    addRentalLog(req, response); return res.json(response);
  }

  // Call mock nextbike API
  const rentalApiResult = mockBikeApiStart(bikeId);

  // Store rental record
  activeRentals[rentalApiResult.rentalId] = {
    rentalId:    rentalApiResult.rentalId,
    bikeId,
    itemType:    bikeType || "Regular",
    authCode,
    receiptNumber:      receiptNumber || "",
    tokenCode:          tokenCode     || "",
    lastDigits:         lastDigits    || "",
    expiryDate:         expiryDate    || "0000",
    preAuthAmountCents: parseInt(preAuthAmount || 1000),
    outlet:             outlet        || rentalConfig.rentalOutlet,
    terminalId:         terminalId    || rentalConfig.rentalTerminal,
    startTime:          rentalApiResult.startTime,
    unlockCode:         rentalApiResult.unlockCode,
    status:             "active"
  };

  console.log(`[RENTAL] Rental started — rentalId=${rentalApiResult.rentalId} bikeId=${bikeId} authCode=${authCode}`);

  const response = {
    responseCode:        "00",
    responseDescription: "Rental started",
    rentalId:            rentalApiResult.rentalId,
    unlockCode:          rentalApiResult.unlockCode,
    bikeId
  };
  addRentalLog(req, response); res.json(response);
});

// ── POST /rental/exit ─────────────────────────────────────────────────────
// Called by terminal after PAN Capture type 14
// Request: { terminalId, outlet, bikeId, pan, last4 }
// Response: { responseCode, barrierOpen, amountDue, rentalId }
// barrierOpen: "1" = void (free), "-2" = capture needed, "0" = staff
app.post("/rental/exit", async (req, res) => {
  const { terminalId, outlet, bikeId, pan, last4 } = req.body;

  if (!bikeId) {
    const response = { responseCode: "99", responseDescription: "Missing bikeId", barrierOpen: "0" };
    addRentalLog(req, response); return res.json(response);
  }

  // Find rental by bikeId
  const rental = Object.values(activeRentals).find(r => r.bikeId === bikeId && r.status === "active");
  if (!rental) {
    const response = { responseCode: "41", responseDescription: "No active rental found for this item", barrierOpen: "0" };
    addRentalLog(req, response); return res.json(response);
  }

  // Confirm bike locked via mock nextbike API
  const statusResult = mockRentalApiStatus(rental.rentalId);
  if (statusResult.status === "not_found") {
    const response = { responseCode: "99", responseDescription: "Item status unknown — contact staff", barrierOpen: "0" };
    addRentalLog(req, response); return res.json(response);
  }

  // Calculate amount due
  const amountCents = calculateRentalFee(rental.startTime);
  const durationMins = Math.floor((Date.now() - rental.startTime) / 60000);

  console.log(`[RENTAL] Exit — rentalId=${rental.rentalId} bikeId=${bikeId} duration=${durationMins}min amount=€${(amountCents/100).toFixed(2)}`);

  // Mark rental as ending — capture will be done by terminal
  rental.status      = "ending";
  rental.endTime     = Date.now();
  rental.amountCents = amountCents;
  rental.last4Exit   = last4 || rental.lastDigits;

  const response = {
    responseCode:        "00",
    responseDescription: "Exit processed",
    rentalId:            rental.rentalId,
    bikeId,
    durationMins:        String(durationMins),
    amountDue:           String(amountCents),
    barrierOpen:         amountCents > 0 ? "-2" : "1",
    displayMessage:      amountCents > 0
      ? `Duration: ${durationMins}min. Amount: €${(amountCents/100).toFixed(2)}`
      : `Duration: ${durationMins}min. Free — no charge.`,
    timeToDisplayMessage: "5"
  };
  addRentalLog(req, response); res.json(response);
});

// ── POST /rental/complete ─────────────────────────────────────────────────
// Called by terminal after ECR Capture confirmed
// Request: { rentalId, amountCharged }
app.post("/rental/complete", (req, res) => {
  const { rentalId, amountCharged } = req.body;
  const rental = activeRentals[rentalId];
  if (!rental) {
    const response = { responseCode: "41", responseDescription: "Rental not found" };
    addRentalLog(req, response); return res.json(response);
  }
  rental.status        = "completed";
  rental.amountCharged = amountCharged;
  rental.completedAt   = Date.now();
  // Remove from active after 60s
  setTimeout(() => { delete activeRentals[rentalId]; }, 60000);
  console.log(`[RENTAL] Rental completed — rentalId=${rentalId} charged=€${(parseInt(amountCharged||0)/100).toFixed(2)}`);
  const response = { responseCode: "00", responseDescription: "Rental completed", rentalId };
  addRentalLog(req, response); res.json(response);
});

// ── POST /rental/void ─────────────────────────────────────────────────────
// Called by terminal when Pre-Auth void (free ride or cancel)
// Request: { rentalId }
app.post("/rental/void", (req, res) => {
  const { rentalId } = req.body;
  const rental = activeRentals[rentalId];
  if (rental) {
    rental.status = "voided";
    setTimeout(() => { delete activeRentals[rentalId]; }, 60000);
  }
  const response = { responseCode: "00", responseDescription: "Rental voided", rentalId };
  addRentalLog(req, response); res.json(response);
});

// ═══════════════════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`RPS Mock running on http://0.0.0.0:${PORT}`);
  startCaptureRetryLoop();
});