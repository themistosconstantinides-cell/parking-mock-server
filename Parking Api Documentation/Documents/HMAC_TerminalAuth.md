# HMAC authentication for parking terminal endpoints

This document describes the HMAC-SHA256 authentication scheme that
protects the parking-terminal-facing API endpoints:

| Endpoint | Method | Controller |
|---|---|---|
| `/api/parkingInit` | GET / POST | `ParkingInitController` |
| `/api/entranceCall` | POST | `EntranceCallController` |
| `/api/exitCall` | POST | `ExitCallController` |
| `/api/exitPayment` | POST | `ExitPaymentController` |
| `/api/vehiclePresent` | POST | `VehiclePresentController` |
| `/api/help` | POST | `HelpController` |

All other endpoints (the React admin UI under `/api/admin/*` plus the
SignalR hubs under `/hubs/*`) continue to use the existing JWT bearer
scheme; this document does not affect them.

The implementation lives in
`src/RPS.Api/Authentication/HmacAuthenticationHandler.cs`. The matching
client-side reference is the folder-level pre-request script under
**Parking App API** in `RemoteParkingServer.postman_collection.json`.

## 1. Wire format

A single `Authorization` header carries everything the server needs:

```
Authorization: hmacauth <clientId>:<signature>:<nonce>:<timestamp>
```

| Component | Encoding | Notes |
|---|---|---|
| `hmacauth` | literal | Lower-case scheme prefix. Matches the JCC IPPI scheme we already implement on the outbound side. |
| `clientId` | UTF-8 string | Identifies the terminal/client. Must match a key in `Hmac:Clients` (or fall through to `Hmac:DefaultSecretKey`). |
| `signature` | Base64 | `HMAC-SHA256(secret, sigBase)` (see below). |
| `nonce` | hex | 16+ random bytes hex-encoded. Each (clientId, nonce) pair is rejected on a second sighting within the cache window. |
| `timestamp` | decimal | Unix epoch seconds. Rejected if `\|now - ts\| > Hmac:ClockSkewSeconds`. |

The signature base string is exactly:

```
sigBase = clientId
        + METHOD                                      # "POST", "GET", upper-case
        + lowercase(percent_encode(path + query))     # "/api/parkinginit?outlet=..."
        + timestamp                                   # epoch seconds, decimal
        + nonce                                       # hex, lower-case
        + base64(SHA256(rawBody))                     # SHA256("") for empty bodies
```

The bytes signed are the UTF-8 encoding of `sigBase`. The HMAC key is
the **decoded** Base64 value of the configured client secret (so the
secret can carry binary entropy without JSON-escaping issues).

### Why path-only (no scheme/host)?

The terminal endpoints sit behind an IIS reverse proxy: TLS terminates
on `RPS.Public:8443`, and IIS rewrites to Kestrel on `127.0.0.1:5000`.
Kestrel sees `Host: localhost:5000`, not the public hostname the
terminal signed against, so signing the host would either tie the
signature to the internal hop or require `UseForwardedHeaders` to round-
trip the original host header. Path-only is reverse-proxy-safe and is
the convention used by AWS SigV4, GitHub webhooks, Slack signatures,
etc.

### Worked example

For a `POST /api/parkingInit` to `https://parking-api.example.com:443/api/parkingInit`
with body `{"application":"Parking","outlet":"0000259010","terminal":"000025901025"}`,
clientId `MarinaParking-T01` and secret `Y2hhbmdlbWUtZGV2LXNoYXJlZC1obWFjLWtleS0wMDAwMDAwMDAwMDAwMDA=`:

```
clientId     = "MarinaParking-T01"
method       = "POST"
pathQuery    = "/api/parkingInit"
encodedPath  = "%2fapi%2fparkinginit"
timestamp    = "1747140000"
nonce        = "9f8a1c2b4d6e7f0a1b3c4d5e6f708192"
bodyHash     = "yXkUO7gmJ0VqxvHnQH+...=" (SHA256 of the JSON above, Base64)
sigBase      = "MarinaParking-T01POST%2fapi%2fparkinginit17471400009f8a1c2b...yXkUO7gmJ0VqxvHnQH+...="
signature    = base64(HMAC-SHA256(decodeBase64(secret), UTF8(sigBase)))
authHeader   = "hmacauth MarinaParking-T01:<signature>:9f8a1c2b...:1747140000"
```

If the server's recomputed signature differs by a single byte, you get a
401 with `WWW-Authenticate: hmacauth realm="rps", error="invalid_signature"`.
Common culprits: trailing `/` mismatch, body re-pretty-printing, query-
string variable substitution, `Date.now() / 1000` vs `Date.now()` (epoch
**seconds**, not milliseconds).

