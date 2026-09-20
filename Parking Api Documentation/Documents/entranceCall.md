# entranceCall Endpoint

API documentation for the **Entrance Call** issued by the Parking Application after a user inserts (and the ECR pre-authorises) a card at the entrance terminal.

The Parking Terminal calls this endpoint to:

- record a new parking session in the database,
- check that a vehicle is actually present at the entrance loop,
- open the entrance barrier via the Tell controller,
- decrement the available-spaces counter for the right card category.

Source of truth: `ParkingSolution_TechnicalSpecification_Phase1_V8.docx`, §2.1 *Entrance Call*, plus the Tell-presence/Tell-open extension described in [§7](#7-notes--change-history).

---

## 1. Route and verbs

| Verb | Path | Parameter binding |
|------|------|-------------------|
| `POST` | `/api/entranceCall` | JSON body |

Authentication: **HMAC-SHA256** scheme `HMAC` (see `Documents/HMAC_TerminalAuth.md`). The controller carries `[Authorize(AuthenticationSchemes = HmacDefaults.AuthenticationScheme)]`. In the `Development` environment the handler is run with `Hmac:Required = false`, so unsigned Postman/Swagger calls are still accepted; in production unsigned calls receive `401 Unauthorized`.

Implementation:

- Controller: `src/RPS.Api/Controllers/Parking/EntranceCallController.cs`
- Service:    `src/RPS.Application/Services/EntranceService.cs`
- Request DTO: `src/RPS.Application/DTOs/Parking/EntranceCallRequest.cs`
- Response DTO: `src/RPS.Application/DTOs/Parking/EntranceCallResponse.cs`

---

## 2. Request

### 2.1 Body parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `companyCode`        | string | yes | `Companies.CompanyCode`. Cross-checked against the company that owns the parking area; mismatch -> response `92`. |
| `application`        | string | yes | Must be `"Parking"`. |
| `intallationPoint`   | string | yes | `"Entrance"`. *(Spelt with a single `s` in the spec sample - the wire field is preserved verbatim.)* |
| `outlet`             | string (10 digits) | yes | `ParkingAreas.OutletNumber`. |
| `terminal`           | string (12 digits) | yes | `Terminals.TerminalNumber` of the entrance terminal. |
| `token`              | string | yes | Card token / fingerprint from the ECR. Hashed before storage (`ITokenEncryptionService.HashToken`); the raw token is never persisted. |
| `inputType`          | string | yes | `"Bank Card"` or `"Monthly Card"`. Determines which spaces counter is decremented and which downstream payment flow is followed. |
| `lastDigits`         | string | no | Last 4 digits of the PAN (bank cards). |
| `firstDigits`        | string | no | First 4-6 digits of the PAN (BIN). |
| `expiryDate`         | string | no | Card expiry as the ECR reports it (`"YYMM"` per spec sample, but field deployments also use `"MMYY"`). Stored verbatim on `ParkingRecords.EntranceExpiryDate`; consumed by the JCC `Capture/Release/TopUp` flow at exit. |
| `timeOfInput`        | string (`yyyyMMddHHmmss`) | yes | When the terminal captured the card. |
| `authCode`           | string | no | ECR pre-authorisation code. Required for any card whose pre-auth must later be captured/released. |
| `referenceNo`        | string | no | ECR reference number for the entrance pre-auth. Used as `originalRef` on later JCC calls. |
| `receiptNumber`      | string | no | ECR receipt number for the entrance pre-auth. Persisted on `EntranceReceiptNo`. |
| `preAuthAmount`      | string (cents) | no | Amount actually pre-authorised on the card by the terminal. Falls back to `ParkingAreas.MinimumAmountPreAuth` when absent / unparseable. Always `0` for monthly cards. |
| `tokenCode`          | string | no | Composite identifier produced by the ECR (vendor-specific, typically `outlet + terminal + authCode + lastDigits + 'C'`). Persisted on `EntranceTokenCode`; passed verbatim to JCC at exit. |

### 2.2 Example

```http
POST /api/entranceCall
Content-Type: application/json
Authorization: hmacauth MarinaParking-T01:<sig>:<nonce>:<ts>

{
  "companyCode": "MarinaParking",
  "application": "Parking",
  "intallationPoint": "Entrance",
  "outlet": "0000259010",
  "terminal": "000025901025",
  "token": "7d2b15a5bb54a579374912383c432ff4d7bb12d1003a836895f9c78d1dddeb180d09c81a5d942b06c417e5af8f063eea2dd6f6d8728883954f715a55c48b230f",
  "inputType": "Bank Card",
  "lastDigits": "3412",
  "firstDig