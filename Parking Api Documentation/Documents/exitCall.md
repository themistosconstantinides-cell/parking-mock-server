# exitCall Endpoint

API documentation for the **Exit Call** issued by the Parking Application after a user re-inserts (and the ECR re-reads) the same card at the exit terminal.

The Parking Terminal calls this endpoint to:

- look up the active parking record by token,
- calculate the parking fee based on duration, charging rules and any applicable discount,
- check that a vehicle is actually present at the exit loop (mirrors `entranceCall`),
- complete the bank-card flow with the acquirer (release / capture / top-up + capture, or fall back to ECR payment when top-up is declined),
- open the exit barrier via the Tell controller,
- decrement the occupancy counter for the right card category.

Source of truth: `ParkingSolution_TechnicalSpecification_Phase1_V8.docx`, §2.4 *Exit Call* (Scenarios 1–3), plus the Tell-presence/Tell-open extensions described in [§7](#7-notes--change-history).

---

## 1. Route and verbs

| Verb | Path | Parameter binding |
|------|------|-------------------|
| `POST` | `/api/exitCall` | JSON body |

Authentication: **HMAC-SHA256** scheme `HMAC` (see `Documents/HMAC_TerminalAuth.md`). The controller carries `[Authorize(AuthenticationSchemes = HmacDefaults.AuthenticationScheme)]`. In the `Development` environment the handler is run with `Hmac:Required = false`, so unsigned Postman/Swagger calls are still accepted; in production unsigned calls receive `401 Unauthorized`.

Implementation:

- Controller:   `src/RPS.Api/Controllers/Parking/ExitCallController.cs`
- Service:      `src/RPS.Application/Services/ExitService.cs`
- Request DTO:  `src/RPS.Application/DTOs/Parking/ExitCallRequest.cs`
- Response DTO: `src/RPS.Application/DTOs/Parking/ExitCallResponse.cs`
- Acquirer:     `src/RPS.Infrastructure/ExternalClients/AcquirerClient.cs` (JCC IPPI)
- Fee:          `src/RPS.Application/Services/FeeCalculationService.cs`

---

## 2. Request

### 2.1 Body parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `companyCode`      | string | yes | `Companies.CompanyCode`. Cross-checked against the company that owns the parking area; mismatch → response `92`. |
| `application`      | string | yes | Must be `"Parking"`. |
| `intallationPoint` | string | yes | `"Exit"`. *(Spelt with a single `s` in the spec sample — the wire field is preserved verbatim. The response uses the corrected spelling `installationPoint`.)* |
| `outlet`           | string (10 digits) | yes | `ParkingAreas.OutletNumber`. |
| `terminal`         | string (12 digits) | yes | `Terminals.TerminalNumber` of the exit terminal. |
| `token`            | string | yes | Card token / fingerprint from the ECR. Hashed with the same `ITokenEncryptionService.HashToken` used on entry; the server looks up the active `ParkingRecords` row by `TokenHash`. |
| `inputType`        | string | yes | `"Bank Card"` or `"Monthly Card"`. Echoed for log context; the actual card-type used for fee/payment logic is the one stored on the matched parking record at entrance time. |
| `lastDigits`       | string | no  | Last 4 digits of the PAN. Logged for support; the canonical value used for acquirer calls is the entrance-time `LastDigits`. |
| `firstDigits`      | string | no  | First 4–6 digits of the PAN (BIN). Same caveat as `lastDigits`. |
| `timeOfInput`      | string (`yyyyMMddHHmmss`) | yes | When the terminal captured the card at the exit. |

### 2.2 Example

```http
POST /api/exitCall
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
  "timeOfInput": "20260513131245"
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
| `displayMessage` | string | Message the terminal should show. On success a fee-aware message (or `ParkingAreas.MessageExitApproved`); on failure a canned error string. |
| `timeToDisplayMessage` | string (seconds) | How long the terminal should keep the message on screen. Sourced from `ParkingAreas.TimeToDisplayMessageExit`; `"10"` on validation failure. |
| `timeSpent` | string (seconds) | `now - EntryTime`, total seconds. `"0"` on validation failure. |
| `moneyToPay` | string (cents) | Calculated fee in cents (`FinalAmount`). `"0"` on free exit / validation failure. |
| `barrierOpen` | string | `"1"` = barrier opened, `"0"` = closed (failure or unverified loop), `"-2"` = top-up declined and ECR payment is required (see [Scenario 3](#42-scenario-3--fee-greater-than-pre-auth-top-up-flow)). |
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
  "displayMessage": "Your card has been charged the amount of 5.00 Euro. Thank you for your visit. Have a nice day!!!",
  "timeToDisplayMessage": "10",
  "timeSpent": "5430",
  "moneyToPay": "500",
  "barrierOpen": "1",
  "timeOfServer": "20260513140315",
  "responseCode": "00",
  "responseDescription": "Successful Response",
  "recordId": "7B2C6F8A1D4E4F0093B2A1C3D4E5F607"
}
```

### 3.3 Response codes

| `responseCode` | Meaning | When emitted |
|---|---|---|
| `"00"` | Successful Response | Fee resolved; barrier opened (or skipped on a Tell-less site); occupancy decremented. |
| `"21"` | Topup declined. ECR payment required. | Scenario 3: calculated fee exceeded the pre-auth and the JCC top-up call was declined. The pre-auth is **released** (fire-and-forget) so the cardholder is not double-held; `barrierOpen = "-2"`; the parking record stays open with `PaymentStatus = PendingEcrPayment` so the terminal can complete the flow via [`/api/exitPayment`](exitPayment.md). |
| `"05"` | No matching entry record found. Please ask for HELP | The (token, parking area) pair has no `ParkingRecords` row in `Status = Active` with `ExitTime IS NULL`. |
| `"06"` | No vehicle detected at exit | Tell `/getgeneral` was called against `TellVehicleInput` and reported no vehicle (or the call failed). The check is skipped — no `06` is ever emitted — when the terminal does not have full Tell input configuration. |
| `"08"` | Technical problem. Please wait for assistance. | The Tell `/open` call returned a non-success status. A `IHelpCallNotifier.NotifyAlertAsync` alert is also raised so an operator sees the failure on the admin UI. The exact text comes from `ParkingAreas.MessageBarrierFailure` when set. |
| `"91"` | Invalid Outlet Number | No `(Terminals, ParkingAreas)` row matches the supplied `outlet` + `terminal` pair. |
| `"92"` | Invalid Application / Invalid Company Code | `application != "Parking"` or `companyCode` does not match the parking area's owning company. |

### 3.4 Error response example — top-up declined

```json
{
  "outlet": "0000259010",
  "terminal": "000025901090",
  "installationPoint": "Exit",
  "availablePlaceMonthly": "4",
  "availablePlacesRegular": "19",
  "displayMessage": "Charge is 12.50 Euro. Prepare your card for the payment. Please wait...",
  "timeToDisplayMessage": "10",
  "timeSpent": "10800",
  "moneyToPay": "1250",
  "barrierOpen": "-2",
  "timeOfServer": "20260513150202",
  "responseCode": "21",
  "responseDescription": "Topup declined. ECR payment required.",
  "recordId": "7B2C6F8A1D4E4F0093B2A1C3D4E5F607"
}
```

---

## 4. Server-side behaviour

`ExitService.HandleExitAsync` performs the following steps (numbering matches the source comments):

1. Validate `application == "Parking"`. Otherwise return `92`.
2. Look up the terminal by `(TerminalNumber, OutletNumber)`. If no row matches, return `91`. Then load the `ParkingAreas` row and verify `Companies.CompanyCode == request.CompanyCode`; mismatch returns `92`.
3. Hash the token (`ITokenEncryptionService.HashToken`) and look up the active `ParkingRecords` row (`Status = Active`, `ExitTime IS NULL`). If none, return `05`.
4. Compute `duration = now - EntryTime` (`durationMinutes` is `Math.Ceiling(TotalMinutes)`).
5. For **bank cards** call `FeeCalculationService.CalculateFeeAsync(parkingAreaId, durationMinutes, EntryTime)` to get the gross fee. Apply any active `TokenDiscounts` row (matching token + area + activated/deactivated window). Monthly cards skip the fee step (`calculatedFee = 0`).
6. **Vehicle presence** (added 2026-05-14): when the exit terminal has a complete Tell input configuration, call `IBarrierControllerClient.CheckVehiclePresentAsync` against `TellVehicleInput`. If no vehicle (or the call failed) return `06` *before* taking any acquirer / barrier action. When the terminal does not have a Tell input configured, the check is skipped (logged at Debug) and the flow continues — same fallback as `entranceCall`.
7. Branch on the calculated fee:

### 4.1 Scenario 1 — fee = 0 (free exit)

- Open the barrier (Tell `/open` on `TellVehicleOutput`; skipped as no-op success when Tell config is incomplete).
- For bank cards with `PreAuthAmount > 0` and a known `EntranceReferenceNo`: fire-and-forget `IAcquirerClient.ReleaseAsync` for the entrance pre-auth so the bank hold is released.
- `PaymentStatus = Released` (bank cards) or `None` (monthly).
- Decrement occupancy; mark `Status = Exited`, set `ExitTime`, `BarrierOpenedOnExit`.

### 4.1.1 Scenario 2 — fee ≤ pre-auth (capture flow)

- Open the barrier.
- Fire-and-forget `IAcquirerClient.CaptureAsync(amount = calculatedFee)` so the cardholder is captured for the actual fee (less than the held pre-auth).
- `PaymentStatus = Captured`. Decrement occupancy. *(Failure handling for the capture call is currently TODO — see source comment.)*

### 4.2 Scenario 3 — fee greater than pre-auth (top-up flow)

- Synchronously call `IAcquirerClient.TopUpAsync(amount = fee - preAuth)`.
  - **Top-up succeeds**: store `TopUpTransactionRef`, open the barrier, fire-and-forget a `CaptureAsync` for the full `calculatedFee`, set `PaymentStatus = Captured`, decrement occupancy.
  - **Top-up declined**: do **not** open the barrier. Fire-and-forget `ReleaseAsync(preAuth)` so the entrance hold is freed (otherwise the card is double-held: pre-auth + ECR amount). Set `PaymentStatus = PendingEcrPayment`, persist `ExitTerminalId`/`CalculatedFee`/`FinalAmount` on the record, and return response code `"21"` with `barrierOpen = "-2"` so the terminal switches to the ECR-payment dialog and follows up via [`/api/exitPayment`](exitPayment.md).

8. On success paths the record is fully persisted (`ExitTerminalId`, `CalculatedFee`, `FinalAmount`, `ExitTime`, `Status`, `PaymentStatus`, `BarrierOpenedOnExit`, `TopUpTransactionRef`, `DateModified`) and the response is returned with `responseCode = "00"`.

---

## 5. Data sources

The endpoint composes data from these tables (column → JSON field):

| Table | Column | JSON field / role |
|-------|--------|-------------------|
| `Terminals` | `TerminalNumber` | `terminal` |
| `Terminals` | `TellApiUrl`, `TellHwId`, `TellAppId`, `TellApiKey`, `TellVehicleInput`, `TellVehicleOutput`, `BarrierControllerDeviceId` | Used to call Tell `/getgeneral` (presence) and `/open` (barrier). |
| `ParkingAreas` | `OutletNumber` | `outlet` |
| `ParkingAreas` | `MessageExitApproved`, `MessageBarrierFailure` | `displayMessage` (per scenario) |
| `ParkingAreas` | `TimeToDisplayMessageExit` | `timeToDisplayMessage` |
| `ParkingAreas` | `TotalNormalSpaces`, `OccupiedNormalSpaces`, `TotalMonthlySpaces`, `OccupiedMonthlySpaces` | `availablePlacesRegular`, `availablePlaceMonthly` (post-decrement) |
| `Companies` | `CompanyCode` | Validation against request's `companyCode` |
| `ParkingRecords` | `TokenHash`, `EntryTime`, `CardType`, `PreAuthAmount`, `EntranceReferenceNo`, `EntranceAuthCode`, `EntranceReceiptNo`, `EntranceTokenCode`, `EntranceTerminalNumber`, `EntranceExpiryDate`, `LastDigits` | Locate record + build `AcquirerTransactionParams` for JCC calls. |
| `TokenDiscounts` | `DiscountAmount`, `DiscountPercentage`, `ActivatedDate`, `DeactivatedDate` | Applied to `calculatedFee` when a row matches the token + area + active window. |
| `ChargingRules` | via `FeeCalculationService` | `calculatedFee` |
| *(server clock)* | `DateTime.UtcNow` | `timeOfServer`, `ExitTime` |

The endpoint mutates `ParkingRecords` (sets `ExitTime`, `Status`, `PaymentStatus`, `BarrierOpenedOnExit`, etc.) and `ParkingAreas` (decrements occupancy on exit). Acquirer side-effects are fire-and-forget in scenarios 1 and 2.

---

## 6. Related endpoints

- [`/api/parkingInit`](parkingInit.md) — bootstrap call; the terminal uses its `mode` to decide between entrance and exit flows.
- [`/api/entranceCall`](entranceCall.md) — counterpart that opens the entrance barrier and creates the parking record this endpoint resolves.
- [`/api/exitPayment`](exitPayment.md) — completes the exit when `responseCode = "21"` (top-up declined → ECR payment).
- [`/api/vehiclePresent`](vehiclePresent.md) — explicit vehicle-presence probe; this endpoint runs the same check inline.
- [`/api/help`](help.md) — operator-assistance call available from any error path.

---

## 7. Notes / change history

- **2026-05-14** — Added a vehicle-presence check (`responseCode = "06"`) **before** any acquirer / barrier action, mirroring `entranceCall` step 4b. Skipped when the terminal has no Tell input configured (single Debug log, no `06`).
- **Scenario 3 release-on-decline** — When the top-up is declined, `ExitService` fires `IAcquirerClient.ReleaseAsync` for the entrance pre-auth so the customer is not double-held while the ECR payment runs. Without this, the bank's natural release window (5–30 days) leaves the hold visible on the cardholder's statement.
- **Acquirer credentials** are keyed by **(parking area, JCC endpoint)**, not by terminal: the JCC `appId` / `apiKey` for `topup`, `capture`, `release`, `void` and `reversal` come from the `Acquirer:Credentials:<OutletNumber>:<TxType>` section (with an optional `"Default"` outer-key fallback) and are signed by the outbound `HmacAuthorizationHandler` (separate scheme from the inbound HMAC handler used for these terminal endpoints). The outlet number is the same value RPS sends to JCC as `merchantNo` — see `AcquirerOptions` and `Documents/KeyVault_Setup.md §5.6`.
