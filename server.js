const express = require("express");
const https   = require("https");
const app     = express();

app.use(express.json());

// ── Email alerts via Resend HTTP API ─────────────────────────────────────────
// Set RESEND_KEY and ALERT_EMAIL in Render environment variables
// No npm packages needed — uses built-in https module
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
let rejectionLog  = [];  // track rejected entrance attempts
let ecrDeclineLog = [];  // track ECR declines (no email sent)

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
  // ── POS Devices ──────────────────────────────────────────────────────────────
  // Entrance POS — configured in Android Settings on the entrance device
  entranceOutlet:   "0000259010",
  entranceTerminal: "000025901090",
  // Exit POS — configured in Android Settings on the exit device
  exitOutlet:       "0000259010",
  exitTerminal:     "000025901091",

  // ── parkingInit fields ────────────────────────────────────────────────────────
  keepAliveFreq:          10,
  minimumAmountPreAuth:   300,
  defaultAmount:          800,
  fixAmountSolution:      -1,   // -1 = off, >0 = fixed SALE amount in cents (entrance only)
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
  monthlyCardsBins:      "123456;12345678910111213453",   // semicolon-separated full card numbers
  showRates:             true,
  responseCode:          "00",
  flagsForAction:        "0000",  // "1000"=restart app, "0100"=force full init, "1100"=both, "0000"=none
  voiceAssistant:        true,    // true = app plays audio; false = silent
  defaultLanguage:       "EN",    // EN, EL, RU, IW
  companyCode:           "MarinaParking",

  // ── TELL Gate Control PRO ─────────────────────────────────────────────────────
  tellEnabled:       false,
  tellApiKey:        "f2nIrJ8DBf4Gc8ar99IQeCVVm3pnWrVP",
  tellPassword:      "1234",  // device admin password — used by app for addappid
  tellHwId:          "",
  tellHwName:        "ParkingBarrier",
  tellAppId:         "",
  tellVehicleInputEntrance: "in1",  // input pin for entrance vehicle detection
  tellVehicleInputExit:     "in2",  // input pin for exit vehicle detection
  tellBarrierOutput: 1,

  // ── JCC IPPI ──────────────────────────────────────────────────────────────────
  jccBaseUrl:   "https://test-apis.jccsecure.com",
  jccUseMock:          true,   // true = call own mock endpoints, false = call real JCC
  parkingName:         "ParkTec",
  topupAmount:         500,    // total exit fee in cents for scenario 3 (TopUp)
  captureRetryMins:    15,     // retry interval in minutes for failed captures
  captureMaxRetries:   5,      // max retry attempts before marking as FAILED
};

// ── Pending Captures (capture declined at exit — retry in background) ─────────
let pendingCaptures = [];  // { id, entry, amountCents, createdAt, retries, status, lastAttempt, lastError }

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
        console.log(`[PENDING_CAPTURE] ${pc.id} FAILED after ${pc.retries} retries — manual action required`);
      } else {
        console.log(`[PENDING_CAPTURE] ${pc.id} retry ${pc.retries}/${config.captureMaxRetries} failed: ${pc.lastError}`);
      }
    }
  } catch(e) {
    pc.lastError = e.message;
    console.error(`[PENDING_CAPTURE] ${pc.id} retry error:`, e.message);
  }
}

// Background retry loop — checks every 60s, fires when interval elapsed
function startCaptureRetryLoop() {
  let lastRun = Date.now();
  setInterval(async () => {
    const intervalMs = (config.captureRetryMins || 15) * 60 * 1000;
    if (Date.now() - lastRun < intervalMs) return;
    lastRun = Date.now();
    const pending = pendingCaptures.filter(pc => pc.status === "PENDING");
    if (pending.length === 0) return;
    console.log(`[PENDING_CAPTURE] Background retry — ${pending.length} pending`);
    for (const pc of pending) await retrySingleCapture(pc);
  }, 60 * 1000); // checks every 60s
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  console.log(`[${new Date().toLocaleTimeString()}] TELL ${action}`);
}

function ts() {
  return new Date().toISOString().replace(/[-:T.Z]/g,"").slice(0,14);
}

// ── HMAC Header Builder (JCC spec) ───────────────────────────────────────────
function buildHmacHeader(method, fullUrl, body, endpointType) {
  const creds     = jccConfig[endpointType] || jccConfig.topup;
  const appId     = creds.appId;
  const apiKey    = creds.apiKey;
  const timestamp = Math.floor(Date.now() / 1000).toString();  // seconds per JCC spec
  const nonce     = crypto.randomBytes(16).toString("hex");     // 32 char alphanumeric
  const bodyStr   = JSON.stringify(body);
  const bodyHash  = crypto.createHash("sha256").update(bodyStr).digest("base64");
  const encodedUrl = encodeURIComponent(fullUrl).toLowerCase();
  const sigRaw    = appId + method.toUpperCase() + encodedUrl + timestamp + nonce + bodyHash;
  const keyBytes  = Buffer.from(apiKey, "base64");
  const signature = crypto.createHmac("sha256", keyBytes)
                          .update(Buffer.from(sigRaw, "utf8"))
                          .digest("base64");
  console.log(`[HMAC] ts=${timestamp} nonce=${nonce} sigRaw=${sigRaw.substring(0,60)}...`);
  return `hmacauth ${appId}:${signature}:${nonce}:${timestamp}`;
}