## 2. Server configuration

The handler is bound from the `Hmac` section of `appsettings.json`. Full
shape:

```jsonc
"Hmac": {
  // When false, requests with NO Authorization header are allowed through
  // as anonymous (handler issues a "DevBypass" ticket so [Authorize] passes).
  // Requests that DO include the header are still validated, even in dev.
  "Required": true,

  // ±5 minutes of allowed clock drift between the terminal and the server.
  "ClockSkewSeconds": 300,

  // (clientId, nonce) pairs are remembered for this many seconds to block
  // replays. Should be >= ClockSkewSeconds * 2.
  "NonceCacheSeconds": 600,

  // Per-client shared secrets (Base64). Production values belong in
  // appsettings.{env}.local.json (gitignored) or in env vars
  // (Hmac__Clients__<ClientId>=<base64>), never in source control.
  "Clients": {
    "MarinaParking-T01": "<base64 of 32+ random bytes>",
    "MarinaParking-T02": "..."
  },

  // Optional fallback used when no per-client entry matches. Useful for
  // smoke tests; leave unset in production.
  "DefaultSecretKey": null
}
```

### Per-environment defaults

| File | Required | Default secrets |
|---|---|---|
| `appsettings.json` | `true` | none (production-safe) |
| `appsettings.Development.json` | `false` | one shared dev key for `MarinaParking-T01` |
| `appsettings.{env}.local.json` (gitignored) | inherits | per-deployment overrides written by `installer\Install.ps1 -GenerateSecrets` |

### Canonical Base64 secrets (fail-fast at startup)

Configured secrets MUST be in **canonical** Base64. At startup the API
walks every entry under `Hmac:Clients` and `Hmac:DefaultSecretKey` and
verifies that `Convert.ToBase64String(Convert.FromBase64String(value))`
equals the configured value. Anything else throws an
`InvalidOperationException` from `RPS.Api.Authentication.HmacSecretValidator`
and the host fails to start.

**Why this exists.** Padded Base64 is not a one-to-one encoding: the
trailing data character carries bits that the decoder discards. For
example `MDA=` and `MDB=` both decode to the same two bytes
(`0x30 0x30`):

```
MDA=  →  001100 000011 000000 → drop last 2 bits → 0011 0000 0011 0000 → "00"
MDB=  →  001100 000011 000001 → drop last 2 bits → 0011 0000 0011 0000 → "00"
```

`Convert.FromBase64String` silently accepts both. Without the canonical
check, "rotating" a secret by tweaking a trailing character is a silent
no-op — the old key keeps working and you'd only find out months later
that nothing actually rotated. The startup check turns that footgun
into an immediate, loud failure with the canonical form printed in the
error message:

```
Hmac:Clients:MarinaParking-T01: configured Base64 secret is not canonical.
Decoded value re-encodes to 'Y2hhbmdlbWUtZGV2LXNoYXJlZC1obWFjLWtleS0wMDAwMDAwMDAwMDAwMDA='.
Two different Base64 strings can decode to the same key bytes because of padding,
so 'rotating' by changing a trailing character is a silent no-op. Use the
canonical form above, or pick a genuinely different secret if you intended to
rotate.
```

`RPS.HmacSample` runs the matching check on `ParkingApi:SecretBase64` at
startup (`ParkingHmacSigner.ValidateCanonicalSecret`), so the sample
fails the same way and tells you whether your "rotated" sample secret
actually differs from the API's key.

To generate a fresh production secret:

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

## 3. Testing from Postman

The collection (`RemoteParkingServer.postman_collection.json`) already
ships with:

- Two collection variables: `hmac_client_id` and `hmac_secret`.
- A folder-level pre-request script on **Parking App API** that:
  1. Reads those variables.
  2. Builds the same `sigBase` string the server validates.
  3. Computes `HMAC-SHA256` via Postman's bundled `CryptoJS`.
  4. Stamps `Authorization: hmacauth …` on the outgoing request.

### Default values

The dev collection ships with `hmac_client_id = MarinaParking-T01` and
`hmac_secret = Y2hhbmdlbWUtZGV2LXNoYXJlZC1obWFjLWtleS0wMDAwMDAwMDAwMDAwMDA=`,
which match `appsettings.Development.json`. Hitting the dev API with the
default values should succeed against `parkingInit`, `entranceCall`,
etc. without any other setup.

### Production / staging tests

- Override `hmac_client_id` and `hmac_secret` in a **Postman environment**
  (not the collection variables) so the production secret never lands in
  a collection export.
