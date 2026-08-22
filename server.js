const express = require("express");
const https   = require("https");
const app     = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));  // Fairway /connect/token uses form-urlencoded

// Ã¢â€â‚¬Ã¢â€â‚¬ Email alerts via Resend HTTP API Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Set RESEND_KEY and ALERT_EMAIL in Render environment variables
// No npm packages needed Ã¢â‚¬â€ uses built-in https module
async function sendHelpAlert(req, isCarWash = false) {
  const apiKey = process.env.RESEND_KEY;
  const to     = (isCarWash ? carWashConfig.alertEmail : null)
              || req.body._overrideEmail
              || config.alertEmail
              || process.env.ALERT_EMAIL;
  if (!apiKey) { console.log("[EMAIL] RESEND_KEY not set Ã¢â‚¬â€ skipping"); return; }
  if (!to)     { console.log("[EMAIL] No alert email configured Ã¢â‚¬â€ skipping"); return; }

  const outlet   = req.body.outlet           || "?";
  const terminal = req.body.terminal         || "?";
  const point    = req.body.intallationPoint || "?";
  const action   = req.body.action           || "Help Button";
  const company  = req.body.companyCode      || config.companyCode;
  const time     = new Date().toLocaleString("en-GB", { timeZone: "Europe/Nicosia" });

  console.log(`[EMAIL] Sending help alert to: ${to}`);

  const payload = JSON.stringify({
    from:    "Parqio Alerts <onboarding@resend.dev>",
    to:      [to],
    subject: `Parqio Help Alert - ${point} (${outlet})`,
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
        <p style="color:#888;font-size:12px;margin-top:16px">Parqio Parking System</p>
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
          if (isCarWash) carWashConfig.lastAlertSent = time;
          else config.lastAlertSent = time;
        } else {
          console.error(`[EMAIL] Failed: HTTP ${res.statusCode} Ã¢â‚¬â€ ${data}`);
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

// Ã¢â€â‚¬Ã¢â€â‚¬ State Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
  // Ã¢â€â‚¬Ã¢â€â‚¬ POS Devices Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // Entrance POS Ã¢â‚¬â€ configured in Android Settings on the entrance device
  entranceOutlet:   "0000259010",
  entranceTerminal: "000025901090",
  // Exit POS Ã¢â‚¬â€ configured in Android Settings on the exit device
  exitOutlet:       "0000259010",
  exitTerminal:     "000025901091",

  // Ã¢â€â‚¬Ã¢â€â‚¬ parkingInit fields Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

  // Ã¢â€â‚¬Ã¢â€â‚¬ TELL Gate Control PRO Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  tellEnabled:       false,
  tellApiKey:        "f2nIrJ8DBf4Gc8ar99IQeCVVm3pnWrVP",
  tellPassword:      "1234",  // device admin password Ã¢â‚¬â€ used by app for addappid
  tellHwId:          "",
  tellHwName:        "ParkingBarrier",
  tellAppId:         "",
  tellVehicleInputEntrance: "in1",  // input pin for entrance vehicle detection
  tellVehicleInputExit:     "in2",  // input pin for exit vehicle detection
  tellBarrierOutput: 1,

  // Ã¢â€â‚¬Ã¢â€â‚¬ JCC IPPI Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  jccBaseUrl:   "https://test-apis.jccsecure.com",
  jccUseMock:          true,   // true = call own mock endpoints, false = call real JCC
  parkingName:         "Parqio",
  topupAmount:         500,    // total exit fee in cents for scenario 3 (TopUp)
  captureRetryMins:    15,     // retry interval in minutes for failed captures
  captureMaxRetries:   5,      // max retry attempts before marking as FAILED
};

// Ã¢â€â‚¬Ã¢â€â‚¬ Pending Captures (capture declined at exit Ã¢â‚¬â€ retry in background) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
  console.log(`[PENDING_CAPTURE] Added ${id} Ã¢â‚¬â€ Ã¢â€šÂ¬${(amountCents/100).toFixed(2)} last4=${entry.lastDigits}`);
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
        console.log(`[PENDING_CAPTURE] ${pc.id} FAILED after ${pc.retries} retries Ã¢â‚¬â€ manual action required`);
      } else {
        console.log(`[PENDING_CAPTURE] ${pc.id} retry ${pc.retries}/${config.captureMaxRetries} failed: ${pc.lastError}`);
      }
    }
  } catch(e) {
    pc.lastError = e.message;
    console.error(`[PENDING_CAPTURE] ${pc.id} retry error:`, e.message);
  }
}

