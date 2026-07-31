package com.parking.app

import android.util.Base64
import java.net.URLEncoder
import java.security.SecureRandom
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * HMAC-SHA256 credentials for a parking terminal.
 *
 * @param clientId     Terminal identifier assigned by the RPS team (e.g. "MarinaParking-T01").
 * @param secretBase64 Shared secret in Base64 — the raw decoded bytes are the HMAC key.
 */
data class HmacCredentials(
    val clientId:     String,
    val secretBase64: String
)

/**
 * Builds the `Authorization: hmacauth …` header required by every RPS terminal endpoint.
 *
 * Wire format (from HMAC_TerminalAuth.md §1):
 *   Authorization: hmacauth <clientId>:<signature>:<nonce>:<timestamp>
 *
 * sigBase = clientId
 *         + METHOD                                    (upper-case)
 *         + lowercase(URLEncode(path + query))
 *         + timestamp                                 (unix seconds, decimal)
 *         + nonce                                     (16 random bytes, hex lower-case)
 *         + Base64(SHA-256(body bytes))               (NO_WRAP, empty for GET)
 *
 * IMPORTANT PORTING NOTES (from C# reference — ParkingHmacSigner.cs):
 *   - timestamp = System.currentTimeMillis() / 1000  (SECONDS, not ms — 10-digit number)
 *   - nonce     = 16 SecureRandom bytes, hex lower-case, fresh every request
 *   - secret    = Base64.decode(secretBase64)         (NEVER use the Base64 string as key)
 *   - path      = URLEncoder.encode(path, "UTF-8").lowercase()
 *   - bodyHash  = Base64.encodeToString(SHA256(body), NO_WRAP)
 *   - signature = Base64.encodeToString(HmacSHA256(keyBytes, UTF8(sigBase)), NO_WRAP)
 */
object HmacSigner {

    private val secureRandom = SecureRandom()

    /**
     * Build the Authorization header value for a POST request with a JSON body.
     *
     * @param credentials  The HMAC client credentials.
     * @param path         Path + query string, e.g. "/api/parkingInit" (no scheme/host).
     * @param method       HTTP verb, e.g. "POST".
     * @param bodyBytes    Exact bytes that will be sent in the body (same array — do not re-serialise).
     * @return The full header value, e.g. "hmacauth MarinaParking-T01:<sig>:<nonce>:<ts>".
     */
    fun buildHeader(
        credentials: HmacCredentials,
        path:        String,
        method:      String,
        bodyBytes:   ByteArray
    ): String {
        val clientId = credentials.clientId

        // 1. Timestamp — Unix SECONDS (server rejects if > ±5 min off)
        val timestamp = (System.currentTimeMillis() / 1000L).toString()

        // 2. Nonce — 16 random bytes, hex lower-case, fresh every call
        val nonceBytes = ByteArray(16)
        secureRandom.nextBytes(nonceBytes)
        val nonce = nonceBytes.joinToString("") { "%02x".format(it) }

        // 3. Encoded path — URL-encode then lower-case (both steps, in that order)
        val encodedPath = URLEncoder.encode(path, "UTF-8").lowercase()

        // 4. Body hash — Base64(SHA-256(bodyBytes)), NO_WRAP (no newlines in output)
        val digest    = java.security.MessageDigest.getInstance("SHA-256").digest(bodyBytes)
        val bodyHash  = Base64.encodeToString(digest, Base64.NO_WRAP)

        // 5. sigBase — exact concatenation, no separators
        val sigBase = clientId + method.uppercase() + encodedPath + timestamp + nonce + bodyHash

        // 6. HMAC-SHA256 over UTF-8(sigBase), keyed with decoded Base64 secret
        val keyBytes   = Base64.decode(credentials.secretBase64, Base64.DEFAULT)
        val mac        = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(keyBytes, "HmacSHA256"))
        val signature  = Base64.encodeToString(
            mac.doFinal(sigBase.toByteArray(Charsets.UTF_8)),
            Base64.NO_WRAP
        )

        return "hmacauth $clientId:$signature:$nonce:$timestamp"
    }
}
