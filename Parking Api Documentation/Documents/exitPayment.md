# exitPayment Endpoint

API documentation for the **Exit Payment** call issued by the Parking Application after the user pays the parking fee on the ECR (card terminal) at the exit.

This call is **only** used as the follow-up to an [`exitCall`](exitCall.md) that returned `responseCode = "21"` (top-up declined → ECR payment required). The Parking Terminal calls this endpoint to:

- locate the pending parking record by token (the one left in `PaymentStatus = PendingEcrPayment` by `exitCall`),
- record the ECR transaction outcome (`authCode`, `referenceNo`, `originalRefNum`, `amountPayed`),
- open the exit barrier via the Tell controller when payment is approved,
- decrement the occupancy counter for the right card category.

Source of truth: `ParkingSolution_TechnicalSpecification_Phase1_V8.docx`, §2.4 *Exit Call* (Scenario 3 ECR exception, Table 9).

---

## 1. Route and verbs

| Verb | Path | Parameter binding |
|------|------|-------------------|
| `POST` | `/api/exitPayment` | JSON body |

Authentication: **HMAC-SHA256** scheme `HMAC` (see `Documents/HMAC_TerminalAuth.md`). The controller carries `[Authorize(AuthenticationSchemes = HmacDefaults.AuthenticationScheme)]`. In the `Development` environment the handler is run with `Hmac:Required = false`, so unsigned Postman/Swagger calls are still accepted; in production unsigned calls receive `401 Unauthorized`.

Implementation:

- Controller:   `src/RPS.Api/Controllers/Parking/ExitPaymentController.cs`
- Service:      `src/RPS.Application/Services/ExitPaymentService.cs`
- Request DTO:  `src/RPS.Application/DTOs/Parking/ExitPaymentRequest.cs`
- Response DTO: `src/RPS.Application/DTOs/Parking/ExitPaymentResponse.cs`

---

## 2. Request

### 2.1 Body parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `companyCode`      | string | yes | `Companies.CompanyCode`. Cross-checked against the company that owns the parking area; mismatch → response `92`. |
| `application`      | string | yes | Must be `"Parking"`. |
| `intallationPoint` | string | yes | `"Exit"`. *(Spelt with a single `s` in the spec sample — wire field preserved verbatim. The response uses the corrected spelling `installationPoint`.)* |
| `outlet`           | string (10 digits) | yes | `ParkingAreas.OutletNumber`. |
| `terminal`         | string (12 digits) | yes | `Terminals.TerminalNumber` of the exit terminal. |
| `token`            | string | yes | Same card token presented at entrance / exit. Hashed with `ITokenEncryptionService.HashToken`; the server looks up the row currently in `PaymentStatus = PendingEcrPayment`. |
| `inputType`        | string | yes | `"Bank Card"` (monthly cards never reach this endpoint — they exit via `exitCall` directly). Logged for context. |
| `lastDigits`       | string | no  | Last 4 digits of the PAN, as reported by the ECR for this transaction. |
| `firstDigits`      | string | no  | First 4–6 digits of the PAN (BIN), as reported by the ECR for this transaction. |
| `timeOfInput`      | string (`yyyyMMddHHmmss`) | yes | When the terminal captured the card for the ECR payment. |
| `amountPayed`      | string (cents) | yes | Amount the ECR captured (in cents). Persisted on `ParkingRecords.AmountPaidAtExit`. |
| `authCode`         | string | yes (when approved) | ECR authorisation code for the ECR payment. **Required** alongside `responseCode = "00"` to mark the payment as approved; missing/empty causes the server to treat the payment as declined and return `05`. |
| `responseCode`     | string | yes | ECR response code. `"00"` indicates ECR approval; any other value indicates a declined transaction. |
| `referenceNo`      | string | no  | ECR reference number for the payment. Persisted on `ParkingRecords.ExitReferenceNo`. |
| `originalRefNum`   | string | no  | ECR original reference / receipt number. Persisted on `ParkingRecords.ExitReceiptNo`. |

### 2.2 Example — approved ECR payment

```http
POST /api/exitPayment
Content-Type: application/json
Authorization: hmacauth MarinaParking-T01:<sig>:<nonce>:<ts>

{
  "companyCode": "MarinaParking",
  "application": "Parking",
  "intallationPoint": "Exit",
  "outlet": "0000259010",
  "terminal": "000025901090",
  "token": "7d2b15a5bb54a579374912383c432ff4d7bb12d1003a836895f9c78d1dddeb180d09c81a5d942b06c417e5af8f063eea2dd6f6d8728883954f715a55c48b230f",
  "inputType": "Bank Card",
  "lastDigits": "3412",
  "firstDigits": "434343",
  "timeOfInput": "20260513150500",
  "amountPayed": "1250",
  "authCode": "012345",
  "responseCode": "00",
  "referenceNo": "REF20260513150500",
  "originalRefNum": "RCPT00012345"
}
```