// ── JCC HTTP POST helper ──────────────────────────────────────────────────────
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
      rejectUnauthorized: false,  // JCC test server uses self-signed certificate
      headers:  {
        "Content-Type":  "application/json",
        "Authorization": auth,
        "Content-Length": Buffer.byteLength(bodyStr)
      }
    };
    console.log(`[JCC] POST ${fullUrl}`);
    const reqHttp = lib.request(opts, (r) => {
      let data = "";
      r.on("data", c => data += c);
      r.on("end", () => {
        console.log(`[JCC] ${fullUrl} → HTTP ${r.statusCode} | body: ${data.substring(0,200)}`);
        if (!data || data.trim() === "" || data.trim() === "{}") {
          // JCC returns empty body on success for topup/capture/release
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

// ── JCC DateTime format — Cyprus timezone +03:00 ─────────────────────────────
function jccDateTime() {
  const now    = new Date();
  const offset = '+03:00';
  const pad    = n => String(n).padStart(2, '0');
  // Adjust to Cyprus time (UTC+3)
  const cy = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return cy.getUTCFullYear() + '-' +
    pad(cy.getUTCMonth() + 1) + '-' +
    pad(cy.getUTCDate()) + 'T' +
    pad(cy.getUTCHours()) + ':' +
    pad(cy.getUTCMinutes()) + ':' +
    pad(cy.getUTCSeconds()) + offset;
}

// ── JCC API Calls ─────────────────────────────────────────────────────────────
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

// ── GET /admin/entries ────────────────────────────────────────────────────────
app.get("/admin/entries", (req, res) => res.json(Object.values(activeEntries)));

// ── GET /admin/rejections ─────────────────────────────────────────────────────
app.get("/admin/rejections", (req, res) => res.json(rejectionLog));
app.get("/admin/ecr-declines", (req, res) => res.json(ecrDeclineLog));

// ── Pending Captures endpoints ────────────────────────────────────────────────
app.get("/admin/pending-captures", (req, res) => res.json(pendingCaptures));

app.post("/admin/retry-capture/:id", async (req, res) => {
  const pc = pendingCaptures.find(p => p.id === req.params.id);
  if (!pc) return res.json({ ok: false, error: "Not found" });
  if (pc.status === "RESOLVED") return res.json({ ok: false, error: "Already resolved" });
  pc.status = "PENDING"; // reset FAILED to allow manual retry
  await retrySingleCapture(pc);
  res.json({ ok: true, status: pc.status, retries: pc.retries, lastError: pc.lastError });
});

app.delete("/admin/pending-captures/:id", (req, res) => {
  const idx = pendingCaptures.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.json({ ok: false, error: "Not found" });
  pendingCaptures.splice(idx, 1);
  res.json({ ok: true });
});

// ── GET /admin/tell-status ────────────────────────────────────────────────────
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
    console.log(`[CONFIG] Unknown key: "${key}"`);
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
  console.log(`[CONFIG] ${key} = ${JSON.stringify(config[key])} (was ${JSON.stringify(existing)})`);
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

// ── POST /admin/tell-register ─────────────────────────────────────────────────
// Calls TELL /gc/addappid using hwId + hwName + password → saves appId to config
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
<p style="color:#8b949e">All changes take effect immediately - no restart needed.</p>

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
<tr><td>App Version</td><td>${config.lastAppVersionName ? config.lastAppVersionName + ' (build ' + config.lastAppVersionNumber + ')' : '<span style="color:#8b949e">not yet received</span>'}</td><td></td></tr>
<tr><td>Company Code</td><td>${config.companyCode}</td>
<td><input class="m" id="inCC" value="${config.companyCode}">
<button class="btn" onclick="sv('companyCode','inCC')">Save</button></td></tr>
<tr><td>Exit Scenario</td><td>${config.exitScenario} - ${sn}</td>
<td><button class="btn green" onclick="set('exitScenario',1)">1 Free</button>
<button class="btn" onclick="set('exitScenario',2)">2 Capture</button>
<button class="btn orange" onclick="set('exitScenario',3)">3 TopUp OK</button>
<button class="btn red" onclick="set('exitScenario',4)">4 TopUp Declined</button>
<button class="btn red" onclick="set('exitScenario',5)">5 Barrier Fail</button></td></tr>
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
<tr><td>Monthly Card Numbers</td><td style="font-size:11px">${config.monthlyCardsBins||'-'}</td>
<td><input class="t" id="inBins" value="${config.monthlyCardsBins||''}" placeholder="e.g. 123456;789012" style="width:220px">
<button class="btn" onclick="sv('monthlyCardsBins','inBins')">Save</button>
<span style="color:#8b949e;font-size:11px;margin-left:6px">Semicolon-separated full card numbers</span></td></tr>
<tr><td>Show Rates</td><td>${config.showRates}</td>
<td><button class="btn green" onclick="set('showRates',true)">YES</button>
<button class="btn red" onclick="set('showRates',false)">NO</button></td></tr>
<tr><td>Force Init Error</td><td>${config.responseCode}</td>
<td><button class="btn green" onclick="set('responseCode','00')">00 OK</button>
<button class="btn red" onclick="set('responseCode','91')">91 Outlet</button>
<button class="btn red" onclick="set('responseCode','92')">92 Company</button>
<button class="btn red" onclick="set('responseCode','08')">08 Technical</button></td></tr>
<tr><td>flagsForAction</td><td>${config.flagsForAction}</td>
<td><button class="btn green" onclick="set('flagsForAction','0000')">0000 None</button>
<button class="btn orange" onclick="set('flagsForAction','1000')">1000 Restart App</button>
<button class="btn" onclick="set('flagsForAction','0100')">0100 Force Init</button>
<button class="btn red" onclick="set('flagsForAction','1100')">1100 Init + Restart</button></td></tr>
<tr><td>Voice Assistant</td><td>${config.voiceAssistant ? '🔊 ON' : '🔇 OFF'}</td>
<td><button class="btn green" onclick="set('voiceAssistant',true)">🔊 ON</button>
<button class="btn red" onclick="set('voiceAssistant',false)">🔇 OFF</button></td></tr>
<tr><td>Default Language</td><td>${config.defaultLanguage}</td>
<td><button class="btn green" onclick="set('defaultLanguage','EN')">🇬🇧 EN</button>
<button class="btn" onclick="set('defaultLanguage','EL')">🇬🇷 EL</button>
<button class="btn" onclick="set('defaultLanguage','RU')">🇷🇺 RU</button>
<button class="btn" onclick="set('defaultLanguage','IW')">🇮🇱 IW</button></td></tr>
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
<tr><td>Fix Amount Solution (cents)</td><td>${config.fixAmountSolution} ${config.fixAmountSolution > 0 ? '= €'+(config.fixAmountSolution/100).toFixed(2)+' SALE mode' : '= OFF (pre-auth mode)'}</td>
<td><input class="n" type="number" id="inFA" value="${config.fixAmountSolution}">
<button class="btn" onclick="set('fixAmountSolution',Number(document.getElementById('inFA').value))">Set</button>
<span style="color:#8b949e;font-size:11px;margin-left:6px">-1 = off, e.g. 500 = €5.00 fixed SALE</span></td></tr>
<tr><td>Default Amount (cents)</td><td>${config.defaultAmount} = €${(config.defaultAmount/100).toFixed(2)}</td>
<td><input class="n" type="number" id="inDA" value="${config.defaultAmount}">
<button class="btn" onclick="set('defaultAmount',Number(document.getElementById('inDA').value))">Set</button></td></tr>
<tr><td>Phone For Help</td><td>${config.phoneForHelp}</td>
<td><input class="m" id="inPH" value="${config.phoneForHelp}">
<button class="btn" onclick="sv('phoneForHelp','inPH')">Save</button></td></tr>
<tr><td>Help Message</td><td style="font-size:11px">${config.helpMessage}</td>
<td><input class="w" id="inHM" value="${config.helpMessage}">
<button class="btn" onclick="sv('helpMessage','inHM')">Save</button></td></tr>
<tr><td>Help Display Time (sec)</td><td>${config.helpDisplayTime}</td>
<td><input class="m" id="inHDT" value="${config.helpDisplayTime}" style="width:60px">
<button class="btn" onclick="sv('helpDisplayTime','inHDT')">Save</button></td></tr>
<tr><td>Email Alerts</td>
<td>${process.env.RESEND_KEY ? '✅ Resend active' : '⚠️ Not configured (set RESEND_KEY in Render)'}</td>
<td style="font-size:11px;color:#8b949e">${config.lastAlertSent ? 'Last sent: '+config.lastAlertSent : 'No alerts sent yet'}</td></tr>
<tr><td>Alert Email (recipient)</td>
<td><input class="w" id="inAlertEmail" placeholder="recipient@email.com" value="${config.alertEmail}"></td>
<td><button class="btn" onclick="sv('alertEmail','inAlertEmail')">Save</button></td></tr>
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
<h3>Mode - currently: <span class="${config.tellEnabled?'active':'inactive'}">${config.tellEnabled?'🟢 REAL TELL API ACTIVE':'⚫ MOCK (TELL disabled)'}</span></h3>
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
<td><input class="w" id="appId" placeholder="paste manually or click Get from TELL" value="${config.tellAppId}"></td>
<td>
  <button class="btn" onclick="sv('tellAppId','appId')">Save</button>
  <button class="btn green" onclick="registerAppId()" style="margin-left:4px">&#x1F4E1; Get from TELL</button>
</td></tr>
<tr><td></td><td colspan="2"><span id="regResult" style="font-size:12px"></span></td></tr>
<tr><td>API Key</td>
<td><input class="w" id="apiKey" value="${config.tellApiKey}"></td>
<td><button class="btn" onclick="sv('tellApiKey','apiKey')">Save</button></td></tr>
<tr><td>Device Password</td>
<td><input class="m" id="tellPwd" value="${config.tellPassword}"></td>
<td><button class="btn" onclick="sv('tellPassword','tellPwd')">Save</button></td></tr>
</table>

<h3>I/O Mapping</h3>
<table>
<tr><th>Function</th><th>Setting</th></tr>
<tr><td>🔵 Entrance vehicle input</td>
<td><select onchange="set('tellVehicleInputEntrance',this.value)">
<option value="in1" ${config.tellVehicleInputEntrance==='in1'?'selected':''}>IN1 - dry contact</option>
<option value="in2" ${config.tellVehicleInputEntrance==='in2'?'selected':''}>IN2 - dry contact</option>
</select></td></tr>
<tr><td>🟠 Exit vehicle input</td>
<td><select onchange="set('tellVehicleInputExit',this.value)">
<option value="in1" ${config.tellVehicleInputExit==='in1'?'selected':''}>IN1 - dry contact</option>
<option value="in2" ${config.tellVehicleInputExit==='in2'?'selected':''}>IN2 - dry contact</option>
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

<!-- TELL Live Status -->
<div class="card" style="margin-bottom:12px">
  <h3>&#x1F6A6; TELL Gate Status <span id="tellStatusTime" style="font-size:11px;color:#8b949e;margin-left:8px"></span></h3>
  <div id="tellStatusDiv" style="display:flex;gap:16px;flex-wrap:wrap;padding:8px 0">
    <span style="color:#8b949e">Loading...</span>
  </div>
</div>

<h2>&#x1F9FE; Active Entries <span id="activeEntriesCount" style="font-size:13px;color:#8b949e"></span></h2>
<div id="activeEntriesDiv">
  <table><tr><td style="color:#8b949e">Loading...</td></tr></table>
</div>
<button class="btn red" onclick="clearE()">Clear All Entries</button>

<h2>&#x26D4; Rejected Attempts <span id="rejectionCount" style="font-size:13px;color:#8b949e"></span></h2>
<div id="rejectionDiv">
  <table><tr><td style="color:#8b949e">Loading...</td></tr></table>
</div>

<h2>&#x1F4B3; ECR Declines <span id="ecrDeclineCount" style="font-size:13px;color:#8b949e"></span></h2>
<div id="ecrDeclineDiv">
  <table><tr><td style="color:#8b949e">Loading...</td></tr></table>
</div>

<h2>&#x26A0;&#xFE0F; Pending Captures <span id="pendingCaptureCount" style="font-size:13px;color:#8b949e"></span></h2>
<div id="pendingCaptureDiv">
  <table><tr><td style="color:#8b949e">Loading...</td></tr></table>
</div>

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

<h2>&#x1F4B3; JCC IPPI Financial Services</h2>
<div class="card">
  <h3>HMAC Configuration (per endpoint)</h3>
  <table>
    <tr><th>Endpoint</th><th>AppId</th><th>ApiKey</th></tr>
    <tr><td>Topup</td>
      <td><input id="topupAppId" value="${jccConfig.topup.appId}" style="width:280px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;padding:4px;font-family:monospace;font-size:11px"></td>
      <td><input id="topupApiKey" type="password" value="${jccConfig.topup.apiKey}" style="width:280px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;padding:4px;font-family:monospace;font-size:11px"></td></tr>
    <tr><td>Capture</td>
      <td><input id="captureAppId" value="${jccConfig.capture.appId}" style="width:280px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;padding:4px;font-family:monospace;font-size:11px"></td>
      <td><input id="captureApiKey" type="password" value="${jccConfig.capture.apiKey}" style="width:280px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;padding:4px;font-family:monospace;font-size:11px"></td></tr>
    <tr><td>Release</td>
      <td><input id="releaseAppId" value="${jccConfig.release.appId}" style="width:280px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;padding:4px;font-family:monospace;font-size:11px"></td>
      <td><input id="releaseApiKey" type="password" value="${jccConfig.release.apiKey}" style="width:280px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;padding:4px;font-family:monospace;font-size:11px"></td></tr>
    <tr><th colspan="3">Global Settings</th></tr>
    <tr><td>Validate HMAC</td><td colspan="2"><input id="jccValidate" type="checkbox" ${jccConfig.validateHmac?'checked':''} style="width:18px;height:18px"> <span style="color:#8b949e;font-size:12px">When OFF - all requests pass through</span></td></tr>
    <tr><td>JCC Target</td><td colspan="2">
      <select onchange="set('jccUseMock',this.value==='true')">
        <option value="true"  ${config.jccUseMock?'selected':''}>🟡 MOCK (this server)</option>
        <option value="false" ${!config.jccUseMock?'selected':''}>🟢 REAL JCC (${config.jccBaseUrl})</option>
      </select>
    </td></tr>
    <tr><td>Parking Name</td><td><input id="parkingNameInput" value="${config.parkingName}" style="width:200px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;padding:4px">
      <button class="btn" style="margin-left:6px" onclick="sv('parkingName','parkingNameInput')">Save</button></td><td></td></tr>
    <tr><td>TopUp total amount (cents)</td><td><input id="topupAmountInput" value="${config.topupAmount}" style="width:100px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;padding:4px">
      <button class="btn" style="margin-left:6px" onclick="sv('topupAmount','topupAmountInput')">Save</button>
      <span style="color:#8b949e;font-size:11px;margin-left:8px">e.g. 500 = €5.00</span></td><td></td></tr>
    <tr><td>Capture Retry Interval (min)</td><td><input id="captureRetryMinsInput" value="${config.captureRetryMins}" style="width:80px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;padding:4px">
      <button class="btn" style="margin-left:6px" onclick="sv('captureRetryMins','captureRetryMinsInput')">Save</button>
      <span style="color:#8b949e;font-size:11px;margin-left:8px">background retry every X minutes</span></td><td></td></tr>
    <tr><td>Capture Max Retries</td><td><input id="captureMaxRetriesInput" value="${config.captureMaxRetries}" style="width:80px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;padding:4px">
      <button class="btn" style="margin-left:6px" onclick="sv('captureMaxRetries','captureMaxRetriesInput')">Save</button>
      <span style="color:#8b949e;font-size:11px;margin-left:8px">mark as FAILED after N retries</span></td><td></td></tr>
  </table>
  <button class="btn" onclick="saveJccConfig()" style="margin-top:8px">💾 Save JCC HMAC Config</button>
</div>

<div class="card" style="margin-top:12px">
  <h3>Active Transaction</h3>
  <div id="jccActiveTx"><span style="color:#888">Loading...</span></div>
  <button class="btn red" onclick="clearJccTransaction()" style="margin-top:8px">🗑 Clear Transaction</button>
</div>

<div class="card" style="margin-top:12px">
  <h3>&#x1F4C5; End of Day - Manual Capture</h3>
  <p style="color:#8b949e;font-size:12px">Run capture for all active entries at end of day. Each pre-auth will be captured for its pre-auth amount.</p>
  <button class="btn orange" onclick="runEndOfDayCapture()">&#x1F4B0; Run End of Day Capture</button>
  <div id="eodStatus" style="margin-top:8px;color:#8b949e;font-size:12px"></div>
</div>

<div class="card" style="margin-top:12px">
  <h3>JCC API Endpoints (base: /financialservices/v1/ippi)</h3>
  <table>
    <tr><th>Endpoint</th><th>Method</th><th>Description</th></tr>
    <tr><td style="font-family:monospace;color:#58a6ff">/auth/topup</td><td>POST</td><td>TopUp - charge additional amount</td></tr>
    <tr><td style="font-family:monospace;color:#58a6ff">/auth/capture</td><td>POST</td><td>Capture - finalise pre-auth amount</td></tr>
    <tr><td style="font-family:monospace;color:#58a6ff">/auth/release</td><td>POST</td><td>PreAuthorisationRelease - release pre-auth</td></tr>
    <tr><td style="font-family:monospace;color:#58a6ff">/void</td><td>POST</td><td>Void - cancel a transaction</td></tr>
    <tr><td style="font-family:monospace;color:#58a6ff">/reversal</td><td>POST</td><td>Reversal - reverse a previous operation</td></tr>
  </table>
</div>

<div class="card" style="margin-top:12px">
  <h3>JCC Transaction Log <span id="jccLogCount" style="font-size:12px;color:#8b949e"></span></h3>
  <div id="jccLogDiv"><table><tr><td style="color:#8b949e">Loading...</td></tr></table></div>
</div>

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
    filtered.length+' of '+allLogs.length+' entries'+(activeFilter?' - filter: '+activeFilter:'');
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
        (l.request&&l.request.versionName?'<span style="color:#8b949e;font-size:11px;margin-left:4px">v'+l.request.versionName+'</span>':'')+
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
  const r=await fetch('/admin/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,value:v})});
  const d=await r.json();
  if(d.ok) location.reload();
  else showS('✗ Error: '+d.error,true);
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
    if(d.ok) showS('OK OK  Model:'+d.model+'  FW:'+d.fw+'  IN1='+d.in1+'  IN2='+d.in2+'  OUT1='+d.out1+'  OUT2='+d.out2,false);
    else showS('✗ '+d.error,true);
  }catch(e){showS('✗ '+e.message,true);}
}
async function openNow(){
  showS('Sending open command...',false);
  try{
    const r=await fetch('/admin/tell-open',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const d=await r.json();
    if(d.ok) showS('OK Barrier open command sent OK',false);
    else showS('✗ '+d.error,true);
  }catch(e){showS('✗ '+e.message,true);}
}
async function registerAppId(){
  const el=document.getElementById('regResult');
  el.style.color='#8b949e'; el.textContent='Calling /gc/addappid...';
  try{
    const r=await fetch('/admin/tell-register',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const d=await r.json();
    if(d.ok){
      document.getElementById('appId').value=d.appId;
      el.style.color='#3fb950';
      el.textContent='OK App ID registered and saved: '+d.appId;
    } else {
      el.style.color='#f85149';
      el.textContent='✗ '+d.error;
    }
  }catch(e){
    el.style.color='#f85149';
    el.textContent='✗ '+e.message;
  }
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

async function loadRejections(){
  try{
    const r=await fetch('/admin/rejections');
    const items=await r.json();
    const el=document.getElementById('rejectionDiv');
    const cnt=document.getElementById('rejectionCount');
    if(!el) return;
    cnt.textContent='('+items.length+')';
    if(items.length===0){
      el.innerHTML='<table><tr><td colspan="4" style="color:#8b949e">No rejected attempts</td></tr></table>';
      return;
    }
    el.innerHTML='<table><tr><th>Time</th><th>Type</th><th>Card</th><th>Reason</th><th>Code</th></tr>'+
      items.map(function(e){
        const t=new Date(e.time).toLocaleTimeString();
        const typeColor=e.cardType==='Monthly Card'?'#3fb950':'#58a6ff';
        const reasonColor=e.code==='41'?'#E65100':'#C62828';
        return '<tr style="background:#2a0d0d">'+
          '<td>'+t+'</td>'+
          '<td style="color:'+typeColor+'">'+e.cardType+'</td>'+
          '<td style="font-family:monospace">'+e.cardId+'</td>'+
          '<td style="color:'+reasonColor+'">'+e.reason+'</td>'+
          '<td style="font-family:monospace">'+e.code+'</td>'+
          '</tr>';
      }).join('')+'</table>';
  }catch(e){}
}

async function loadEcrDeclines(){
  try{
    const r=await fetch('/admin/ecr-declines');
    const items=await r.json();
    const el=document.getElementById('ecrDeclineDiv');
    const cnt=document.getElementById('ecrDeclineCount');
    if(!el) return;
    cnt.textContent='('+items.length+')';
    if(items.length===0){
      el.innerHTML='<table><tr><td style="color:#8b949e">No ECR declines recorded</td></tr></table>';
      return;
    }
    el.innerHTML='<table><tr><th>Time</th><th>Location</th><th>Terminal</th><th>Reason</th></tr>'+
      items.map(function(e){
        return '<tr style="background:#1a1200">'+
          '<td>'+e.ts+'</td>'+
          '<td style="color:#f85149">'+e.point+'</td>'+
          '<td style="font-family:monospace;font-size:11px">'+e.terminal+'</td>'+
          '<td style="color:#e3b341">'+e.action+'</td>'+
          '</tr>';
      }).join('')+'</table>';
  }catch(e){}
}

async function loadPendingCaptures(){
  try{
    const r=await fetch('/admin/pending-captures');
    const items=await r.json();
    const el=document.getElementById('pendingCaptureDiv');
    const cnt=document.getElementById('pendingCaptureCount');
    if(!el) return;
    const pending=items.filter(i=>i.status!=='RESOLVED');
    cnt.textContent='('+pending.length+' active)';
    if(items.length===0){
      el.innerHTML='<table><tr><td style="color:#8b949e">No pending captures</td></tr></table>';
      return;
    }
    const statusColor={'PENDING':'#e3b341','FAILED':'#f85149','RESOLVED':'#3fb950'};
    el.innerHTML='<table><tr><th>ID</th><th>Time</th><th>Card</th><th>Amount</th><th>Retries</th><th>Status</th><th>Last Error</th><th>Actions</th></tr>'+
      items.map(function(p){
        var sc=statusColor[p.status]||'#8b949e';
        var retryBtn=p.status!=='RESOLVED'?'<button class="btn orange" style="font-size:11px" onclick="retryCapture(this.dataset.id)" data-id="'+p.id+'">Retry</button>':'';
        var deleteBtn='<button class="btn red" style="font-size:11px;margin-left:4px" onclick="deleteCapture(this.dataset.id)" data-id="'+p.id+'">Remove</button>';
        var tok=p.entry&&p.entry.tokenCode?'<br><small style="color:#8b949e">'+p.entry.tokenCode+'</small>':'';
        return '<tr style="background:'+(p.status==='RESOLVED'?'#0d2010':p.status==='FAILED'?'#2a0d0d':'#1a1200')+'">'+
          '<td style="font-family:monospace;font-size:11px">'+p.id+'</td>'+
          '<td style="font-size:11px">'+p.createdAt+'</td>'+
          '<td style="font-family:monospace">****'+(p.entry&&p.entry.lastDigits||'????')+tok+'</td>'+
          '<td style="color:#3fb950">EUR '+(p.amountCents/100).toFixed(2)+'</td>'+
          '<td>'+p.retries+'</td>'+
          '<td style="color:'+sc+';font-weight:bold">'+p.status+'</td>'+
          '<td style="font-size:11px;color:#f85149">'+(p.lastError||'-')+'</td>'+
          '<td>'+retryBtn+deleteBtn+'</td>'+
          '</tr>';
      }).join('')+'</table>';
  }catch(e){}
}

async function retryCapture(el){
  var id=el.dataset?el.dataset.id:el;
  const r=await fetch('/admin/retry-capture/'+id,{method:'POST'});
  const d=await r.json();
  if(d.ok) alert('Retry result: '+d.status+(d.lastError?' - '+d.lastError:''));
  else alert('Error: '+d.error);
  loadPendingCaptures();
}

async function deleteCapture(el){
  var id=el.dataset?el.dataset.id:el;
  if(!confirm('Remove this pending capture record?')) return;
  await fetch('/admin/pending-captures/'+id,{method:'DELETE'});
  loadPendingCaptures();
}

async function loadActiveEntries(){
  try{
    const r=await fetch('/admin/entries');
    const entries=await r.json();
    const el=document.getElementById('activeEntriesDiv');
    const cnt=document.getElementById('activeEntriesCount');
    if(!el) return;
    cnt.textContent='('+entries.length+')';
    if(entries.length===0){
      el.innerHTML='<table><tr><td colspan="5" style="color:#8b949e">No active entries</td></tr></table>';
      return;
    }
    const now=Date.now();
    el.innerHTML='<table><tr><th>Type</th><th>Last4</th><th>Auth/Card</th><th>Entry Time</th><th>Duration</th></tr>'+
      entries.map(function(e){
        const mins=Math.floor((now-(e.entryTime||now))/60000);
        const dur=mins+'m';
        const bg=e.inputType==='Monthly Card'?'#0d2010':'#0a1628';
        return '<tr style="background:'+bg+'">'+
          '<td style="color:'+(e.inputType==='Monthly Card'?'#3fb950':'#58a6ff')+'">'+( e.inputType||'Bank Card')+'</td>'+
          '<td>*'+( e.lastDigits||'')+'</td>'+
          '<td style="font-family:monospace;font-size:11px">'+(e.authCode||e.lastDigits||'')+'</td>'+
          '<td>'+(e.timeOfInput||'').substring(8,14)+'</td>'+
          '<td>'+dur+'</td>'+
          '</tr>';
      }).join('')+'</table>';
  }catch(e){}
}

async function loadTellStatus(){
  try{
    const r=await fetch('/admin/tell-status');
    const d=await r.json();
    const el=document.getElementById('tellStatusDiv');
    const te=document.getElementById('tellStatusTime');
    if(!el) return;
    te.textContent=new Date().toLocaleTimeString();
    if(!d.available){
      el.innerHTML='<span style="color:#8b949e">TELL not configured or unavailable: '+( d.reason||'')+'</span>';
      return;
    }
    const s=d.status||{};
    const in1Color=s.in1===1?'#E65100':'#238636';
    const in1Text=s.in1===1?'🟠 Car Present':'🟢 No Car';
    const in2Color=s.in2===1?'#E65100':'#238636';
    const in2Text=s.in2===1?'🟠 Car Present':'🟢 No Car';
    const barrierColor=s.in4!==0?'#C62828':'#238636';
    const barrierText=s.in4!==0?'🔴 Barrier OPEN':'🟢 Barrier Closed';
    const out1Color=s.out1===1?'#1F6FEB':'#30363d';
    el.innerHTML=
      '<div style="background:#161b22;border-radius:8px;padding:10px 14px;border:1px solid '+in1Color+'">'+
        '<div style="font-size:11px;color:#8b949e">IN1 - Entrance</div>'+
        '<div style="font-size:14px;font-weight:500;color:'+in1Color+'">'+in1Text+'</div>'+
      '</div>'+
      '<div style="background:#161b22;border-radius:8px;padding:10px 14px;border:1px solid '+in2Color+'">'+
        '<div style="font-size:11px;color:#8b949e">IN2 - Exit</div>'+
        '<div style="font-size:14px;font-weight:500;color:'+in2Color+'">'+in2Text+'</div>'+
      '</div>'+
      '<div style="background:#161b22;border-radius:8px;padding:10px 14px;border:1px solid '+barrierColor+'">'+
        '<div style="font-size:11px;color:#8b949e">IN4 - Barrier</div>'+
        '<div style="font-size:14px;font-weight:500;color:'+barrierColor+'">'+barrierText+'</div>'+
      '</div>'+
      '<div style="background:#161b22;border-radius:8px;padding:10px 14px;border:1px solid '+out1Color+'">'+
        '<div style="font-size:11px;color:#8b949e">OUT1 - Relay</div>'+
        '<div style="font-size:14px;font-weight:500;color:'+out1Color+'">'+(s.out1===1?'🔵 Active':'⚪ Idle')+'</div>'+
      '</div>'+
      '<div style="background:#161b22;border-radius:8px;padding:10px 14px;border:1px solid #30363d">'+
        '<div style="font-size:11px;color:#8b949e">Ping / IP</div>'+
        '<div style="font-size:13px;color:#c9d1d9">'+(d.pingMs||'?')+'ms</div>'+
        '<div style="font-size:11px;color:#8b949e">'+(d.lastIp||'')+'</div>'+
      '</div>';
  }catch(e){}
}

async function loadJccLogs(){
  try{
    const r=await fetch('/jcc/logs');
    const logs=await r.json();
    const el=document.getElementById('jccLogDiv');
    const cnt=document.getElementById('jccLogCount');
    if(!el) return;
    cnt.textContent='('+logs.length+' entries)';
    if(logs.length===0){
      el.innerHTML='<table><tr><td style="color:#8b949e">No JCC calls yet</td></tr></table>';
      return;
    }

    // Field labels for each JCC call type
    var reqLabels={
      amount:'Amount (cents)', currency:'Currency', originalRef:'Original Ref',
      authID:'Auth ID', messageNo:'Message No', messageType:'Message Type',
      dateTime:'DateTime', merchantNo:'Merchant No', stationID:'Station ID',
      tokenCode:'Token Code', maskedPAN:'Masked PAN', cardExpiry:'Card Expiry',
      cardType:'Card Type', invoiceNo:'Invoice No', reasonCode:'Reason Code',
      userID:'User ID', posSoftware:'POS Software', merchantType:'Merchant Type',
      surchargeAmount:'Surcharge', citIndicator:'CIT Indicator', ippiVersion:'IPPI Version'
    };
    var resLabels={
      responseCode:'Response Code', responseText:'Response Text',
      messageNo:'Message No', messageType:'Message Type',
      mid:'MID', tid:'TID', authID:'Auth ID',
      retrievalRef:'Retrieval Ref', receiptString:'Receipt',
      citIndicator:'CIT Indicator'
    };

    var typeColor={'topup':'#e3b341','capture':'#3fb950','release':'#58a6ff',
                   'topup-response':'#7a5c00','capture-response':'#1a5c1a','release-response':'#1a3a5c'};

    el.innerHTML=logs.slice(0,50).map(function(l,idx){
      var isResp=l.endpoint.includes('-response');
      var baseType=l.endpoint.replace('-response','');
      var col=typeColor[l.endpoint]||'#8b949e';
      var hmacCol=l.hmacValid?'#3fb950':'#f85149';
      var hmacTxt=l.hmacValid?'HMAC OK':'HMAC FAIL';
      var rc=(l.response&&l.response.responseCode)||'';
      var rcCol=rc==='00'?'#3fb950':rc?'#f85149':'#8b949e';
      var rt=(l.response&&(l.response.responseText||l.response.responseDescription))||'';

      // Build request fields table
      var reqFields='';
      if(l.request && !isResp){
        reqFields='<table style="width:100%;font-size:11px;margin:4px 0">';
        Object.keys(l.request).forEach(function(k){
          var v=l.request[k];
          if(v===undefined||v===null||v==='') return;
          var label=reqLabels[k]||k;
          var valCol='#c9d1d9';
          if(k==='tokenCode') valCol='#e3b341';
          if(k==='maskedPAN') valCol='#58a6ff';
          if(k==='amount') valCol='#3fb950';
          if(k==='authID'||k==='originalRef') valCol='#d2a8ff';
          reqFields+='<tr><td style="color:#8b949e;width:140px;padding:1px 6px">'+label+'</td>'+
            '<td style="font-family:monospace;color:'+valCol+';padding:1px 6px">'+v+'</td></tr>';
        });
        reqFields+='</table>';
      }

      // Build response fields table
      var resFields='';
      if(l.response && Object.keys(l.response).length>0){
        resFields='<table style="width:100%;font-size:11px;margin:4px 0">';
        Object.keys(l.response).forEach(function(k){
          var v=l.response[k];
          if(v===undefined||v===null||v==='') return;
          var label=resLabels[k]||k;
          var valCol='#c9d1d9';
          if(k==='responseCode') valCol=rc==='00'?'#3fb950':'#f85149';
          if(k==='responseText') valCol=rc==='00'?'#3fb950':'#f85149';
          if(k==='authID') valCol='#d2a8ff';
          if(k==='retrievalRef') valCol='#e3b341';
          resFields+='<tr><td style="color:#8b949e;width:140px;padding:1px 6px">'+label+'</td>'+
            '<td style="font-family:monospace;color:'+valCol+';padding:1px 6px">'+v+'</td></tr>';
        });
        resFields+='</table>';
      }

      var bg=isResp?(rc==='00'?'#0d1e0d':'#1e0d0d'):'#0d1117';
      var border=isResp?'border-left:3px solid '+(rc==='00'?'#3fb950':'#f85149'):'border-left:3px solid '+col;

      return '<div style="'+border+';background:'+bg+';margin-bottom:4px;padding:8px 12px;border-radius:4px">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'+
          '<span style="color:'+col+';font-weight:bold;font-size:13px">'+l.endpoint.toUpperCase()+'</span>'+
          '<span style="display:flex;gap:12px;font-size:11px">'+
            '<span style="color:'+hmacCol+'">'+hmacTxt+'</span>'+
            (rc?'<span style="color:'+rcCol+';font-weight:bold">RC: '+rc+' '+rt+'</span>':'')+
            '<span style="color:#8b949e">'+l.time.substring(11,19)+'</span>'+
          '</span>'+
        '</div>'+
        (reqFields?'<div style="color:#8b949e;font-size:11px;margin-bottom:2px">REQUEST</div>'+reqFields:'')+
        (resFields?'<div style="color:#8b949e;font-size:11px;margin-bottom:2px;margin-top:4px">RESPONSE</div>'+resFields:'')+
      '</div>';
    }).join('');
  }catch(e){ console.error('loadJccLogs error',e); }
}

async function loadJccTransaction(){
  try{
    const r=await fetch('/jcc/transaction');
    const d=await r.json();
    const el=document.getElementById('jccActiveTx');
    if(!el) return;
    if(d.activeTransaction){
      el.innerHTML='<pre style="color:#4caf50;font-size:11px">'+JSON.stringify(d.activeTransaction,null,2)+'</pre>';
    } else {
      el.innerHTML='<span style="color:#888">No active transaction</span>';
    }
  }catch(e){}
}

async function clearJccTransaction(){
  await fetch('/jcc/transaction',{method:'DELETE'});
  loadJccTransaction();
}

async function runEndOfDayCapture(){
  const el=document.getElementById('eodStatus');
  el.textContent='Running end of day capture...';
  try{
    const r=await fetch('/admin/eod-capture',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const d=await r.json();
    el.textContent='OK EOD Capture done - '+d.processed+' entries processed. '+d.results;
  }catch(e){el.textContent='✗ Error: '+e.message;}
}

async function saveJccConfig(){
  const body = {
    topupAppId:    document.getElementById('topupAppId').value.trim(),
    topupApiKey:   document.getElementById('topupApiKey').value.trim(),
    captureAppId:  document.getElementById('captureAppId').value.trim(),
    captureApiKey: document.getElementById('captureApiKey').value.trim(),
    releaseAppId:  document.getElementById('releaseAppId').value.trim(),
    releaseApiKey: document.getElementById('releaseApiKey').value.trim(),
    validateHmac:  document.getElementById('jccValidate').checked
  };
  const r=await fetch('/jcc/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const d=await r.json();
  if(d.ok) alert('JCC config saved');
}

loadLogs();setInterval(loadLogs,3000);
loadJccLogs();setInterval(loadJccLogs,3000);
loadJccTransaction();setInterval(loadJccTransaction,3000);
loadActiveEntries();setInterval(loadActiveEntries,5000);
loadTellStatus();setInterval(loadTellStatus,5000);
loadRejections();setInterval(loadRejections,5000);
loadEcrDeclines();setInterval(loadEcrDeclines,5000);
loadPendingCaptures();setInterval(loadPendingCaptures,10000);
</script></body></html>`);
});

// ── POST /parkingInit ─────────────────────────────────────────────────────────
app.post("/parkingInit", (req, res) => {
  // Track app version for dashboard display
  const versionName = req.body.versionName || "";
  const versionNumber = req.body.versionNumber || "";
  if (versionName) {
    config.lastAppVersionName   = versionName;
    config.lastAppVersionNumber = versionNumber;
    console.log(`[parkingInit] App version: ${versionName} (${versionNumber})`);
  }

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

  const charges = config.charges;

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
    monthlyCardsBins:                config.monthlyEnabled ? config.monthlyCardsBins : "",
    controller:                      config.tellEnabled ? "A" : "0",
    fixAmountSolution:               String(config.fixAmountSolution),
    charges,
    // TELL credentials — only included when TELL is enabled
    // App uses these to poll getStatus directly for vehicle detection
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
    voiceAssistant:                  config.voiceAssistant ? "1" : "0",  // "1"=enabled, "0"=silent
    defaultLanguage:                 config.defaultLanguage               // "EN","EL","RU","IW"
  };
  // Auto-reset flagsForAction to "0000" after sending — prevents loop on next keep-alive
  if (config.flagsForAction !== "0000") {
    console.log(`[parkingInit] flagsForAction=${config.flagsForAction} sent → auto-reset to 0000`);
    config.flagsForAction = "0000";
  }
  addLog(req, response); res.json(response);
});

// ── POST /entranceCall ────────────────────────────────────────────────────────
app.post("/entranceCall", async (req, res) => {
  const { token, lastDigits, authCode, timeOfInput, tokenCode,
          receiptNumber, referenceNo, preAuthAmount, expiryDate,
          outlet, terminal, inputType } = req.body;

  // Validate monthly card against allowed list
  if (inputType === "Monthly Card" && config.monthlyEnabled && config.monthlyCardsBins) {
    const allowedCards = config.monthlyCardsBins.split(";").map(c => c.trim()).filter(Boolean);
    const cardNumber = req.body.lastDigits || "";
    if (allowedCards.length > 0 && !allowedCards.includes(cardNumber)) {
      const response = {
        outlet: outlet || config.entranceOutlet, terminal: terminal || config.entranceTerminal,
        installationPoint: "Entrance",
        displayMessage: "Monthly card not recognised. Please contact staff.",
        timeToDisplayMessage: "8", responseCode: "56",
        responseDescription: "Monthly card not in allowed list"
      };
      console.log(`[entranceCall] BLOCKED — Monthly card ${cardNumber} not in list`);
      addRejection("Not in allowed list", "Monthly Card", cardNumber, "56");
      addLog(req, response); return res.json(response);
    }
  }
  // Monthly: match by token (same card = same token)
  // Bank card: match by lastDigits + expiryDate
  if (token && activeEntries[token] && inputType === "Monthly Card") {
    const existing = activeEntries[token];
    const entryTime = new Date(existing.entryTime).toISOString().substring(11,19);
    const response = {
      outlet: outlet || config.entranceOutlet, terminal: terminal || config.entranceTerminal,
      installationPoint: "Entrance",
      displayMessage: `This card is already inside since ${entryTime}. Please exit first.`,
      timeToDisplayMessage: "8", responseCode: "41",
      responseDescription: "Card already inside — exit required"
    };
    console.log(`[entranceCall] BLOCKED monthly — already inside since ${entryTime}`);
    addRejection("Already inside since "+entryTime, "Monthly Card", existing.lastDigits, "41");
    addLog(req, response); return res.json(response);
  }

  if (inputType === "Bank Card") {
    const { lastDigits: ld, expiryDate: exp } = req.body;
    const duplicate = Object.values(activeEntries).find(e =>
      e.lastDigits === ld && e.expiryDate === exp && e.inputType === "Bank Card"
    );
    if (duplicate) {
      const entryTime = new Date(duplicate.entryTime).toISOString().substring(11,19);
      const response = {
        outlet: outlet || config.entranceOutlet, terminal: terminal || config.entranceTerminal,
        installationPoint: "Entrance",
        displayMessage: `This card is already inside since ${entryTime}. Please exit first.`,
        timeToDisplayMessage: "8", responseCode: "41",
        responseDescription: "Card already inside — exit required"
      };
      console.log(`[entranceCall] BLOCKED bank card *${ld} — already inside since ${entryTime}`);
      addRejection("Already inside since "+entryTime, "Bank Card", "*"+ld, "41");
      addLog(req, response); return res.json(response);
    }
  }

  if (token) {
    activeEntries[token] = {
      token, lastDigits, authCode, timeOfInput,
      tokenCode:          tokenCode || token,
      receiptNumber:      receiptNumber || "",
      originalRefNum:     referenceNo   || receiptNumber || "",
      preAuthAmountCents: parseInt(preAuthAmount || config.minimumAmountPreAuth || 300),
      expiryDate:         expiryDate || "0000",
      outlet:             outlet     || config.entranceOutlet,
      terminal:           terminal   || config.entranceTerminal,
      inputType:          inputType  || "Bank Card",
      entryTime:          Date.now()
    };
    if (inputType === "Monthly Card") {
      config.availablePlaceMonthly = Math.max(0, config.availablePlaceMonthly - 1);
    } else {
      config.availablePlacesNormal = Math.max(0, config.availablePlacesNormal - 1);
    }
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

function releaseSpace(entry) {
  if (entry && entry.inputType === "Monthly Card") {
    config.availablePlaceMonthly = Math.min(config.availablePlaceMonthly + 1, 99);
  } else {
    config.availablePlacesNormal = Math.min(config.availablePlacesNormal + 1, 99);
  }
}

// ── Barrier open with 3 retries ───────────────────────────────────────────────
async function openBarrierWithRetry(maxRetries = 3, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (config.tellEnabled && config.tellHwId && config.tellAppId) {
        const ok = await tellOpenBarrier();
        if (ok) { console.log(`[BARRIER] Opened on attempt ${attempt}`); return "tell-ok"; }
        console.warn(`[BARRIER] Attempt ${attempt} failed`);
      } else {
        return "mock-ok";  // mock always succeeds
      }
    } catch(e) {
      console.error(`[BARRIER] Attempt ${attempt} error: ${e.message}`);
    }
    if (attempt < maxRetries) await new Promise(r => setTimeout(r, delayMs));
  }
  console.error("[BARRIER] All retries failed — calling staff");
  return "failed";
}

// ── Fee calculation from entry time and charges table ─────────────────────────
function calculateFee(entryTime) {
  if (!entryTime) return config.minimumAmountPreAuth || 300;
  const mins = Math.floor((Date.now() - entryTime) / 60000);
  const charges = config.charges || [];
  for (const c of charges) {
    const from = parseInt(c.from);
    const to   = c.to ? parseInt(c.to) : Infinity;
    if (mins >= from && mins < to) return parseInt(c.fee);
  }
  // Below first threshold — free
  return 0;
}

// ── POST /exitCall ────────────────────────────────────────────────────────────
app.post("/exitCall", async (req, res) => {
  const { token } = req.body;
  const entry = token ? activeEntries[token] : null;

  const feeCents     = entry ? calculateFee(entry.entryTime) : 0;
  const preAuthCents = entry ? (entry.preAuthAmountCents || config.minimumAmountPreAuth || 300) : 0;

  function staffResponse(msg) {
    return { barrierOpen:"0", moneyToPay:"0",
      displayMessage: msg || "Technical issue. Please contact staff.",
      timeToDisplayMessage:"10", responseCode:"08",
      responseDescription:"Barrier failed — staff called" };
  }

  let response;
  switch(config.exitScenario) {

    // ── Scenario 1: FREE ──────────────────────────────────────────────────────
    // Release pre-auth, open barrier, no charge
    case 1: {
      if (!entry) { response = staffResponse("Entry not found."); break; }
      try { await jccRelease(entry); } catch(e) { console.error("[JCC RELEASE]", e.message); }
      delete activeEntries[token];
      releaseSpace(entry);
      const b1 = await openBarrierWithRetry();
      response = b1 === "failed"
        ? staffResponse("Technical issue. Please contact staff.")
        : { barrierOpen:"1", moneyToPay:"0",
            displayMessage:"Thank you! Have a nice day.", timeToDisplayMessage:"5",
            responseCode:"00", responseDescription:"Successful Response" };
      break;
    }

    // ── Scenario 2: CAPTURE ───────────────────────────────────────────────────
    // Capture the calculated fee (must be <= preAuth), open barrier
    case 2: {
      if (!entry) { response = staffResponse("Entry not found."); break; }
      const captureAmt = feeCents > 0 ? feeCents : preAuthCents;
      let captureResult2 = null;
      try { captureResult2 = await jccCapture(entry, captureAmt); } catch(e) { console.error("[JCC CAPTURE]", e.message); }
      const captureOk2 = captureResult2 && captureResult2.responseCode === "00";
      if (!captureOk2) {
        // Capture declined — open barrier anyway, store for retry
        console.log(`[JCC] Capture declined (${captureResult2?.responseCode}) — storing for retry`);
        addPendingCapture(entry, captureAmt);
      }
      delete activeEntries[token];
      releaseSpace(entry);
      const b2 = await openBarrierWithRetry();
      response = b2 === "failed"
        ? staffResponse("Technical issue. Please contact staff.")
        : { barrierOpen:"1", moneyToPay:String(captureAmt),
            displayMessage: captureOk2
              ? `Thank you! Charged €${(captureAmt/100).toFixed(2)}.`
              : `Thank you! Charged €${(captureAmt/100).toFixed(2)}. (Payment pending)`,
            timeToDisplayMessage:"5", responseCode:"00",
            responseDescription:"Successful Response" };
      break;
    }

    // ── Scenario 3: TOPUP APPROVED ────────────────────────────────────────────
    // TopUp succeeds → Capture full fee → open barrier
    // If TopUp is declined by JCC → fall back to Scenario 4 behaviour (release + barrierOpen:"-2")
    case 3: {
      if (!entry) { response = staffResponse("Entry not found."); break; }
      const totalFee3 = feeCents > 0 ? feeCents : (config.topupAmount || 500);
      const topupAmt3 = Math.max(0, totalFee3 - preAuthCents);
      let topupResult3 = null;
      try { topupResult3 = await jccTopup(entry, topupAmt3); } catch(e) { console.error("[JCC TOPUP]", e.message); }

      const topupApproved = topupResult3 && topupResult3.responseCode === "00";
      console.log(`[JCC] topup result: ${topupResult3?.responseCode} ${topupResult3?.responseText} → ${topupApproved ? "APPROVED" : "DECLINED"}`);

      if (topupApproved) {
        // TopUp approved → Capture full fee → open barrier
        let captureResult3 = null;
        try { captureResult3 = await jccCapture(entry, totalFee3); } catch(e) { console.error("[JCC CAPTURE]", e.message); }
        const captureOk3 = captureResult3 && captureResult3.responseCode === "00";
        if (!captureOk3) {
          console.log(`[JCC] Capture declined after TopUp (${captureResult3?.responseCode}) — storing for retry`);
          addPendingCapture(entry, totalFee3);
        }
        delete activeEntries[token];
        releaseSpace(entry);
        const b3 = await openBarrierWithRetry();
        response = b3 === "failed"
          ? staffResponse(`Payment €${(totalFee3/100).toFixed(2)} processed. Barrier failed — staff called.`)
          : { barrierOpen:"1", moneyToPay:String(totalFee3),
              displayMessage: captureOk3
                ? `Thank you! Total €${(totalFee3/100).toFixed(2)}.`
                : `Thank you! Total €${(totalFee3/100).toFixed(2)}. (Payment pending)`,
              timeToDisplayMessage:"5", responseCode:"00",
              responseDescription:"Successful Response" };
      } else {
        // TopUp declined by JCC → Release pre-auth → ask app for full SALE
        console.log("[JCC] TopUp declined — falling back to full SALE flow");
        if (!entry.recordId) entry.recordId = require("crypto").randomBytes(16).toString("hex").toUpperCase();
        try { await jccRelease(entry); } catch(e) { console.error("[JCC RELEASE]", e.message); }
        // Do NOT delete entry — app needs it alive to send exitPayment
        response = { barrierOpen:"-2", moneyToPay:String(totalFee3),
          recordId: entry.recordId,
          displayMessage:`Card declined. Please tap card for full €${(totalFee3/100).toFixed(2)}.`,
          timeToDisplayMessage:"10", responseCode:"31",
          responseDescription:"TopUp declined — full SALE required" };
      }
      break;
    }

    // ── Scenario 4: TOPUP DECLINED ────────────────────────────────────────────
    // TopUp declined → Release pre-auth → ask app for full SALE (barrierOpen:"-2")
    case 4: {
      if (!entry) { response = staffResponse("Entry not found."); break; }
      const totalFee4 = feeCents > 0 ? feeCents : (config.topupAmount || 500);
      // Generate recordId once and store it on the entry so it is stable across retries
      if (!entry.recordId) entry.recordId = require("crypto").randomBytes(16).toString("hex").toUpperCase();
      try { await jccRelease(entry); } catch(e) { console.error("[JCC RELEASE]", e.message); }
      // Do NOT delete entry — app needs it alive to send exitPayment
      response = { barrierOpen:"-2", moneyToPay:String(totalFee4),
        recordId: entry.recordId,
        displayMessage:`Card declined. Please tap card for full €${(totalFee4/100).toFixed(2)}.`,
        timeToDisplayMessage:"10", responseCode:"31",
        responseDescription:"TopUp declined — full SALE required" };
      break;
    }

    // ── Scenario 5: BARRIER FAILED ────────────────────────────────────────────
    case 5: default:
      response = staffResponse("Technical issue. Please contact staff.");
      break;
  }
  addLog(req, response); res.json(response);
});

// ── POST /exitPayment ─────────────────────────────────────────────────────────
app.post("/exitPayment", async (req, res) => {
  const { token } = req.body;
  const exitEntry = token ? activeEntries[token] : null;
  if (token) delete activeEntries[token];
  if (exitEntry) releaseSpace(exitEntry);
  const b = await openBarrierWithRetry();
  let response;
  if (b === "failed") {
    response = { barrierOpen:"0",
      displayMessage:"Payment processed. Barrier failed - staff called.",
      timeToDisplayMessage:"10", responseCode:"08",
      responseDescription:"Barrier failed after SALE" };
  } else {
    response = { barrierOpen:"1",
      displayMessage:"Payment successful. Barrier is open.",
      timeToDisplayMessage:"5", responseCode:"00",
      responseDescription:"Successful Response", _barrier:b };
  }
  addLog(req, response); res.json(response);
});

app.post("/vehiclePresent", async (req, res) => {
  let detected = config.vehiclePresent;
  if (config.tellEnabled && config.tellHwId && config.tellAppId) {
    const mode = detectMode(req.body);
    const vehicleInput = mode === "Exit" ? config.tellVehicleInputExit : config.tellVehicleInputEntrance;
    try {
      detected = await tellCheckVehicle(vehicleInput);
      console.log(`TELL ${vehicleInput} = ${detected}`);
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
  const action = req.body.action || "";
  const isManualHelp = action === "Help Button";
  const isEcrDecline = action.toLowerCase().includes("ecr decline") || action.toLowerCase().includes("ecr_decline");

  if (isManualHelp) {
    // Only send email for manual Help button press
    Promise.race([
      sendHelpAlert(req),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000))
    ]).catch(e => console.error("[EMAIL] Alert error:", e.message));
  } else if (isEcrDecline) {
    // Store ECR decline silently — no email
    addEcrDecline(
      req.body.outlet           || "?",
      req.body.terminal         || "?",
      req.body.intallationPoint || "?",
      action
    );
    console.log(`[ECR_DECLINE] ${req.body.intallationPoint || "?"} — ${action}`);
  }

  const response = {
    outlet:               req.body.outlet   || config.entranceOutlet,
    terminal:             req.body.terminal || config.entranceTerminal,
    installationPoint:    req.body.intallationPoint || "",
    daytime:              ts(),
    displayMessage:       config.helpMessage,
    timeToDisplayMessage: config.helpDisplayTime,
    availablePlacesNormal: String(config.availablePlacesNormal),
    availablePlaceMonthly: String(config.availablePlaceMonthly),
    responseCode:         "00",
    responseDescription:  "Successful Response"
  };
  addLog(req, response); res.json(response);
});

// ═══════════════════════════════════════════════════════════════════════════════
// JCC IPPI Financial Services API  (mirroring test-apis.jccsecure.com)
// Base path: /financialservices/v1/ippi
// Auth: HMAC as per JCC spec (Authorization: hmacauth appId:sig:nonce:ts)
// One active transaction stored in memory — cleared per transaction
// ═══════════════════════════════════════════════════════════════════════════════

const crypto = require("crypto");

// ── HMAC credentials per endpoint ─────────────────────────────────────────────
let jccConfig = {
  topup:   { appId: "1cbb351c501647ef8f855335d2017dbc", apiKey: "CbGMgGAnQp1Hk+qeXSqjOsiRcN4P54skp32VWOav+ti=" },
  capture: { appId: "c677c1ba0bc349cfb04e2d10d67763f6", apiKey: "jzHup+gUjZo4XDKm54DtoIE9oK51THQ+Vp1AStzIfvI=" },
  release: { appId: "df4124bcd39a42ffb1b375c8d7af4bf8", apiKey: "a6t7zeZ9l+QqwZh9cQyQjCzqIFzwbWtCp62LijGe76L=" },
  void:    { appId: "1cbb351c501647ef8f855335d2017dbc", apiKey: "CbGMgGAnQp1Hk+qeXSqjOsiRcN4P54skp32VWOav+ti=" },
  reversal:{ appId: "1cbb351c501647ef8f855335d2017dbc", apiKey: "CbGMgGAnQp1Hk+qeXSqjOsiRcN4P54skp32VWOav+ti=" },
  validateHmac: false
};

// ── In-memory transaction store (one at a time) ───────────────────────────────
let activeTransaction = null;
let jccLogs = [];

function addJccLog(endpoint, req, res, hmacValid) {
  const entry = {
    time:      new Date().toISOString(),
    endpoint,
    hmacValid,
    request:   req,
    response:  res || {}
  };
  jccLogs.unshift(entry);
  if (jccLogs.length > 100) jccLogs.pop();
  console.log(`[JCC] ${endpoint} | HMAC:${hmacValid} | res=${JSON.stringify(res).substring(0,80)}`);
}

// ── HMAC Validation ───────────────────────────────────────────────────────────
function validateHmac(req) {
  try {
    const auth = req.headers["authorization"] || "";
    if (!auth.startsWith("hmacauth ")) return { valid: false, reason: "Missing hmacauth prefix" };
    const parts = auth.substring(9).split(":");
    if (parts.length < 4) return { valid: false, reason: "Invalid auth format" };
    const [appId, signature, nonce, timestamp] = parts;
    const now = Date.now();
    const ts  = parseInt(timestamp);
    // Support both seconds (JCC spec) and milliseconds (Postman)
    const tsMs = ts < 10000000000 ? ts * 1000 : ts;
    if (Math.abs(now - tsMs) > 300000) return { valid: false, reason: `Timestamp too old` };
    const bodyStr  = JSON.stringify(req.body);
    const bodyHash = crypto.createHash("sha256").update(bodyStr).digest("base64");
    const fullUrl  = `https://parking-mock-server.onrender.com${req.path}`;
    const encodedUrl = encodeURIComponent(fullUrl).toLowerCase();
    // Find matching credentials by appId
    const creds = Object.values(jccConfig).find(c => c && c.appId === appId);
    if (!creds) return { valid: false, reason: `Unknown appId: ${appId}` };
    const sigRaw  = appId + req.method.toUpperCase() + encodedUrl + timestamp + nonce + bodyHash;
    const keyBytes = Buffer.from(creds.apiKey, "base64");
    const computed = crypto.createHmac("sha256", keyBytes)
                           .update(Buffer.from(sigRaw, "utf8"))
                           .digest("base64");
    const valid = computed === signature;
    return { valid, reason: valid ? "OK" : `Sig mismatch` };
  } catch(e) {
    return { valid: false, reason: e.message };
  }
}

function jccAuth(req, res, next) {
  const check = validateHmac(req);
  req.hmacValid = check.valid;
  req.hmacReason = check.reason;
  if (jccConfig.validateHmac && !check.valid) {
    const r = { responseCode: "401", responseDescription: `HMAC validation failed: ${check.reason}` };
    addJccLog(req.path, req.body, r, false);
    return res.status(401).json(r);
  }
  next();
}

// ── Standard JCC success response ─────────────────────────────────────────────
function jccOk(extra = {}) {
  return { responseCode: "00", responseDescription: "Successful Response", ...extra };
}

function jccErr(code, desc) {
  return { responseCode: code, responseDescription: desc };
}

// ── POST /financialservices/v1/ippi/auth/topup ────────────────────────────────
app.post("/financialservices/v1/ippi/auth/topup", jccAuth, (req, res) => {
  const b = req.body;
  const response = jccOk({
    messageType:    "topup",
    messageNo:      b.messageNo,
    originalRef:    b.originalRef,
    authID:         b.authID,
    amount:         b.amount,
    currency:       b.currency,
    tokenCode:      b.tokenCode,
    dateTime:       jccDateTime()
  });
  // Store as active transaction
  activeTransaction = { type: "topup", ...b, processedAt: new Date().toISOString() };
  addJccLog("topup", b, response, req.hmacValid);
  res.json(response);
});

// ── POST /financialservices/v1/ippi/auth/capture ──────────────────────────────
app.post("/financialservices/v1/ippi/auth/capture", jccAuth, (req, res) => {
  const b = req.body;
  const response = jccOk({
    messageType:    "capture",
    messageNo:      b.messageNo,
    originalRef:    b.originalRef,
    authID:         b.authID,
    amount:         b.amount,
    currency:       b.currency,
    tokenCode:      b.tokenCode,
    dateTime:       jccDateTime()
  });
  activeTransaction = { type: "capture", ...b, processedAt: new Date().toISOString() };
  addJccLog("capture", b, response, req.hmacValid);
  res.json(response);
});

// ── POST /financialservices/v1/ippi/auth/release (PreAuthorisationRelease) ────
app.post("/financialservices/v1/ippi/auth/release", jccAuth, (req, res) => {
  const b = req.body;
  const response = jccOk({
    messageType:    "release",
    messageNo:      b.messageNo,
    originalRef:    b.originalRef,
    authID:         b.authID,
    amount:         b.amount,
    currency:       b.currency,
    tokenCode:      b.tokenCode,
    dateTime:       jccDateTime()
  });
  activeTransaction = null;  // release clears the transaction
  addJccLog("release", b, response, req.hmacValid);
  res.json(response);
});

// ── POST /financialservices/v1/ippi/void ─────────────────────────────────────
app.post("/financialservices/v1/ippi/void", jccAuth, (req, res) => {
  const b = req.body;
  const response = jccOk({
    messageType:    "void",
    messageNo:      b.messageNo,
    originalRef:    b.originalRef,
    originalAmount: b.originalAmount,
    currency:       b.currency,
    tokenCode:      b.tokenCode,
    dateTime:       jccDateTime()
  });
  activeTransaction = null;  // void clears the transaction
  addJccLog("void", b, response, req.hmacValid);
  res.json(response);
});

// ── POST /financialservices/v1/ippi/reversal ──────────────────────────────────
app.post("/financialservices/v1/ippi/reversal", jccAuth, (req, res) => {
  const b = req.body;
  const response = jccOk({
    messageType:         "reversal",
    messageNo:           b.messageNo,
    originalMessageNo:   b.originalMessageNo,
    originalType:        b.originalType,
    amount:              b.amount,
    currency:            b.currency,
    dateTime:            jccDateTime()
  });
  activeTransaction = null;
  addJccLog("reversal", b, response, req.hmacValid);
  res.json(response);
});

// ── GET /jcc/transaction ── current active transaction ────────────────────────
app.get("/jcc/transaction", (req, res) => {
  res.json({ activeTransaction });
});

// ── DELETE /jcc/transaction ── clear active transaction ───────────────────────
app.delete("/jcc/transaction", (req, res) => {
  activeTransaction = null;
  res.json({ cleared: true });
});

// ── GET /jcc/logs ── JCC transaction logs ─────────────────────────────────────
app.get("/jcc/logs", (req, res) => {
  res.json(jccLogs);
});

// ── GET /jcc/config ── get JCC HMAC config ───────────────────────────────────
app.get("/jcc/config", (req, res) => {
  res.json({ appId: jccConfig.appId, validateHmac: jccConfig.validateHmac });
});

// ── POST /jcc/config ── update JCC HMAC config ───────────────────────────────
app.post("/jcc/config", (req, res) => {
  const { topupAppId, topupApiKey, captureAppId, captureApiKey,
          releaseAppId, releaseApiKey, validateHmac } = req.body;
  if (topupAppId)    jccConfig.topup.appId    = topupAppId;
  if (topupApiKey)   jccConfig.topup.apiKey   = topupApiKey;
  if (captureAppId)  jccConfig.capture.appId  = captureAppId;
  if (captureApiKey) jccConfig.capture.apiKey = captureApiKey;
  if (releaseAppId)  jccConfig.release.appId  = releaseAppId;
  if (releaseApiKey) jccConfig.release.apiKey = releaseApiKey;
  if (validateHmac !== undefined) jccConfig.validateHmac = validateHmac;
  res.json({ ok: true });
});

// ── START ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Parking RPS Mock running on http://0.0.0.0:${PORT}`);
  startCaptureRetryLoop();
  console.log(`[PENDING_CAPTURE] Retry loop started — every ${config.captureRetryMins} min, max ${config.captureMaxRetries} retries`);
});