# help Endpoint

API documentation for the **HELP Button** call issued by the Parking Application when a user presses the on-screen *HELP* button on a parking terminal.

The Parking Terminal calls this endpoint to:

- record an operator-assistance request in the `HelpRequests` table,
- broadcast a real-time SignalR notification to any admin UI session listening on the `helpcall` hub (so the operator's screen "lights up" immediately),
- echo back the screen message + free-spaces counters the terminal should display while the user waits.

Source of truth: `ParkingSolution_TechnicalSpecification_Phase1_V5.docx`, §1.5 *"HELP" Button*.

---

## 1. Route and verbs

| Verb | Path | Parameter binding |
|------|------|-------------------|
| `POST` | `/api/help` | JSON body |

Authentication: **HMAC-SHA256** scheme `HMAC` (see `Documents/HMAC_TerminalAuth.md`). The controller carries `[Authorize(AuthenticationSchemes = HmacDefaults.AuthenticationScheme)]`. In the `Development` environment the handler is run with `Hmac:Required = false`, so unsigned Postman/Swagger calls are still accepted; in production unsigned calls receive `401 Unauthorized`.

Implementation:

- Controller: `src/RPS.Api/Controllers/Parking/HelpController.cs`
- Service:    `src/RPS.Application/Services/HelpCallService.cs`
- Request DTO:  `src/RPS.Application/DTOs/Parking/HelpCallRequest.cs`
- Response DTO: `src/RPS.Application/DTOs/Parking/HelpCallResponse.cs`
- SignalR hub:  `src/RPS.Infrastructure/Hubs/HelpCallHub.cs` (broadcast via `IHelpCallNotifier`)

---

## 2. Request

### 2.1 Body parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `companyCode`      | string | yes | `Companies.CompanyCode`. Cross-checked against the company that owns the parking area; mismatch → response `92`. |
| `application`      | string | yes | Must be `"Parking"`. |
| `intallationPoint` | string | yes | `"Entrance"` or `"Exit"`. *(Spelt with a single `s` in the spec sample — the wire field is preserved verbatim. The response uses the correct spelling `installationPoint`.)* |
| `outlet`           | string (10 digits) | yes | `ParkingAreas.OutletNumber`. |
| `terminal`         | string (12 digits) | yes | `Terminals.TerminalNumber` of the terminal raising the call. |
| `dateTime`         | string (`yyyyMMddHHmmss`) | yes | When the user pressed the HELP button on the terminal (terminal local time). Stored verbatim on `HelpRequests.RequestDateTime`; the server's own UTC timestamp is recorded separately on `HelpRequests.RequestTime`. |
| `action`           | string | yes | What the terminal asked help for. Free-form text; common values include `"ECR Decline"`, `"Technical Error"`, `"Bank Card Insertion Error"`, `"Token Not Recognized"`. Surfaced verbatim in the admin UI. |

### 2.2 Example

```http
POST /api/help
Content-Type: application/json
Authorization: hmacauth MarinaParking-T01:<sig>:<nonce>:<ts>

{
  "companyCode": "MarinaParking",
  "application": "Parking",
  "intallationPoint": "Entrance",
  "outlet": "0000259010",
  "terminal": "000025901025",
  "dateTime": "20260513124500",
  "action": "ECR Decline"
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
| `installationPoint` | string | Echoes the request's `intallationPoint` (with the corrected spelling). |
| `dayTime` | string (`yyyyMMddHHmmss`) | Server UTC time when the response was built. |
| `displayMessage` | string | The message the terminal should show to the user. Sourced from `ParkingAreas.MessageHelpWait` when configured; defaults to `"Please wait for assistance."`. Falls back to one of the canned error strings on failure (see §3.3). |
| `timeToDisplayMessage` | string (seconds) | How long the terminal should keep the message on screen. Sourced from the API config (`Help:TimeToDisplayMessage`, default `"20"`). |
| `responseCode` | string | `"00"` for success. See [Response codes](#33-response-codes). |
| `availablePlaceMonthly` | string (int) | Currently free monthly spaces, or `"-1"` if monthly cards are not supported by this area. Empty string on validation failure. |
| `availablePlacesRegular` | string (int) | Currently free regular spaces, or `"-1"` if not tracked. Empty string on validation failure. |
| `responseDescription` | string | Human-readable description of `responseCode`. |

### 3.2 Example — success

```json
{
  "outlet": "0000259010",
  "terminal": "000025901025",
  "installationPoint": "Entrance",
  "dayTime": "20260513124501",
  "displayMessage": "Please wait for assistance.",
  "timeToDisplayMessage": "20",
  "responseCode": "00",
  "availablePlaceMonthly": "4",
  "availablePlacesRegular": "19",
  "responseDescription": "Successful Response"
}
```

### 3.3 Response codes

| `responseCode` | Meaning | When emitted |
|---|---|---|
| `"00"` | Successful Response | Help request was inserted and the SignalR notification was dispatched. |
| `"91"` | Invalid Outlet Number | No `(Terminals, ParkingAreas)` row matches the supplied `outlet` + `terminal` pair. `displayMessage` falls back to `"Please wait for assistance."` so the user is not left looking at a confusing screen while the terminal logs the failure. |
| `"92"` | Invalid Application *