// Background retry loop Ã¢â‚¬â€ checks every 60s, fires when interval elapsed
function startCaptureRetryLoop() {
  let lastRun = Date.now();
  setInterval(async () => {
    const intervalMs = (config.captureRetryMins || 15) * 60 * 1000;
    if (Date.now() - lastRun < intervalMs) return;
    lastRun = Date.now();
    const pending = pendingCaptures.filter(pc => pc.status === "PENDING");
    if (pending.length === 0) return;
    console.log(`[PENDING_CAPTURE] Background retry Ã¢â‚¬â€ ${pending.length} pending`);
    for (const pc of pending) await retrySingleCapture(pc);
  }, 60 * 1000); // checks every 60s
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Rental State Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
let rentalConfig = {
  rentalOutlet:          "",
  rentalTerminal:        "",
  rentalStationId:       "LIM-012",
  rentalStationName:     "Limassol Marina Ã¢â‚¬â€ Station 12",
  preAuthAmountCents:    1500,      // legacy field (used by /rental/start)
  preAuthStandardCents:  1500,      // Standard pre-auth Ã¢â€šÂ¬15
  preAuthPremiumCents:   3000,      // Premium pre-auth Ã¢â€šÂ¬30
  maxRentalTimeMins:     120,
  rentalScenario:        1,         // 1=time-based, 2=fixed, 3=free+release
  fixedAmountCents:      300,
  unlockDisplaySecs:     15,
  returnDisplaySecs:     8,
  phoneForHelp:          "77002020",
  displayMessage:        "Welcome to Limassol Marina Ã¢â‚¬â€ Station 12",
  helpMessage:           "Help has been called. Staff will assist you shortly.",
  helpDisplayTime:       "10",
  alertEmail:            process.env.ALERT_EMAIL || "",
  lastAlertSent:         null,
  flagsForAction:        "0000",
  responseCode:          "00",
  voiceAssistant:        true,
  defaultLanguage:       "EN",
  charges:               [
    { upToMins: 60,  fee: 300 },
    { upToMins: 120, fee: 450 },
    { upToMins: 180, fee: 600 },
    { upToMins: -1,  fee: 750 }
  ],
  items: [
    { itemId: "S-001", type: "Standard", dock: "Dock 1"  },
    { itemId: "S-002", type: "Standard", dock: "Dock 2"  },
    { itemId: "S-003", type: "Standard", dock: "Dock 3"  },
    { itemId: "S-004", type: "Standard", dock: "Dock 4"  },
    { itemId: "S-005", type: "Standard", dock: "Dock 5"  },
    { itemId: "S-006", type: "Standard", dock: "Dock 6"  },
    { itemId: "S-007", type: "Standard", dock: "Dock 7"  },
    { itemId: "S-008", type: "Standard", dock: "Dock 8"  },
    { itemId: "P-001", type: "Premium",  dock: "Dock 9"  },
    { itemId: "P-002", type: "Premium",  dock: "Dock 10" },
    { itemId: "P-003", type: "Premium",  dock: "Dock 11" },
    { itemId: "P-004", type: "Premium",  dock: "Dock 12" },
  ]
};
let activeRentals             = {};
let rentalItemAvailability    = {};  // itemId -> boolean (true = available)
let rentalLogs                = [];
let rentalPendingCaptures     = [];

function getRentalItems() {
  return rentalConfig.items.map(item => ({
    itemId:    item.itemId,
    type:      item.type,
    dock:      item.dock,
    available: rentalItemAvailability[item.itemId] !== false
  }));
}

function generateRentalUnlockCode(entryId) {
  const hash = [...entryId].reduce((acc, c) => ((acc * 31) + c.charCodeAt(0)) | 0, 0);
  return String((Math.abs(hash) % 9000) + 1000);
}

function addRentalLog(req, response) {
  rentalLogs.unshift({
    id: Date.now(), time: new Date().toLocaleString(),
    endpoint: req.originalUrl, method: req.method,
    request: req.body || {}, response
  });
  if (rentalLogs.length > 200) rentalLogs.pop();
  console.log(`[RENTAL] ${req.method} ${req.originalUrl} Ã¢â€ â€™ ${JSON.stringify(response).substring(0,80)}`);
}

function addRentalPendingCapture(session, amountCents) {
  const id = require("crypto").randomBytes(8).toString("hex").toUpperCase();
  rentalPendingCaptures.unshift({
    id, session, amountCents,
    createdAt:   new Date().toLocaleString("en-GB", { timeZone: "Europe/Nicosia" }),
    retries: 0, status: "PENDING", lastAttempt: null, lastError: null
  });
  console.log(`[RENTAL_PENDING] Added ${id} Ã¢â‚¬â€ Ã¢â€šÂ¬${(amountCents/100).toFixed(2)} rentalId=${session.rentalId}`);
}

function calcRentalFee(startTimeMs, endTimeMs) {
  const mins = (endTimeMs - startTimeMs) / 60000;
  const sorted = [...rentalConfig.charges].sort((a, b) => (a.upToMins === -1 ? 1 : b.upToMins === -1 ? -1 : a.upToMins - b.upToMins));
  for (const tier of sorted) {
    if (tier.upToMins === -1 || mins <= tier.upToMins) return tier.fee;
  }
  return sorted[sorted.length - 1].fee;
}

// Ã¢â€â‚¬Ã¢â€â‚¬ CarWash State Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
let carWashConfig = {
  outlet:                   "0000259010",
  terminal:                 "000025901025",
  maxWashTimeSeconds:       300,
  maxWashAmountCents:       500,
  displayMessageOfEntrance: "Welcome to Car Wash!",
  helpMessage:              "Help has been called. Staff will assist you shortly.",
  helpDisplayTime:          "10",
  alertEmail:               process.env.ALERT_EMAIL || "",
  lastAlertSent:            null,
  washScenario:             1,    // 1=capture_preauth, 2=fixed_amount, 3=free
  controllerUrl:            "",
  controllerApiKey:         "",
  flagsForAction:           "0000",
  responseCode:             "00",
  voiceAssistant:           true,
  defaultLanguage:          "EN",
  monthlyEnabled:           true,   // show Monthly Card button in app
  monthlyCardsBins:         "",     // semicolon-separated card numbers for validation (empty = allow all)
};
let activeWashSessions   = {};
let washPendingCaptures  = [];
let carWashLogs          = [];

// -- Petrolina State ----------------------------------------------------------
let petrolinaConfig = {
  terminal:         "",
  pumpNo:           "1",
  defaultLan:       "el",          // "el" or "en" â€” app falls back to "el" if absent
  terminalMode:     "unattended",  // "unattended" (S1U2, pre-auth) | "attended" (S1F2, post-pay Sale)
  claimTTL:         180,           // seconds a claim on an unpaid fuelling stays exclusive
  devicePort:       8080,          // spec Table 2 â€” port the app binds its callback listener to
  deviceIP:         "",            // learned from deviceIP on petrolAppInit; used to address callbacks
  maxAmount:        200.00,        // spec Table 2 â€” ceiling on a manually entered unattended amount
  failSaleAdvice:   "0",           // "1" = reject saleAdvice with HTTP 500, to test the device queue
  confirmAmountTO:  60,            // attended: seconds on the confirm-amount screen
  stationName:      "Petrolina Station",
  isLoyalty:        "0",
  loyaltyEndPoint:  "/loyaltyCheck",
  loyaltyBins:      "",
  helpPhone:        "99123456",
  // Spec Table 43: the OPT supplies the text and how long to show it. {phone} is substituted
  // with helpPhone so the number lives in one place.
  helpMessage:      "For assistance, please call {phone}",
  helpMessageSecs:  20,
  petrolinaPin:     "1234",        // the PIN this mock accepts; anything else returns 01
  askForKm:         "Y",           // petrolinacardaskforkm â€” drives the odometer screen
  askForRegNo:      "N",           // petrolinacardaskforcarregno â€” drives the registration screen
  // Response code returned by /petrolinaCard when the PIN is correct. Anything other than 00 lets
  // the business declines be exercised â€” each shows a different message on the terminal.
  petrolinaCardRc:  "00",
  pumpProducts: [
    { productCode: "unleaded95", product: "Unleaded 95", pricePerLiter: 1720, image: "95petrolina.gif" },
    { productCode: "unleaded98", product: "Unleaded 98", pricePerLiter: 1890, image: "98petrolina.gif" },
    { productCode: "diesel",     product: "Diesel",      pricePerLiter: 1650, image: "diesel.gif"      }
  ],
  pumpSelectedTO:          8,
  memberOfMyPetrolinaTO:   8,
  phoneForMyPetrolinaTO:   8,
  confirmMyPetrolinaTO:    5,
  fuelSelectionTO:         9,
  selectAmountTO:          8,
  enterAmountTO:           8,
  displayStartFuelingTO:   8,
  displayAskKM:            40,
  displayAskRegNo:         40,
  insertPetrolinaCardTO:   40,
  displayScreenFuelingTO:  240,
  callbackDelaySec:        8,
  // Nozzle simulation: "1" sends /fueling ticks before the completion, as a pump controller would.
  fuelingEnabled:          "1",
  fuelingTicks:            4,     // updates sent while the fill climbs
  fuelingTickSec:          5,     // seconds between them

  // Settlement guarantee. Every approved pre-auth owes a completion or a reversal, so unacknowledged
  // callbacks are retried and none may be outstanding when the batch closes.
  settlementRetryEnabled:  "1",
  settlementSweepSec:      30,    // how often outstanding pre-auths are re-attempted
  abandonedAfterSec:       900,   // no fuelling for this long means reverse the hold (15 min)
  actualAmountCents:       0,
  preAuthResult:           "ok",
  responseCode:            "00"
};
// Spec Table 37 serviceStatus values, and Table 40/41 status codes returned by the app.
const SERVICE_IN     = "IN_SERVICE";
const SERVICE_OUT    = "OUT_OF_SERVICE";
const STATUS_RC_IDLE = "00";

/**
 * OPT response-code catalogue. The range decides the app's behaviour:
 *   00      success        Â· continue
 *   01-19   decline        Â· definite answer, do not retry
 *   20-39   state conflict Â· do not repeat the call, recover per code
 *   90-99   technical      Â· retry with back-off (except 90/93/96, which never change)
 */
// Spec V9 Table 46. Codes 01-23 are as published; from 06 up they mirror the abortReason
// meanings of Table 8. The 3x band below it is not in V9 at all â€” the attended flow has to be
// able to say "claimed at another terminal" and "nothing owed here", and Table 46 offers nothing
// for either. Those values are ours and are expected to move once Petrolina rules on them.
const RC = {
  APPROVED:            "00",
  INVALID_PIN:         "01",
  CARD_DECLINED:       "02",
  LOYALTY_DECLINED:    "04",
  PREAUTH_NOT_APPROVED:"12",
  PIN_EXHAUSTED:       "18",
  PETROLINA_REFUSED:   "23",
  // â”€â”€ not in V9 â”€â”€
  ALREADY_PROCESSED:   "31",
  CLAIMED_ELSEWHERE:   "32",
  CLAIM_EXPIRED:       "33",
  CLAIM_NOT_HELD:      "34",
  INVALID_STATE:       "36",
  FUELLING_IN_PROGRESS:"37",
  NOTHING_TO_PAY:      "38",
  // â”€â”€ technical â”€â”€
  MALFORMED:           "90",
  UNKNOWN_TRANSSEGNO:  "93",
  NOT_SETTLED:         "96",
  SYSTEM_MALFUNCTION:  "99"
};

let petrolinaLogs        = [];
/** Last settlement alert, surfaced on the dashboard so a deferred closure is visible, not just logged. */
let petroLastAlert       = null;
let petrolinaTranCounter = 1000;
let petrolinaTransactions = {};

// Ã¢â€â‚¬Ã¢â€â‚¬ Fairway State Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
let fairwayConfig = {
  clientId:       "hermes-parking",
  clientSecret:   "secret123",
  scope:          "fairway.api",
  tokenExpiresIn: 3600,
  requireAuth:    true,
  responseCode:   "200",   // "200"=OK, "401"=auth fail, "500"=server error
};
let fairwayLogs        = [];
let fairwayCurrentToken = null;
let fairwayTokenExpiry  = 0;
// Per-method mock data Ã¢â‚¬â€ params describe inputs, data is what the API returns
let fairwayMethods = {
  "OpenGate": {
    params: [
      { name: "gate", type: "varchar" }
    ],
    data: [{ resultOK: true, resultCode: "OK", resultMessage: null }]
  },
  "parking_entry": {
    params: [
      { name: "plateNumber",   type: "varchar"  },
      { name: "entryDateTime", type: "datetime" },
      { name: "terminalId",    type: "varchar"  }
    ],
    data: [{ status: "OK", recordId: "PARK001" }]
  },
  "parking_exit": {
    params: [
      { name: "plateNumber",  type: "varchar"  },
      { name: "exitDateTime", type: "datetime" },
      { name: "terminalId",   type: "varchar"  }
    ],
    data: [{ status: "OK", fee: 500, durationMins: 120 }]
  },
  "departure_flights": {
    params: [
      { name: "datebegin",   type: "datetime" },
      { name: "dateend",     type: "datetime" },
      { name: "airlinecode", type: "varchar"  }
    ],
    data: [
      { flightNo: "CY100", airlineCode: "CY", departure: "2026-07-03T10:00:00", gate: "A1", status: "ON TIME" },
      { flightNo: "FR234", airlineCode: "FR", departure: "2026-07-03T11:30:00", gate: "B3", status: "ON TIME" }
    ]
  },
  "arrival_flights": {
    params: [
      { name: "datebegin",   type: "datetime" },
      { name: "dateend",     type: "datetime" },
      { name: "airlinecode", type: "varchar"  }
    ],
    data: [
      { flightNo: "CY101", airlineCode: "CY", arrival: "2026-07-03T09:30:00", gate: "A2", status: "LANDED" }
    ]
  }
};

function addFairwayLog(method, path, reqBody, resBody) {
  fairwayLogs.unshift({
    time: new Date().toLocaleTimeString(), method, path,
    request: reqBody, response: resBody
  });
  if (fairwayLogs.length > 200) fairwayLogs.pop();
  console.log(`[FAIRWAY] ${method} ${path} Ã¢â€ â€™ ${JSON.stringify(resBody).substring(0,80)}`);
}

function addPetroLog(method, path, req, res) {
  petrolinaLogs.unshift({ time: new Date().toLocaleTimeString(), method, path, req, res });
  if (petrolinaLogs.length > 200) petrolinaLogs.pop();
  console.log(`[PETRO] ${method} ${path} Ã¢â€ â€™ ${JSON.stringify(res).substring(0,80)}`);
}

function addCarWashLog(req, response) {
  carWashLogs.unshift({
    id: Date.now(), time: new Date().toLocaleString(),
    endpoint: req.originalUrl, method: req.method,
    request: req.body || {}, response
  });
  if (carWashLogs.length > 200) carWashLogs.pop();
  console.log(`[CW] ${req.method} ${req.originalUrl} Ã¢â€ â€™ ${JSON.stringify(response).substring(0,80)}`);
}

function addWashPendingCapture(session, amountCents) {
  const id = require("crypto").randomBytes(8).toString("hex").toUpperCase();
  washPendingCaptures.unshift({
    id, session, amountCents,
    createdAt:   new Date().toLocaleString("en-GB", { timeZone: "Europe/Nicosia" }),
    retries: 0, status: "PENDING", lastAttempt: null, lastError: null
  });
  console.log(`[CW_PENDING] Added ${id} Ã¢â‚¬â€ Ã¢â€šÂ¬${(amountCents/100).toFixed(2)} washId=${session.washId}`);
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Helpers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ HMAC Header Builder (JCC spec) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ JCC HTTP POST helper Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
        console.log(`[JCC] ${fullUrl} Ã¢â€ â€™ HTTP ${r.statusCode} | body: ${data.substring(0,200)}`);
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

// Ã¢â€â‚¬Ã¢â€â‚¬ JCC DateTime format Ã¢â‚¬â€ Cyprus timezone +03:00 Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ JCC API Calls Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ TELL API client Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ Admin endpoints Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.get("/logs", (req, res) => res.json(logs));
app.get("/admin/config", (req, res) => res.json(config));

// Ã¢â€â‚¬Ã¢â€â‚¬ GET /admin/entries Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.get("/admin/entries", (req, res) => res.json(Object.values(activeEntries)));

// Ã¢â€â‚¬Ã¢â€â‚¬ GET /admin/rejections Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.get("/admin/rejections", (req, res) => res.json(rejectionLog));
app.get("/admin/ecr-declines", (req, res) => res.json(ecrDeclineLog));

// Ã¢â€â‚¬Ã¢â€â‚¬ Pending Captures endpoints Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ GET /admin/tell-status Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /admin/tell-register Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Calls TELL /gc/addappid using hwId + hwName + password Ã¢â€ â€™ saves appId to config
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

// Ã¢â€â‚¬Ã¢â€â‚¬ Dashboard Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

.tab-nav{display:flex;gap:4px;margin-bottom:24px;border-bottom:2px solid #21262d;padding-bottom:0}
.tab-btn{background:none;border:none;color:#8b949e;padding:10px 20px;cursor:pointer;font-size:14px;border-bottom:2px solid transparent;margin-bottom:-2px}
.tab-btn.active{color:#1f6feb;border-bottom-color:#1f6feb;font-weight:bold}
.tab-content{display:none}.tab-content.active{display:block}
</style></head><body>

<div class="tab-nav">
  <button class="tab-btn active" onclick="showTab('parking',this)">&#x1F697; Parking</button>
  <button class="tab-btn" onclick="showTab('rental',this)">&#x1F512; Rental</button>
  <button class="tab-btn" onclick="showTab('carwash',this)">&#x1F6BF; Car Wash</button>
  <button class="tab-btn" onclick="showTab('petrolina',this)" style="color:#e07b00">&#x26FD; Petrolina</button>
  <button class="tab-btn" onclick="showTab('fairway',this)" style="color:#1D9E75">&#x2708;&#xFE0F; Fairway</button>
</div>

<div id="tab-parking" class="tab-content active">
<h1>&#x1F17F; Parking RPS Mock Server</h1>
<p style="color:#8b949e">All changes take effect immediately - no restart needed.</p>

<h2>&#x1F4F1; POS Device Configuration</h2>
<p style="color:#8b949e;font-size:12px;margin-top:-8px">
  The server identifies which POS is calling by matching outlet + terminal from the request.
  Enter the same values here that you configure in the Android app Settings.
</p>

<div class="pos-box entrance-box">
<h3>Ã°Å¸â€Âµ Entrance POS</h3>
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
<h3>Ã°Å¸Å¸Â  Exit POS</h3>
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
<tr><td>Voice Assistant</td><td>${config.voiceAssistant ? 'Ã°Å¸â€Å  ON' : 'Ã°Å¸â€â€¡ OFF'}</td>
<td><button class="btn green" onclick="set('voiceAssistant',true)">Ã°Å¸â€Å  ON</button>
<button class="btn red" onclick="set('voiceAssistant',false)">Ã°Å¸â€â€¡ OFF</button></td></tr>
<tr><td>Default Language</td><td>${config.defaultLanguage}</td>
<td><button class="btn green" onclick="set('defaultLanguage','EN')">Ã°Å¸â€¡Â¬Ã°Å¸â€¡Â§ EN</button>
<button class="btn" onclick="set('defaultLanguage','EL')">Ã°Å¸â€¡Â¬Ã°Å¸â€¡Â· EL</button>
<button class="btn" onclick="set('defaultLanguage','RU')">Ã°Å¸â€¡Â·Ã°Å¸â€¡Âº RU</button>
<button class="btn" onclick="set('defaultLanguage','IW')">Ã°Å¸â€¡Â®Ã°Å¸â€¡Â± IW</button></td></tr>
</table>

<h2>&#x1F4E1; parkingInit Response Fields</h2>
<table>
<tr><th style="width:200px">Field</th><th>Value</th><th style="width:220px">Edit</th></tr>
<tr><td>Keep Alive (min)</td><td>${config.keepAliveFreq}</td>
<td><input class="n" type="number" id="inKA" value="${config.keepAliveFreq}">
<button class="btn" onclick="set('keepAliveFreq',Number(document.getElementById('inKA').value))">Set</button></td></tr>
<tr><td>Min Pre-Auth (cents)</td><td>${config.minimumAmountPreAuth} = Ã¢â€šÂ¬${(config.minimumAmountPreAuth/100).toFixed(2)}</td>
<td><input class="n" type="number" id="inPA" value="${config.minimumAmountPreAuth}">
<button class="btn" onclick="set('minimumAmountPreAuth',Number(document.getElementById('inPA').value))">Set</button></td></tr>
<tr><td>Fix Amount Solution (cents)</td><td>${config.fixAmountSolution} ${config.fixAmountSolution > 0 ? '= Ã¢â€šÂ¬'+(config.fixAmountSolution/100).toFixed(2)+' SALE mode' : '= OFF (pre-auth mode)'}</td>
<td><input class="n" type="number" id="inFA" value="${config.fixAmountSolution}">
<button class="btn" onclick="set('fixAmountSolution',Number(document.getElementById('inFA').value))">Set</button>
<span style="color:#8b949e;font-size:11px;margin-left:6px">-1 = off, e.g. 500 = Ã¢â€šÂ¬5.00 fixed SALE</span></td></tr>
<tr><td>Default Amount (cents)</td><td>${config.defaultAmount} = Ã¢â€šÂ¬${(config.defaultAmount/100).toFixed(2)}</td>
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
<td>${process.env.RESEND_KEY ? 'Ã¢Å“â€¦ Resend active' : 'Ã¢Å¡Â Ã¯Â¸Â Not configured (set RESEND_KEY in Render)'}</td>
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
<td>${c.from}</td><td>${c.to||'Ã¢Ë†Å¾'}</td><td>${c.fee}</td><td>Ã¢â€šÂ¬${(parseInt(c.fee)/100).toFixed(2)}</td>
<td><button class="btn red" onclick="removeCharge(${i})">Remove</button></td>
</tr>`).join('')}
</table>
<div style="display:flex;gap:6px;align-items:center;margin-top:8px;flex-wrap:wrap">
  <input class="n" type="number" id="chFrom" placeholder="from">
  <input class="n" type="number" id="chTo" placeholder="to (blank=Ã¢Ë†Å¾)">
  <input class="n" type="number" id="chFee" placeholder="fee">
  <button class="btn green" onclick="addCharge()">+ Add Charge</button>
</div>

<h2>&#x1F6A7; TELL Gate Control PRO</h2>
<div class="tell-box">
<h3>Mode - currently: <span class="${config.tellEnabled?'active':'inactive'}">${config.tellEnabled?'Ã°Å¸Å¸Â¢ REAL TELL API ACTIVE':'Ã¢Å¡Â« MOCK (TELL disabled)'}</span></h3>
<button class="btn green" onclick="set('tellEnabled',true)">&#x1F7E2; Enable Real TELL API</button>
<button class="btn gray" onclick="set('tellEnabled',false)">Ã¢Å¡Â« Use Mock</button>
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
<tr><td>Ã°Å¸â€Âµ Entrance vehicle input</td>
<td><select onchange="set('tellVehicleInputEntrance',this.value)">
<option value="in1" ${config.tellVehicleInputEntrance==='in1'?'selected':''}>IN1 - dry contact</option>
<option value="in2" ${config.tellVehicleInputEntrance==='in2'?'selected':''}>IN2 - dry contact</option>
</select></td></tr>
<tr><td>Ã°Å¸Å¸Â  Exit vehicle input</td>
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
        <option value="true"  ${config.jccUseMock?'selected':''}>Ã°Å¸Å¸Â¡ MOCK (this server)</option>
        <option value="false" ${!config.jccUseMock?'selected':''}>Ã°Å¸Å¸Â¢ REAL JCC (${config.jccBaseUrl})</option>
      </select>
    </td></tr>
    <tr><td>Parking Name</td><td><input id="parkingNameInput" value="${config.parkingName}" style="width:200px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;padding:4px">
      <button class="btn" style="margin-left:6px" onclick="sv('parkingName','parkingNameInput')">Save</button></td><td></td></tr>
    <tr><td>TopUp total amount (cents)</td><td><input id="topupAmountInput" value="${config.topupAmount}" style="width:100px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;padding:4px">
      <button class="btn" style="margin-left:6px" onclick="sv('topupAmount','topupAmountInput')">Save</button>
      <span style="color:#8b949e;font-size:11px;margin-left:8px">e.g. 500 = Ã¢â€šÂ¬5.00</span></td><td></td></tr>
    <tr><td>Capture Retry Interval (min)</td><td><input id="captureRetryMinsInput" value="${config.captureRetryMins}" style="width:80px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;padding:4px">
      <button class="btn" style="margin-left:6px" onclick="sv('captureRetryMins','captureRetryMinsInput')">Save</button>
      <span style="color:#8b949e;font-size:11px;margin-left:8px">background retry every X minutes</span></td><td></td></tr>
    <tr><td>Capture Max Retries</td><td><input id="captureMaxRetriesInput" value="${config.captureMaxRetries}" style="width:80px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;padding:4px">
      <button class="btn" style="margin-left:6px" onclick="sv('captureMaxRetries','captureMaxRetriesInput')">Save</button>
      <span style="color:#8b949e;font-size:11px;margin-left:8px">mark as FAILED after N retries</span></td><td></td></tr>
  </table>
  <button class="btn" onclick="saveJccConfig()" style="margin-top:8px">Ã°Å¸â€™Â¾ Save JCC HMAC Config</button>
</div>

<div class="card" style="margin-top:12px">
  <h3>Active Transaction</h3>
  <div id="jccActiveTx"><span style="color:#888">Loading...</span></div>
  <button class="btn red" onclick="clearJccTransaction()" style="margin-top:8px">Ã°Å¸â€”â€˜ Clear Transaction</button>
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

</div>

<!-- Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â RENTAL TAB Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â -->
<div id="tab-rental" class="tab-content">
<h1>&#x1F512; Rental RPS Mock</h1>
<p style="color:#8b949e">All changes take effect immediately. Uses same JCC IPPI endpoints as Parking.</p>

<h2>&#x1F4F1; Rental Terminal Configuration</h2>
<div class="pos-box" style="border-color:#1D9E75">
<h3>&#x1F7E2; Rental POS</h3>
<table>
<tr><th style="width:160px">Parameter</th><th>Value</th><th style="width:80px"></th></tr>
<tr><td>Outlet Number</td>
  <td><input class="t" id="rentalOutlet" value="${rentalConfig.rentalOutlet}" maxlength="10" placeholder="10 digits"></td>
  <td><button class="btn" onclick="saveRentalCfg('rentalOutlet','rentalOutlet')">Save</button></td></tr>
<tr><td>Terminal ID</td>
  <td><input class="t" id="rentalTerminal" value="${rentalConfig.rentalTerminal}" maxlength="12" placeholder="12 digits"></td>
  <td><button class="btn" onclick="saveRentalCfg('rentalTerminal','rentalTerminal')">Save</button></td></tr>
<tr><td>Station ID</td>
  <td><input class="t" id="rentalStationId" value="${rentalConfig.rentalStationId}" placeholder="e.g. LIM-001"></td>
  <td><button class="btn" onclick="saveRentalCfg('rentalStationId','rentalStationId')">Save</button></td></tr>
<tr><td>Station Name</td>
  <td><input class="m" id="rentalStationName" value="${rentalConfig.rentalStationName}" placeholder="e.g. Limassol Marina"></td>
  <td><button class="btn" onclick="saveRentalCfg('rentalStationName','rentalStationName')">Save</button></td></tr>
</table></div>

<h2>&#x2699;&#xFE0F; Rental Configuration</h2>
<table>
<tr><th>Setting</th><th>Current</th><th>Actions</th></tr>
<tr>
  <td>Pre-Auth Standard (cents)</td>
  <td>${rentalConfig.preAuthStandardCents} = &#x20AC;${(rentalConfig.preAuthStandardCents/100).toFixed(2)}</td>
  <td><input class="n" type="number" id="rnPreAuthStd" value="${rentalConfig.preAuthStandardCents}">
  <button class="btn" onclick="rnSet('preAuthStandardCents',Number(document.getElementById('rnPreAuthStd').value))">Set</button></td>
</tr>
<tr>
  <td>Pre-Auth Premium (cents)</td>
  <td>${rentalConfig.preAuthPremiumCents} = &#x20AC;${(rentalConfig.preAuthPremiumCents/100).toFixed(2)}</td>
  <td><input class="n" type="number" id="rnPreAuthPrem" value="${rentalConfig.preAuthPremiumCents}">
  <button class="btn" onclick="rnSet('preAuthPremiumCents',Number(document.getElementById('rnPreAuthPrem').value))">Set</button></td>
</tr>
<tr>
  <td>Unlock Display (sec)</td>
  <td>${rentalConfig.unlockDisplaySecs}s</td>
  <td><input class="n" type="number" id="rnUnlockSec" value="${rentalConfig.unlockDisplaySecs}">
  <button class="btn" onclick="rnSet('unlockDisplaySecs',Number(document.getElementById('rnUnlockSec').value))">Set</button></td>
</tr>
<tr>
  <td>Return Display (sec)</td>
  <td>${rentalConfig.returnDisplaySecs}s</td>
  <td><input class="n" type="number" id="rnReturnSec" value="${rentalConfig.returnDisplaySecs}">
  <button class="btn" onclick="rnSet('returnDisplaySecs',Number(document.getElementById('rnReturnSec').value))">Set</button></td>
</tr>
<tr>
  <td>Phone for Help</td>
  <td>${rentalConfig.phoneForHelp}</td>
  <td><input class="m" id="rnPhone" value="${rentalConfig.phoneForHelp}">
  <button class="btn" onclick="rnSv('phoneForHelp','rnPhone')">Save</button></td>
</tr>
<tr>
  <td>Max Rental Time (min)</td>
  <td>${rentalConfig.maxRentalTimeMins} min</td>
  <td><input class="n" type="number" id="rnMaxTime" value="${rentalConfig.maxRentalTimeMins}">
  <button class="btn" onclick="rnSet('maxRentalTimeMins',Number(document.getElementById('rnMaxTime').value))">Set</button></td>
</tr>
<tr>
  <td>Rental Scenario</td>
  <td>${{1:"Time-based capture",2:"Fixed amount",3:"Free + release"}[rentalConfig.rentalScenario]||"?"}</td>
  <td>
    <button class="btn green" onclick="rnSet('rentalScenario',1)">1 Time-based</button>
    <button class="btn orange" onclick="rnSet('rentalScenario',2)">2 Fixed</button>
    <button class="btn red" onclick="rnSet('rentalScenario',3)">3 Free</button>
  </td>
</tr>
<tr>
  <td>Fixed Amount (cents)</td>
  <td>${rentalConfig.fixedAmountCents} = &#x20AC;${(rentalConfig.fixedAmountCents/100).toFixed(2)}</td>
  <td><input class="n" type="number" id="rnFixed" value="${rentalConfig.fixedAmountCents}">
  <button class="btn" onclick="rnSet('fixedAmountCents',Number(document.getElementById('rnFixed').value))">Set</button>
  <span style="color:#8b949e;font-size:11px;margin-left:6px">only used for scenario 2</span></td>
</tr>
<tr>
  <td>Force Init Error</td>
  <td>${rentalConfig.responseCode}</td>
  <td>
    <button class="btn green" onclick="rnSet('responseCode','00')">00 OK</button>
    <button class="btn red" onclick="rnSet('responseCode','91')">91 Outlet</button>
    <button class="btn red" onclick="rnSet('responseCode','08')">08 Technical</button>
  </td>
</tr>
<tr>
  <td>Force Action (flagsForAction)</td>
  <td>${rentalConfig.flagsForAction}</td>
  <td>
    <button class="btn green" onclick="rnSet('flagsForAction','0000')">0000 None</button>
    <button class="btn orange" onclick="rnSet('flagsForAction','1000')">1000 Restart App</button>
    <button class="btn" onclick="rnSet('flagsForAction','0100')">0100 Force Re-Init</button>
    <button class="btn red" onclick="rnSet('flagsForAction','1100')">1100 Init + Restart</button>
  </td>
</tr>
<tr>
  <td>Voice Assistant</td>
  <td>${rentalConfig.voiceAssistant ? '&#x1F50A; ON' : '&#x1F507; OFF'}</td>
  <td>
    <button class="btn green" onclick="rnSet('voiceAssistant',true)">&#x1F50A; ON</button>
    <button class="btn red" onclick="rnSet('voiceAssistant',false)">&#x1F507; OFF</button>
  </td>
</tr>
<tr>
  <td>Default Language</td>
  <td>${rentalConfig.defaultLanguage}</td>
  <td>
    <button class="btn green" onclick="rnSet('defaultLanguage','EN')">&#x1F1EC;&#x1F1E7; EN</button>
    <button class="btn" onclick="rnSet('defaultLanguage','EL')">&#x1F1EC;&#x1F1F7; EL</button>
    <button class="btn" onclick="rnSet('defaultLanguage','RU')">&#x1F1F7;&#x1F1FA; RU</button>
    <button class="btn" onclick="rnSet('defaultLanguage','IW')">&#x1F1EE;&#x1F1F1; IW</button>
  </td>
</tr>
<tr>
  <td>Welcome Message</td>
  <td style="font-size:11px">${rentalConfig.displayMessage}</td>
  <td><input class="w" id="rnDM" value="${rentalConfig.displayMessage}">
  <button class="btn" onclick="rnSv('displayMessage','rnDM')">Save</button></td>
</tr>
<tr>
  <td>Help Message</td>
  <td style="font-size:11px">${rentalConfig.helpMessage}</td>
  <td><input class="w" id="rnHM" value="${rentalConfig.helpMessage}">
  <button class="btn" onclick="rnSv('helpMessage','rnHM')">Save</button></td>
</tr>
<tr>
  <td>Help Display Time (sec)</td>
  <td>${rentalConfig.helpDisplayTime}</td>
  <td><input style="width:60px" id="rnHDT" value="${rentalConfig.helpDisplayTime}">
  <button class="btn" onclick="rnSv('helpDisplayTime','rnHDT')">Save</button></td>
</tr>
<tr>
  <td>Email Alerts</td>
  <td>${process.env.RESEND_KEY ? '&#x2705; Resend active' : '&#x26A0;&#xFE0F; Not configured'}</td>
  <td style="font-size:11px;color:#8b949e">${rentalConfig.lastAlertSent ? 'Last sent: '+rentalConfig.lastAlertSent : 'No alerts sent yet'}</td>
</tr>
<tr>
  <td>Alert Email (recipient)</td>
  <td><input class="w" id="rnAlertEmail" placeholder="recipient@email.com" value="${rentalConfig.alertEmail}"></td>
  <td><button class="btn" onclick="rnSv('alertEmail','rnAlertEmail')">Save</button></td>
</tr>
</table>

<h3 style="color:#8b949e;margin-top:16px">Time-based Charges (scenario 1)</h3>
<table>
<tr><th>Up to (min)</th><th>Fee (cents)</th><th>= Euro</th><th></th></tr>
${rentalConfig.charges.map((c,i)=>`<tr>
<td>${c.upToMins===-1?'Ã¢Ë†Å¾':c.upToMins}</td><td>${c.fee}</td><td>&#x20AC;${(c.fee/100).toFixed(2)}</td>
<td><button class="btn red" onclick="removeRentalCharge(${i})">Remove</button></td>
</tr>`).join('')}
</table>
<div style="display:flex;gap:6px;align-items:center;margin-top:8px;flex-wrap:wrap">
  <input class="n" type="number" id="rnChTo" placeholder="up to min (-1=Ã¢Ë†Å¾)">
  <input class="n" type="number" id="rnChFee" placeholder="fee cents">
  <button class="btn green" onclick="addRentalCharge()">+ Add Tier</button>
</div>

<h2>&#x1F4CB; Item Catalogue</h2>
<p style="color:#8b949e;font-size:12px;margin-top:-8px">Items returned by /rental/init and /rental/keepAlive. Toggle availability to simulate dock state.</p>
<table>
<tr><th>Item ID</th><th>Type</th><th>Dock</th><th>Availability</th><th></th></tr>
${rentalConfig.items.map((item,i)=>`<tr>
  <td>${item.itemId}</td><td>${item.type}</td><td>${item.dock}</td>
  <td id="rnItemAvail_${item.itemId}" style="color:${rentalItemAvailability[item.itemId]===false?'#ff6b6b':'#3fb950'}">
    ${rentalItemAvailability[item.itemId]===false?'&#x26D4; Rented':'&#x2705; Available'}
  </td>
  <td>
    <button class="btn green" onclick="setRentalItemAvail('${item.itemId}',true)">Free</button>
    <button class="btn red" onclick="setRentalItemAvail('${item.itemId}',false)">Rented</button>
  </td>
</tr>`).join('')}
</table>

<h2>&#x1F4E6; Active Rentals <span id="rentalCount" style="font-size:13px;color:#8b949e"></span></h2>
<div id="rentalsDiv"><table><tr><td style="color:#8b949e">Loading...</td></tr></table></div>
<button class="btn red" onclick="clearRentals()">Clear All Rentals</button>

<h2>&#x26A0;&#xFE0F; Pending Rental Captures <span id="rentalPendingCount" style="font-size:13px;color:#8b949e"></span></h2>
<div id="rentalPendingDiv"><table><tr><td style="color:#8b949e">Loading...</td></tr></table></div>

<h2>&#x1F4CB; Rental Request Log</h2>
<div style="display:flex;gap:6px;margin-bottom:10px">
  <button class="btn gray" onclick="setRentalFilter('')">All</button>
  <button class="btn" style="background:#1f6feb" onclick="setRentalFilter('rental/init')">Init</button>
  <button class="btn gray" onclick="setRentalFilter('keepAlive')">Keep-Alive</button>
  <button class="btn" onclick="setRentalFilter('preAuthAmount')">Pre-Auth</button>
  <button class="btn green" onclick="setRentalFilter('rental/entry')">Entry</button>
  <button class="btn orange" onclick="setRentalFilter('rental/return')">Return</button>
  <button class="btn gray" onclick="setRentalFilter('rental/help')">Help</button>
  <button class="btn red" style="margin-left:auto" onclick="clearRentalLogs()">Clear</button>
</div>
<div id="rentalLogDiv"><p style="color:#8b949e">Loading...</p></div>
</div>

<!-- Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â CARWASH TAB Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â -->
<div id="tab-carwash" class="tab-content">
<h1>&#x1F6BF; Car Wash RPS Mock</h1>
<p style="color:#8b949e">All changes take effect immediately. Uses same JCC IPPI endpoints as Parking.</p>

<h2>&#x1F4F1; Car Wash POS Configuration</h2>
<div class="pos-box" style="border-color:#1F9E8E">
<h3>&#x1F6BF; Car Wash POS</h3>
<table>
<tr><th style="width:180px">Parameter</th><th>Value</th><th style="width:100px"></th></tr>
<tr>
  <td>Outlet Number</td>
  <td><input class="t" id="cwOutlet" value="${carWashConfig.outlet}" maxlength="10"></td>
  <td><button class="btn" onclick="cwSv('outlet','cwOutlet')">Save</button></td>
</tr>
<tr>
  <td>Terminal ID</td>
  <td><input class="t" id="cwTerminal" value="${carWashConfig.terminal}" maxlength="12"></td>
  <td><button class="btn" onclick="cwSv('terminal','cwTerminal')">Save</button></td>
</tr>
</table>
</div>

<h2>&#x2699;&#xFE0F; Wash Configuration</h2>
<table>
<tr><th>Setting</th><th>Current</th><th>Actions</th></tr>
<tr>
  <td>Max Wash Time (seconds)</td>
  <td>${carWashConfig.maxWashTimeSeconds}s = ${Math.floor(carWashConfig.maxWashTimeSeconds/60)}min</td>
  <td><input class="n" type="number" id="cwMaxTime" value="${carWashConfig.maxWashTimeSeconds}">
  <button class="btn" onclick="cwSet('maxWashTimeSeconds',Number(document.getElementById('cwMaxTime').value))">Set</button></td>
</tr>
<tr>
  <td>Max Pre-Auth Amount (cents)</td>
  <td>${carWashConfig.maxWashAmountCents} = &#x20AC;${(carWashConfig.maxWashAmountCents/100).toFixed(2)}</td>
  <td><input class="n" type="number" id="cwMaxAmt" value="${carWashConfig.maxWashAmountCents}">
  <button class="btn" onclick="cwSet('maxWashAmountCents',Number(document.getElementById('cwMaxAmt').value))">Set</button></td>
</tr>
<tr>
  <td>Wash Scenario</td>
  <td>${{1:"Capture Pre-Auth",2:"Fixed Amount",3:"Free"}[carWashConfig.washScenario]||"?"}</td>
  <td>
    <button class="btn green" onclick="cwSet('washScenario',1)">1 Capture</button>
    <button class="btn orange" onclick="cwSet('washScenario',2)">2 Fixed</button>
    <button class="btn red" onclick="cwSet('washScenario',3)">3 Free</button>
  </td>
</tr>
<tr>
  <td>Force Init Error</td>
  <td>${carWashConfig.responseCode}</td>
  <td>
    <button class="btn green" onclick="cwSet('responseCode','00')">00 OK</button>
    <button class="btn red" onclick="cwSet('responseCode','91')">91 Outlet</button>
    <button class="btn red" onclick="cwSet('responseCode','08')">08 Technical</button>
  </td>
</tr>
<tr>
  <td>Force Action (flagsForAction)</td>
  <td>${carWashConfig.flagsForAction}</td>
  <td>
    <button class="btn green" onclick="cwSet('flagsForAction','0000')">0000 None</button>
    <button class="btn orange" onclick="cwSet('flagsForAction','1000')">1000 Restart App</button>
    <button class="btn" onclick="cwSet('flagsForAction','0100')">0100 Force Re-Init</button>
    <button class="btn red" onclick="cwSet('flagsForAction','1100')">1100 Init + Restart</button>
  </td>
</tr>
<tr>
  <td>Voice Assistant</td>
  <td>${carWashConfig.voiceAssistant ? '&#x1F50A; ON' : '&#x1F507; OFF'}</td>
  <td>
    <button class="btn green" onclick="cwSet('voiceAssistant',true)">&#x1F50A; ON</button>
    <button class="btn red" onclick="cwSet('voiceAssistant',false)">&#x1F507; OFF</button>
  </td>
</tr>
<tr>
  <td>Default Language</td>
  <td>${carWashConfig.defaultLanguage}</td>
  <td>
    <button class="btn green" onclick="cwSet('defaultLanguage','EN')">&#x1F1EC;&#x1F1E7; EN</button>
    <button class="btn" onclick="cwSet('defaultLanguage','EL')">&#x1F1EC;&#x1F1F7; EL</button>
    <button class="btn" onclick="cwSet('defaultLanguage','RU')">&#x1F1F7;&#x1F1FA; RU</button>
    <button class="btn" onclick="cwSet('defaultLanguage','IW')">&#x1F1EE;&#x1F1F1; IW</button>
  </td>
</tr>
<tr>
  <td>Welcome Message</td>
  <td style="font-size:11px">${carWashConfig.displayMessageOfEntrance}</td>
  <td><input class="w" id="cwDME" value="${carWashConfig.displayMessageOfEntrance}">
  <button class="btn" onclick="cwSv('displayMessageOfEntrance','cwDME')">Save</button></td>
</tr>
<tr>
  <td>Help Message</td>
  <td style="font-size:11px">${carWashConfig.helpMessage}</td>
  <td><input class="w" id="cwHM" value="${carWashConfig.helpMessage}">
  <button class="btn" onclick="cwSv('helpMessage','cwHM')">Save</button></td>
</tr>
<tr>
  <td>Help Display Time (sec)</td>
  <td>${carWashConfig.helpDisplayTime}</td>
  <td><input style="width:60px" id="cwHDT" value="${carWashConfig.helpDisplayTime}">
  <button class="btn" onclick="cwSv('helpDisplayTime','cwHDT')">Save</button></td>
</tr>
<tr>
  <td>Email Alerts</td>
  <td>${process.env.RESEND_KEY ? '&#x2705; Resend active' : '&#x26A0;&#xFE0F; Not configured (set RESEND_KEY in Render)'}</td>
  <td style="font-size:11px;color:#8b949e">${carWashConfig.lastAlertSent ? 'Last sent: '+carWashConfig.lastAlertSent : 'No alerts sent yet'}</td>
</tr>
<tr>
  <td>Alert Email (recipient)</td>
  <td><input class="w" id="cwAlertEmail" placeholder="recipient@email.com" value="${carWashConfig.alertEmail}"></td>
  <td><button class="btn" onclick="cwSv('alertEmail','cwAlertEmail')">Save</button></td>
</tr>
<tr>
  <td>Controller URL</td>
  <td style="font-size:11px">${carWashConfig.controllerUrl||'<span style="color:#8b949e">not set</span>'}</td>
  <td><input class="w" id="cwCtrlUrl" placeholder="http://192.168.1.10" value="${carWashConfig.controllerUrl}">
  <button class="btn" onclick="cwSv('controllerUrl','cwCtrlUrl')">Save</button></td>
</tr>
<tr>
  <td>Controller API Key</td>
  <td style="font-size:11px">${carWashConfig.controllerApiKey ? '****' + carWashConfig.controllerApiKey.slice(-4) : '<span style="color:#8b949e">not set</span>'}</td>
  <td><input class="w" id="cwCtrlKey" type="password" placeholder="API key" value="${carWashConfig.controllerApiKey}">
  <button class="btn" onclick="cwSv('controllerApiKey','cwCtrlKey')">Save</button></td>
</tr>
<tr>
  <td>Monthly Card Button</td>
  <td>${carWashConfig.monthlyEnabled ? '&#x2705; Enabled' : '&#x26D4; Disabled'}</td>
  <td>
    <button class="btn green" onclick="cwSet('monthlyEnabled',true)">&#x2705; Enable</button>
    <button class="btn red" onclick="cwSet('monthlyEnabled',false)">&#x26D4; Disable</button>
  </td>
</tr>
<tr>
  <td>Monthly Card Numbers</td>
  <td style="font-size:11px">${carWashConfig.monthlyCardsBins || '<span style="color:#8b949e">any card accepted</span>'}</td>
  <td><input class="w" id="cwMonthlyBins" placeholder="123456;789012 (empty=allow all)" value="${carWashConfig.monthlyCardsBins}">
  <button class="btn" onclick="cwSv('monthlyCardsBins','cwMonthlyBins')">Save</button></td>
</tr>
</table>

<h2>&#x1F6BF; Active Wash Sessions <span id="cwSessionCount" style="font-size:13px;color:#8b949e"></span></h2>
<div id="cwSessionsDiv"><table><tr><td style="color:#8b949e">Loading...</td></tr></table></div>
<button class="btn red" onclick="cwClearSessions()">Clear All Sessions</button>

<h2>&#x26A0;&#xFE0F; Pending Wash Captures <span id="cwPendingCount" style="font-size:13px;color:#8b949e"></span></h2>
<div id="cwPendingDiv"><table><tr><td style="color:#8b949e">Loading...</td></tr></table></div>

<h2>&#x1F4CB; Car Wash Request Log</h2>
<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap">
  <button class="btn gray" onclick="cwSetFilter('')">All</button>
  <button class="btn" style="background:#1f6feb" onclick="cwSetFilter('parkingInit')">Init</button>
  <button class="btn green" onclick="cwSetFilter('washStart')">Wash Start</button>
  <button class="btn orange" onclick="cwSetFilter('washStop')">Wash Stop</button>
  <button class="btn gray" onclick="cwSetFilter('help')">Help</button>
  <span style="margin-left:auto;display:flex;gap:6px">
    <button class="btn red" onclick="cwClearLogs()">&#x1F5D1; Clear</button>
  </span>
</div>
<div id="cwLogCount" style="color:#8b949e;font-size:11px;margin-bottom:8px"></div>
<div id="cwLogDiv"><p style="color:#8b949e">Loading...</p></div>
</div>

<!-- â•â•â• PETROLINA TAB â•â•â• -->
<div id="tab-petrolina" class="tab-content">
<h1>&#x26FD; Petrolina Mock OPT Server</h1>
<p style="color:#8b949e">Simulates the Petrolina OPT server. The S1U2 app calls <code>/petrolAppInit</code>, <code>/optTransaction</code>, <code>/preAuthorization</code>, <code>/abortTransaction</code>, <code>/help</code>. The OPT fires <code>POST /completion</code> back to the app.</p>

<h2>&#x1F4F1; Terminal Configuration</h2>
<div class="pos-box" style="border:1px solid #e07b00;background:#161b22;border-radius:6px;padding:14px;margin-bottom:14px">
<h3 style="color:#e07b00">&#x26FD; Petrolina OPT</h3>
<table>
<tr><th style="width:180px">Parameter</th><th>Value</th><th style="width:100px"></th></tr>
<tr><td>Terminal ID</td>
  <td><input class="t" id="ptTerminal" value="${petrolinaConfig.terminal}" maxlength="12" placeholder="12 chars"></td>
  <td><button class="btn" onclick="ptSv('terminal','ptTerminal')">Save</button></td></tr>
<tr><td>Pump No</td>
  <td><input class="m" id="ptPumpNo" value="${petrolinaConfig.pumpNo}" placeholder="e.g. 1"></td>
  <td><button class="btn" onclick="ptSv('pumpNo','ptPumpNo')">Save</button></td></tr>
<tr><td>Station Name</td>
  <td><input class="m" id="ptStationName" value="${petrolinaConfig.stationName}" placeholder="e.g. Petrolina Station"></td>
  <td><button class="btn" onclick="ptSv('stationName','ptStationName')">Save</button></td></tr>
<tr><td>Help Phone</td>
  <td><input class="m" id="ptHelpPhone" value="${petrolinaConfig.helpPhone}"></td>
  <td><button class="btn" onclick="ptSv('helpPhone','ptHelpPhone')">Save</button></td></tr>
<tr><td>Device Port (devicePort)<br><span style="color:#8b949e;font-size:11px">Port the app binds its callback listener to. Returned by /petrolAppInit &#x2014; the app re-binds on the next init.</span></td>
  <td><input class="m" id="ptDevicePort" value="${petrolinaConfig.devicePort}" style="width:90px"></td>
  <td><button class="btn" onclick="ptSv('devicePort','ptDevicePort')">Save</button></td></tr>
<tr><td>Device IP (deviceIP)<br><span style="color:#8b949e;font-size:11px">Reported by the app on /petrolAppInit. Callbacks go to this address on the port above.</span></td>
  <td>${petrolinaConfig.deviceIP ? `<code>${petrolinaConfig.deviceIP}:${petrolinaConfig.devicePort}</code>` : "<span style='color:#8b949e'>not yet initialised</span>"}</td>
  <td><span style="color:#8b949e;font-size:11px">read&#x2011;only</span></td></tr>
<tr><td>Max Amount (maxAmount)<br><span style="color:#8b949e;font-size:11px">Ceiling on a manually entered unattended amount, in euro.</span></td>
  <td><input class="m" id="ptMaxAmount" value="${petrolinaConfig.maxAmount}" style="width:90px"></td>
  <td><button class="btn" onclick="ptSv('maxAmount','ptMaxAmount')">Save</button></td></tr>
<tr><td>PetrolinaCard PIN (petrolinaPin)<br><span style="color:#8b949e;font-size:11px">The PIN accepted by /petrolinaCard. Any other value returns 01 and the device re-prompts, up to 3 attempts.</span></td>
  <td><input class="m" id="ptPetrolinaPin" value="${petrolinaConfig.petrolinaPin}" style="width:90px"></td>
  <td><button class="btn" onclick="ptSv('petrolinaPin','ptPetrolinaPin')">Save</button></td></tr>
<tr><td>Ask for KM (askForKm)<br><span style="color:#8b949e;font-size:11px">Shows the odometer screen after the PIN.</span></td>
  <td>${petrolinaConfig.askForKm === "Y" ? "&#x2705; Yes" : "No"}</td>
  <td>
    <button class="btn ${petrolinaConfig.askForKm === "Y" ? "green" : ""}" onclick="ptSet2('askForKm','Y')">Yes</button>
    <button class="btn ${petrolinaConfig.askForKm === "N" ? "green" : ""}" onclick="ptSet2('askForKm','N')">No</button>
  </td></tr>
<tr><td>Ask for Reg. No (askForRegNo)<br><span style="color:#8b949e;font-size:11px">Shows the vehicle registration screen.</span></td>
  <td>${petrolinaConfig.askForRegNo === "Y" ? "&#x2705; Yes" : "No"}</td>
  <td>
    <button class="btn ${petrolinaConfig.askForRegNo === "Y" ? "green" : ""}" onclick="ptSet2('askForRegNo','Y')">Yes</button>
    <button class="btn ${petrolinaConfig.askForRegNo === "N" ? "green" : ""}" onclick="ptSet2('askForRegNo','N')">No</button>
  </td></tr>
<tr><td>Fuelling ticks (fuelingEnabled)<br><span style="color:#8b949e;font-size:11px">Sends /fueling every ${petrolinaConfig.fuelingTickSec}s &times;${petrolinaConfig.fuelingTicks} as the fill climbs, then /completion. Off sends the completion alone.</span></td>
  <td>${petrolinaConfig.fuelingEnabled === "1" ? "&#x2705; On" : "Off"}</td>
  <td>
    <button class="btn ${petrolinaConfig.fuelingEnabled === "1" ? "green" : ""}" onclick="ptSet2('fuelingEnabled','1')">On</button>
    <button class="btn ${petrolinaConfig.fuelingEnabled === "0" ? "green" : ""}" onclick="ptSet2('fuelingEnabled','0')">Off</button>
  </td></tr>
<tr><td>PetrolinaCard result (petrolinaCardRc)<br><span style="color:#8b949e;font-size:11px">Returned by /petrolinaCard once the PIN is correct. A decline ends the transaction with abortReason 23.</span></td>
  <td style="font-family:monospace">${petrolinaConfig.petrolinaCardRc} ${petroCardRcText(petrolinaConfig.petrolinaCardRc)}</td>
  <td>
    <button class="btn ${petrolinaConfig.petrolinaCardRc === "00" ? "green" : ""}" onclick="ptSet2('petrolinaCardRc','00')">00 OK</button>
    <button class="btn ${petrolinaConfig.petrolinaCardRc === "02" ? "green" : ""}" onclick="ptSet2('petrolinaCardRc','02')">02 Blocked</button>
    <button class="btn ${petrolinaConfig.petrolinaCardRc === "03" ? "green" : ""}" onclick="ptSet2('petrolinaCardRc','03')">03 Expired</button>
    <button class="btn ${petrolinaConfig.petrolinaCardRc === "04" ? "green" : ""}" onclick="ptSet2('petrolinaCardRc','04')">04 Unknown</button>
    <button class="btn ${petrolinaConfig.petrolinaCardRc === "05" ? "green" : ""}" onclick="ptSet2('petrolinaCardRc','05')">05 Declined</button>
    <button class="btn ${petrolinaConfig.petrolinaCardRc === "06" ? "green" : ""}" onclick="ptSet2('petrolinaCardRc','06')">06 No credit</button>
  </td></tr>
<tr><td>Terminal Mode (terminalMode)</td>
  <td>${petrolinaConfig.terminalMode === "attended" ? "&#x1F6B6; Attended (S1F2, post-pay Sale)" : "&#x26FD; Unattended (S1U2, pre-auth)"}</td>
  <td>
    <button class="btn ${petrolinaConfig.terminalMode === "unattended" ? "green" : ""}" onclick="ptSet2('terminalMode','unattended')">Unattended</button>
    <button class="btn ${petrolinaConfig.terminalMode === "attended" ? "green" : ""}" onclick="ptSet2('terminalMode','attended')">Attended</button>
  </td></tr>
<tr><td>Default Language (defaultLan)</td>
  <td>${petrolinaConfig.defaultLan === "en" ? "&#x1F1EC;&#x1F1E7; English" : "&#x1F1EC;&#x1F1F7; &#x395;&#x3BB;&#x3BB;&#x3B7;&#x3BD;&#x3B9;&#x3BA;&#x3AC;"}</td>
  <td>
    <button class="btn ${petrolinaConfig.defaultLan === "el" ? "green" : ""}" onclick="ptSet2('defaultLan','el')">&#x1F1EC;&#x1F1F7; EL</button>
    <button class="btn ${petrolinaConfig.defaultLan === "en" ? "green" : ""}" onclick="ptSet2('defaultLan','en')">&#x1F1EC;&#x1F1E7; EN</button>
  </td></tr>
<tr><td>Loyalty (isLoyalty)</td>
  <td>${petrolinaConfig.isLoyalty === "1" ? "&#x2705; Enabled" : "Disabled"}</td>
  <td>
    <button class="btn green" onclick="ptSet2('isLoyalty','1')">Enable</button>
    <button class="btn gray" onclick="ptSet2('isLoyalty','0')">Disable</button>
  </td></tr>
</table>
</div>

<h2>&#x26FD; Pump Products</h2>
<table>
<tr><th>Code</th><th>Product</th><th>Price (cents/L)</th><th>&#x20AC;/L</th><th>Image</th></tr>
${petrolinaConfig.pumpProducts.map(g=>`<tr>
  <td style="color:#58a6ff;font-family:monospace">${g.productCode}</td>
  <td>${g.product}</td>
  <td>${g.pricePerLiter}</td>
  <td style="color:#3fb950">&#x20AC;${(g.pricePerLiter/1000).toFixed(3)}</td>
  <td style="color:#8b949e;font-size:11px">${g.image}</td>
</tr>`).join('')}
</table>
<p style="color:#8b949e;font-size:12px">Products are configured in server.js <code>petrolinaConfig.pumpProducts</code>.</p>

<h2>&#x1F9EA; Simulation Controls</h2>
<table>
<tr><th style="width:260px">Setting</th><th style="width:80px">Current</th><th>Edit</th></tr>

<tr><td colspan="3" style="background:#161b22;color:#58a6ff;font-size:11px;letter-spacing:.08em;padding:6px 8px">TIMEOUTS (seconds) â€” returned to app via /petrolAppInit</td></tr>
<tr><td>pumpSelectedTO<br><span style="color:#8b949e;font-size:11px">Wait for pump selection</span></td>
  <td>${petrolinaConfig.pumpSelectedTO}s</td>
  <td><input type="number" id="pt_pumpSelectedTO" value="${petrolinaConfig.pumpSelectedTO}" style="width:70px">
  <button class="btn" onclick="ptSet('pumpSelectedTO',Number(document.getElementById('pt_pumpSelectedTO').value))">Set</button></td></tr>
<tr><td>memberOfMyPetrolinaTO<br><span style="color:#8b949e;font-size:11px">Wait for "are you a MyPetrolina member?" answer</span></td>
  <td>${petrolinaConfig.memberOfMyPetrolinaTO}s</td>
  <td><input type="number" id="pt_memberTO" value="${petrolinaConfig.memberOfMyPetrolinaTO}" style="width:70px">
  <button class="btn" onclick="ptSet('memberOfMyPetrolinaTO',Number(document.getElementById('pt_memberTO').value))">Set</button></td></tr>
<tr><td>phoneForMyPetrolinaTO<br><span style="color:#8b949e;font-size:11px">Wait for phone number entry</span></td>
  <td>${petrolinaConfig.phoneForMyPetrolinaTO}s</td>
  <td><input type="number" id="pt_phoneTO" value="${petrolinaConfig.phoneForMyPetrolinaTO}" style="width:70px">
  <button class="btn" onclick="ptSet('phoneForMyPetrolinaTO',Number(document.getElementById('pt_phoneTO').value))">Set</button></td></tr>
<tr><td>confirmMyPetrolinaTO<br><span style="color:#8b949e;font-size:11px">Wait for loyalty account confirmation</span></td>
  <td>${petrolinaConfig.confirmMyPetrolinaTO}s</td>
  <td><input type="number" id="pt_confirmTO" value="${petrolinaConfig.confirmMyPetrolinaTO}" style="width:70px">
  <button class="btn" onclick="ptSet('confirmMyPetrolinaTO',Number(document.getElementById('pt_confirmTO').value))">Set</button></td></tr>
<tr><td>insertPetrolinaCardTO<br><span style="color:#8b949e;font-size:11px">Wait for Petrolina card insert + PIN</span></td>
  <td>${petrolinaConfig.insertPetrolinaCardTO}s</td>
  <td><input type="number" id="pt_insertCardTO" value="${petrolinaConfig.insertPetrolinaCardTO}" style="width:70px">
  <button class="btn" onclick="ptSet('insertPetrolinaCardTO',Number(document.getElementById('pt_insertCardTO').value))">Set</button></td></tr>
<tr><td>fuelSelectionTO<br><span style="color:#8b949e;font-size:11px">Wait for fuel grade selection</span></td>
  <td>${petrolinaConfig.fuelSelectionTO}s</td>
  <td><input type="number" id="pt_fuelSelTO" value="${petrolinaConfig.fuelSelectionTO}" style="width:70px">
  <button class="btn" onclick="ptSet('fuelSelectionTO',Number(document.getElementById('pt_fuelSelTO').value))">Set</button></td></tr>
<tr><td>selectAmountTO<br><span style="color:#8b949e;font-size:11px">Wait for amount selection</span></td>
  <td>${petrolinaConfig.selectAmountTO}s</td>
  <td><input type="number" id="pt_selAmtTO" value="${petrolinaConfig.selectAmountTO}" style="width:70px">
  <button class="btn" onclick="ptSet('selectAmountTO',Number(document.getElementById('pt_selAmtTO').value))">Set</button></td></tr>
<tr><td>enterAmountTO<br><span style="color:#8b949e;font-size:11px">Wait for manual amount entry</span></td>
  <td>${petrolinaConfig.enterAmountTO}s</td>
  <td><input type="number" id="pt_entAmtTO" value="${petrolinaConfig.enterAmountTO}" style="width:70px">
  <button class="btn" onclick="ptSet('enterAmountTO',Number(document.getElementById('pt_entAmtTO').value))">Set</button></td></tr>
<tr><td>displayStartFuelingTO<br><span style="color:#8b949e;font-size:11px">Wait before expecting completion callback</span></td>
  <td>${petrolinaConfig.displayStartFuelingTO}s</td>
  <td><input type="number" id="pt_startFuelTO" value="${petrolinaConfig.displayStartFuelingTO}" style="width:70px">
  <button class="btn" onclick="ptSet('displayStartFuelingTO',Number(document.getElementById('pt_startFuelTO').value))">Set</button></td></tr>
<tr><td>displayAskKM<br><span style="color:#8b949e;font-size:11px">Wait for odometer entry (Petrolina card)</span></td>
  <td>${petrolinaConfig.displayAskKM}s</td>
  <td><input type="number" id="pt_askKmTO" value="${petrolinaConfig.displayAskKM}" style="width:70px">
  <button class="btn" onclick="ptSet('displayAskKM',Number(document.getElementById('pt_askKmTO').value))">Set</button></td></tr>
<tr><td>displayAskRegNo<br><span style="color:#8b949e;font-size:11px">Wait for car registration entry (Petrolina card)</span></td>
  <td>${petrolinaConfig.displayAskRegNo}s</td>
  <td><input type="number" id="pt_askRegTO" value="${petrolinaConfig.displayAskRegNo}" style="width:70px">
  <button class="btn" onclick="ptSet('displayAskRegNo',Number(document.getElementById('pt_askRegTO').value))">Set</button></td></tr>
<tr><td>displayScreenFuelingTO<br><span style="color:#8b949e;font-size:11px">How long to show the fueling progress screen</span></td>
  <td>${petrolinaConfig.displayScreenFuelingTO}s</td>
  <td><input type="number" id="pt_screenFuelTO" value="${petrolinaConfig.displayScreenFuelingTO}" style="width:70px">
  <button class="btn" onclick="ptSet('displayScreenFuelingTO',Number(document.getElementById('pt_screenFuelTO').value))">Set</button></td></tr>

<tr><td colspan="3" style="background:#161b22;color:#58a6ff;font-size:11px;letter-spacing:.08em;padding:6px 8px">SIMULATION</td></tr>
<tr><td>Auto-completion callback delay (sec)<br><span style="color:#8b949e;font-size:11px">After /preAuthorization or /confirmPetrolinaCard, before callback fires</span></td>
  <td>${petrolinaConfig.callbackDelaySec}s</td>
  <td><input type="number" id="ptDelay" value="${petrolinaConfig.callbackDelaySec}" style="width:80px">
  <button class="btn" onclick="ptSet('callbackDelaySec',Number(document.getElementById('ptDelay').value))">Set</button></td></tr>
<tr><td>Actual amount (cents)<br><span style="color:#8b949e;font-size:11px">0 = random (&#x20AC;5 to pre-auth max)</span></td>
  <td>${petrolinaConfig.actualAmountCents} ${petrolinaConfig.actualAmountCents?'= &#x20AC;'+(petrolinaConfig.actualAmountCents/100).toFixed(2):'(random)'}</td>
  <td><input type="number" id="ptActual" value="${petrolinaConfig.actualAmountCents}" style="width:100px">
  <button class="btn" onclick="ptSet('actualAmountCents',Number(document.getElementById('ptActual').value))">Set</button></td></tr>
<tr><td>Pre-auth result</td>
  <td id="ptAuthResultVal" style="color:${petrolinaConfig.preAuthResult==='ok'?'#3fb950':'#ff6b6b'};font-weight:bold">${petrolinaConfig.preAuthResult==='ok'?'&#x2705; OK':'&#x274C; FAIL'}</td>
  <td>
    <button class="btn green" onclick="ptSet2('preAuthResult','ok')">&#x2705; OK</button>
    <button class="btn red" onclick="ptSet2('preAuthResult','fail')">&#x274C; Fail</button>
  </td></tr>
<tr><td>Force error (responseCode)</td>
  <td>${petrolinaConfig.responseCode}</td>
  <td>
    <button class="btn green" onclick="ptSet2('responseCode','00')">00 OK</button>
    <button class="btn red" onclick="ptSet2('responseCode','91')">91 Error</button>
  </td></tr>
</table>

<h2>&#x1F504; Active Transactions</h2>
<div id="ptTransDiv" style="background:#161b22;border:1px solid #30363d;border-radius:6px;padding:12px;margin-bottom:16px;font-size:13px">
  <span style="color:#8b949e">Loading transactions...</span>
</div>

<h2>&#x26A1; Manual OPT&#x2192;App Callbacks</h2>
<p style="color:#8b949e;font-size:12px">Enter a transsegno and callbackBase (e.g. <code>http://192.168.x.x:8080</code>) then fire.</p>
<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
  <span style="color:#8b949e">transsegno:</span>
  <input type="text" id="ptManualTranssegno" placeholder="e.g. 1001" style="width:120px">
  <span style="color:#8b949e">callbackBase:</span>
  <input type="text" id="ptManualCallbackBase" placeholder="http://192.168.x.x:8080" style="width:220px">
</div>
<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
  <span style="color:#8b949e">Amount (cents):</span>
  <input type="number" id="ptManualAmount" value="3500" style="width:110px">
  <span style="color:#8b949e;font-size:11px">(= &#x20AC;<span id="ptManualEuros">35.00</span>)</span>
  <button class="btn orange" style="background:#e07b00;padding:8px 20px;font-size:13px" onclick="ptFireCompletion()">&#x26FD; Fire Completion</button>
  <button class="btn red" style="padding:8px 20px;font-size:13px" onclick="ptFireReversal()">&#x21A9; Fire Reversal</button>
  <span id="ptCallbackResult" style="font-size:12px"></span>
</div>

<div style="background:#161b22;border:1px solid #30363d;border-radius:6px;padding:12px;margin-bottom:16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
  <span style="color:#8b949e;font-size:12px">OPT&#x2192;App control callbacks (uses the callbackBase above, or the last one the app reported):</span>
  <button class="btn" style="padding:8px 16px;font-size:13px" onclick="ptFireBatchClosure()">&#x1F4E6; Batch Closure</button>
  <span style="color:#8b949e;font-size:11px">txns</span>
  <input type="number" id="ptBcTxns" value="11" style="width:70px">
  <span style="color:#8b949e;font-size:11px">total &#x20AC;</span>
  <input type="number" id="ptBcTotal" value="931.20" step="0.01" style="width:90px">
  <button class="btn red" style="padding:8px 16px;font-size:13px" onclick="ptFireServiceChange('out')">&#x26D4; Out of Service</button>
  <button class="btn green" style="padding:8px 16px;font-size:13px" onclick="ptFireServiceChange('in')">&#x2705; In Service</button>
  <button class="btn" style="padding:8px 16px;font-size:13px" onclick="ptFireGetStatus()">&#x2753; Get Status</button>
  <span id="ptCtrlResult" style="font-size:12px"></span>
</div>

<div style="background:#161b22;border:1px solid #30363d;border-radius:6px;padding:12px;margin-bottom:16px">
  <div style="color:#8b949e;font-size:12px;margin-bottom:8px">ATTENDED MODE &#x2014; simulate a car that has already fuelled, then pay for it on the portable device</div>
  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
    <span style="color:#8b949e;font-size:11px">pump</span>
    <input type="number" id="ptUpPump" value="1" style="width:60px">
    <span style="color:#8b949e;font-size:11px">litres</span>
    <input type="number" id="ptUpLitres" value="29.07" step="0.01" style="width:90px">
    <span style="color:#8b949e;font-size:11px">amount &#x20AC;</span>
    <input type="number" id="ptUpAmount" value="50.00" step="0.01" style="width:90px">
    <button class="btn green" style="padding:8px 16px;font-size:13px" onclick="ptAddUnpaid()">&#x2795; Add Unpaid Fuelling</button>
    <button class="btn" style="padding:8px 16px;font-size:13px" onclick="ptLoadUnpaid()">&#x1F504; Refresh</button>
    <button class="btn red" style="padding:8px 16px;font-size:13px" onclick="ptClearUnpaid()">Clear All</button>
    <span style="margin-left:14px;color:#8b949e;font-size:11px">saleAdvice:</span>
    <button class="btn ${petrolinaConfig.failSaleAdvice === "0" ? "green" : ""}" style="padding:8px 14px;font-size:12px" onclick="ptSet2('failSaleAdvice','0')">Accept</button>
    <button class="btn ${petrolinaConfig.failSaleAdvice === "1" ? "red" : ""}" style="padding:8px 14px;font-size:12px" onclick="ptSet2('failSaleAdvice','1')">&#x26A0; Fail (test queue)</button>
  </div>
  <div id="ptUnpaidList" style="margin-top:10px;font-family:monospace;font-size:11px;color:#8b949e"></div>
</div>

<h2>&#x1F4CB; Petrolina Request Log</h2>
<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap">
  <button class="btn gray" onclick="ptSetFilter('')">All</button>
  <button class="btn" style="background:#1f6feb" onclick="ptSetFilter('petrolAppInit')">Init</button>
  <button class="btn green" onclick="ptSetFilter('optTransaction')">OPT Tran</button>
  <button class="btn" style="background:#6e40c9" onclick="ptSetFilter('preAuthorization')">Pre-Auth</button>
  <button class="btn orange" onclick="ptSetFilter('CALLBACK')">Callback</button>
  <button class="btn gray" onclick="ptSetFilter('abortTransaction')">Abort</button>
  <button class="btn gray" onclick="ptSetFilter('help')">Help</button>
  <span style="margin-left:auto">
    <button class="btn red" onclick="ptClearLogs()">&#x1F5D1; Clear</button>
  </span>
</div>
<div id="ptLogCount" style="color:#8b949e;font-size:11px;margin-bottom:8px"></div>
<div id="ptLogDiv"><p style="color:#8b949e">Loading...</p></div>
</div>

<!-- Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â FAIRWAY TAB Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â -->
<div id="tab-fairway" class="tab-content">
<h1>&#x2708;&#xFE0F; Fairway API Mock</h1>
<p style="color:#8b949e">Simulates <code>http://identity.hermesairports.com</code> (OAuth2 token) and <code>https://fairway-api.hermesairports.com</code> (API methods).</p>
<p style="color:#8b949e;font-size:12px">
  App points to: <code style="color:#58a6ff">${process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'}/connect/token</code> for auth
  &nbsp;|&nbsp; <code style="color:#58a6ff">${process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'}/fairway/</code> for API methods
</p>

<h2>&#x1F511; OAuth2 Credentials</h2>
<div class="pos-box" style="border-color:#1D9E75">
<table>
<tr><th style="width:180px">Parameter</th><th>Value</th><th style="width:100px"></th></tr>
<tr>
  <td>Client ID</td>
  <td><input class="m" id="fwClientId" value="${fairwayConfig.clientId}"></td>
  <td><button class="btn" onclick="fwSv('clientId','fwClientId')">Save</button></td>
</tr>
<tr>
  <td>Client Secret</td>
  <td><input class="m" id="fwClientSecret" value="${fairwayConfig.clientSecret}"></td>
  <td><button class="btn" onclick="fwSv('clientSecret','fwClientSecret')">Save</button></td>
</tr>
<tr>
  <td>Scope</td>
  <td><input class="m" id="fwScope" value="${fairwayConfig.scope}"></td>
  <td><button class="btn" onclick="fwSv('scope','fwScope')">Save</button></td>
</tr>
<tr>
  <td>Token expires_in (sec)</td>
  <td><input class="n" type="number" id="fwExpiry" value="${fairwayConfig.tokenExpiresIn}"></td>
  <td><button class="btn" onclick="fwSet('tokenExpiresIn',Number(document.getElementById('fwExpiry').value))">Set</button></td>
</tr>
<tr>
  <td>Require Bearer Auth</td>
  <td>${fairwayConfig.requireAuth ? '&#x2705; Yes' : '&#x26D4; No (open)'}</td>
  <td>
    <button class="btn green" onclick="fwSet('requireAuth',true)">&#x2705; Yes</button>
    <button class="btn red" onclick="fwSet('requireAuth',false)">&#x26D4; No</button>
  </td>
</tr>
<tr>
  <td>Force Response Code</td>
  <td>${fairwayConfig.responseCode}</td>
  <td>
    <button class="btn green" onclick="fwSet2('responseCode','200')">200 OK</button>
    <button class="btn red" onclick="fwSet2('responseCode','401')">401 Unauthorized</button>
    <button class="btn red" onclick="fwSet2('responseCode','500')">500 Error</button>
  </td>
</tr>
</table>
</div>

<h2>&#x1F9EE; Current Token</h2>
<div id="fwTokenDiv" style="background:#161b22;border:1px solid #30363d;border-radius:6px;padding:12px;font-size:12px;font-family:monospace">
${fairwayCurrentToken
  ? `<span style="color:#3fb950">Active Ã¢â‚¬â€ expires in ${Math.max(0,Math.floor((fairwayTokenExpiry-Date.now())/1000))}s</span><br><span style="color:#8b949e">${fairwayCurrentToken}</span>`
  : '<span style="color:#8b949e">No token issued yet Ã¢â‚¬â€ app must call POST /connect/token first</span>'}
</div>
<button class="btn red" onclick="fwClearToken()" style="margin-top:8px">&#x1F5D1; Invalidate Token</button>

<h2>&#x1F4E1; API Methods</h2>
<p style="color:#8b949e;font-size:12px">Each method maps to <code>POST /fairway/{methodName}</code>. Pass <code>help=1</code> to discover parameters.</p>
<table>
<tr><th>Method</th><th>Parameters</th><th>Mock Data (JSON)</th><th></th></tr>
${Object.entries(fairwayMethods).map(([name, def]) => `
<tr style="vertical-align:top">
  <td style="font-family:monospace;color:#58a6ff;padding-top:10px">${name}</td>
  <td style="font-size:11px;color:#8b949e;padding-top:10px">${def.params.map(p=>p.name+' ('+p.type+')').join('<br>')}</td>
  <td><textarea id="fwMethod_${name}" rows="3" style="width:100%;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;padding:4px;font-family:monospace;font-size:11px;border-radius:4px">${JSON.stringify(def.data,null,2)}</textarea></td>
  <td style="padding-top:6px"><button class="btn" onclick="fwSaveMethod('${name}')">Save</button></td>
</tr>`).join('')}
</table>
<div style="margin-top:12px;display:flex;gap:8px;align-items:center">
  <input class="m" id="fwNewMethodName" placeholder="new_method_name">
  <button class="btn green" onclick="fwAddMethod()">+ Add Method</button>
</div>

<h2>&#x1F4CB; Fairway Request Log</h2>
<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
  <button class="btn gray" onclick="fwSetFilter('')">All</button>
  <button class="btn green" onclick="fwSetFilter('/connect/token')">Token</button>
  <button class="btn" style="background:#1f6feb" onclick="fwSetFilter('parking')">Parking</button>
  <button class="btn" style="background:#6e40c9" onclick="fwSetFilter('flight')">Flights</button>
  <span style="margin-left:auto">
    <button class="btn red" onclick="fwClearLogs()">&#x1F5D1; Clear</button>
  </span>
</div>
<div id="fwLogDiv"><p style="color:#8b949e">Loading...</p></div>
</div>

<script>

function showTab(name, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  btn.classList.add('active');
  localStorage.setItem('activeTab', name);
}
// Restore active tab after reload
(function() {
  const saved = localStorage.getItem('activeTab');
  if (!saved || saved === 'parking') return;
  const tab = document.getElementById('tab-' + saved);
  if (!tab) return;
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active');
    if ((b.getAttribute('onclick') || '').includes("'" + saved + "'")) b.classList.add('active');
  });
  tab.classList.add('active');
})();

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
        '<span style="color:'+col+';font-weight:bold;font-size:12px">'+(isTell?'Ã°Å¸â€Å’ ':'')+l.method+' '+l.endpoint+'</span>'+
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
  else showS('Ã¢Å“â€” Error: '+d.error,true);
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
    else showS('Ã¢Å“â€” '+d.error,true);
  }catch(e){showS('Ã¢Å“â€” '+e.message,true);}
}
async function openNow(){
  showS('Sending open command...',false);
  try{
    const r=await fetch('/admin/tell-open',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const d=await r.json();
    if(d.ok) showS('OK Barrier open command sent OK',false);
    else showS('Ã¢Å“â€” '+d.error,true);
  }catch(e){showS('Ã¢Å“â€” '+e.message,true);}
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
      el.textContent='Ã¢Å“â€” '+d.error;
    }
  }catch(e){
    el.style.color='#f85149';
    el.textContent='Ã¢Å“â€” '+e.message;
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
    const in1Text=s.in1===1?'Ã°Å¸Å¸Â  Car Present':'Ã°Å¸Å¸Â¢ No Car';
    const in2Color=s.in2===1?'#E65100':'#238636';
    const in2Text=s.in2===1?'Ã°Å¸Å¸Â  Car Present':'Ã°Å¸Å¸Â¢ No Car';
    const barrierColor=s.in4!==0?'#C62828':'#238636';
    const barrierText=s.in4!==0?'Ã°Å¸â€Â´ Barrier OPEN':'Ã°Å¸Å¸Â¢ Barrier Closed';
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
        '<div style="font-size:14px;font-weight:500;color:'+out1Color+'">'+(s.out1===1?'Ã°Å¸â€Âµ Active':'Ã¢Å¡Âª Idle')+'</div>'+
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
  }catch(e){el.textContent='Ã¢Å“â€” Error: '+e.message;}
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

// Ã¢â€â‚¬Ã¢â€â‚¬ Rental tab JS Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
let rentalFilter='', rentalLogs=[];
function setRentalFilter(f){rentalFilter=f;renderRentalLogs();}
function renderRentalLogs(){
  const filtered=rentalFilter?rentalLogs.filter(l=>l.endpoint.toLowerCase().includes(rentalFilter.toLowerCase())):rentalLogs;
  const el=document.getElementById('rentalLogDiv');
  if(!filtered.length){el.innerHTML='<p style="color:#8b949e">No rental requests yet</p>';return;}
  el.innerHTML=filtered.map(function(l){
    const rc=(l.response&&l.response.responseCode)||'';
    const rcCol=rc==='00'?'#3fb950':rc?'#ff6b6b':'#8b949e';
    const isStop=l.endpoint.includes('stop');
    const isInit=l.endpoint.includes('Init');
    const borderCol=isStop?'#e65100':isInit?'#1f6feb':'#1D9E75';
    return '<div style="background:#0d1117;border:1px solid '+borderCol+';border-radius:6px;padding:10px;margin-bottom:8px">'+
      '<div style="display:flex;gap:8px;margin-bottom:6px;flex-wrap:wrap">'+
        '<span style="color:#8b949e;font-size:11px">'+l.time+'</span>'+
        '<span style="color:'+borderCol+';font-weight:bold;font-size:12px">'+l.method+' '+l.endpoint+'</span>'+
        (rc?'<span style="margin-left:auto;color:'+rcCol+';font-size:12px;font-weight:bold">RC: '+rc+'</span>':'')+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+
        '<div><div style="color:#8b949e;font-size:10px;margin-bottom:2px">REQUEST</div><pre>'+JSON.stringify(l.request,null,2)+'</pre></div>'+
        '<div><div style="color:#3fb950;font-size:10px;margin-bottom:2px">RESPONSE</div><pre style="border-left:3px solid '+rcCol+'">'+JSON.stringify(l.response,null,2)+'</pre></div>'+
      '</div></div>';
  }).join('');
}
async function loadRentalLogs(){
  try{const r=await fetch('/rental/logs');rentalLogs=await r.json();renderRentalLogs();}catch(e){}
}
async function clearRentalLogs(){
  if(!confirm('Clear rental logs?'))return;
  await fetch('/rental/logs',{method:'DELETE'});rentalLogs=[];renderRentalLogs();
}
async function rnSet(k,v){
  await fetch('/admin/rental-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k,value:v})});
  location.reload();
}
async function rnSv(key,id){
  const v=document.getElementById(id).value.trim();
  const r=await fetch('/admin/rental-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,value:v})});
  const d=await r.json();
  if(d.ok) location.reload(); else alert('Error: '+d.error);
}
async function saveRentalCfg(key,id){
  const v=document.getElementById(id).value.trim();
  const r=await fetch('/admin/rental-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,value:v})});
  const d=await r.json();
  if(d.ok) location.reload(); else alert('Error: '+d.error);
}
async function addRentalCharge(){
  const upToMins=parseInt(document.getElementById('rnChTo').value)||(-1);
  const fee=parseInt(document.getElementById('rnChFee').value);
  if(!fee){alert('Fee is required');return;}
  await fetch('/admin/rental-add-charge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({upToMins,fee})});
  location.reload();
}
async function removeRentalCharge(i){
  await fetch('/admin/rental-remove-charge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({index:i})});
  location.reload();
}
async function clearRentals(){
  if(!confirm('Clear all active rentals?'))return;
  await fetch('/admin/rental-clear',{method:'POST'});location.reload();
}
async function setRentalItemAvail(itemId,avail){
  await fetch('/admin/rental-item-avail',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({itemId,available:avail})});
  location.reload();
}
async function loadRentals(){
  try{
    const r=await fetch('/rental/rentals');const items=await r.json();
    const el=document.getElementById('rentalsDiv');const cnt=document.getElementById('rentalCount');
    if(!el)return;cnt.textContent='('+items.length+')';
    if(!items.length){el.innerHTML='<table><tr><td style="color:#8b949e">No active rentals</td></tr></table>';return;}
    const now=Date.now();
    el.innerHTML='<table><tr><th>Entry/Rental ID</th><th>Item</th><th>Last4</th><th>Code</th><th>Pre-Auth</th><th>Start</th><th>Duration</th><th>Auth</th></tr>'+
      items.map(function(item){
        const mins=Math.floor((now-(item.startTime||now))/60000);
        const secs=Math.floor(((now-(item.startTime||now))%60000)/1000);
        const id=item.entryId||item.rentalId||'?';
        return '<tr style="background:#0a1a0a">'+
          '<td style="font-family:monospace;font-size:11px;color:#1D9E75">'+id+'</td>'+
          '<td style="font-size:11px">'+(item.itemId||'-')+(item.itemType?' ('+item.itemType+')':'')+'</td>'+
          '<td style="font-family:monospace">****'+(item.lastDigits||'')+'</td>'+
          '<td style="font-family:monospace;color:#e3b341">'+(item.unlockCode||'-')+'</td>'+
          '<td style="color:#3fb950">&#x20AC;'+((item.preAuthAmountCents||0)/100).toFixed(2)+'</td>'+
          '<td style="font-size:11px">'+new Date(item.startTime).toLocaleTimeString()+'</td>'+
          '<td style="color:#e3b341">'+mins+'m '+secs+'s</td>'+
          '<td style="font-family:monospace;font-size:11px">'+(item.authCode||'')+'</td>'+
          '</tr>';
      }).join('')+'</table>';
  }catch(e){}
}
async function loadRentalPending(){
  try{
    const r=await fetch('/admin/rental-pending-captures');const items=await r.json();
    const el=document.getElementById('rentalPendingDiv');const cnt=document.getElementById('rentalPendingCount');
    if(!el)return;
    const active=items.filter(i=>i.status!=='RESOLVED');
    cnt.textContent='('+active.length+' active)';
    if(!items.length){el.innerHTML='<table><tr><td style="color:#8b949e">No pending rental captures</td></tr></table>';return;}
    const sc={'PENDING':'#e3b341','FAILED':'#f85149','RESOLVED':'#3fb950'};
    el.innerHTML='<table><tr><th>ID</th><th>Time</th><th>Rental ID</th><th>Card</th><th>Amount</th><th>Retries</th><th>Status</th><th>Last Error</th></tr>'+
      items.map(function(p){
        var c=sc[p.status]||'#8b949e';
        return '<tr style="background:'+(p.status==='RESOLVED'?'#0d2010':p.status==='FAILED'?'#2a0d0d':'#1a1200')+'">'+
          '<td style="font-family:monospace;font-size:11px">'+p.id+'</td>'+
          '<td style="font-size:11px">'+p.createdAt+'</td>'+
          '<td style="font-family:monospace;font-size:11px;color:#1D9E75">'+(p.session&&p.session.rentalId||'?')+'</td>'+
          '<td style="font-family:monospace">****'+(p.session&&p.session.lastDigits||'??')+'</td>'+
          '<td style="color:#3fb950">&#x20AC;'+(p.amountCents/100).toFixed(2)+'</td>'+
          '<td>'+p.retries+'</td>'+
          '<td style="color:'+c+';font-weight:bold">'+p.status+'</td>'+
          '<td style="font-size:11px;color:#f85149">'+(p.lastError||'-')+'</td>'+
          '</tr>';
      }).join('')+'</table>';
  }catch(e){}
}


// Ã¢â€â‚¬Ã¢â€â‚¬ Car Wash Tab JS Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
let cwFilter='', cwAllLogs=[];

function cwSetFilter(f){cwFilter=f;cwRenderLogs();}

async function cwSet(k,v){
  await fetch('/admin/carwash-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k,value:v})});
  location.reload();
}
async function cwSv(key,id){
  const v=document.getElementById(id).value.trim();
  const r=await fetch('/admin/carwash-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,value:v})});
  const d=await r.json();
  if(d.ok) location.reload(); else alert('Error: '+d.error);
}
async function cwClearSessions(){
  if(!confirm('Clear all active wash sessions?')) return;
  await fetch('/admin/carwash-clear-sessions',{method:'POST'});
  loadCwSessions();
}
async function cwClearLogs(){
  if(!confirm('Clear car wash logs?')) return;
  await fetch('/admin/carwash-clear-logs',{method:'POST'});
  cwAllLogs=[];cwRenderLogs();
}

async function loadCwSessions(){
  try{
    const r=await fetch('/admin/carwash-sessions');
    const items=await r.json();
    const el=document.getElementById('cwSessionsDiv');
    const cnt=document.getElementById('cwSessionCount');
    if(!el) return;
    cnt.textContent='('+items.length+')';
    if(!items.length){
      el.innerHTML='<table><tr><td colspan="5" style="color:#8b949e">No active wash sessions</td></tr></table>';
      return;
    }
    const now=Date.now();
    el.innerHTML='<table><tr><th>Wash ID</th><th>Last4</th><th>Pre-Auth</th><th>Started</th><th>Running</th></tr>'+
      items.map(function(s){
        const mins=Math.floor((now-(s.startTime||now))/60000);
        const secs=Math.floor(((now-(s.startTime||now))%60000)/1000);
        return '<tr style="background:#0a1a2e">'+
          '<td style="font-family:monospace;font-size:11px;color:#1F9E8E">'+s.washId+'</td>'+
          '<td>****'+(s.lastDigits||'')+'</td>'+
          '<td style="color:#3fb950">&#x20AC;'+(s.preAuthAmountCents/100).toFixed(2)+'</td>'+
          '<td style="font-size:11px">'+new Date(s.startTime).toLocaleTimeString()+'</td>'+
          '<td style="color:#e3b341">'+mins+'m '+secs+'s</td>'+
          '</tr>';
      }).join('')+'</table>';
  }catch(e){}
}

async function loadCwPending(){
  try{
    const r=await fetch('/admin/carwash-pending-captures');
    const items=await r.json();
    const el=document.getElementById('cwPendingDiv');
    const cnt=document.getElementById('cwPendingCount');
    if(!el) return;
    const active=items.filter(i=>i.status!=='RESOLVED');
    cnt.textContent='('+active.length+' active)';
    if(!items.length){
      el.innerHTML='<table><tr><td style="color:#8b949e">No pending wash captures</td></tr></table>';
      return;
    }
    const sc={'PENDING':'#e3b341','FAILED':'#f85149','RESOLVED':'#3fb950'};
    el.innerHTML='<table><tr><th>ID</th><th>Time</th><th>Wash ID</th><th>Card</th><th>Amount</th><th>Retries</th><th>Status</th><th>Last Error</th></tr>'+
      items.map(function(p){
        var c=sc[p.status]||'#8b949e';
        return '<tr style="background:'+(p.status==='RESOLVED'?'#0d2010':p.status==='FAILED'?'#2a0d0d':'#1a1200')+'">'+
          '<td style="font-family:monospace;font-size:11px">'+p.id+'</td>'+
          '<td style="font-size:11px">'+p.createdAt+'</td>'+
          '<td style="font-family:monospace;font-size:11px;color:#1F9E8E">'+(p.session&&p.session.washId||'?')+'</td>'+
          '<td style="font-family:monospace">****'+(p.session&&p.session.lastDigits||'??')+'</td>'+
          '<td style="color:#3fb950">&#x20AC;'+(p.amountCents/100).toFixed(2)+'</td>'+
          '<td>'+p.retries+'</td>'+
          '<td style="color:'+c+';font-weight:bold">'+p.status+'</td>'+
          '<td style="font-size:11px;color:#f85149">'+(p.lastError||'-')+'</td>'+
          '</tr>';
      }).join('')+'</table>';
  }catch(e){}
}

async function loadCwLogs(){
  try{
    const r=await fetch('/admin/carwash-logs');
    cwAllLogs=await r.json();
    cwRenderLogs();
  }catch(e){}
}

function cwRenderLogs(){
  const filtered=cwFilter
    ?cwAllLogs.filter(l=>l.endpoint.toLowerCase().includes(cwFilter.toLowerCase()))
    :cwAllLogs;
  const countEl=document.getElementById('cwLogCount');
  if(countEl) countEl.textContent=filtered.length+' of '+cwAllLogs.length+' entries'+(cwFilter?' Ã¢â‚¬â€ filter: '+cwFilter:'');
  const el=document.getElementById('cwLogDiv');
  if(!el) return;
  if(!filtered.length){el.innerHTML='<p style="color:#8b949e">No entries match filter</p>';return;}
  el.innerHTML=filtered.map(function(l){
    const rc=(l.response&&l.response.responseCode)||'';
    const isStart=l.endpoint.includes('washStart');
    const isStop=l.endpoint.includes('washStop');
    const col=isStart?'#1F9E8E':isStop?'#e65100':l.endpoint.includes('Init')?'#1f6feb':'#555';
    const rcCol=rc==='00'?'#3fb950':rc?'#f85149':'#8b949e';
    return '<div style="background:#0d1117;border:1px solid '+col+';border-radius:6px;padding:10px;margin-bottom:8px">'+
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">'+
        '<span style="color:#8b949e;font-size:11px">'+l.time+'</span>'+
        '<span style="color:'+col+';font-weight:bold;font-size:12px">'+l.method+' '+l.endpoint+'</span>'+
        (rc?'<span style="margin-left:auto;color:'+rcCol+';font-size:12px;font-weight:bold">RC: '+rc+'</span>':'')+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+
        '<div><div style="color:#8b949e;font-size:10px;margin-bottom:2px">REQUEST</div>'+
          '<pre>'+JSON.stringify(l.request,null,2)+'</pre></div>'+
        '<div><div style="color:#3fb950;font-size:10px;margin-bottom:2px">RESPONSE</div>'+
          '<pre style="border-left:3px solid '+rcCol+'">'+JSON.stringify(l.response,null,2)+'</pre></div>'+
      '</div></div>';
  }).join('');
}

loadCwSessions();setInterval(loadCwSessions,4000);
loadCwPending();setInterval(loadCwPending,8000);
loadCwLogs();setInterval(loadCwLogs,3000);

loadLogs();setInterval(loadLogs,3000);
loadJccLogs();setInterval(loadJccLogs,3000);
loadJccTransaction();setInterval(loadJccTransaction,3000);
loadActiveEntries();setInterval(loadActiveEntries,5000);
loadTellStatus();setInterval(loadTellStatus,5000);
loadRejections();setInterval(loadRejections,5000);
loadEcrDeclines();setInterval(loadEcrDeclines,5000);
loadPendingCaptures();setInterval(loadPendingCaptures,10000);
loadRentalLogs();setInterval(loadRentalLogs,3000);
loadRentals();setInterval(loadRentals,5000);
loadRentalPending();setInterval(loadRentalPending,8000);

// â”€â”€ Petrolina JS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let ptAllLogs=[]; let ptFilter='';

function ptSetFilter(f){ptFilter=f;ptRenderLogs();}

function ptRenderLogs(){
  const logs=ptFilter?ptAllLogs.filter(l=>(l.method+' '+l.path).toLowerCase().includes(ptFilter.toLowerCase())):ptAllLogs;
  const el=document.getElementById('ptLogDiv');
  const cnt=document.getElementById('ptLogCount');
  if(!el) return;
  cnt.textContent='Showing '+logs.length+' of '+ptAllLogs.length+' entries';
  if(!logs.length){el.innerHTML='<p style="color:#8b949e">No logs yet.</p>';return;}
  el.innerHTML='<table><tr><th style="width:75px">Time</th><th style="width:60px">Method</th><th style="width:180px">Endpoint</th><th>Request</th><th>Response</th></tr>'+
    logs.map(function(l){
      const col=l.path.includes('preAuth')?'#3fb950':l.path.includes('CALLBACK')||l.path.includes('REVERSAL')?'#e07b00':l.path.includes('optTran')?'#6e40c9':l.path.includes('abort')?'#ff6b6b':l.path.includes('help')?'#8b949e':'#58a6ff';
      return '<tr><td style="color:#8b949e">'+l.time+'</td>'+
        '<td style="color:#8b949e">'+l.method+'</td>'+
        '<td style="color:'+col+';font-family:monospace">'+l.path+'</td>'+
        '<td><pre style="max-height:80px;overflow:auto;background:#0d1117;padding:4px;font-size:10px;margin:0">'+JSON.stringify(l.req,null,1)+'</pre></td>'+
        '<td><pre style="max-height:80px;overflow:auto;background:#0d1117;padding:4px;font-size:10px;margin:0">'+JSON.stringify(l.res,null,1)+'</pre></td></tr>';
    }).join('')+'</table>';
}

async function loadPtLogs(){
  try{const r=await fetch('/petrolina/logs');ptAllLogs=await r.json();ptRenderLogs();}catch(e){}
}

async function loadPtTransactions(){
  try{
    const txns=await fetch('/petrolina/transactions').then(r=>r.json());
    const el=document.getElementById('ptTransDiv');if(!el)return;
    const keys=Object.keys(txns);
    if(!keys.length){el.innerHTML='<span style="color:#8b949e">No active transactions.</span>';return;}
    el.innerHTML='<table><tr><th>transsegno</th><th>UUID</th><th>terminal</th><th>pumpId</th><th>state</th><th>callbackBase</th></tr>'+
      keys.map(k=>{const t=txns[k];return '<tr>'+
        '<td style="color:#58a6ff;font-family:monospace">'+t.transsegno+'</td>'+
        '<td style="font-size:10px;color:#8b949e">'+t.uuid+'</td>'+
        '<td>'+t.terminal+'</td>'+
        '<td>'+t.pumpId+'</td>'+
        '<td style="color:'+(t.state==='completed'?'#3fb950':t.state==='aborted'?'#ff6b6b':'#e07b00')+'">'+t.state+'</td>'+
        '<td style="font-size:11px;color:#58a6ff">'+t.callbackBase+'</td>'+
      '</tr>';}).join('')+'</table>';
  }catch(e){}
}

async function ptSet(k,v){
  await fetch('/petrolina/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k,value:v})});
  location.reload();
}
async function ptSet2(k,v){ await ptSet(k,v); }
async function ptSv(key,id){
  const v=document.getElementById(id).value;
  await fetch('/petrolina/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,value:v})});
  location.reload();
}
async function ptFireCompletion(){
  const transsegno=document.getElementById('ptManualTranssegno').value.trim();
  const callbackBase=document.getElementById('ptManualCallbackBase').value.trim();
  const cents=parseInt(document.getElementById('ptManualAmount').value)||3500;
  if(!transsegno){alert('Enter a transsegno');return;}
  const r=await fetch('/petrolina/fire-completion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transsegno,callbackBase,actualAmountCents:cents})});
  const j=await r.json();
  const el=document.getElementById('ptCallbackResult');
  el.textContent=j.ok?'Completion sent to '+j.callbackBase:'ERROR: '+j.error;
  el.style.color=j.ok?'#3fb950':'#ff6b6b';
  setTimeout(loadPtLogs,1000);
}
async function ptCtrl(endpoint, body, label){
  const cb=document.getElementById('ptManualCallbackBase').value.trim();
  const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({callbackBase:cb},body))});
  const j=await r.json();
  const el=document.getElementById('ptCtrlResult');
  el.textContent=j.ok?(label+' sent to '+j.sentTo):('ERROR: '+j.error);
  el.style.color=j.ok?'#3fb950':'#ff6b6b';
  setTimeout(loadPtLogs,1000);
}
async function ptAddUnpaid(){
  await fetch('/petrolina/add-unpaid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    pumpid:document.getElementById('ptUpPump').value,
    litres:Number(document.getElementById('ptUpLitres').value),
    amount:Number(document.getElementById('ptUpAmount').value)
  })});
  ptLoadUnpaid();
}
async function ptClearUnpaid(){ await fetch('/petrolina/clear-unpaid',{method:'POST'}); ptLoadUnpaid(); }
async function ptLoadUnpaid(){
  const r=await fetch('/petrolina/unpaid'); const list=await r.json();
  const el=document.getElementById('ptUnpaidList');
  if(!list.length){ el.textContent='(no unpaid fuellings)'; return; }
  el.innerHTML=list.map(f=>{
    const loy=f.loyaltyPhoneNo?(' &#x2022; <span style="color:#58a6ff">MyPetrolina '+f.loyaltyPhoneNo+'</span>'):'';
    const state=f.paid?('<span style="color:#3fb950">PAID '+f.receiptNo+' '+(f.cartType==='C'?'cash':'card')+'</span>'+loy)
      :(f.claimedBy?('<span style="color:#e3b341">CLAIMED by '+f.claimedBy+'</span>'):'<span style="color:#8b949e">unpaid</span>');
    return 'transsegno '+f.transsegno+' &#x2022; pump '+f.pumpId+' &#x2022; '+f.product+' &#x2022; '+f.litres+'L &#x2022; &#x20AC;'+f.amount+' &#x2022; '+state;
  }).join('<br>');
}
async function ptFireBatchClosure(){
  await ptCtrl('/petrolina/fire-batch-closure',{
    noOfTransactions:Number(document.getElementById('ptBcTxns').value)||0,
    totalAmount:Number(document.getElementById('ptBcTotal').value)||0
  },'Batch closure');
}
async function ptFireServiceChange(s){ await ptCtrl('/petrolina/fire-service-change',{service:s},'Service '+s); }
async function ptFireGetStatus(){ await ptCtrl('/petrolina/fire-get-status',{},'Get status'); }
async function ptFireReversal(){
  const transsegno=document.getElementById('ptManualTranssegno').value.trim();
  const callbackBase=document.getElementById('ptManualCallbackBase').value.trim();
  if(!transsegno){alert('Enter a transsegno');return;}
  const r=await fetch('/petrolina/fire-reversal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transsegno,callbackBase,reverseReason:1})});
  const j=await r.json();
  const el=document.getElementById('ptCallbackResult');
  el.textContent=j.ok?'Reversal sent to '+j.sentTo:'ERROR: '+j.error;
  el.style.color=j.ok?'#e07b00':'#ff6b6b';
  setTimeout(loadPtLogs,1000);
}
async function ptClearLogs(){
  if(!confirm('Clear Petrolina logs?')) return;
  await fetch('/petrolina/clear-logs',{method:'POST'});
  ptAllLogs=[];ptRenderLogs();
}
const ptAmtInput=document.getElementById('ptManualAmount');
if(ptAmtInput) ptAmtInput.addEventListener('input',function(){
  const el=document.getElementById('ptManualEuros');
  if(el) el.textContent=(parseInt(this.value||0)/100).toFixed(2);
});
loadPtLogs(); setInterval(loadPtLogs,4000);
ptLoadUnpaid(); setInterval(ptLoadUnpaid,4000);
loadPtTransactions(); setInterval(loadPtTransactions,3000);
// Ã¢â€â‚¬Ã¢â€â‚¬ Fairway Tab JS Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
let fwFilter='', fwAllLogs=[];
function fwSetFilter(f){fwFilter=f;fwRenderLogs();}
function fwRenderLogs(){
  const filtered=fwFilter?fwAllLogs.filter(l=>(l.path||'').toLowerCase().includes(fwFilter.toLowerCase())):fwAllLogs;
  const el=document.getElementById('fwLogDiv');if(!el)return;
  if(!filtered.length){el.innerHTML='<p style="color:#8b949e">No Fairway requests yet</p>';return;}
  el.innerHTML=filtered.map(function(l){
    const isToken=l.path&&l.path.includes('token');
    const borderCol=isToken?'#e3b341':'#1D9E75';
    const rc=l.response&&l.response.error?'ERR':(l.response&&l.response.access_token?'TOKEN':'OK');
    const rcCol=l.response&&l.response.error?'#ff6b6b':'#3fb950';
    return '<div style="background:#0d1117;border:1px solid '+borderCol+';border-radius:6px;padding:10px;margin-bottom:8px">'+
      '<div style="display:flex;gap:8px;margin-bottom:6px;flex-wrap:wrap">'+
        '<span style="color:#8b949e;font-size:11px">'+l.time+'</span>'+
        '<span style="color:'+borderCol+';font-weight:bold;font-size:12px">'+l.method+' '+l.path+'</span>'+
        '<span style="margin-left:auto;color:'+rcCol+';font-size:12px;font-weight:bold">'+rc+'</span>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+
        '<div><div style="color:#8b949e;font-size:10px;margin-bottom:2px">REQUEST</div><pre>'+JSON.stringify(l.request,null,2)+'</pre></div>'+
        '<div><div style="color:#3fb950;font-size:10px;margin-bottom:2px">RESPONSE</div><pre>'+JSON.stringify(l.response,null,2)+'</pre></div>'+
      '</div></div>';
  }).join('');
}
async function loadFwLogs(){
  try{const r=await fetch('/fairway/logs');fwAllLogs=await r.json();fwRenderLogs();}catch(e){}
}
async function fwClearLogs(){
  if(!confirm('Clear Fairway logs?'))return;
  await fetch('/fairway/logs',{method:'DELETE'});fwAllLogs=[];fwRenderLogs();
}
async function fwSet(k,v){
  await fetch('/admin/fairway-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k,value:v})});
  location.reload();
}
async function fwSet2(k,v){ await fwSet(k,v); }
async function fwSv(key,id){
  const v=document.getElementById(id).value.trim();
  const r=await fetch('/admin/fairway-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,value:v})});
  const d=await r.json();
  if(d.ok) location.reload(); else alert('Error: '+d.error);
}
async function fwClearToken(){
  await fetch('/admin/fairway-clear-token',{method:'POST'});location.reload();
}
async function fwSaveMethod(name){
  try{
    const v=document.getElementById('fwMethod_'+name).value;
    const data=JSON.parse(v);
    const r=await fetch('/admin/fairway-method',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,data})});
    const d=await r.json();
    if(d.ok) alert('Saved: '+name); else alert('Error: '+d.error);
  }catch(e){alert('Invalid JSON: '+e.message);}
}
async function fwAddMethod(){
  const name=document.getElementById('fwNewMethodName').value.trim();
  if(!name){alert('Enter a method name');return;}
  const r=await fetch('/admin/fairway-method',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name,data:[{result:"ok"}],params:[{name:"param1",type:"varchar"}]})});
  const d=await r.json();
  if(d.ok) location.reload(); else alert('Error: '+d.error);
}
loadFwLogs(); setInterval(loadFwLogs,4000);
</script></body></html>`);
});

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /parkingInit Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.post("/parkingInit", (req, res) => {
  // Track app version for dashboard display
  const versionName = req.body.versionName || "";
  const versionNumber = req.body.versionNumber || "";
  if (versionName) {
    config.lastAppVersionName   = versionName;
    config.lastAppVersionNumber = versionNumber;
    console.log(`[parkingInit] App version: ${versionName} (${versionNumber})`);
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ CarWash init Ã¢â‚¬â€ clean response, no parking fields Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  if (req.body.application === "CarWash") {
    if (carWashConfig.responseCode !== "00") {
      const errMap = {"91":"Invalid Outlet Number","92":"Invalid Company Code","93":"Invalid Application","08":"Technical issue. Please wait for assistance."};
      const response = { responseCode: carWashConfig.responseCode, responseDescription: errMap[carWashConfig.responseCode] || "Error" };
      addCarWashLog(req, response); return res.json(response);
    }
    const response = {
      responseCode:             "00",
      responseDescription:      "Successful Response",
      maxWashTimeSeconds:       String(carWashConfig.maxWashTimeSeconds),
      maxWashAmountCents:       String(carWashConfig.maxWashAmountCents),
      displayMessageOfEntrance: carWashConfig.displayMessageOfEntrance,
      controllerUrl:            carWashConfig.controllerUrl,
      controllerApiKey:         carWashConfig.controllerApiKey,
      flagsForAction:           carWashConfig.flagsForAction,
      voiceAssistant:           carWashConfig.voiceAssistant ? "1" : "0",
      defaultLanguage:          carWashConfig.defaultLanguage,
      availablePlaceMonthly:    carWashConfig.monthlyEnabled ? "0" : "-1",
      monthlyCardsBins:         carWashConfig.monthlyCardsBins || "",
      timeOfServer:             ts()
    };
    if (carWashConfig.flagsForAction !== "0000") {
      console.log(`[parkingInit/CarWash] flagsForAction=${carWashConfig.flagsForAction} sent Ã¢â€ â€™ auto-reset to 0000`);
      carWashConfig.flagsForAction = "0000";
    }
    addCarWashLog(req, response); return res.json(response);
  }

  if (config.responseCode !== "00") {
    const errMap = {"91":"Invalid Outlet Number","92":"Invalid Company Code","93":"Invalid Application","08":"Technical issue. Please wait for assistance."};
    const response = {responseCode:config.responseCode, responseDescription:errMap[config.responseCode]||"Error"};
    addLog(req, response); return res.json(response);
  }

  // Identify which POS is calling Ã¢â‚¬â€ determines mode returned
  const mode = detectMode(req.body);

  // Validate outlet Ã¢â‚¬â€ return 91 if unrecognised (both POS configured and neither matches)
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
    // TELL credentials Ã¢â‚¬â€ only included when TELL is enabled
    // App uses these to poll getStatus directly for vehicle detection
    ...(config.tellEnabled && config.tellHwId ? {
      tellApiUrl:        "https://api.tell.hu/gc",
      tellHwId:          config.tellHwId,
      tellApiKey:        config.tellApiKey,
      tellAppId:         config.tellAppId,
      tellPassword:      config.tellPassword,
      tellVehicleInput:  mode === "Exit" ? config.tellVehicleInputExit : config.tellVehicleInputEntrance
    } : {}),
    stationId:                       rentalConfig.rentalStationId   || "LIM-001",
    stationName:                     rentalConfig.rentalStationName || "Rental Station",
    // Rental-specific fields Ã¢â‚¬â€ only included when app identifies as Rental
    ...(req.body.application === "Rental" ? {
      preAuthAmountCents: String(rentalConfig.preAuthAmountCents),
      maxRentalTimeMins:  String(rentalConfig.maxRentalTimeMins),
      displayMessage:     rentalConfig.displayMessage,
      flagsForAction:     rentalConfig.flagsForAction,
      voiceAssistant:     rentalConfig.voiceAssistant ? "1" : "0",
      defaultLanguage:    rentalConfig.defaultLanguage
    } : {}),
    responseCode:                    "00",
    responseDescription:             "Successful Response",
    timeOfServer:                    ts(),
    flagsForAction:                  config.flagsForAction,
    voiceAssistant:                  config.voiceAssistant ? "1" : "0",  // "1"=enabled, "0"=silent
    defaultLanguage:                 config.defaultLanguage               // "EN","EL","RU","IW"
  };
  // Auto-reset flagsForAction to "0000" after sending Ã¢â‚¬â€ prevents loop on next keep-alive
  if (config.flagsForAction !== "0000") {
    console.log(`[parkingInit] flagsForAction=${config.flagsForAction} sent Ã¢â€ â€™ auto-reset to 0000`);
    config.flagsForAction = "0000";
  }
  if (req.body.application === "Rental" && rentalConfig.flagsForAction !== "0000") {
    console.log(`[parkingInit/Rental] flagsForAction=${rentalConfig.flagsForAction} sent Ã¢â€ â€™ auto-reset to 0000`);
    rentalConfig.flagsForAction = "0000";
  }
  addLog(req, response); res.json(response);
});

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /entranceCall Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
      console.log(`[entranceCall] BLOCKED Ã¢â‚¬â€ Monthly card ${cardNumber} not in list`);
      addRejection("Not in allowed list", "Monthly Card", cardNumber, "56");
      addLog(req, response); return res.json(response);
    }
  }
  // Monthly: match by token (same card = same token)
  // Bank card: match by lastDigits + expiryDate
  if (token && activeEntries[token] && inputType === "Monthly Card") {
    const existing = activeEntries[token];
    const entryTime = new Date(existing.entryTime).toISOString().substring(11,19);
    // No jccRelease needed Ã¢â‚¬â€ monthly cards have no pre-auth
    const response = {
      outlet: outlet || config.entranceOutlet, terminal: terminal || config.entranceTerminal,
      installationPoint: "Entrance",
      displayMessage: `This card is already inside since ${entryTime}. Please exit first.`,
      timeToDisplayMessage: "8", responseCode: "41",
      responseDescription: "Card already inside Ã¢â‚¬â€ exit required"
    };
    console.log(`[entranceCall] BLOCKED monthly Ã¢â‚¬â€ already inside since ${entryTime}`);
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
      // Release the pre-auth since we're rejecting entrance
      try {
        const releaseEntry = {
          tokenCode, authCode, receiptNumber,
          originalRefNum:     referenceNo || receiptNumber,
          preAuthAmountCents: parseInt(preAuthAmount || config.minimumAmountPreAuth || 300),
          outlet, terminal,
          lastDigits:         ld,
          expiryDate:         exp
        };
        await jccRelease(releaseEntry);
        console.log(`[entranceCall] jccRelease called Ã¢â‚¬â€ duplicate bank card *${ld}`);
      } catch(e) { console.error("[entranceCall] jccRelease failed:", e.message); }
      const response = {
        outlet: outlet || config.entranceOutlet, terminal: terminal || config.entranceTerminal,
        installationPoint: "Entrance",
        displayMessage: `This card is already inside since ${entryTime}. Please exit first.`,
        timeToDisplayMessage: "8", responseCode: "41",
        responseDescription: "Card already inside Ã¢â‚¬â€ exit required"
      };
      console.log(`[entranceCall] BLOCKED bank card *${ld} Ã¢â‚¬â€ already inside since ${entryTime}`);
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

  // If barrier failed Ã¢â‚¬â€ release pre-auth (bank card only) and remove entry
  if (barrier !== "tell-ok" && barrier !== "mock-ok") {
    console.log(`[entranceCall] Barrier failed (${barrier}) Ã¢â‚¬â€ removing entry${inputType === "Bank Card" ? " + releasing pre-auth" : ""}`);
    if (token && activeEntries[token]) {
      if (inputType === "Bank Card") {
        // Only bank cards have a pre-auth to release
        try {
          const releaseEntry = {
            tokenCode, authCode, receiptNumber,
            originalRefNum:     referenceNo || receiptNumber,
            preAuthAmountCents: parseInt(preAuthAmount || config.minimumAmountPreAuth || 300),
            outlet, terminal,
            lastDigits:         lastDigits || "",
            expiryDate:         expiryDate || "0000"
          };
          await jccRelease(releaseEntry);
          console.log(`[entranceCall] jccRelease called Ã¢â‚¬â€ barrier failure`);
        } catch(e) { console.error("[entranceCall] jccRelease failed:", e.message); }
      }
      releaseSpace(activeEntries[token]);
      delete activeEntries[token];
    }
    const failResponse = {
      outlet:               req.body.outlet   || config.entranceOutlet,
      terminal:             req.body.terminal || config.entranceTerminal,
      availablePlaceMonthly:  String(config.availablePlaceMonthly),
      availablePlacesRegular: String(config.availablePlacesNormal),
      installationPoint:    "Entrance",
      displayMessage:       "Technical issue. Please contact staff.",
      timeToDisplayMessage: "8",
      responseCode:         "99",
      responseDescription:  "Barrier failed to open",
      _barrier:             barrier
    };
    addLog(req, failResponse); return res.json(failResponse);
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

// Ã¢â€â‚¬Ã¢â€â‚¬ Barrier open with 3 retries Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
  console.error("[BARRIER] All retries failed Ã¢â‚¬â€ calling staff");
  return "failed";
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Fee calculation from entry time and charges table Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function calculateFee(entryTime) {
  if (!entryTime) return config.minimumAmountPreAuth || 300;
  const mins = Math.floor((Date.now() - entryTime) / 60000);
  const charges = config.charges || [];
  for (const c of charges) {
    const from = parseInt(c.from);
    const to   = c.to ? parseInt(c.to) : Infinity;
    if (mins >= from && mins < to) return parseInt(c.fee);
  }
  // Below first threshold Ã¢â‚¬â€ free
  return 0;
}

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /exitCall Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.post("/exitCall", async (req, res) => {
  const { token } = req.body;
  const entry = token ? activeEntries[token] : null;
  const inputType = req.body.inputType || (entry && entry.inputType) || "Bank Card";

  // Ã¢â€â‚¬Ã¢â€â‚¬ Monthly Card exit Ã¢â‚¬â€ always free, no JCC calls Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  if (inputType === "Monthly Card") {
    if (!token || !activeEntries[token]) {
      // Card not registered at entrance Ã¢â‚¬â€ reject
      console.log(`[exitCall] Monthly Card exit Ã¢â‚¬â€ no entry found for token`);
      const response = {
        barrierOpen:         "0",
        moneyToPay:          "0",
        displayMessage:      "No entry record found. Please contact staff.",
        timeToDisplayMessage:"10",
        responseCode:        "41",
        responseDescription: "No entry record found"
      };
      addLog(req, response); return res.json(response);
    }
    console.log(`[exitCall] Monthly Card exit Ã¢â‚¬â€ entry found, opening barrier`);
    releaseSpace(activeEntries[token]);
    delete activeEntries[token];
    const bm = await openBarrierWithRetry();
    const response = bm === "failed"
      ? { barrierOpen:"0", moneyToPay:"0",
          displayMessage:"Technical issue. Please contact staff.",
          timeToDisplayMessage:"10", responseCode:"08",
          responseDescription:"Barrier failed Ã¢â‚¬â€ staff called" }
      : { barrierOpen:"1", moneyToPay:"0",
          displayMessage:"Thank you! Have a nice day.",
          timeToDisplayMessage:"5", responseCode:"00",
          responseDescription:"Successful Response" };
    addLog(req, response); return res.json(response);
  }

  const feeCents     = entry ? calculateFee(entry.entryTime) : 0;
  const preAuthCents = entry ? (entry.preAuthAmountCents || config.minimumAmountPreAuth || 300) : 0;

  function staffResponse(msg) {
    return { barrierOpen:"0", moneyToPay:"0",
      displayMessage: msg || "Technical issue. Please contact staff.",
      timeToDisplayMessage:"10", responseCode:"08",
      responseDescription:"Barrier failed Ã¢â‚¬â€ staff called" };
  }

  let response;
  switch(config.exitScenario) {

    // Ã¢â€â‚¬Ã¢â€â‚¬ Scenario 1: FREE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

    // Ã¢â€â‚¬Ã¢â€â‚¬ Scenario 2: CAPTURE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    // Capture the calculated fee (must be <= preAuth), open barrier
    case 2: {
      if (!entry) { response = staffResponse("Entry not found."); break; }
      const captureAmt = feeCents > 0 ? feeCents : preAuthCents;
      let captureResult2 = null;
      try { captureResult2 = await jccCapture(entry, captureAmt); } catch(e) { console.error("[JCC CAPTURE]", e.message); }
      const captureOk2 = captureResult2 && captureResult2.responseCode === "00";
      if (!captureOk2) {
        // Capture declined Ã¢â‚¬â€ open barrier anyway, store for retry
        console.log(`[JCC] Capture declined (${captureResult2?.responseCode}) Ã¢â‚¬â€ storing for retry`);
        addPendingCapture(entry, captureAmt);
      }
      delete activeEntries[token];
      releaseSpace(entry);
      const b2 = await openBarrierWithRetry();
      response = b2 === "failed"
        ? staffResponse("Technical issue. Please contact staff.")
        : { barrierOpen:"1", moneyToPay:String(captureAmt),
            displayMessage: captureOk2
              ? `Thank you! Charged Ã¢â€šÂ¬${(captureAmt/100).toFixed(2)}.`
              : `Thank you! Charged Ã¢â€šÂ¬${(captureAmt/100).toFixed(2)}. (Payment pending)`,
            timeToDisplayMessage:"5", responseCode:"00",
            responseDescription:"Successful Response" };
      break;
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Scenario 3: TOPUP APPROVED Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    // TopUp succeeds Ã¢â€ â€™ Capture full fee Ã¢â€ â€™ open barrier
    // If TopUp is declined by JCC Ã¢â€ â€™ fall back to Scenario 4 behaviour (release + barrierOpen:"-2")
    case 3: {
      if (!entry) { response = staffResponse("Entry not found."); break; }
      const totalFee3 = feeCents > 0 ? feeCents : (config.topupAmount || 500);
      const topupAmt3 = Math.max(0, totalFee3 - preAuthCents);
      let topupResult3 = null;
      try { topupResult3 = await jccTopup(entry, topupAmt3); } catch(e) { console.error("[JCC TOPUP]", e.message); }

      const topupApproved = topupResult3 && topupResult3.responseCode === "00";
      console.log(`[JCC] topup result: ${topupResult3?.responseCode} ${topupResult3?.responseText} Ã¢â€ â€™ ${topupApproved ? "APPROVED" : "DECLINED"}`);

      if (topupApproved) {
        // TopUp approved Ã¢â€ â€™ Capture full fee Ã¢â€ â€™ open barrier
        let captureResult3 = null;
        try { captureResult3 = await jccCapture(entry, totalFee3); } catch(e) { console.error("[JCC CAPTURE]", e.message); }
        const captureOk3 = captureResult3 && captureResult3.responseCode === "00";
        if (!captureOk3) {
          console.log(`[JCC] Capture declined after TopUp (${captureResult3?.responseCode}) Ã¢â‚¬â€ storing for retry`);
          addPendingCapture(entry, totalFee3);
        }
        delete activeEntries[token];
        releaseSpace(entry);
        const b3 = await openBarrierWithRetry();
        response = b3 === "failed"
          ? staffResponse(`Payment Ã¢â€šÂ¬${(totalFee3/100).toFixed(2)} processed. Barrier failed Ã¢â‚¬â€ staff called.`)
          : { barrierOpen:"1", moneyToPay:String(totalFee3),
              displayMessage: captureOk3
                ? `Thank you! Total Ã¢â€šÂ¬${(totalFee3/100).toFixed(2)}.`
                : `Thank you! Total Ã¢â€šÂ¬${(totalFee3/100).toFixed(2)}. (Payment pending)`,
              timeToDisplayMessage:"5", responseCode:"00",
              responseDescription:"Successful Response" };
      } else {
        // TopUp declined by JCC Ã¢â€ â€™ Release pre-auth Ã¢â€ â€™ ask app for full SALE
        console.log("[JCC] TopUp declined Ã¢â‚¬â€ falling back to full SALE flow");
        if (!entry.recordId) entry.recordId = require("crypto").randomBytes(16).toString("hex").toUpperCase();
        try { await jccRelease(entry); } catch(e) { console.error("[JCC RELEASE]", e.message); }
        // Do NOT delete entry Ã¢â‚¬â€ app needs it alive to send exitPayment
        response = { barrierOpen:"-2", moneyToPay:String(totalFee3),
          recordId: entry.recordId,
          displayMessage:`Card declined. Please tap card for full Ã¢â€šÂ¬${(totalFee3/100).toFixed(2)}.`,
          timeToDisplayMessage:"10", responseCode:"31",
          responseDescription:"TopUp declined Ã¢â‚¬â€ full SALE required" };
      }
      break;
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Scenario 4: TOPUP DECLINED Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    // TopUp declined Ã¢â€ â€™ Release pre-auth Ã¢â€ â€™ ask app for full SALE (barrierOpen:"-2")
    case 4: {
      if (!entry) { response = staffResponse("Entry not found."); break; }
      const totalFee4 = feeCents > 0 ? feeCents : (config.topupAmount || 500);
      // Generate recordId once and store it on the entry so it is stable across retries
      if (!entry.recordId) entry.recordId = require("crypto").randomBytes(16).toString("hex").toUpperCase();
      try { await jccRelease(entry); } catch(e) { console.error("[JCC RELEASE]", e.message); }
      // Do NOT delete entry Ã¢â‚¬â€ app needs it alive to send exitPayment
      response = { barrierOpen:"-2", moneyToPay:String(totalFee4),
        recordId: entry.recordId,
        displayMessage:`Card declined. Please tap card for full Ã¢â€šÂ¬${(totalFee4/100).toFixed(2)}.`,
        timeToDisplayMessage:"10", responseCode:"31",
        responseDescription:"TopUp declined Ã¢â‚¬â€ full SALE required" };
      break;
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Scenario 5: BARRIER FAILED Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    case 5: default:
      response = staffResponse("Technical issue. Please contact staff.");
      break;
  }
  addLog(req, response); res.json(response);
});

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /exitPayment Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /help Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.post("/help", (req, res) => {
  const action      = req.body.action      || "";
  const application = req.body.application || "";

  // Petrolina shares this path per its own specification, so it is answered here rather than by a
  // second route that Express would never reach.
  if (application === "petrolinaApp") return petroHelp(req, res);

  const isCarWash   = application === "CarWash";
  const isManualHelp  = action === "Help Button";
  const isEcrDecline  = action.toLowerCase().includes("ecr decline") || action.toLowerCase().includes("ecr_decline");

  if (isManualHelp) {
    // Send to carwash or parking email depending on which app called
    const alertReq = isCarWash
      ? { ...req, body: { ...req.body, _overrideEmail: carWashConfig.alertEmail } }
      : req;
    Promise.race([
      sendHelpAlert(alertReq, isCarWash),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000))
    ]).catch(e => console.error("[EMAIL] Alert error:", e.message));
  } else if (isEcrDecline) {
    addEcrDecline(
      req.body.outlet           || "?",
      req.body.terminal         || "?",
      req.body.intallationPoint || "?",
      action
    );
    console.log(`[ECR_DECLINE] ${req.body.intallationPoint || "?"} Ã¢â‚¬â€ ${action}`);
  }

  const cfg = isCarWash ? carWashConfig : config;
  const response = {
    outlet:               req.body.outlet   || config.entranceOutlet,
    terminal:             req.body.terminal || config.entranceTerminal,
    installationPoint:    req.body.intallationPoint || "",
    daytime:              ts(),
    displayMessage:       cfg.helpMessage,
    timeToDisplayMessage: cfg.helpDisplayTime,
    availablePlacesNormal: String(config.availablePlacesNormal),
    availablePlaceMonthly: String(config.availablePlaceMonthly),
    responseCode:         "00",
    responseDescription:  "Successful Response"
  };
  addLog(req, response); res.json(response);
});

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// Car Wash API
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /washStart Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.post("/washStart", (req, res) => {
  const { washId, token, authCode, lastDigits, expiryDate, tokenCode,
          receiptNumber, referenceNo, preAuthAmount, outlet, terminal, inputType } = req.body;

  const isMonthly = inputType === "Monthly Card";

  if (carWashConfig.responseCode !== "00") {
    const errMap = { "91":"Invalid Outlet Number", "08":"Technical issue. Please wait." };
    const response = { responseCode: carWashConfig.responseCode,
      responseDescription: errMap[carWashConfig.responseCode] || "Error" };
    addCarWashLog(req, response); return res.json(response);
  }

  if (!washId) {
    const response = { responseCode: "99", responseDescription: "Missing washId" };
    addCarWashLog(req, response); return res.json(response);
  }

  activeWashSessions[washId] = {
    washId,
    token:              token || washId,
    authCode:           authCode || "",
    lastDigits:         lastDigits || "????",
    expiryDate:         expiryDate || "0000",
    tokenCode:          tokenCode || token || washId,
    receiptNumber:      receiptNumber || "",
    originalRefNum:     referenceNo || receiptNumber || "",
    preAuthAmountCents: isMonthly ? 0 : parseInt(preAuthAmount || carWashConfig.maxWashAmountCents || 500),
    isMonthly:          isMonthly,
    outlet:             outlet   || carWashConfig.outlet,
    terminal:           terminal || carWashConfig.terminal,
    startTime:          Date.now()
  };

  console.log(`[WASH_START] washId=${washId} last4=${lastDigits} preAuth=Ã¢â€šÂ¬${(parseInt(preAuthAmount||0)/100).toFixed(2)}`);

  const response = {
    responseCode:         "00",
    responseDescription:  "Successful Response",
    displayMessage:       "Wash started! Enjoy.",
    timeToDisplayMessage: "5"
  };
  addCarWashLog(req, response); res.json(response);
});

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /washStop Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.post("/washStop", async (req, res) => {
  const { washId, timeUsedSeconds, reason } = req.body;
  const session = washId ? activeWashSessions[washId] : null;

  if (!session) {
    const response = {
      responseCode: "41", responseDescription: "Wash session not found",
      amountCharged: "0", timeUsedSeconds: String(timeUsedSeconds || 0),
      displayMessage: "Session not found. Please contact staff.",
      timeToDisplayMessage: "10"
    };
    addCarWashLog(req, response); return res.json(response);
  }

  delete activeWashSessions[washId];

  // Always calculate time used server-side from session.startTime Ã¢â‚¬â€ more reliable than app-reported value
  const timeUsed = Math.round((Date.now() - session.startTime) / 1000);

  // Monthly card Ã¢â‚¬â€ no pre-auth was taken, free wash, no JCC calls
  if (session.isMonthly) {
    const mins = Math.floor(timeUsed / 60);
    const secs = timeUsed % 60;
    console.log(`[WASH_STOP] Monthly card Ã¢â‚¬â€ free wash washId=${washId} timeUsed=${timeUsed}s`);
    const response = {
      responseCode: "00", responseDescription: "Successful Response",
      amountCharged: "0", timeUsedSeconds: String(timeUsed),
      displayMessage: `Monthly Card Ã¢â‚¬â€ Free Wash\nTime used: ${mins}m ${secs}s`,
      timeToDisplayMessage: "5"
    };
    addCarWashLog(req, response); return res.json(response);
  }

  // Void pre-auth immediately Ã¢â‚¬â€ wash never started or crashed before completing
  if (reason === "controller_failed" || reason === "app_restart") {
    console.log(`[WASH_STOP] Void pre-auth Ã¢â‚¬â€ reason=${reason} washId=${washId}`);
    try { await jccRelease(session); } catch(e) { console.error("[WASH_STOP VOID]", e.message); }
    const response = {
      responseCode: "00", responseDescription: "Pre-auth voided. No charge applied.",
      amountCharged: "0", timeUsedSeconds: "0",
      displayMessage: "Pre-auth voided. No charge applied.", timeToDisplayMessage: "10"
    };
    addCarWashLog(req, response); return res.json(response);
  }

  // Determine charge amount by scenario
  let amountCents = 0;
  switch (carWashConfig.washScenario) {
    case 1: {
      // Proportional to actual time used Ã¢â‚¬â€ capped at pre-auth amount
      const maxSecs = carWashConfig.maxWashTimeSeconds || 300;
      const ratio   = Math.min(timeUsed / maxSecs, 1.0);
      amountCents   = Math.round(session.preAuthAmountCents * ratio);
      console.log(`[WASH_STOP] Proportional charge: ${timeUsed}s / ${maxSecs}s = ${(ratio*100).toFixed(1)}% Ã¢â€ â€™ Ã¢â€šÂ¬${(amountCents/100).toFixed(2)}`);
      break;
    }
    case 2: amountCents = carWashConfig.maxWashAmountCents; break;  // fixed amount
    case 3: amountCents = 0;                                break;  // free
    default: amountCents = session.preAuthAmountCents;
  }

  if (amountCents === 0) {
    try { await jccRelease(session); } catch(e) { console.error("[WASH_STOP RELEASE]", e.message); }
    const response = {
      responseCode: "00", responseDescription: "Successful Response",
      amountCharged: "0", timeUsedSeconds: String(timeUsed),
      displayMessage: "Thank you! Wash was free.", timeToDisplayMessage: "5"
    };
    addCarWashLog(req, response); return res.json(response);
  }

  // Capture the charge
  let captureResult = null;
  try { captureResult = await jccCapture(session, amountCents); }
  catch(e) { console.error("[WASH_STOP CAPTURE]", e.message); }

  const captureOk = captureResult && captureResult.responseCode === "00";
  if (!captureOk) {
    addWashPendingCapture(session, amountCents);
    console.log(`[WASH_STOP] Capture failed (${captureResult?.responseCode}) Ã¢â‚¬â€ stored for retry. washId=${washId}`);
  }

  const mins = Math.floor(timeUsed / 60);
  const secs = timeUsed % 60;

  const response = {
    responseCode:         "00",
    responseDescription:  "Successful Response",
    amountCharged:        String(amountCents),
    timeUsedSeconds:      String(timeUsed),
    displayMessage:       captureOk
      ? `Time used: ${mins}m ${secs}s\nAmount charged: Ã¢â€šÂ¬${(amountCents/100).toFixed(2)}`
      : `Time used: ${mins}m ${secs}s\nAmount charged: Ã¢â€šÂ¬${(amountCents/100).toFixed(2)} (pending)`,
    timeToDisplayMessage: "8"
  };
  addCarWashLog(req, response); res.json(response);
});

// Ã¢â€â‚¬Ã¢â€â‚¬ CarWash Admin endpoints Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.get("/admin/carwash-config",  (req, res) => res.json(carWashConfig));
app.get("/admin/carwash-sessions",(req, res) => res.json(Object.values(activeWashSessions)));
app.get("/admin/carwash-logs",    (req, res) => res.json(carWashLogs));
app.get("/admin/carwash-pending-captures", (req, res) => res.json(washPendingCaptures));

app.post("/admin/carwash-config", (req, res) => {
  const { key, value } = req.body;
  if (!(key in carWashConfig)) return res.json({ ok: false, error: `Unknown key: ${key}` });
  const existing = carWashConfig[key];
  if (typeof existing === "boolean")
    carWashConfig[key] = value === true || value === "true" || value === 1;
  else if (typeof existing === "number") {
    const n = parseFloat(value);
    carWashConfig[key] = isNaN(n) ? existing : n;
  } else {
    carWashConfig[key] = value;
  }
  console.log(`[CW_CONFIG] ${key} = ${JSON.stringify(carWashConfig[key])}`);
  res.json({ ok: true, config: carWashConfig });
});

app.post("/admin/carwash-clear-sessions", (req, res) => {
  activeWashSessions = {};
  res.json({ ok: true });
});

app.post("/admin/carwash-clear-logs", (req, res) => {
  carWashLogs = [];
  res.json({ ok: true });
});

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// JCC IPPI Financial Services API  (mirroring test-apis.jccsecure.com)
// Base path: /financialservices/v1/ippi
// Auth: HMAC as per JCC spec (Authorization: hmacauth appId:sig:nonce:ts)
// One active transaction stored in memory Ã¢â‚¬â€ cleared per transaction
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

const crypto = require("crypto");

// Ã¢â€â‚¬Ã¢â€â‚¬ HMAC credentials per endpoint Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
let jccConfig = {
  topup:   { appId: "1cbb351c501647ef8f855335d2017dbc", apiKey: "CbGMgGAnQp1Hk+qeXSqjOsiRcN4P54skp32VWOav+ti=" },
  capture: { appId: "c677c1ba0bc349cfb04e2d10d67763f6", apiKey: "jzHup+gUjZo4XDKm54DtoIE9oK51THQ+Vp1AStzIfvI=" },
  release: { appId: "df4124bcd39a42ffb1b375c8d7af4bf8", apiKey: "a6t7zeZ9l+QqwZh9cQyQjCzqIFzwbWtCp62LijGe76L=" },
  void:    { appId: "1cbb351c501647ef8f855335d2017dbc", apiKey: "CbGMgGAnQp1Hk+qeXSqjOsiRcN4P54skp32VWOav+ti=" },
  reversal:{ appId: "1cbb351c501647ef8f855335d2017dbc", apiKey: "CbGMgGAnQp1Hk+qeXSqjOsiRcN4P54skp32VWOav+ti=" },
  validateHmac: false
};

// Ã¢â€â‚¬Ã¢â€â‚¬ In-memory transaction store (one at a time) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ HMAC Validation Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ Standard JCC success response Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function jccOk(extra = {}) {
  return { responseCode: "00", responseDescription: "Successful Response", ...extra };
}

function jccErr(code, desc) {
  return { responseCode: code, responseDescription: desc };
}

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /financialservices/v1/ippi/auth/topup Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /financialservices/v1/ippi/auth/capture Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /financialservices/v1/ippi/auth/release (PreAuthorisationRelease) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /financialservices/v1/ippi/void Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /financialservices/v1/ippi/reversal Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ GET /jcc/transaction Ã¢â€â‚¬Ã¢â€â‚¬ current active transaction Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.get("/jcc/transaction", (req, res) => {
  res.json({ activeTransaction });
});

// Ã¢â€â‚¬Ã¢â€â‚¬ DELETE /jcc/transaction Ã¢â€â‚¬Ã¢â€â‚¬ clear active transaction Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.delete("/jcc/transaction", (req, res) => {
  activeTransaction = null;
  res.json({ cleared: true });
});