---

## 3. Response

### 3.1 Schema

All values are returned as **strings** (the wire format defined in the spec).

| Field | Type | Description |
|-------|------|-------------|
| `outlet` | string | Echoes the parking-area outlet number. |
| `terminal` | string | Echoes the terminal number. |
| `installationPoint` | string | Always `"Exit"` for this endpoint. |
| `availablePlaceMonthly` | string (int) | Currently free monthly spaces after this exit. |
| `availablePlacesRegular` | string (int) | Currently free regular spaces after this exit. |
| `displayMessage` | string | Message the terminal should show. On success `ParkingAreas.MessageExitApproved` (default `"Thank you for parking here. Have a nice day!!"`); on failure a canned error string. |
| `timeToDisplayMessage` | string (seconds) | How long the terminal should keep the message on screen. Sourced from `ParkingAreas.TimeToDisplayMessageExit`; `"10"` on validation failure. |
| `timeSpent` | string (seconds) | `now - EntryTime`, total seconds. `"0"` on validation failure. |
| `moneyToPay` | string (cents) | The fee that was due for this exit (`FinalAmount`). `"0"` on validation failure. |
| `barrierOpen` | string | `"1"` = barrier opened, `"0"` = closed (failure). This endpoint never returns `"-2"`. |
| `timeOfServer` | string (`yyyyMMddHHmmss`) | Server UTC time when the response was built. |
| `responseCode` | string | See [Response codes](#33-response-codes). |
| `responseDescription` | string | Human-readable description of `responseCode`. |
| `recordId` | string | `ParkingRecords.RecordGuid` formatted as 32 uppercase hex chars (no dashes). Empty on validation failure. |

### 3.2 Example — success

```json
{
  "outlet": "0000259010",
  "terminal": "000025901090",
  "installationPoint": "Exit",
  "availablePlaceMonthly": "4",
  "availablePlacesRegular": "20",
  "displayMessage": "Thank you for parking here. Have a nice day!!",
  "timeToDisplayMessage": "10",
  "timeSpent": "10845",
  "moneyToPay": "1250",
  "barrierOpen": "1",
  "timeOfServer": "20260513150515",
  "responseCode": "00",
  "responseDescription": "Successful Response",
  "recordId": "7B2C6F8A1D4E4F0093B2A1C3D4E5F607"
}
```

### 3.3 Response codes

| `responseCode` | Meaning | When emitted |
|---|---|---|
| `"00"` | Successful Response | ECR payment approved (`responseCode == "00"` AND non-empty `authCode`); record updated, barrier opened (or skipped on a Tell-less site), occupancy decremented. |
| `"05"` | No pending exit payment found. | Look-up by `TokenHash` + `ParkingAreaId` + `PaymentStatus = PendingEcrPayment` (with `ExitTime IS NULL`) returned no row. Either the prior `exitCall` did not return `"21"`, the wrong token was presented, or the row has already been completed. |
| `"05"` | Payment was declined. Please try again or ask for HELP. | ECR sent back a non-`"00"` `responseCode`, or `authCode` was empty. The parking record stays in `PaymentStatus = PendingEcrPayment` so the terminal can retry. |
| `"91"` | Invalid Outlet Number | No `(Terminals, ParkingAreas)` row matches the supplied `outlet` + `terminal` pair. |
| `"92"` | Invalid Application / Invalid Company Code | `application != "Parking"` or `companyCode` does not match the parking area's owning company. |

> **Note:** the two `"05"` cases share the same response code (per spec) but carry different `displayMessage` / `responseDescription` values — `"No pending exit payment found."` vs `"Payment was declined. Please try again or ask for HELP."`.

### 3.4 Error response example — payment declined

```json
{
  "outlet": "0000259010",
  "terminal": "000025901090",
  "installationPoint": "Exit",
  "availablePlaceMonthly": "4",
  "availablePlacesRegular": "19",
  "displayMessage": "Payment was declined. Please try again or ask for HELP.",
  "timeToDisplayMessage": "10",
  "timeSpent": "0",
  "moneyToPay": "0",
  "barrierOpen": "0",
  "timeOfServer": "20260513150525",
  "responseCode": "05",
  "responseDescription": "Payment was declined. Please try again or ask for HELP.",
  "recordId": ""
}
```

---

## 4. Server-side behaviour

`ExitPaymentService.HandleExitPaymentAsync` performs the following steps:

1. Validate `application == "Parking"`. Otherwise return `92`.
2. Look up the terminal by `(TerminalNumber, OutletNumber)`. If no row matches, return `91`. Then load the `ParkingAreas` row and verify `Companies.CompanyCode == request.CompanyCode`; mismatch returns `92`.
3. Hash the token (`ITokenEncryptionService.HashToken`) and look up the **pending** `ParkingRecords` row (`PaymentStatus = PendingEcrPayment`, `ExitTime IS NULL`). If none, return `05` *("No pending exit payment found.")*.
4. Branch on the ECR result:
   - `request.ResponseCode == "00"` AND `!string.IsNullOrEmpty(request.AuthCode)` → **approved**:
     - Persist `AmountPaidAtExit`, `ExitAuthCode`, `ExitReferenceNo` (← `referenceNo`), `ExitReceiptNo` (← `originalRefNum`).
     - Set `PaymentStatus = EcrPaymentCompleted`.
     - Open the barrier via Tell `/open` on `TellVehicleOutput` (skipped as no-op success when Tell config is incomplete).
     - Set `ExitTime = now`, `ExitTerminalId`, `Status = Exited`, `BarrierOpenedOnExit`, `DateModified`.
     - Decrement the right occupancy counter (`OccupiedMonthlySpaces` or `OccupiedNormalSpaces`).
     - Return `responseCode = "00"` with `MessageExitApproved` and barrier state.
   - Otherwise → **declined**: return `05` *("Payment was declined…")* without mutating the record (the row stays in `PendingEcrPayment` so the terminal can retry the ECR transaction).
5. Tell `/open` failures raise an `IHelpCallNotifier.NotifyAlertAsync` so an operator sees the failure on the admin UI; the response still carries `responseCode = "00"` because the payment itself succeeded — `barrierOpen = "0"` signals the barrier issue.

> **Note on company-code validation**: spec V8 §2.4 (Table 9) puts `companyCode` in the request body. `EntranceService` and `ExitService` both validate it; `ExitPaymentService` matches them exactly so a misconfigured terminal cannot complete an exit transaction against the wrong company.

---

## 5. Data sources

The endpoint composes data from these tables (column → JSON field):

| Table | Column | JSON field / role |
|-------|--------|-------------------|
| `Terminals` | `TerminalNumber` | `terminal` |
| `Terminals` | `TellApiUrl`, `TellHwId`, `TellAppId`, `TellApiKey`, `TellVehicleOutput` | Used to call Tell `/open`. |
| `ParkingAreas` | `OutletNumber` | `outlet` |
| `ParkingAreas` | `MessageExitApproved` | `displayMessage` (success) |
| `ParkingAreas` | `TimeToDisplayMessageExit` | `timeToDisplayMessage` |
| `ParkingAreas` | `TotalNormalSpaces`, `OccupiedNormalSpaces`, `TotalMonthlySpaces`, `OccupiedMonthlySpaces` | `availablePlacesRegular`, `availablePlaceMonthly` (post-decrement) |
| `Companies` | `CompanyCode` | Validation against request's `companyCode` |
| `ParkingRecords` | `TokenHash`, `EntryTime`, `CardType`, `FinalAmount` | Locate record + populate response fields. |
| `ParkingRecords` | `AmountPaidAtExit`, `ExitAuthCode`, `ExitReferenceNo`, `ExitReceiptNo`, `PaymentStatus`, `ExitTime`, `ExitTerminalId`, `Status`, `BarrierOpenedOnExit`, `DateModified` | Mutated on approval. |
| *(server clock)* | `DateTime.UtcNow` | `timeOfServer`, `ExitTime` |

The endpoint mutates `ParkingRecords` and `ParkingAreas` (occupancy decrement) on the approved branch; the declined branch is read-only.

---

## 6. Related endpoints

- [`/api/exitCall`](exitCall.md) — produces the `PendingEcrPayment` state this endpoint resolves; emits `responseCode = "21"` and `barrierOpen = "-2"` when ECR payment is required.
- [`/api/parkingInit`](parkingInit.md) — bootstrap; the terminal uses `mode` to decide which exit flow to run.
- [`/api/help`](help.md) — operator-assistance call available from a declined-payment screen.

---

## 7. Notes / change history

- **Company-code parity** — Earlier revisions of `ExitPaymentService` did not validate `companyCode`. Aligned with `EntranceService` and `ExitService` so a misconfigured terminal cannot complete an exit against the wrong company.
- **No vehicle-presence check** — Unlike `entranceCall` and `exitCall`, this endpoint does **not** call Tell `/getgeneral` before opening the barrier. Reason: the user has just completed an ECR transaction at the exit terminal, the car is by definition still at the gate, and re-checking adds latency to the most time-sensitive step. Future revisions may add an opt-in presence check via a per-terminal flag.
- **Idempotency** — The endpoint matches by `(TokenHash, ParkingAreaId, PaymentStatus = PendingEcrPayment)`. After a successful approval, `PaymentStatus` becomes `EcrPaymentCompleted`, so a duplicate approval call returns `05` (*No pending exit payment found.*) rather than re-opening the barrier.