- The script reads via `pm.collectionVariables.get(...)` which transparently
  resolves environment-level overrides too.

### Debugging a 401

When the script's `debug` flag is `true`, it logs `clientId`, `method`,
`pathQuery`, `encoded`, `timestamp`, `nonce`, `bodyHash`, `sigBase`, and
`signature` to the Postman Console (`Ctrl+Alt+C`). The server logs the
same fields under `RPS.Api.Authentication.HmacAuthenticationHandler` at
`Warning` level on every failure (`HMAC auth failed: ... for ClientId=...`),
so a side-by-side diff of the two `sigBase` lines pins down byte-level
mismatches in seconds.

The 401 response itself includes a `WWW-Authenticate` header whose
`error="..."` parameter explains the failure:

| `error` value | Meaning | First thing to check |
|---|---|---|
| `missing_credentials` | No `Authorization` header | The pre-request script didn't run; check the request is in the **Parking App API** folder. |
| `invalid_scheme` | Header doesn't start with `hmacauth ` | Token shape; confirm script output. |
| `invalid_header` | Less than 4 colon-separated parts | Truncated header. |
| `invalid_timestamp` | Non-numeric `ts` field | Postman-side bug. |
| `clock_skew` | `\|now - ts\|` > `ClockSkewSeconds` | NTP-sync the client/server. |
| `unknown_client` | `clientId` not in `Hmac:Clients` and no `DefaultSecretKey` | Provision the terminal / fix typo. |
| `invalid_signature` | Recomputed signature differs | Body re-pretty-printing, path case, query substitution; see "Worked example" above. |
| `replay` | Same (clientId, nonce) seen recently | The script must use a fresh nonce per request — `CryptoJS.lib.WordArray.random(16)` already does this; suspect a manual paste. |
| `server_misconfiguration` | Configured secret isn't valid Base64 | Check `appsettings*.json`. |

## 4. Operational notes

- **Replay cache is per-process.** Multi-instance deployments would let
  an attacker replay a captured nonce against a sibling instance within
  the cache window. Today we run a single API instance behind IIS, so
  this is a non-issue. If we ever scale out, swap `IMemoryCache` for
  `IDistributedCache` (Redis) and the rest of the handler is unchanged.
- **Clock-skew window:** 5 min is loose enough to absorb terminal/server
  drift but tight enough that a replay window outside `NonceCacheSeconds`
  is impossible. If terminals end up on poorly NTP-synced GSM modems we
  can widen the window; the security cost is small as long as the nonce
  cache covers it.
- **Secret rotation:** today secrets live in `appsettings.{env}.local.json`.
  Rotation is a config redeploy + pool recycle. The next iteration will
  move secrets into a `Terminals` table column (`HmacSecretKey`) so
  rotation is a SQL UPDATE; the handler's `Clients` lookup is already
  factored to make that swap a one-line change.
- **Brute-force resistance:** HMAC-SHA256 with a 256-bit key is
  computationally out of reach. The thing that matters is that the
  secret is **at least 32 random bytes** and is not reused across
  clients. The `New-RandomBase64Bytes 32` helper in `installer\Install.ps1`
  produces conformant secrets.
- **Audit:** every successful authentication logs `Debug` with the
  `clientId`; every failure logs `Warning` with the failure reason but
  never the expected signature (timing-safe behaviour, no secret leakage
  via logs).

## 5. Migration path for new terminals

1. Generate a fresh secret on the server:
   ```powershell
   $bytes = New-Object byte[] 32
   [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
   $b64 = [Convert]::ToBase64String($bytes)
   ```
2. Add it to `appsettings.{env}.local.json` (or the Postman environment
   for testing) under `Hmac:Clients:<TerminalId>`.
3. Distribute the same secret to the terminal device through whatever
   channel its installer/MDM uses (out of scope for this document).
4. Recycle the API app pool so the configuration is reloaded.

## 6. Phase-2 roadmap (future work)

- Move secrets from config to the `Terminals` table for DB-backed
  rotation.
- Add an admin UI page under `/admin/security` to mint, rotate, and
  revoke per-terminal secrets.
- Add a structured audit log for HMAC outcomes (`AuthenticationLog`
  table) so security can review failed-signature spikes.
- Swap `IMemoryCache` for `IDistributedCache` if and when the API runs
  multi-instance.
- Consider shifting to RFC 9421 ("HTTP Message Signatures") for a
  standardised wire format. The current scheme is intentionally
  conservative and easy to port (Postman, embedded C, Java) but RFC
  9421 will be the long-term default for new HMAC integrations.