// Ã¢â€â‚¬Ã¢â€â‚¬ GET /jcc/logs Ã¢â€â‚¬Ã¢â€â‚¬ JCC transaction logs Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.get("/jcc/logs", (req, res) => {
  res.json(jccLogs);
});

// Ã¢â€â‚¬Ã¢â€â‚¬ GET /jcc/config Ã¢â€â‚¬Ã¢â€â‚¬ get JCC HMAC config Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.get("/jcc/config", (req, res) => {
  res.json({ appId: jccConfig.appId, validateHmac: jccConfig.validateHmac });
});

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /jcc/config Ã¢â€â‚¬Ã¢â€â‚¬ update JCC HMAC config Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /rental/init Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Android app calls this on startup to get station config + initial item list
app.post("/rental/init", (req, res) => {
  if (rentalConfig.responseCode !== "00") {
    const response = { responseCode: rentalConfig.responseCode, responseDescription: "Service unavailable" };
    addRentalLog(req, response); return res.json(response);
  }
  const response = {
    responseCode:          "00",
    stationId:             rentalConfig.rentalStationId,
    stationName:           rentalConfig.rentalStationName,
    phoneForHelp:          rentalConfig.phoneForHelp,
    helpMessage:           rentalConfig.helpMessage,
    helpDisplayTime:       String(rentalConfig.helpDisplayTime),
    unlockDisplaySecs:     String(rentalConfig.unlockDisplaySecs),
    returnDisplaySecs:     String(rentalConfig.returnDisplaySecs),
    preAuthStandardCents:  String(rentalConfig.preAuthStandardCents),
    preAuthPremiumCents:   String(rentalConfig.preAuthPremiumCents),
    flagsForAction:        rentalConfig.flagsForAction,
    voiceAssistant:        rentalConfig.voiceAssistant,
    defaultLanguage:       rentalConfig.defaultLanguage,
    displayMessage:        rentalConfig.displayMessage,
    items:                 getRentalItems()
  };
  addRentalLog(req, response); res.json(response);
});

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /rental/keepAlive Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Sent every 30s Ã¢â‚¬â€ returns refreshed item list + any pending flags
app.post("/rental/keepAlive", (req, res) => {
  const response = {
    responseCode:   "00",
    stationId:      rentalConfig.rentalStationId,
    items:          getRentalItems(),
    flagsForAction: rentalConfig.flagsForAction
  };
  addRentalLog(req, response); res.json(response);
});

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /rental/preAuthAmount Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Called just before ECR PreAuth Ã¢â‚¬â€ confirms item is still available and returns amount
app.post("/rental/preAuthAmount", (req, res) => {
  const { itemId, itemType } = req.body;
  const item = rentalConfig.items.find(i => i.itemId === itemId);
  if (!item || rentalItemAvailability[itemId] === false) {
    const response = { responseCode: "02", responseDescription: `Item ${itemId} is not available` };
    addRentalLog(req, response); return res.json(response);
  }
  const cents = (itemType === "Premium") ? rentalConfig.preAuthPremiumCents : rentalConfig.preAuthStandardCents;
  const response = {
    responseCode:        "00",
    itemId,
    itemType:            itemType || item.type,
    preAuthAmountCents:  String(cents),
    currency:            "EUR"
  };
  addRentalLog(req, response); res.json(response);
});

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /rental/entry Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// ECR PreAuth approved Ã¢â€ â€™ create rental record, generate unlock code
app.post("/rental/entry", (req, res) => {
  const { entryId, outlet, terminal, stationId, itemId, itemType, dock,
          authCode, receiptNumber, tokenCode, lastDigits, expiryDate, preAuthAmountCents } = req.body;
  if (!entryId) {
    const response = { responseCode: "41", responseDescription: "entryId required" };
    addRentalLog(req, response); return res.json(response);
  }
  if (rentalConfig.responseCode !== "00") {
    const response = { responseCode: rentalConfig.responseCode, responseDescription: "Service unavailable" };
    addRentalLog(req, response); return res.json(response);
  }
  // Duplicate guard Ã¢â‚¬â€ return same unlock code
  if (activeRentals[entryId]) {
    const response = { responseCode: "00", entryId, unlockCode: activeRentals[entryId].unlockCode, duplicate: true };
    addRentalLog(req, response); return res.json(response);
  }
  const unlockCode = generateRentalUnlockCode(entryId);
  rentalItemAvailability[itemId] = false;
  activeRentals[entryId] = {
    entryId, outlet, terminal, stationId, itemId, itemType, dock,
    authCode, receiptNumber, tokenCode, lastDigits, expiryDate,
    preAuthAmountCents: parseInt(preAuthAmountCents || rentalConfig.preAuthStandardCents),
    unlockCode,
    startTime: Date.now()
  };
  console.log(`[RENTAL] Entry Ã¢â‚¬â€ entryId=${entryId} item=${itemId} last4=****${lastDigits} code=${unlockCode}`);
  const response = {
    responseCode:      "00",
    responseDescription: "Rental entry created",
    entryId,
    itemId,
    unlockCode,
    displayMessage:    `Your item is ready. Code: ${unlockCode}`,
    unlockDisplaySecs: String(rentalConfig.unlockDisplaySecs)
  };
  addRentalLog(req, response); res.json(response);
});

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /rental/return Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// ECR PAN-Capture approved Ã¢â€ â€™ verify card, calc fee, JCC capture, release item
app.post("/rental/return", async (req, res) => {
  const { entryId, outlet, terminal, stationId, panToken, panLastDigits, panExpiry } = req.body;
  const session = activeRentals[entryId];
  if (!session) {
    const response = { responseCode: "41", displayMessage: "Rental entry not found.", timeToDisplayMessage: "8" };
    addRentalLog(req, response); return res.json(response);
  }
  // Card token verification (last-4 as proxy for encrypted token match)
  if (panLastDigits && session.lastDigits && panLastDigits !== session.lastDigits) {
    const response = { responseCode: "05", displayMessage: "Card does not match the original rental card.", timeToDisplayMessage: "8" };
    addRentalLog(req, response); return res.json(response);
  }
  const endTime    = Date.now();
  const timeUsedSec = Math.floor((endTime - session.startTime) / 1000);
  let amountCents  = 0;
  let displayMessage = "";
  try {
    if (rentalConfig.rentalScenario === 3) {
      await jccRelease(session);
      displayMessage = "Thank you! No charge for this rental.";
    } else if (rentalConfig.rentalScenario === 2) {
      amountCents = rentalConfig.fixedAmountCents;
      const r = await jccCapture(session, amountCents);
      if (!r || r.responseCode !== "00") {
        addRentalPendingCapture(session, amountCents);
        amountCents = 0;
        displayMessage = "Return received. Payment pending Ã¢â‚¬â€ please contact staff.";
      } else {
        displayMessage = `Thank you! Ã¢â€šÂ¬${(amountCents/100).toFixed(2)} charged.`;
      }
    } else {
      amountCents = calcRentalFee(session.startTime, endTime);
      const r = await jccCapture(session, amountCents);
      if (!r || r.responseCode !== "00") {
        addRentalPendingCapture(session, amountCents);
        amountCents = 0;
        displayMessage = "Return received. Payment pending Ã¢â‚¬â€ please contact staff.";
      } else {
        const mins = Math.floor(timeUsedSec / 60);
        const secs = timeUsedSec % 60;
        displayMessage = `Thank you! Time: ${mins}m ${secs}s. Charged: Ã¢â€šÂ¬${(amountCents/100).toFixed(2)}`;
      }
    }
  } catch(e) {
    console.error("[RENTAL/return] JCC error:", e.message);
    addRentalPendingCapture(session, amountCents || calcRentalFee(session.startTime, endTime));
    displayMessage = "Return received. Payment pending Ã¢â‚¬â€ please contact staff.";
  }
  rentalItemAvailability[session.itemId] = true;
  delete activeRentals[entryId];
  console.log(`[RENTAL] Return Ã¢â‚¬â€ entryId=${entryId} timeUsed=${timeUsedSec}s charged=Ã¢â€šÂ¬${(amountCents/100).toFixed(2)}`);
  const response = {
    responseCode:         "00",
    entryId,
    amountCharged:        String(amountCents),
    timeUsedSeconds:      String(timeUsedSec),
    displayMessage,
    timeToDisplayMessage: String(rentalConfig.returnDisplaySecs || 10)
  };
  addRentalLog(req, response); res.json(response);
});

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /rental/start Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Android pre-auth approved Ã¢â€ â€™ store rental session
app.post("/rental/start", (req, res) => {
  const { rentalId, outlet, terminal, token, lastDigits, expiryDate,
          authCode, rrn, receiptNumber, tokenCode, preAuthAmountCents, timeOfStart } = req.body;
  if (!rentalId) {
    const response = { responseCode: "41", responseDescription: "rentalId required" };
    addRentalLog(req, response); return res.json(response);
  }
  if (rentalConfig.responseCode !== "00") {
    const response = { responseCode: rentalConfig.responseCode, displayMessage: "Service unavailable. Please try again." };
    addRentalLog(req, response); return res.json(response);
  }
  activeRentals[rentalId] = {
    rentalId, outlet, terminal, token, lastDigits, expiryDate,
    authCode, rrn, receiptNumber, tokenCode,
    preAuthAmountCents: parseInt(preAuthAmountCents || rentalConfig.preAuthAmountCents),
    timeOfStart, startTime: Date.now()
  };
  console.log(`[RENTAL] Started Ã¢â‚¬â€ rentalId=${rentalId} last4=****${lastDigits}`);
  const response = {
    responseCode:  "00",
    responseDescription: "Rental started",
    rentalId,
    displayMessage: "Item is yours! Return it when done.",
    timeToDisplayMessage: "5"
  };
  addRentalLog(req, response); res.json(response);
});

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /rental/stop Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Customer returns item Ã¢â€ â€™ capture fee based on time used, then clear session
app.post("/rental/stop", async (req, res) => {
  const { rentalId, timeOfStop, reason } = req.body;
  const session = activeRentals[rentalId];
  if (!session) {
    const response = { responseCode: "41", displayMessage: "Rental session not found.", timeToDisplayMessage: "8" };
    addRentalLog(req, response); return res.json(response);
  }

  const endTime    = Date.now();
  const timeUsedMs = endTime - session.startTime;
  const timeUsedSec = Math.floor(timeUsedMs / 1000);

  let amountCents = 0;
  let responseCode = "00";
  let displayMessage = "";

  try {
    if (rentalConfig.rentalScenario === 3) {
      // Free Ã¢â‚¬â€ release the pre-auth
      await jccRelease(session);
      amountCents = 0;
      displayMessage = "Thank you! No charge for this rental.";
    } else if (rentalConfig.rentalScenario === 2) {
      // Fixed amount
      amountCents = rentalConfig.fixedAmountCents;
      const r = await jccCapture(session, amountCents);
      if (!r || r.responseCode !== "00") {
        addRentalPendingCapture(session, amountCents);
        amountCents = 0;
        displayMessage = "Return received. Payment pending Ã¢â‚¬â€ please contact staff.";
      } else {
        displayMessage = "Thank you! Ã¢â€šÂ¬" + (amountCents / 100).toFixed(2) + " charged.";
      }
    } else {
      // Scenario 1: time-based
      amountCents = calcRentalFee(session.startTime, endTime);
      const r = await jccCapture(session, amountCents);
      if (!r || r.responseCode !== "00") {
        addRentalPendingCapture(session, amountCents);
        amountCents = 0;
        displayMessage = "Return received. Payment pending Ã¢â‚¬â€ please contact staff.";
      } else {
        const mins = Math.floor(timeUsedSec / 60);
        const secs = timeUsedSec % 60;
        displayMessage = `Thank you! Time: ${mins}m ${secs}s. Charged: Ã¢â€šÂ¬${(amountCents/100).toFixed(2)}`;
      }
    }
  } catch(e) {
    console.error(`[RENTAL/stop] JCC error:`, e.message);
    addRentalPendingCapture(session, amountCents || calcRentalFee(session.startTime, endTime));
    displayMessage = "Return received. Payment pending Ã¢â‚¬â€ please contact staff.";
  }

  delete activeRentals[rentalId];
  console.log(`[RENTAL] Stopped Ã¢â‚¬â€ rentalId=${rentalId} timeUsed=${timeUsedSec}s charged=Ã¢â€šÂ¬${(amountCents/100).toFixed(2)}`);
  const response = {
    responseCode,
    rentalId,
    amountCharged:        String(amountCents),
    timeUsedSeconds:      String(timeUsedSec),
    displayMessage,
    timeToDisplayMessage: "10"
  };
  addRentalLog(req, response); res.json(response);
});

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /rental/help Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.post("/rental/help", async (req, res) => {
  const action = req.body.action || "Help Button";
  if (action === "Help Button" || action.startsWith("Help")) {
    sendHelpAlert(req, false).catch(e => console.error("[RENTAL/help] email error:", e.message));
  }
  const response = {
    responseCode:        "00",
    displayMessage:      rentalConfig.helpMessage,
    timeToDisplayMessage: rentalConfig.helpDisplayTime
  };
  addRentalLog(req, response); res.json(response);
});

