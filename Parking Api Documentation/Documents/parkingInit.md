# parkingInit Endpoint

API documentation for the **Initial Call of the Parking Application** at the Entrance (or Exit) of a parking area.

This endpoint is the bootstrap call from a Parking Terminal to the Remote Parking Server (RPS). The terminal calls it:

- once at startup,
- automatically at midnight (daily refresh of pricing/configuration),
- on-demand from the terminal when an administrator triggers a manual refresh,
- as the periodic Keep-Alive call (same request/response shape; see [Keep Alive](#6-keep-alive)).

Source of truth: `ParkingSolution_TechnicalSpecification_Phase1_V5.docx`, §1.2 *Initial Call of Parking Application at the Entrance of the Parking Area*, plus the Tell-controller / station / language extensions described in [§7](#7-notes--change-history).

---

## 1. Route and verbs

| Verb | Path | Parameter binding |
|------|------|-------------------|
| `GET`  | `/api/parkingInit` | Query string (`?application=…&outlet=…&terminal=…`) |
| `POST` | `/api/parkingInit` | JSON body |

Both verbs are accepted and produce identical responses. The technical specification names the call as `GET parkingInit` but illustrates a JSON body; `POST` is supported for clients that prefer a body.

Authentication: **HMAC-SHA256** scheme `HMAC` (see `Documents/HMAC_TerminalAuth.md`). The controller carries `[Authorize(AuthenticationSchemes = HmacDefaults.AuthenticationScheme)]`. In the `Development` environment the handler runs with `Hmac:Required = false`, so unsigned Postman/Swagger calls (including the daily Keep-Alive from a freshly-flashed terminal) are accepted; in production unsigned calls receive `401 Unauthorized` with `WWW-Authenticate: hmacauth realm="rps", error="missing_credentials"`.

Implementation:

- Controller: `src/RPS.Api/Controllers/Parking/ParkingInitController.cs`
- Service:    `src/RPS.Application/Services/ParkingInitService.cs`
- Request DTO: `src/RPS.Application/DTOs/Parking/ParkingInitRequest.cs`
- Response DTO: `src/RPS.Application/DTOs/Parking/ParkingInitResponse.cs`

---

## 2. Request

### 2.1 Body / query parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `application`   | string | yes | Must be `"Parking"`. |
| `outlet`        | string (10 digits) | yes | Identifies the parking area. Configured at setup. Matches `ParkingAreas.OutletNumber`. |
| `terminal`      | string (12 digits) | yes | Identifies the terminal within the parking area. Matches `Terminals.TerminalNumber`. |
| `versionName`   | string | no | Name of the terminal application (e.g. `"ParkingApp"`). Reported by the terminal so the server can log / inspect the running build. |
| `versionNumber` | string | no | Version number of the terminal application (e.g. `"1.0.0"`). Reported by the terminal so the server can log / inspect the running build. |

### 2.2 Example — `POST /api/parkingInit`

```http
POST /api/parkingInit
Content-Type: application/json

{
  "application": "Parking",
  "outlet": "0000259010",
  "terminal": "000025901025",
  "versionName": "ParkingApp",
  "versionNumber": "1.0.0"
}
```

### 2.3 Example — `GET /api/parkingInit`

```
GET /api/parkingInit?application=Parking&outlet=0000259010&terminal=000025901025&versionName=ParkingApp&versionNumber=1.0.0
```

---

## 3. Response

### 3.1 Schema

All values are returned as **strings** (the wire format defined in the spec).

| Field | Type | Description |
|-------|------|-------------|
| `outlet` | string | Echoes the outlet from the request. |
| `terminal` | string | Echoes the terminal from the request. |
| `mode` | `"Entrance"` \| `"Exit"` | Derived from `Terminals.Type`. |
| `companyCode` | string | `Companies.CompanyCode` for the parking area's owning company. |
| `keepAliveFreq` | string (minutes) | Interval for the periodic Keep-Alive call. Negative (e.g. `"-1"`) disables Keep-Alive. |
| `minimumAmountPreAuth` | string (cents) | Minimum pre-authorization to take on the cardholder's card at Entrance. |
| `defaultAmount` | string (cents) | Fallback amount used if no `charges` rule matches. 2 decimals implied (`"800"` = `8.00 EUR`). |
| `phoneForHelp` | string\|null | Phone number the terminal should display when the user presses the **HELP** button. |
| `displayMessageOfEntrance` | string\|null | Up to 300 chars displayed on screen at the Entrance. |
| `displayMessageOnExit` | string\|null | Up to 300 chars displayed on screen at the Exit. |
| `displayMessageOfAvailablePlaces` | string\|null | Template message for free-spaces display. May contain `{availablePlacesRegular}` and `{availablePlaceMonthly}` placeholders that the terminal substitutes. |
| `availablePlacesNormal` | string (int) | Currently free regular spaces, or `"-1"` if regular spaces are not tracked. |
| `availablePlaceMonthly` | string (int) | Currently free monthly spaces, or `"-1"` if monthly cards are not supported by this area. |
| `monthlyCardsBins` | string\|null | Semicolon-separated list of accepted BINs for monthly cards (e.g. `"434343;232323"`). |
| `controller` | string | Barrier controller protocol indicator. `"0"` = no controller. Other values (`"A"`, `"B"`, …) are protocol identifiers. |
| `fixAmountSolution` | string (cents) | Fixed-amount-on-entry feature. `"-1"` disables the feature; otherwise the fixed amount in cents. |
| `charges` | array | Pricing rules. See [Charge object](#33-charge-object). |
| `tellApiUrl` | string\|null | Base URL of the Tell barrier-controller HTTP API for this terminal (e.g. `"https://api.tell.hu/gc"`). |
| `tellHwId` | string\|null | Tell hardware identifier (MAC-address style, e.g. `"FC:0F:E7:CA:8C:09"`). |
| `tellApiKey` | string\|null | Tell API key. |
| `tellAppId` | string\|null | Tell application identifier. |
| `tellPassword` | string\|null | Tell account password. |
| `tellVehicleInput` | string\|null | Which Tell input pin is wired to the vehicle-presence sensor (`"in1"` or `"in2"`). |
| `stationId` | string\|null | Short station code (e.g. `"LIM-001"`). |
| `stationName` | string\|null | Human-readable station name (e.g. `"Rental Station"`). |
| `responseCode` | string | `"00"` for success. See [Response codes](#34-response-codes). |
| `responseDescription` | string | Human-readable description of `responseCode`. |
| `timeOfServer` | string (`yyyyMMddHHmmss`) | Current UTC server time at the moment the response is built. |
| `flagsForAction` | string | Free-form action flags (e.g. `"0000"`). Defaults to `"0000"` if not configured. |
| `voiceAssistant` | `"0"` \| `"1"` | `"1"` enables the on-device voice assistant, `"0"` disables it. Defaults to `"0"`. |
| `defaultLanguage` | string | ISO-style language code for the terminal UI (e.g. `"EN"`, `"EL"`). Defaults to `"EN"`. |

### 3.2 Example

```json
{
  "outlet": "0000259010",
  "terminal": "000025901090",
  "mode": "Entrance",
  "companyCode": "MarinaParking",
  "keepAliveFreq": "10",
  "minimumAmountPreAuth": "300",
  "defaultAmount": "800",
  "phoneForHelp": "99123456",
  "displayMessageOfEntrance": "Welcome to Limassol Parking!",
  "displayMessageOnExit": "Please prepare the card that was used during Entrance.",
  "displayMessageOfAvailablePlaces": "There are {availablePlacesRegular} available places for Normal and {availablePlaceMonthly} for Monthly Customers.",
  "availablePlacesNormal": "19",
  "availablePlaceMonthly": "4",
  "monthlyCardsBins": "123456;12345678910111213453",
  "controller": "A",
  "fixAmountSolution": "-1",
  "charges": [
    { "from": "30",  "to": "120", "fee": "200"  },
    { "from": "120", "to": "180", "fee": "400"  },
    { "from": "180", "to": "240", "fee": "500"  },
    { "from": "240",                "fee": "1000" }
  ],
  "tellApiUrl": "https://api.tell.hu/gc",
  "tellHwId": "FC:0F:E7:CA:8C:09",
  "tellApiKey": "f2nIrJ8DBf4Gc8ar99IQeCVVm3pnWrVP",
  "tellAppId": "d0ab58c3c56ec228dbb932174e63fa9107bc499d",
  "tellPassword": "1234",
  "tellVehicleInput": "in1",
  "stationId": "LIM-001",
  "stationName": "Rental Station",
  "responseCode": "00",
  "responseDescription": "Successful Response",
  "timeOfServer": "20260508061139",
  "flagsForAction": "0000",
  "voiceAssistant": "1",
  "defaultLanguage": "EN"
}
```

### 3.3 Charge object

Each entry in `charges`:

| Field | Type | Description |
|-------|------|-------------|
| `from` | string (minutes) | Lower bound of the duration range, inclusive. |
| `to`   | string (minutes) \| absent | Upper bound, exclusive. **Absent** means infinity (the catch-all top tier). |
| `fee`  | string (cents) | Fee in cents (2 decimals implied). |

Selection rule (see `FeeCalculationService.CalculateFeeAsync`): the first rule for which `from ≤ duration < to` (or `from ≤ duration` when `to` is absent) wins.

`parkingInit` includes both the **default** ruleset and any rules matching the **current effective day type** (Weekday/Weekend, or a `DayCategory` linked via `SpecialDays` — see `ParkingInitService.HandleInitAsync` for the day-type resolution). Day-typed rules for *other* day types are not surfaced through this endpoint.

### 3.4 Response codes

| `responseCode` | Meaning |
|----------------|---------|
| `"00"` | Successful response. Configuration payload is valid. |
| `"91"` | Invalid Outlet Number — no terminal/parking area combination matches the supplied `outlet` + `terminal`. |
| `"92"` | Invalid Application — `application` is not `"Parking"`. |

The full list of response codes lives in the appendix of the technical specification; only the codes actually emitted by `ParkingInitService` are listed above.

### 3.5 Error response example

```json
{
  "outlet": "0000259010",
  "terminal": "999999999999",
  "mode": "",
  "companyCode": "",
  "keepAliveFreq": "",
  "minimumAmountPreAuth": "",
  "defaultAmount": "",
  "availablePlacesNormal": "",
  "availablePlaceMonthly": "",
  "controller": "0",
  "fixAmountSolution": "-1",
  "charges": [],
  "responseCode": "91",
  "responseDescription": "Invalid Outlet Number",
  "timeOfServer": "20260508061145",
  "flagsForAction": "0000",
  "voiceAssistant": "0",
  "defaultLanguage": "EN"
}
```

Even on errors, the server populates `timeOfServer`, `flagsForAction`, `voiceAssistant`, `defaultLanguage`, `controller` and `fixAmountSolution` with their defaults so the terminal always receives a fully-shaped payload.

---

## 4. Server-side behaviour

`ParkingInitService.HandleInitAsync` performs the following steps:

1. Validate `application == "Parking"`. Otherwise return response code `"92"`.
2. Look up the terminal by `(TerminalNumber, OutletNumber)` joining `Terminals` and `ParkingAreas`. If no row matches, return response code `"91"`.
3. Load the corresponding `ParkingAreas` row.
4. Load the owning `Companies` row (only `CompanyCode` is exposed in the response).
5. Resolve the current effective day type:
   - Default: `"Weekend"` for Sat/Sun, otherwise `"Weekday"`.
   - If a `SpecialDays` row exists for today's month/day at this parking area, the day type becomes the matching `DayCategories.Name`.
6. Load `ChargingRules` for the parking area where `DayType = @currentDayType` OR (`DayType IS NULL AND DayOfWeek IS NULL`), ordered by `(SortOrder, FromMinutes)`.
7. Compute available spaces:

   ```text
   availableNormal  = max(0, TotalNormalSpaces  - OccupiedNormalSpaces)
   availableMonthly = max(0, TotalMonthlySpaces - OccupiedMonthlySpaces)
   ```

   If `TotalNormalSpaces`/`TotalMonthlySpaces` is negative (sentinel for "not tracked"), the response returns `"-1"` directly.
8. Map `Terminals.Type` to `mode` (`Entrance` or `Exit`).
9. Project the parking area, terminal, company and charging rules into `ParkingInitResponse`. Populate `timeOfServer` from `DateTime.UtcNow`.

No state is mutated by this endpoint; it is read-only.

---

## 5. Data sources

The endpoint composes data from these tables (column → JSON field):

| Table | Column | JSON field |
|-------|--------|------------|
| `Terminals` | `TerminalNumber` | `terminal` |
| `Terminals` | `Type` | `mode` |
| `Terminals` | `TellApiUrl` | `tellApiUrl` |
| `Terminals` | `TellHwId` | `tellHwId` |
| `Terminals` | `TellApiKey` | `tellApiKey` |
| `Terminals` | `TellAppId` | `tellAppId` |
| `Terminals` | `TellPassword` | `tellPassword` |
| `Terminals` | `TellVehicleInput` | `tellVehicleInput` |
| `Terminals` | `FlagsForAction` | `flagsForAction` (default `"0000"`) |
| `Terminals` | `VoiceAssistant` | `voiceAssistant` (`BIT` → `"1"`/`"0"`) |
| `Terminals` | `DefaultLanguage` | `defaultLanguage` (default `"EN"`) |
| `ParkingAreas` | `OutletNumber` | `outlet` |
| `ParkingAreas` | `DefaultAmount` | `defaultAmount` |
| `ParkingAreas` | `DisplayMessageOfEntrance` | `displayMessageOfEntrance` |
| `ParkingAreas` | `DisplayMessageOnExit` | `displayMessageOnExit` |
| `ParkingAreas` | `DisplayMessageOfAvailablePlaces` | `displayMessageOfAvailablePlaces` |
| `ParkingAreas` | `TotalNormalSpaces`, `OccupiedNormalSpaces` | `availablePlacesNormal` |
| `ParkingAreas` | `TotalMonthlySpaces`, `OccupiedMonthlySpaces` | `availablePlaceMonthly` |
| `ParkingAreas` | `MonthlyCardsBins` | `monthlyCardsBins` |
| `ParkingAreas` | `Controller` | `controller` |
| `ParkingAreas` | `FixAmountSolution` | `fixAmountSolution` |
| `ParkingAreas` | `MinimumAmountPreAuth` | `minimumAmountPreAuth` |
| `ParkingAreas` | `KeepAliveFreqMinutes` | `keepAliveFreq` |
| `ParkingAreas` | `PhoneForHelp` | `phoneForHelp` |
| `ParkingAreas` | `StationId` | `stationId` |
| `ParkingAreas` | `StationName` | `stationName` |
| `Companies` | `CompanyCode` | `companyCode` |
| `ChargingRules` | `FromMinutes` | `charges[].from` |
| `ChargingRules` | `ToMinutes` | `charges[].to` |
| `ChargingRules` | `Fee` | `charges[].fee` |
| *(server clock)* | `DateTime.UtcNow` | `timeOfServer` |

Configuration of these values is done through the admin UI (`/admin/parking-areas`, `/admin/terminals`, `/admin/charging-rules`, `/admin/companies`) or directly via the admin REST API under `/api/admin/*`.

---

## 6. Keep Alive

The Parking Application periodically sends a `parkingInit` call as a Keep Alive. The request and response payloads are identical to the standard call. The terminal uses the `keepAliveFreq` field to decide the interval:

- `keepAliveFreq` ≥ 0: send a Keep Alive every `keepAliveFreq` minutes.
- `keepAliveFreq` < 0 (e.g. `"-1"`): Keep Alive disabled.

Server-side there is no separate endpoint or branch — it is the same handler.

---

## 7. Notes / change history

- **2026-05-08** — Extended the response to include 12 new fields:
  - **Tell barrier-controller integration** (per terminal): `tellApiUrl`, `tellHwId`, `tellApiKey`, `tellAppId`, `tellPassword`, `tellVehicleInput`. Sourced from new `Terminals.Tell*` columns.
  - **Station identification** (per parking area): `stationId`, `stationName`. Sourced from new `ParkingAreas.Station*` columns.
  - **Behavioural flags / voice / language** (per terminal): `flagsForAction`, `voiceAssistant`, `defaultLanguage`. Sourced from new `Terminals` columns; defaults `"0000"` / `"0"` / `"EN"` if unset. *(An earlier draft of the migration placed these on `ParkingAreas`; the alter script drops them from `ParkingAreas` and re-adds them on `Terminals` so each terminal can have its own behaviour.)*
  - **Server time**: `timeOfServer` is now always emitted (success and error paths), formatted `yyyyMMddHHmmss` UTC.
  - **Property ordering** of the response was reorganised to match the new sample payload.
  - **Request DTO**: `versionName` and `versionNumber` (terminal application version, optional) are now part of the request schema.
  - **Placeholder syntax** in `displayMessageOfAvailablePlaces` switched from `<availablePlacesRegular>`/`<availablePlaceMonthly>` to `{availablePlacesRegular}`/`{availablePlaceMonthly}`. This is admin-configurable text; existing rows can be migrated with `database/UpdateData_2026_05_08_PlaceholderSyntax.sql`.
  - DB migration: `database/AlterSchema_2026_05_08_ParkingInit_Tell_Station.sql` (idempotent `ALTER TABLE … ADD …` for all new columns, including the per-terminal `FlagsForAction` / `VoiceAssistant` / `DefaultLanguage` move).
- **2026-05-07** — Renamed the response field `displayMessageOfExit` → `displayMessageOnExit` (`ParkingInitResponse.cs`, `ParkingInitService.cs`) so the wire format matches the technical specification's response table, the `ParkingAreas.DisplayMessageOnExit` column, and every other use of this field across the admin DTOs, web UI, TypeScript types and Postman collection. The previous name was a typo carried over from the example block of the technical specification.
- The technical specification's response example uses `"default"` for the default amount field; the response **table** uses `"defaultAmount"`. The endpoint follows the table (`defaultAmount`) — this is the canonical name and is consistent with the rest of the project.
