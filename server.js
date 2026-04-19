const express = require("express");
const app = express();

app.use(express.json());

/* =========================
   parkingInit
========================= */
app.post("/parkingInit", (req, res) => {
  res.json({
    outlet: "0000259010",
    terminal: "000025901025",
    mode: "Entrance",
    companyCode: "MarinaParking",
    keepAliveFreq: "10",
    minimumAmountPreAuth: "300",
    defaultAmount: "800",
    phoneForHelp: "99375545",
    displayMessageOfEntrance: "Welcome to Limassol Parking!",
    displayMessageOnExit: "Please prepare the card.",
    availablePlacesNormal: "18",
    availablePlaceMonthly: "-1",
    charges: [
      { from: "30", to: "120", fee: "200" },
      { from: "120", to: "180", fee: "400" }
    ],
    responseCode: "00",
    responseDescription: "Successful Response"
  });
});

/* =========================
   entranceCall
========================= */
app.post("/entranceCall", (req, res) => {
  res.json({
    outlet: "0000259010",
    terminal: "000025901025",
    installationPoint: "Entrance",
    displayMessage: "Welcome. Have a nice!!",
    timeToDisplayMessage: "5",
    availablePlaceMonthly: "9",
    availablePlacesRegular: "19",
    responseCode: "00",
    responseDescription: "Successful Response"
  });
});

/* =========================
   exitCall (with scenarios)
========================= */
app.post("/exitCall", (req, res) => {
  const scenario = req.query.scenario || "1";

  if (scenario === "1") {
    return res.json({
      barrierOpen: "1",
      moneyToPay: "0",
      displayMessage: "Thank you!",
      responseCode: "00"
    });
  }

  if (scenario === "2") {
    return res.json({
      barrierOpen: "1",
      moneyToPay: "200",
      displayMessage: "Charged EUR 2.00",
      responseCode: "00"
    });
  }

  if (scenario === "3") {
    return res.json({
      barrierOpen: "-2",
      moneyToPay: "356",
      recordId: "1234567890ABCDEF",
      displayMessage: "TopUp required",
      responseCode: "31"
    });
  }

  if (scenario === "4") {
    return res.json({
      barrierOpen: "0",
      moneyToPay: "0",
      displayMessage: "Barrier failed",
      responseCode: "08"
    });
  }
});

/* =========================
   exitPayment
========================= */
app.post("/exitPayment", (req, res) => {
  res.json({
    barrierOpen: "1",
    displayMessage: "Payment successful",
    responseCode: "00"
  });
});

/* =========================
   vehiclePresent
========================= */
app.post("/vehiclePresent", (req, res) => {
  res.json({
    vehiclePresent: "1",
    displayMessage: "Vehicle detected",
    responseCode: "00"
  });
});

/* =========================
   help
========================= */
app.post("/help", (req, res) => {
  res.json({
    responseCode: "00",
    responseDescription: "Successful Response"
  });
});

/* ========================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});