// Ã¢â€â‚¬Ã¢â€â‚¬ GET /rental/rentals Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.get("/rental/rentals", (req, res) => res.json(Object.values(activeRentals)));

// Ã¢â€â‚¬Ã¢â€â‚¬ GET /rental/logs Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.get("/rental/logs", (req, res) => res.json(rentalLogs));

// Ã¢â€â‚¬Ã¢â€â‚¬ DELETE /rental/logs Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.delete("/rental/logs", (req, res) => { rentalLogs = []; res.json({ ok: true }); });

// Ã¢â€â‚¬Ã¢â€â‚¬ GET /rental/config Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.get("/rental/config", (req, res) => res.json(rentalConfig));

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /admin/rental-config Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.post("/admin/rental-config", (req, res) => {
  const { key, value } = req.body;
  if (!(key in rentalConfig)) return res.json({ ok: false, error: `Unknown key: ${key}` });
  const existing = rentalConfig[key];
  if (typeof existing === "boolean") {
    rentalConfig[key] = value === true || value === "true" || value === 1;
  } else if (typeof existing === "number") {
    const n = parseFloat(value);
    rentalConfig[key] = isNaN(n) ? existing : n;
  } else if (Array.isArray(existing)) {
    return res.json({ ok: false, error: "Use add/remove-charge endpoints for arrays" });
  } else {
    rentalConfig[key] = value;
  }
  console.log(`[RENTAL_CONFIG] ${key} = ${JSON.stringify(rentalConfig[key])}`);
  res.json({ ok: true, config: rentalConfig });
});

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /admin/rental-add-charge Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.post("/admin/rental-add-charge", (req, res) => {
  const { upToMins, fee } = req.body;
  if (!fee) return res.json({ ok: false, error: "fee required" });
  rentalConfig.charges.push({ upToMins: parseInt(upToMins) || -1, fee: parseInt(fee) });
  rentalConfig.charges.sort((a, b) => (a.upToMins === -1 ? 1 : b.upToMins === -1 ? -1 : a.upToMins - b.upToMins));
  res.json({ ok: true });
});

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /admin/rental-remove-charge Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.post("/admin/rental-remove-charge", (req, res) => {
  const { index } = req.body;
  if (index >= 0 && index < rentalConfig.charges.length) rentalConfig.charges.splice(index, 1);
  res.json({ ok: true });
});

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /admin/rental-clear Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.post("/admin/rental-clear", (req, res) => { activeRentals = {}; res.json({ ok: true }); });

