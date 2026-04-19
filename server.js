const express = require("express");
const app = express();

app.use(express.json());

let scenario = "FREE";

// ---- exitCall ----
app.post("/exitCall", (req, res) => {
  if (scenario === "FREE") {
    return res.json({
      barrierOpen: "1",
      moneyToPay: "0",
      responseCode: "00"
    });
  }

  if (scenario === "CAPTURE") {
    return res.json({
      barrierOpen: "1",
      moneyToPay: "200",
      responseCode: "00"
    });
  }

  if (scenario === "TOPUP") {
    return res.json({
      barrierOpen: "-2",
      moneyToPay: "356",
      responseCode: "31"
    });
  }

  if (scenario === "FAIL") {
    return res.json({
      barrierOpen: "0",
      moneyToPay: "0",
      responseCode: "08"
    });
  }
});

// ---- change scenario ----
app.post("/setScenario", (req, res) => {
  scenario = req.body.scenario;
  res.json({ activeScenario: scenario });
});

// ---- start server ----
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});