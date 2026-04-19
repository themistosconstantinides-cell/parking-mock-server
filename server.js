const express = require("express");
const app = express();

app.use(express.json());
app.use(express.static("public"));

let logs = [];

function addLog(req, response) {
  const log = {
    time: new Date().toLocaleTimeString(),
    endpoint: req.originalUrl,
    method: req.method,
    request: req.body || {},
    response: response
  };

  console.log("LOG:", log);
  logs.unshift(log);
}

// ===== LOG ENDPOINT =====
app.get("/logs", (req, res) => {
  res.json(logs);
});

// ===== parkingInit =====
app.post("/parkingInit", (req, res) => {

  const response = {
    responseCode: "00",
    responseDescription: "Init OK"
  };

  addLog(req, response);

  res.json(response);
});

// ===== TEST ROUTE =====
app.get("/", (req, res) => {
  res.send("Server is alive");
});

// ===== START =====
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});