// Ã¢â€â‚¬Ã¢â€â‚¬ GET /admin/rental-pending-captures Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.get("/admin/rental-pending-captures", (req, res) => res.json(rentalPendingCaptures));

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /admin/rental-item-avail Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Toggle item availability in the catalogue (simulate dock state)
app.post("/admin/rental-item-avail", (req, res) => {
  const { itemId, available } = req.body;
  if (!rentalConfig.items.find(i => i.itemId === itemId)) {
    return res.json({ ok: false, error: `Item ${itemId} not in catalogue` });
  }
  rentalItemAvailability[itemId] = available === true || available === "true";
  console.log(`[RENTAL_ITEM] ${itemId} = ${rentalItemAvailability[itemId] ? "available" : "rented"}`);
  res.json({ ok: true });
});


// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// PETROLINA API  (called by S1U2 app)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const http = require("http");

// POST /petrolAppInit
app.post("/petrolAppInit", (req, res) => {
  if (petrolinaConfig.responseCode !== "00") {
    const body = { responseCode: petrolinaConfig.responseCode, responseDescription: "Configuration error" };
    addPetroLog("POST", "/petrolAppInit", req.body, body);
    return res.json(body);
  }
  // Spec Table 1: the app tells us where it lives, we tell it which port to listen on. Remembering
  // it here is what lets a callback be fired without a transaction having run first.
  if (req.body && req.body.deviceIP) petrolinaConfig.deviceIP = String(req.body.deviceIP);

  const body = {
    terminal:                petrolinaConfig.terminal || req.body.terminal || "",
    pumpNo:                  petrolinaConfig.pumpNo,
    defaultLan:              petrolinaConfig.defaultLan,
    // Spec Table 2 names this "mode", capitalised. terminalMode is kept alongside it only so
    // an app build older than the rename keeps working; remove once none are in the field.
    mode:                    petrolinaConfig.terminalMode === "attended" ? "Attended" : "Unattended",
    terminalMode:            petrolinaConfig.terminalMode,
    // V9 Table 2 calls the callback port "listeningPort" and makes it mandatory. devicePort was
    // the name while it was still a proposal; both go out until no old app build remains.
    listeningPort:           petrolinaConfig.devicePort,
    claimTTL:                petrolinaConfig.claimTTL,
    devicePort:              petrolinaConfig.devicePort,
    maxAmount:               petrolinaConfig.maxAmount,
    confirmAmountTO:         petrolinaConfig.confirmAmountTO,
    stationName:             petrolinaConfig.stationName,
    isLoyalty:               petrolinaConfig.isLoyalty,
    loyaltyEndPoint:         petrolinaConfig.loyaltyEndPoint,
    loyaltyBins:             petrolinaConfig.loyaltyBins,
    helpPhone:               petrolinaConfig.helpPhone,
    pumpProducts:            petrolinaConfig.pumpProducts,
    pumpSelectedTO:          petrolinaConfig.pumpSelectedTO,
    memberOfMyPetrolinaTO:   petrolinaConfig.memberOfMyPetrolinaTO,
    phoneForMyPetrolinaTO:   petrolinaConfig.phoneForMyPetrolinaTO,
    confirmMyPetrolinaTO:    petrolinaConfig.confirmMyPetrolinaTO,
    fuelSelectionTO:         petrolinaConfig.fuelSelectionTO,
    selectAmountTO:          petrolinaConfig.selectAmountTO,
    enterAmountTO:           petrolinaConfig.enterAmountTO,
    displayStartFuelingTO:   petrolinaConfig.displayStartFuelingTO,
    displayAskKM:            petrolinaConfig.displayAskKM,
    displayAskRegNo:         petrolinaConfig.displayAskRegNo,
    insertPetrolinaCardTO:   petrolinaConfig.insertPetrolinaCardTO,
    displayScreenFuelingTO:  petrolinaConfig.displayScreenFuelingTO,
    serverTime:              new Date().toISOString()
  };
  addPetroLog("POST", "/petrolAppInit", req.body, body);
  res.json(body);
});

// POST /optTransaction â€” creates a new OPT transaction record, returns transsegno
app.post("/optTransaction", (req, res) => {
  if (petrolinaConfig.responseCode !== "00") {
    const body = { responseCode: petrolinaConfig.responseCode, responseDescription: "OPT error", uuid: req.body.UUID || "" };
    addPetroLog("POST", "/optTransaction", req.body, body);
    return res.json(body);
  }
  const transsegno = String(petrolinaTranCounter++);
  const uuid = req.body.UUID || "";
  petrolinaTransactions[transsegno] = {
    transsegno, uuid,
    terminal: req.body.terminal || petrolinaConfig.terminal,
    cardType: req.body.cartType || "B",
    pumpId:   req.body.pumpid || petrolinaConfig.pumpNo,
    batchNo:  req.body.batchNo || "",
    callbackBase: req.body.callbackBase || "",
    createdAt: Date.now(),
    state: "opt_created"
  };
  const body = {
    terminal:            petrolinaTransactions[transsegno].terminal,
    timeOfTheServer:     new Date().toISOString(),
    transsegno,
    UUID:                uuid,
    batchNo:             req.body.batchNo || "",
    responseCode:        "00",
    responseDescription: "Transaction created successfully"
  };
  addPetroLog("POST", "/optTransaction", req.body, body);
  res.json(body);
});

// POST /preAuthorization â€” records ECR pre-auth result, schedules completion callback
app.post("/preAuthorization", (req, res) => {
  const transsegno = req.body.transsegno || "";
  const txn = petrolinaTransactions[transsegno];
  if (!txn) {
    const body = { terminal: req.body.terminal || "", timeOfTheServer: new Date().toISOString(), transsegno, UUID: req.body.UUID || "", batchNo: req.body.batchNo || "", responseCode: RC.UNKNOWN_TRANSSEGNO, responseDescription: "Unknown transsegno" };
    addPetroLog("POST", "/preAuthorization", req.body, body);
    return res.json(body);
  }
  if (petrolinaConfig.preAuthResult !== "ok") {
    const body = { terminal: txn.terminal || "", timeOfTheServer: new Date().toISOString(), transsegno, UUID: req.body.UUID || "", batchNo: req.body.batchNo || "", responseCode: petrolinaConfig.responseCode || "05", responseDescription: "Pre-auth rejected by OPT" };
    addPetroLog("POST", "/preAuthorization", req.body, body);
    return res.json(body);
  }
  Object.assign(txn, {
    jccAuthCode:           req.body.jccAuthCode || "",
    jccRetrievalReference: req.body.jccRetrievalReference || "",
    jccRequestAmount:      req.body.jccRequestAmount || 0,
    jccFinalAmount:        req.body.jccFinalAmount || 0,
    // Stamped so the settlement sweep can tell a fresh pre-auth from an abandoned one.
    preAuthAt:             Date.now(),
    fuelledCents:          0,
    state: "pre_auth_ok"
  });
  const body = {
    terminal:            txn.terminal || petrolinaConfig.terminal,
    timeOfTheServer:     new Date().toISOString(),
    transsegno,
    UUID:                req.body.UUID || "",
    batchNo:             req.body.batchNo || "",
    responseCode:        "00",
    responseDescription: "Pre-auth accepted"
  };
  addPetroLog("POST", "/preAuthorization", req.body, body);
  res.json(body);

  // Schedule completion callback
  const callbackBase = txn.callbackBase || "";
  if (callbackBase) {
    if (petrolinaConfig.fuelingEnabled === "1") {
      // The nozzle is lifted callbackDelaySec after approval, then fuel flows in ticks.
      console.log(`[PETRO] Fuelling starts in ${petrolinaConfig.callbackDelaySec}s, then ${petrolinaConfig.fuelingTicks} ticks`);
      setTimeout(() => petroStartFuelling(transsegno, callbackBase), petrolinaConfig.callbackDelaySec * 1000);
    } else {
      console.log(`[PETRO] Completion callback to ${callbackBase} in ${petrolinaConfig.callbackDelaySec}s`);
      setTimeout(() => firePetroCompletion(transsegno, callbackBase), petrolinaConfig.callbackDelaySec * 1000);
    }
  }
});

// POST /abortTransaction
app.post("/abortTransaction", (req, res) => {
  const transsegno = req.body.transsegno || "";
  if (transsegno && petrolinaTransactions[transsegno]) {
    petrolinaTransactions[transsegno].state = "aborted";
  }
  const body = {
    terminal:            req.body.terminal || petrolinaConfig.terminal,
    timeOfTheServer:     new Date().toISOString(),
    transsegno:          transsegno,
    UUID:                req.body.UUID || "",
    responseCode:        "00",
    responseDescription: "Abort acknowledged"
  };
  addPetroLog("POST", "/abortTransaction", req.body, body);
  res.json(body);
});

// POST /help
/**
 * Petrolina help, spec Table 43.
 *
 * Not registered as its own route: the parking application already owns POST /help, and Express
 * matches the first route it finds, so a second one here would never be reached. The parking
 * handler delegates here when the caller identifies itself as petrolinaApp.
 */
function petroHelp(req, res) {
  const body = {
    terminal:             req.body.terminal || petrolinaConfig.terminal || "",
    UUID:                 req.body.UUID || "",
    displayMessage:       petrolinaConfig.helpMessage.replace("{phone}", petrolinaConfig.helpPhone),
    timeToDisplayMessage: String(petrolinaConfig.helpMessageSecs),
    responseCode:         RC.APPROVED,
    responseDescription:  "Help Ok",
    timeOfTheServer:      new Date().toISOString()
  };
  addPetroLog("POST", "/help", req.body, body);
  res.json(body);
}

// POST /loyaltyCheck â€” MyPetrolina loyalty lookup by phone number
/**
 * Only these numbers have an account. Anything else is declined â€” a lookup that approves whatever
 * it is given cannot exercise the "no such account" path the device has to handle.
 */
const mockLoyaltyAccounts = {
  "99123456": { maskedName: "Î“Î¹ÏŽ*** Î‘Î½Ï„****", pointsBalance: 1250 },
  "99654321": { maskedName: "ÎœÎ±Ï*** Î Î±Ï€****", pointsBalance:  320 }
};
app.post("/loyaltyCheck", (req, res) => {
  const phoneNo = req.body.phoneNo || "";
  const account = mockLoyaltyAccounts[phoneNo];
  const body = {
    terminal:            req.body.terminal || "",
    timeOfTheServer:     new Date().toISOString(),
    transsegno:          req.body.transsegno || "",
    UUID:                req.body.UUID || "",
    responseCode:        account ? RC.APPROVED : RC.LOYALTY_DECLINED,
    responseDescription: account ? "OK" : "No MyPetrolina account for this number",
    maskedName:          account ? account.maskedName    : undefined,
    pointsBalance:       account ? account.pointsBalance : undefined
  };
  addPetroLog("POST", "/loyaltyCheck", req.body, body);
  res.json(body);
});

// POST /petrolinaCard â€” Petrolina proprietary card auth (PAN + PIN)
// UID â†’ card number mapping. In production this lives in the OPT / card host and is populated at
// card issuance; here it is a stub so the contactless path can be tested end to end.
const petrolinaUidMap = {
  "9566709B":       "9100001880880805",   // MIFARE Classic 1K test card
  "041534FA035C80": "9100001880880806"    // ISO 14443-4 test card (SAK 0x20)
};
function petroCardForUid(uid) {
  return petrolinaUidMap[String(uid).toUpperCase()] || `UID:${uid}`;
}

/** Description for a /petrolinaCard response code. The device shows its own translated text. */
function petroCardRcText(rc) {
  return {
    [RC.APPROVED]:           "Card accepted",
    [RC.INVALID_PIN]:        "Incorrect PIN",
    [RC.CARD_DECLINED]:      "Card declined",
    [RC.PIN_EXHAUSTED]:      "Incorrect PIN, maximum attempts reached",
    [RC.PETROLINA_REFUSED]:  "Petrolina Card not approved"
  }[rc] || `Declined (${rc})`;
}

app.post("/petrolinaCard", (req, res) => {
  // A swipe sends petrolinaCard (the card number); a tap sends petrolinaCardUid, because the
  // terminal cannot read the card's data sector. A real OPT resolves the UID to an account â€”
  // this mock accepts either and records which was used.
  const uid = req.body.petrolinaCardUid || "";
  const pan = req.body.petrolinaCard || (uid ? petroCardForUid(uid) : "");
  const pin = req.body.petrolinaPIN  || "";
  const txnKey = req.body.transsegno || "";
  if (txnKey && petrolinaTransactions[txnKey]) {
    petrolinaTransactions[txnKey].petrolinaCardPan = pan;
    petrolinaTransactions[txnKey].petrolinaCardUid = uid;
  }

  // A PIN that is always accepted cannot exercise the re-prompt path, which is the one decline a
  // customer can recover from unaided. petrolinaPin holds the value this mock treats as correct;
  // anything else returns 01 and the device offers another attempt.
  const pinOk = pin === String(petrolinaConfig.petrolinaPin);
  // The PIN is checked first: a wrong PIN is recoverable and the device re-prompts, whereas the
  // declines below end the transaction, so a card set to "blocked" must not mask a typing mistake.
  const rc   = !pinOk ? RC.INVALID_PIN : String(petrolinaConfig.petrolinaCardRc || RC.APPROVED);
  const ok   = rc === RC.APPROVED;
  const body = {
    terminal:                   req.body.terminal || "",
    timeOfTheServer:             new Date().toISOString(),
    transsegno:                  req.body.transsegno || "",
    UUID:                        req.body.UUID || "",
    petrolinacardaskforkm:       ok ? petrolinaConfig.askForKm    : undefined,
    petrolinacardaskforcarregno: ok ? petrolinaConfig.askForRegNo : undefined,
    responseCode:                rc,
    responseDescription:         petroCardRcText(rc)
  };
  addPetroLog("POST", "/petrolinaCard", req.body, body);
  res.json(body);
});

// POST /confirmPetrolinaCard â€” after fuel/KM/reg selection; OPT authorises pump
app.post("/confirmPetrolinaCard", (req, res) => {
  const transsegno  = req.body.transsegno || "";
  const productId   = req.body.productId  || "";
  const odometer    = req.body.petrolinacardodometer || 0;
  const carRegNo    = req.body.petrolinacardcarregno || "";

  // Save into active transaction so fire-completion knows the card type
  if (petrolinaTransactions[transsegno]) {
    petrolinaTransactions[transsegno].isPetrolinaCard = true;
  }

  const body = {
    terminal:            req.body.terminal || "",
    timeOfTheServer:     new Date().toISOString(),
    transsegno,
    UUID:                req.body.UUID || "",
    responseCode:        "00",
    responseDescription: "Confirmed â€” pump authorised"
  };
  addPetroLog("POST", "/confirmPetrolinaCard", req.body, body);

  // Auto-fire /completionPetrolina after callbackDelaySec
  const txn = petrolinaTransactions[transsegno] || {};
  const callbackBase = txn.callbackBase || "";
  if (callbackBase && petrolinaConfig.callbackDelaySec > 0) {
    setTimeout(() => firePetroCompletion(transsegno, callbackBase, true), petrolinaConfig.callbackDelaySec * 1000);
  }

  res.json(body);
});

// â”€â”€ Petrolina callback helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/**
 * A completion is valid once, and only while the pre-authorisation still stands. A second one â€” or
 * one sent after a reversal â€” is what produces a double charge on a live terminal.
 *
 * The device deliberately keeps no record of past transactions, so it cannot refuse these itself:
 * it will acknowledge whatever arrives and fire the ECR completion. That makes ordering the OPT's
 * responsibility, and the mock enforces it so testing reflects how a correct server must behave.
 */
function petroCompletionBlockedReason(txn) {
  switch (txn.state) {
    case "completed": return "already completed";
    case "reversed":  return "pre-authorisation already reversed";
    case "aborted":   return "transaction aborted";
    default:          return null;
  }
}

/** The OPT holds the outcome â€” whether this call delivered it or an earlier one did. */
function petroAcknowledged(reply) {
  return reply && (reply.responseCode === RC.APPROVED || reply.responseCode === RC.ALREADY_PROCESSED);
}

/** Spec Table 15 reverse reasons. 1 is "no fuelling took place". */
const REVERSE_REASON_NOT_FUELLED = 1;

// -- Settlement guarantee ----------------------------------------------------
// Every approved pre-authorisation ends in exactly one completion or one reversal. The OPT owns
// that promise, so an unacknowledged callback is retried, and none may still be outstanding when
// the batch closes: afterwards an uncaptured pre-auth can no longer be settled against it.

/** Transactions pre-authorised and not yet completed or reversed. */
function petroOutstanding() {
  return Object.values(petrolinaTransactions)
    .filter(t => t.state === "pre_auth_ok")
    .map(t => ({
      transsegno: t.transsegno,
      pumpId:     t.pumpId,
      amount:     t.jccFinalAmount || 0,
      ageSec:     Math.round((Date.now() - (t.preAuthAt || Date.now())) / 1000),
      fuelledCents: t.fuelledCents || 0,
      fuelling:   !!t.fuellingInProgress
    }));
}

/**
 * Settles one outstanding pre-authorisation.
 *
 * Which one is owed is not a choice: fuel dispensed means a completion for what was taken, no fuel
 * means the hold is given back. A completion for a fuelling that never happened charges for
 * nothing; a reversal of one that did gives the fuel away.
 */
function petroSettleOne(item, callbackBase) {
  const txn = petrolinaTransactions[item.transsegno];
  if (!txn) return;
  if (item.fuelling) {
    // The nozzle is still up. Neither outcome is known yet, so leave it alone - reversing now
    // would give away fuel that is at this moment going into the tank.
    return;
  }
  if (item.fuelledCents > 0) {
    console.log(`[PETRO_SETTLE] retry completion transsegno=${item.transsegno} (age ${item.ageSec}s)`);
    firePetroCompletion(item.transsegno, callbackBase, txn.isPetrolinaCard, item.fuelledCents);
  } else if (item.ageSec >= petrolinaConfig.abandonedAfterSec) {
    console.log(`[PETRO_SETTLE] reversing abandoned pre-auth transsegno=${item.transsegno} (age ${item.ageSec}s)`);
    firePetroReversal(item.transsegno, callbackBase);
  }
}

/** Periodic sweep. Silent when nothing is owed. */
function petroSettlementSweep() {
  if (!petrolinaConfig.settlementRetryEnabled) return;
  const base = lastPetroCallbackBase();
  if (!base) return;
  const outstanding = petroOutstanding();
  if (!outstanding.length) return;
  console.log(`[PETRO_SETTLE] ${outstanding.length} pre-auth(s) outstanding`);
  outstanding.forEach(item => petroSettleOne(item, base));
}

/** Fire-and-forget POST to the device. Used for /fueling, where a missed tick simply skips. */
function postToDevice(callbackBase, path, payload, label) {
  const body = JSON.stringify(payload);
  const url  = new URL(callbackBase.replace(/\/$/, "") + path);
  const r = (url.protocol === "https:" ? require("https") : http).request({
    hostname: url.hostname, port: url.port || (url.protocol === "https:" ? 443 : 80),
    path: url.pathname, method: "POST",
    // agent:false forces a fresh socket. Node's global agent keeps sockets alive, but
    // NanoHTTPD on the terminal closes them between ticks â€” reusing one gives "socket hang up".
    agent: false,
    headers: {
      "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body),
      "Connection": "close"
    }
  }, resp => {
    let d = ""; resp.on("data", c => d += c);
    resp.on("end", () => addPetroLog(label, url.href, payload, safeJson(d)));
  });
  r.on("error", e => addPetroLog(label, url.href, payload, { error: e.message }));
  r.write(body); r.end();
}

/**
 * Simulates the pump: the nozzle is lifted, fuel flows, then the nozzle is returned.
 *
 * The device is told at each stage â€” a /fueling tick every fuelingTickSec while the fill climbs,
 * then /completion once it stops. The ticks are what let the terminal show the fill progressing and
 * keep its screen alive, so a slow fill is indistinguishable from an abandoned one without them.
 */
function petroStartFuelling(transsegno, callbackBase) {
  const txn = petrolinaTransactions[transsegno];
  if (!txn || !callbackBase) return;

  // The nozzle is up. The settlement sweep leaves it alone until this clears - the outcome is not
  // knowable while fuel is flowing, and reversing mid-fill would give away what is being dispensed.
  txn.fuellingInProgress = true;

  const maxCents = Math.round((txn.jccFinalAmount || 0) * 100) || 20000;
  const target   = petrolinaConfig.actualAmountCents > 0
    ? Math.min(petrolinaConfig.actualAmountCents, maxCents)
    : Math.floor(Math.random() * (maxCents - Math.min(500, maxCents)) + Math.min(500, maxCents));
  const price    = petrolinaConfig.pumpProducts[0]?.pricePerLiter || 1650;
  const ticks    = Math.max(1, Number(petrolinaConfig.fuelingTicks) || 4);
  const everyMs  = (Number(petrolinaConfig.fuelingTickSec) || 5) * 1000;

  let tick = 0;
  const timer = setInterval(() => {
    tick++;
    const blocked = petroCompletionBlockedReason(txn);
    if (blocked) { clearInterval(timer); return; }   // reversed or aborted mid-fill

    const cents = Math.round(target * (tick / ticks));
    postToDevice(callbackBase, "/fueling", {
      application:     "petrolinaApp",
      terminal:        txn.terminal || petrolinaConfig.terminal,
      transsegno,
      UUID:            txn.uuid || "",
      amountUsed:      cents / 100,
      litresUsed:      parseFloat((cents / price).toFixed(3)),
      pumpId:          txn.pumpId || petrolinaConfig.pumpNo,
      productid:       txn.productId || "",
      timeOfTheServer: new Date().toISOString()
    }, "FUELINGâ†’APP");

    if (tick >= ticks) {
      clearInterval(timer);
      // Nozzle returned: the OPT now knows the final amount and completes. Passed explicitly so
      // the completion matches the fill the device has just watched â€” writing it back into the
      // config would pin every later transaction to this one's amount.
      // Remembered so the settlement sweep knows fuel was actually dispensed. Without it an
      // unacknowledged completion would later be settled as a reversal and the fuel given away.
      if (petrolinaTransactions[transsegno]) {
        petrolinaTransactions[transsegno].fuelledCents = target;
        petrolinaTransactions[transsegno].fuellingInProgress = false;   // nozzle returned
      }
      setTimeout(() => firePetroCompletion(transsegno, callbackBase, false, target), everyMs);
    }
  }, everyMs);
}

/** [forcedCents] is the amount actually dispensed, when a fuelling simulation has just measured it. */
function firePetroCompletion(transsegno, callbackBase, isPetrolinaCard = false, forcedCents = 0) {
  const txn = petrolinaTransactions[transsegno] || {};

  const blocked = petroCompletionBlockedReason(txn);
  if (blocked) {
    const note = { responseCode: RC.INVALID_STATE, responseDescription: `Completion refused â€” ${blocked}` };
    console.log(`[PETRO_CB] refused completion for ${transsegno}: ${blocked}`);
    addPetroLog("CALLBACK REFUSED", `${transsegno} â€” ${blocked}`, { transsegno, state: txn.state }, note);
    return { ok: false, error: note.responseDescription };
  }

  const isPetro = isPetrolinaCard || txn.isPetrolinaCard || false;
  const maxCents = Math.round((txn.jccFinalAmount || 0) * 100) || 20000;
  // The pump controller stops at the authorised amount, so a completion can never exceed the
  // pre-authorisation. Randomising above it â€” as this did via Math.max(maxCents, 5000) â€” produced
  // traces the physical system cannot generate, and made the app look wrong for capturing them.
  const floorCents  = Math.min(500, maxCents);
  const actualCents = forcedCents > 0
    ? Math.min(forcedCents, maxCents)
    : petrolinaConfig.actualAmountCents > 0
      ? Math.min(petrolinaConfig.actualAmountCents, maxCents)
      : Math.floor(Math.random() * (maxCents - floorCents) + floorCents);
  const pricePerLiter = petrolinaConfig.pumpProducts[0]?.pricePerLiter || 1650;
  const liters = parseFloat((actualCents / pricePerLiter).toFixed(3));

  const payload = JSON.stringify({
    terminal:              txn.terminal || petrolinaConfig.terminal,
    timeOfTheServer:       new Date().toISOString(),
    UUID:                  txn.uuid || "",
    transsegno,
    amountUsed:            actualCents / 100,
    amountAuthorized:      maxCents / 100,
    pumpId:                txn.pumpId || petrolinaConfig.pumpNo,
    jccAuthCode:           txn.jccAuthCode || "",
    jccRetrievalReference: txn.jccRetrievalReference || "",
    petrolinaCardNo:       isPetro ? (txn.petrolinaCardPan || "") : undefined
  });

  // Petrolina card â†’ /completionPetrolina; bank card â†’ /completion
  const endpoint = isPetro ? "/completionPetrolina" : "/completion";
  const callbackUrl = callbackBase.replace(/\/$/, "") + endpoint;
  console.log(`[PETRO_CB] â†’ ${callbackUrl}  ${payload}`);
  try {
    const url = new URL(callbackUrl);
    const req = (url.protocol === "https:" ? require("https") : http).request({
      hostname: url.hostname, port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
    }, (r) => {
      let data = ""; r.on("data", c => data += c);
      r.on("end", () => {
        console.log(`[PETRO_CB] â† HTTP ${r.statusCode} ${data}`);
        const reply = safeJson(data);
        // Only on an acknowledgement. Marking it completed regardless would hide a device that
        // rejected the completion, and the advice would look settled when it is not.
        if (petrolinaTransactions[transsegno] && petroAcknowledged(reply)) {
          petrolinaTransactions[transsegno].state = "completed";
        }
        addPetroLog("CALLBACKâ†’APP", callbackUrl, { actualAmountCents: actualCents, liters }, reply);
      });
    });
    req.on("error", e => {
      console.error(`[PETRO_CB] FAILED: ${e.message}`);
      addPetroLog("CALLBACKâ†’APP", callbackUrl, { actualAmountCents: actualCents }, { error: e.message });
    });
    req.write(payload); req.end();
  } catch (e) {
    console.error(`[PETRO_CB] URL parse error: ${e.message}`);
    addPetroLog("CALLBACKâ†’APP", callbackUrl || "?", { actualAmountCents: actualCents }, { error: e.message });
  }
}

// â”€â”€ Petrolina admin endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/petrolina/logs",    (req, res) => res.json(petrolinaLogs));
app.post("/petrolina/clear-logs", (req, res) => { petrolinaLogs = []; res.json({ ok: true }); });
app.get("/petrolina/transactions", (req, res) => res.json(petrolinaTransactions));
/** What the batch is waiting on, and the last deferral. Lets a tester see the guarantee working. */
app.get("/petrolina/settlement", (req, res) => res.json({
  outstanding:      petroOutstanding(),
  lastAlert:        petroLastAlert,
  sweepSec:         petrolinaConfig.settlementSweepSec,
  abandonedAfterSec: petrolinaConfig.abandonedAfterSec,
  retryEnabled:     petrolinaConfig.settlementRetryEnabled
}));

app.post("/petrolina/config", (req, res) => {
  const { key, value } = req.body;
  if (!(key in petrolinaConfig)) return res.status(400).json({ ok: false, error: `Unknown key: ${key}` });
  const existing = petrolinaConfig[key];
  if (typeof existing === "number")       petrolinaConfig[key] = Number(value);
  else if (typeof existing === "boolean") petrolinaConfig[key] = value === true || value === "true";
  else                                    petrolinaConfig[key] = value;
  console.log(`[PETRO_CFG] ${key} = ${JSON.stringify(petrolinaConfig[key])}`);
  res.json({ ok: true });
});

// Manual: fire completion callback to a specific transsegno+callbackBase
app.post("/petrolina/fire-completion", (req, res) => {
  const { transsegno, callbackBase } = req.body;
  const txn = transsegno ? petrolinaTransactions[transsegno] : null;
  const base = callbackBase || txn?.callbackBase || "";
  if (!txn) return res.json({ ok: false, error: "transsegno not found" });
  if (!base) return res.json({ ok: false, error: "No callbackBase â€” app must send it in optTransaction" });
  const result = firePetroCompletion(transsegno, base);
  if (result && result.ok === false) return res.json(result);
  res.json({ ok: true, transsegno, callbackBase: base });
});

// Manual: fire reversal callback to a specific transsegno+callbackBase
app.post("/petrolina/fire-reversal", (req, res) => {
  const { transsegno, callbackBase, reverseReason } = req.body;
  const txn = transsegno ? petrolinaTransactions[transsegno] : null;
  const base = callbackBase || txn?.callbackBase || "";
  if (!txn) return res.json({ ok: false, error: "transsegno not found" });
  if (!base) return res.json({ ok: false, error: "No callbackBase" });
  const sentTo = firePetroReversal(transsegno, base, reverseReason || 1, "Manual reversal from mock server");
  res.json({ ok: true, sentTo });
});

/**
 * Sends reversePreAuth and records the outcome. Used by the dashboard button and by the settlement
 * sweep, which is why it is a function rather than route-local: an abandoned pre-authorisation has
 * to be reversible without anyone pressing anything.
 *
 * Returns the URL it posted to.
 */
function firePetroReversal(transsegno, base, reverseReason = REVERSE_REASON_NOT_FUELLED, description = "No fuelling took place") {
  const txn = petrolinaTransactions[transsegno];
  if (!txn) return "";
  const payload = JSON.stringify({
    application: "petrolinaApp",
    terminal: txn.terminal || petrolinaConfig.terminal,
    UUID: txn.uuid || "", transsegno,
    jccAuthCode: txn.jccAuthCode || "", jccRetrievalReference: txn.jccRetrievalReference || "",
    reverseReason, reverseDescription: description,
    timeOfTheServer: nowIso()
  });
  const callbackUrl = base.replace(/\/$/, "") + "/reversePreAuth";
  try {
    const url = new URL(callbackUrl);
    const r = (url.protocol === "https:" ? require("https") : http).request({
      hostname: url.hostname, port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
    }, resp => { let d=""; resp.on("data",c=>d+=c); resp.on("end",()=>{
      const reply = safeJson(d);
      // Record the outcome. Without this the transaction keeps whatever state the completion left
      // it in, so a reversed pre-authorisation still reads as completed and a second completion
      // looks legitimate.
      if (petroAcknowledged(reply)) txn.state = "reversed";
      addPetroLog("REVERSALâ†’APP", callbackUrl, safeJson(payload), reply);
    }); });
    r.on("error", e => addPetroLog("REVERSALâ†’APP", callbackUrl, JSON.parse(payload), { error: e.message }));
    r.write(payload); r.end();
  } catch(e) { console.error(`[PETRO_REV] ${e.message}`); }
  return callbackUrl;
}

// The device may answer a callback with a non-JSON body â€” a NanoHTTPD HTML error page, plain text,
// or nothing at all. Parsing that unguarded inside a response handler throws asynchronously and
// takes the whole server down, so every callback response goes through this.
function safeJson(s) {
  if (!s) return {};
  try { return JSON.parse(s); }
  catch (e) { return { parseError: e.message, raw: String(s).slice(0, 300) }; }
}

// Most recent callbackBase reported by the app on any optTransaction
/**
 * Where to address a callback. The spec pairing wins: deviceIP from petrolAppInit plus the
 * devicePort we handed back. Falling back to a callbackBase reported during a transaction keeps
 * older app builds working, and means a callback can still be fired if init predates this change.
 */
function lastPetroCallbackBase() {
  if (petrolinaConfig.deviceIP && petrolinaConfig.devicePort) {
    return `http://${petrolinaConfig.deviceIP}:${petrolinaConfig.devicePort}`;
  }
  const txns = Object.values(petrolinaTransactions).filter(t => t.callbackBase);
  return txns.length ? txns[txns.length - 1].callbackBase : "";
}

// Generic OPTâ†’App callback sender â€” used by batchClosure / serviceChange / getStatus
function firePetroCallback(path, payload, callbackBase, res) {
  const base = callbackBase || lastPetroCallbackBase();
  if (!base) return res.json({ ok: false, error: "No callbackBase known â€” run a transaction first" });
  const body = JSON.stringify(payload);
  const callbackUrl = base.replace(/\/$/, "") + path;
  try {
    const url = new URL(callbackUrl);
    const r = (url.protocol === "https:" ? require("https") : http).request({
      hostname: url.hostname, port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, resp => {
      let d = ""; resp.on("data", c => d += c);
      resp.on("end", () => {
        const reply = safeJson(d);
        if (path === "/getStatus") {
          addPetroLog(`${path}â†’APP`, `${callbackUrl}  [${describePetroStatus(reply)}]`, payload, reply);
        } else {
          addPetroLog(`${path}â†’APP`, callbackUrl, payload, reply);
        }
      });
    });
    r.on("error", e => addPetroLog(`${path}â†’APP`, callbackUrl, payload, { error: e.message }));
    r.write(body); r.end();
  } catch (e) { return res.json({ ok: false, error: e.message }); }
  res.json({ ok: true, sentTo: callbackUrl });
}

// Manual: batch closure â†’ app
app.post("/petrolina/fire-batch-closure", (req, res) => {
  const { callbackBase, batchNo, noOfTransactions, totalAmount, force } = req.body;

  // Closure is the deadline for the settlement guarantee: after it, an uncaptured pre-auth can no
  // longer be settled against this batch. So it is deferred while anything is still owed, and the
  // condition is raised rather than swallowed - a deferred batch is recoverable, a stranded hold on
  // a customer's card is not. `force` exists for testing the override path deliberately.
  const outstanding = petroOutstanding();
  if (outstanding.length && !force) {
    const alert = {
      ok: false,
      deferred: true,
      reason: `Batch closure deferred - ${outstanding.length} pre-authorisation(s) not yet settled`,
      outstanding
    };
    console.error(`[PETRO_ALERT] BATCH CLOSURE DEFERRED - ${outstanding.length} unsettled: ` +
      outstanding.map(o => `${o.transsegno} (pump ${o.pumpId}, EUR ${o.amount}, ${o.ageSec}s)`).join(", "));
    addPetroLog("BATCH DEFERRED", "/batchClosure", { batchNo }, alert);
    petroLastAlert = { at: nowIso(), ...alert };
    // Nudge them along now rather than waiting for the next sweep.
    petroSettlementSweep();
    return res.json(alert);
  }

  firePetroCallback("/batchClosure", {
    application:      "petrolinaApp",
    terminal:         petrolinaConfig.terminal,
    batchNo:          batchNo || "000012",
    noOfTransactions: Number(noOfTransactions) || 0,
    totalAmount:      Number(totalAmount) || 0,
    UUID:             require("crypto").randomUUID(),
    timeOfTheServer:  new Date().toISOString()
  }, callbackBase, res);
});

// Manual: service change (in / out) â†’ app
app.post("/petrolina/fire-service-change", (req, res) => {
  const { callbackBase, service } = req.body;
  // Spec Table 37: the field is serviceStatus, carrying IN_SERVICE / OUT_OF_SERVICE.
  firePetroCallback("/serviceChange", {
    application:     "petrolinaApp",
    terminal:        petrolinaConfig.terminal,
    serviceStatus:   service === "out" ? SERVICE_OUT : SERVICE_IN,
    reason:          req.body.reason || "",
    UUID:            require("crypto").randomUUID(),
    timeOfTheServer: new Date().toISOString()
  }, callbackBase, res);
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ATTENDED (PORTABLE) MODE â€” Amendment 1
// Post-pay: the customer has already fuelled, so there is no pre-auth. The device
// fetches the unpaid fuelling for a pump, claims it exclusively, takes payment,
// then advises the OPT.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let petrolinaUnpaid    = {};      // transsegno -> fuelling
let petrolinaReceiptNo = 100;

/**
 * Local time with the UTC offset written out — "2026-07-10T21:48:20.000+03:00".
 *
 * V9 shows every timestamp in this form and none in Z form, so the mock answers in the shape the
 * app will meet in production. toISOString() would send UTC and hide a three-hour disagreement.
 */
function nowIso(d = new Date()) {
  const p = (n, w = 2) => String(Math.abs(n)).padStart(w, "0");
  const off = -d.getTimezoneOffset();                 // minutes east of UTC
  const sign = off >= 0 ? "+" : "-";
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
         `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}` +
         `${sign}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
}

/** The single unpaid fuelling for a pump â€” Petrolina cannot serve a second car until settled. */
function unpaidForPump(pumpid) {
  return Object.values(petrolinaUnpaid)
    .find(f => String(f.pumpId) === String(pumpid) && !f.paid) || null;
}

function claimIsLive(f) {
  return f.claimedBy && f.claimExpiry && new Date(f.claimExpiry).getTime() > Date.now();
}

function petroAck(req, extra) {
  return Object.assign({
    terminal:        petrolinaConfig.terminal || req.body.terminal || "",
    timeOfTheServer: nowIso(),
    transsegno:      req.body.transsegno || "",
    UUID:            req.body.UUID || ""
  }, extra);
}

// â”€â”€ A3: the unpaid fuelling for a pump â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post("/pumpTransaction", (req, res) => {
  const pumpid = String(req.body.pumpid || "");
  let body;
  if (!pumpid) {
    body = petroAck(req, { pumpid, responseCode: RC.NOTHING_TO_PAY, responseDescription: "Unknown pump number" });
  } else {
    const f = unpaidForPump(pumpid);
    if (!f) {
      body = petroAck(req, { pumpid, responseCode: RC.NOTHING_TO_PAY, responseDescription: "No unpaid fuelling at this pump" });
    } else {
      body = petroAck(req, {
        pumpid,
        transsegno:   f.transsegno,
        productId:    f.productId,
        product:      f.product,
        litres:       f.litres,
        amount:       f.amount,
        fuellingTime: f.fuellingTime,
        claimedBy:    claimIsLive(f) ? f.claimedBy : "",
        claimExpiry:  claimIsLive(f) ? f.claimExpiry : undefined,
        responseCode: "00",
        responseDescription: "Unpaid fuelling found"
      });
    }
  }
  addPetroLog("POST", "/pumpTransaction", req.body, body);
  res.json(body);
});

// â”€â”€ A4: exclusive claim â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post("/claimPumpTransaction", (req, res) => {
  const f = petrolinaUnpaid[req.body.transsegno];
  const me = req.body.terminal || "";
  let body;
  if (!f) {
    body = petroAck(req, { responseCode: RC.UNKNOWN_TRANSSEGNO, responseDescription: "Unknown transsegno" });
  } else if (f.paid) {
    body = petroAck(req, { responseCode: RC.ALREADY_PROCESSED, responseDescription: "Already paid" });
  } else if (claimIsLive(f) && f.claimedBy !== me) {
    body = petroAck(req, { responseCode: RC.CLAIMED_ELSEWHERE, responseDescription: `Claimed by ${f.claimedBy}` });
  } else {
    f.claimedBy   = me;
    f.claimExpiry = new Date(Date.now() + petrolinaConfig.claimTTL * 1000).toISOString();
    body = petroAck(req, {
      amount: f.amount, productId: f.productId, litres: f.litres,
      claimExpiry: f.claimExpiry,
      responseCode: "00", responseDescription: "Claim granted"
    });
  }
  addPetroLog("POST", "/claimPumpTransaction", req.body, body);
  res.json(body);
});

// â”€â”€ A5: release without payment â€” still owed, NOT an abort â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post("/releasePumpTransaction", (req, res) => {
  const f = petrolinaUnpaid[req.body.transsegno];
  if (f && !f.paid) { f.claimedBy = ""; f.claimExpiry = null; }
  const body = petroAck(req, {
    responseCode: f ? "00" : "93",
    responseDescription: f ? `Released (reason ${req.body.releaseReason || "-"})` : "Unknown transsegno"
  });
  addPetroLog("POST", "/releasePumpTransaction", req.body, body);
  res.json(body);
});

// â”€â”€ A6/A8: payment advice â€” idempotent on (transsegno, UUID) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post("/saleAdvice", (req, res) => {
  // Test switch: fail the advice at transport level so the device cannot tell whether the payment
  // was recorded. This is the ambiguous case the durable queue exists for â€” the advice must stay
  // queued and be retried, NOT discarded.
  if (petrolinaConfig.failSaleAdvice === "1") {
    addPetroLog("POST", "/saleAdvice", req.body, { simulatedFailure: true, note: "failSaleAdvice enabled" });
    return res.status(500).json({ error: "Simulated failure (failSaleAdvice enabled)" });
  }
  const f = petrolinaUnpaid[req.body.transsegno];
  let body;
  if (!f) {
    body = petroAck(req, { responseCode: RC.UNKNOWN_TRANSSEGNO, responseDescription: "Unknown transsegno" });
  } else if (f.paid) {
    // A repeat of an advice already recorded returns 21 with the original receiptNo, and MUST NOT
    // post the payment twice. 21 tells the device the OPT holds it, so the entry leaves the queue â€”
    // which is the difference between a duplicate and a failure worth retrying.
    body = petroAck(req, {
      receiptNo: f.receiptNo, responseCode: RC.ALREADY_PROCESSED,
      responseDescription: `Already recorded (duplicate advice, attempt ${req.body.adviceAttempt || "?"})`
    });
  } else {
    f.paid       = true;
    f.paidBy     = req.body.terminal || "";
    f.cartType   = req.body.cartType || "";
    f.amountPaid = req.body.amountPaid;
    // Attended loyalty: the number is captured on the device with no prior lookup, so the OPT
    // resolves it and attributes the points here, after the fuelling is already recorded.
    f.loyaltyPhoneNo = req.body.phoneNo || "";
    f.petrolinaCardNo = req.body.petrolinaCard || req.body.petrolinaCardUid || "";
    f.odometer = req.body.petrolinacardodometer || 0;
    f.carRegNo = req.body.petrolinacardcarregno || "";
    f.receiptNo  = String(++petrolinaReceiptNo).padStart(6, "0");
    f.paidAt     = nowIso();
    body = petroAck(req, {
      receiptNo: f.receiptNo, responseCode: "00",
      responseDescription: `Payment recorded (${f.cartType === "C" ? "cash" : "card"})`
    });
  }
  addPetroLog("POST", "/saleAdvice", req.body, body);
  res.json(body);
});

// â”€â”€ A16: receipt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Returned already formatted for the printer, per ECR field 29:
//   FJ<line><GS>FJ<line><GS>â€¦   F = font (B double width, N normal, C barcode, P paper)
//                               J = justification (L left, R right, C centred, S separator)
// Max 42 chars normal / 21 double-width. The Petrolina logo is NOT included â€” it is pre-loaded
// on the terminal and prepended by the payment application.
const GS = String.fromCharCode(29);

function rline(font, just, text) { return font + just + text; }

function buildPetroReceipt(f) {
  const paidAt = new Date(f.paidAt || Date.now());
  const dt = `${String(paidAt.getDate()).padStart(2,"0")}/${String(paidAt.getMonth()+1).padStart(2,"0")}/` +
             `${paidAt.getFullYear()} ${String(paidAt.getHours()).padStart(2,"0")}:${String(paidAt.getMinutes()).padStart(2,"0")}`;
  const net = +(f.amountPaid / 1.19).toFixed(2);
  const vat = +(f.amountPaid - net).toFixed(2);
  const price = f.litres > 0 ? (f.amountPaid / f.litres) : 0;
  const method = f.cartType === "C" ? "CASH" : (f.cartType === "P" ? "PETROLINA CARD" : "BANK CARD");

  const lines = [
    rline("N","C", petrolinaConfig.stationName || "PETROLINA"),
    rline("N","C", "113, Athalassas Avenue"),
    rline("N","C", "TEL:22421258"),
    rline("N","C", "VAT REG. NO.10170964K"),
    rline("P","S", ""),
    rline("B","C", method === "PETROLINA CARD" ? "PETROLINA CARD" : method),
    rline("N","C", "DELIVERY NOTE"),
    rline("P","S", ""),
    rline("N","L", padRow("RECEIPT NO:", f.receiptNo || "")),
    rline("N","L", padRow("PUMP NO:",    f.pumpId || "")),
    rline("N","L", padRow("TRANS NO:",   f.transsegno || "")),
  ];
  if (f.cartType === "P" && f.petrolinaCardNo) lines.push(rline("N","L", padRow("CARD NO:", f.petrolinaCardNo)));
  if (f.carRegNo)  lines.push(rline("N","L", padRow("CAR REG. NO:", f.carRegNo)));
  lines.push(
    rline("P","S", ""),
    rline("N","C", "PURCHASE DETAILS"),
    rline("N","L", "PRODUCT      PRICE    QTY     VALUE"),
    rline("N","L", `${(f.product||"").slice(0,12).padEnd(12)} ${price.toFixed(3).padStart(6)} ${Number(f.litres).toFixed(2).padStart(7)} ${Number(f.amountPaid).toFixed(2).padStart(8)}`),
    rline("N","L", padRow("TOTAL (EUR):", Number(f.amountPaid).toFixed(2))),
    rline("P","S", ""),
    rline("N","L", "RATE  CODE     NET     VAT   TOTAL"),
    rline("N","L", `19%   A     ${net.toFixed(2).padStart(7)} ${vat.toFixed(2).padStart(7)} ${Number(f.amountPaid).toFixed(2).padStart(7)}`),
    rline("P","S", ""),
    rline("N","L", padRow("DATE:", dt)),
    rline("N","L", padRow("PAID BY:", method))
  );
  if (f.odometer)       lines.push(rline("N","L", padRow("KILOMETERS:", String(f.odometer))));
  if (f.loyaltyPhoneNo) lines.push(rline("N","L", padRow("MYPETROLINA:", f.loyaltyPhoneNo)));
  lines.push(
    rline("P","S", ""),
    rline("N","C", "THIS IS NOT A VALID TAX RECEIPT"),
    rline("N","C", "PRICES ARE INDICATIVE"),
    rline("N","C", "HAVE A NICE TRIP")
  );
  return lines.join(GS);
}

/** Left label, right value, padded to the 42-character normal-font line width. */
function padRow(label, value) {
  const w = 42;
  const v = String(value);
  return label + " ".repeat(Math.max(1, w - label.length - v.length)) + v;
}

app.post("/receipt", (req, res) => {
  const f = petrolinaUnpaid[req.body.transsegno];
  let body;
  if (!f) {
    body = petroAck(req, { responseCode: RC.UNKNOWN_TRANSSEGNO, responseDescription: "Unknown transsegno" });
  } else if (!f.paid) {
    body = petroAck(req, { responseCode: RC.NOT_SETTLED, responseDescription: "Not settled â€” no receipt available" });
  } else {
    body = petroAck(req, {
      receiptNo:      f.receiptNo,
      receiptContent: buildPetroReceipt(f),
      responseCode:   "00",
      responseDescription: "Receipt"
    });
  }
  addPetroLog("POST", "/receipt", req.body, { ...body, receiptContent: body.receiptContent ? "<" + body.receiptContent.split(GS).length + " lines>" : "" });
  res.json(body);
});

// â”€â”€ Dashboard: simulate a car having fuelled at a pump â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post("/petrolina/add-unpaid", (req, res) => {
  const transsegno = String(++petrolinaTranCounter);
  const litres = Number(req.body.litres) || 20;
  const price  = (petrolinaConfig.pumpProducts[0] || {}).pricePerLiter || 1720;
  petrolinaUnpaid[transsegno] = {
    transsegno,
    pumpId:       String(req.body.pumpid || petrolinaConfig.pumpNo),
    productId:    req.body.productId || "unleaded95",
    product:      req.body.product   || "Unleaded 95",
    litres:       Number(litres.toFixed(2)),
    amount:       Number(req.body.amount) || Number(((litres * price) / 1000).toFixed(2)),
    fuellingTime: nowIso(),
    claimedBy:    "", claimExpiry: null, paid: false
  };
  res.json({ ok: true, transsegno, fuelling: petrolinaUnpaid[transsegno] });
});

app.get("/petrolina/unpaid", (req, res) => res.json(Object.values(petrolinaUnpaid)));

app.post("/petrolina/clear-unpaid", (req, res) => {
  petrolinaUnpaid = {};
  res.json({ ok: true });
});

// Manual: get status â†’ app
app.post("/petrolina/fire-get-status", (req, res) => {
  const { callbackBase } = req.body;
  firePetroCallback("/getStatus", {
    application:     "petrolinaApp",
    terminal:        petrolinaConfig.terminal,
    UUID:            require("crypto").randomUUID(),
    timeOfTheServer: new Date().toISOString()
  }, callbackBase, res);
});

/**
 * Spec Table 40: responseCode says whether the terminal is free, stateCode says what it is doing.
 * Reading both is what lets the OPT decide it may start work rather than merely guessing from a
 * timeout, so the reply is summarised into the log rather than left as raw JSON.
 */
function describePetroStatus(reply) {
  if (!reply || typeof reply !== "object") return "no reply";
  const free = reply.responseCode === STATUS_RC_IDLE;
  const code = reply.stateCode || "--";
  const desc = reply.stateDescription || reply.responseDescription || "";
  return `${free ? "IDLE" : "IN USE"} Â· ${code} ${desc}`.trim();
}

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// FAIRWAY API  (RESA / Hermes Airports)
// POST /connect/token   Ã¢â‚¬â€ OAuth2 client_credentials (identity server)
// POST /fairway/:method Ã¢â‚¬â€ Fairway API call (Bearer token required)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /connect/token Ã¢â‚¬â€ OAuth2 token endpoint Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.post("/connect/token", (req, res) => {
  const { grant_type, client_id, client_secret, scope } = req.body;
  if (grant_type !== "client_credentials") {
    const r = { error: "unsupported_grant_type", error_description: "Only client_credentials is supported" };
    addFairwayLog("POST", "/connect/token", req.body, r);
    return res.status(400).json(r);
  }
  if (fairwayConfig.responseCode === "401" ||
      client_id !== fairwayConfig.clientId ||
      client_secret !== fairwayConfig.clientSecret) {
    const r = { error: "invalid_client", error_description: "Invalid client_id or client_secret" };
    addFairwayLog("POST", "/connect/token", { grant_type, client_id, scope }, r);
    return res.status(401).json(r);
  }
  if (fairwayConfig.responseCode === "500") {
    const r = { error: "server_error", error_description: "Internal server error" };
    addFairwayLog("POST", "/connect/token", req.body, r);
    return res.status(500).json(r);
  }
  const token = require("crypto").randomBytes(32).toString("hex");
  fairwayCurrentToken  = token;
  fairwayTokenExpiry   = Date.now() + fairwayConfig.tokenExpiresIn * 1000;
  const response = {
    access_token: token,
    expires_in:   fairwayConfig.tokenExpiresIn,
    token_type:   "Bearer",
    scope:        scope || fairwayConfig.scope
  };
  addFairwayLog("POST", "/connect/token", { grant_type, client_id, scope }, response);
  res.json(response);
});

// Ã¢â€â‚¬Ã¢â€â‚¬ POST /fairway/:apimethod Ã¢â‚¬â€ Fairway API Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.post("/fairway/:apimethod", (req, res) => {
  const method = req.params.apimethod;

  // Bearer auth check
  if (fairwayConfig.requireAuth) {
    const auth  = req.headers["authorization"] || "";
    const token = auth.startsWith("Bearer ") ? auth.substring(7) : null;
    if (!token || token !== fairwayCurrentToken || Date.now() > fairwayTokenExpiry) {
      const r = { error: "Unauthorized", error_description: "Invalid or expired Bearer token" };
      addFairwayLog("POST", `/fairway/${method}`, req.body, r);
      return res.status(401).json(r);
    }
  }

  if (fairwayConfig.responseCode === "500") {
    const r = { error: "InternalServerError", error_description: "Server error (forced)" };
    addFairwayLog("POST", `/fairway/${method}`, req.body, r);
    return res.status(500).json(r);
  }

  const def = fairwayMethods[method];
  if (!def) {
    const r = { error: "MethodNotFound", error_description: `Unknown API method: ${method}` };
    addFairwayLog("POST", `/fairway/${method}`, req.body, r);
    return res.status(404).json(r);
  }

  // help=1 Ã¢â€ â€™ parameter discovery
  if (req.body.help !== undefined) {
    const response = { Data: def.params.map(p => ({ name: p.name, type: p.type })) };
    addFairwayLog("POST", `/fairway/${method}?help`, req.body, response);
    return res.json(response);
  }

  const response = { Data: def.data };
  addFairwayLog("POST", `/fairway/${method}`, req.body, response);
  res.json(response);
});

// Ã¢â€â‚¬Ã¢â€â‚¬ Fairway admin endpoints Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.get("/fairway/logs",    (req, res) => res.json(fairwayLogs));
app.delete("/fairway/logs", (req, res) => { fairwayLogs = []; res.json({ ok: true }); });

app.post("/admin/fairway-config", (req, res) => {
  const { key, value } = req.body;
  if (!(key in fairwayConfig)) return res.status(400).json({ ok: false, error: `Unknown key: ${key}` });
  const existing = fairwayConfig[key];
  if (typeof existing === "boolean")  fairwayConfig[key] = value === true || value === "true";
  else if (typeof existing === "number") fairwayConfig[key] = Number(value);
  else fairwayConfig[key] = value;
  console.log(`[FAIRWAY_CFG] ${key} = ${JSON.stringify(fairwayConfig[key])}`);
  res.json({ ok: true });
});

app.post("/admin/fairway-clear-token", (req, res) => {
  fairwayCurrentToken = null;
  fairwayTokenExpiry  = 0;
  res.json({ ok: true });
});

app.post("/admin/fairway-method", (req, res) => {
  const { name, data, params } = req.body;
  if (!name) return res.status(400).json({ ok: false, error: "name required" });
  if (!fairwayMethods[name]) {
    fairwayMethods[name] = { params: params || [], data: data || [] };
  } else {
    if (data    !== undefined) fairwayMethods[name].data   = data;
    if (params  !== undefined) fairwayMethods[name].params = params;
  }
  console.log(`[FAIRWAY_METHOD] ${name} updated`);
  res.json({ ok: true });
});

// Ã¢â€â‚¬Ã¢â€â‚¬ START Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// This is a test rig: a stray throw in an async callback handler must not take the server down
// mid-test. Log it and keep serving â€” a crashed mock looks exactly like a network fault from the
// device, which is expensive to diagnose.
process.on("uncaughtException", (e) => {
  console.error(`[UNCAUGHT] ${e && e.stack ? e.stack : e}`);
});
process.on("unhandledRejection", (e) => {
  console.error(`[UNHANDLED_REJECTION] ${e && e.stack ? e.stack : e}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`RPS Mock running on http://0.0.0.0:${PORT}`);
  startCaptureRetryLoop();
  setInterval(petroSettlementSweep, petrolinaConfig.settlementSweepSec * 1000);
  console.log(`[PETRO_SETTLE] Sweep every ${petrolinaConfig.settlementSweepSec}s; ` +
    `pre-auths with no fuelling reversed after ${petrolinaConfig.abandonedAfterSec}s`);
  console.log(`[PENDING_CAPTURE] Retry loop started Ã¢â‚¬â€ every ${config.captureRetryMins} min, max ${config.captureMaxRetries} retries`);
})
