package com.parking.app.api.real

import com.parking.app.AppLogger
import com.parking.app.EntryRecord
import com.parking.app.HmacCredentials
import com.parking.app.HmacSigner
import com.parking.app.api.RpsApi
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Production implementation of RpsApi.
 * Makes real HTTP POST calls to the RPS backend.
 *
 * @param baseUrl     RPS server base URL, e.g. "https://parking-api.example.com".
 * @param hmac        HMAC credentials (clientId + Base64 secret). When non-null every request
 *                    is signed with `Authorization: hmacauth …`. Pass null to skip signing
 *                    (dev/sandbox without HMAC enabled).
 *
 * All calls run on the calling thread (caller must use a background thread).
 */
class RetrofitRpsApi(
    private val baseUrl: String,
    private val hmac: HmacCredentials? = null
) : RpsApi {

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()

    // ── parkingInit ───────────────────────────────────────────────────────────
    override fun parkingInit(outlet: String, terminal: String, callback: (String) -> Unit) {
        val body = JSONObject().apply {
            put("application",   "Parking")
            put("outlet",        outlet)
            put("terminal",      terminal)
            put("versionName",   getVersionName())    // spec Table 2: optional — app version string
            put("versionNumber", getVersionNumber())  // spec Table 2: optional — app version code
        }
        post("parkingInit", body, callback)
    }

    // Returns the app versionName from PackageInfo (e.g. "1.0.3")
    private fun getVersionName(): String = try {
        val ctx = okhttp3.OkHttpClient::class.java.classLoader
            ?.let { android.app.Application::class.java }
        // BuildConfig is not accessible here — use a static holder set from MainActivity
        RetrofitRpsApi.appVersionName
    } catch (_: Exception) { "" }

    private fun getVersionNumber(): String = try {
        RetrofitRpsApi.appVersionCode
    } catch (_: Exception) { "" }

    companion object {
        // Set from MainActivity.onCreate:
        //   RetrofitRpsApi.appVersionName = BuildConfig.VERSION_NAME
        //   RetrofitRpsApi.appVersionCode = BuildConfig.VERSION_CODE.toString()
        var appVersionName: String = ""
        var appVersionCode: String = ""
    }

    // ── vehiclePresent ────────────────────────────────────────────────────────
    override fun vehiclePresent(outlet: String, terminal: String, dateTime: String, callback: (String) -> Unit) {
        val body = JSONObject().apply {
            put("outlet",   outlet)
            put("terminal", terminal)
            put("dateTime", dateTime)
        }
        post("vehiclePresent", body, callback)
    }

    // ── entranceCall ──────────────────────────────────────────────────────────
    override fun entranceCall(entry: EntryRecord, callback: (String) -> Unit) {
        val body = JSONObject().apply {
            put("companyCode",      entry.companyCode)
            put("application",      "Parking")
            put("intallationPoint", "Entrance")
            put("outlet",           entry.outlet)
            put("terminal",         entry.terminalId)
            put("token",            entry.token)
            put("inputType",        entry.inputType)
            put("lastDigits",       entry.lastDigits)
            put("firstDigits",      entry.firstDigits)
            put("expiryDate",       entry.expiryDate)
            put("authCode",         entry.authCode)
            put("referenceNo",      entry.rrn)       // spec uses "referenceNo" for RRN
            put("receiptNumber",    entry.receiptNumber)
            put("preAuthAmount",    entry.preAuthAmountCents.toString())
            put("tokenCode",        entry.tokenCode)
            put("timeOfInput",      entry.timeOfInput)
        }
        post("entranceCall", body, callback)
    }

    // ── exitCall ──────────────────────────────────────────────────────────────
    override fun exitCall(
        token: String,
        timeOfInput: String,
        lastDigits: String,
        firstDigits: String,    // Real BIN from ECR
        inputType: String,      // P10: "Card" for bank card, "Monthly Card" for monthly exit
        outlet: String,
        terminal: String,
        companyCode: String,
        callback: (String) -> Unit
    ) {
        val body = JSONObject().apply {
            put("companyCode",      companyCode)
            put("application",      "Parking")
            put("intallationPoint", "Exit")
            put("outlet",           outlet)
            put("terminal",         terminal)
            put("token",            token)
            put("inputType",        inputType)  // P10: correctly reflects card type at exit
            put("lastDigits",       lastDigits)
            put("firstDigits",      firstDigits)
            put("timeOfInput",      timeOfInput)
        }
        post("exitCall", body, callback)
    }

    // ── exitPayment ───────────────────────────────────────────────────────────
    override fun exitPayment(
        token: String,
        lastDigits: String,
        firstDigits: String,
        timeOfInput: String,
        amountPayed: Int,
        authCode: String,
        responseCode: String,
        referenceNo: String,
        originalRefNum: String,
        recordId: String,
        outlet: String,
        terminal: String,
        companyCode: String,
        callback: (String) -> Unit
    ) {
        val body = JSONObject().apply {
            put("companyCode",      companyCode)
            put("application",      "Parking")
            put("intallationPoint", "Exit")
            put("outlet",           outlet)
            put("terminal",         terminal)
            put("token",            token)
            put("inputType",        "Card")
            put("lastDigits",       lastDigits)
            put("firstDigits",      firstDigits)
            put("timeOfInput",      timeOfInput)
            put("amountPayed",      amountPayed.toString())
            put("authCode",         authCode)
            put("responseCode",     responseCode)
            put("referenceNo",      referenceNo)
            put("originalRefNum",   originalRefNum)
            put("recordId",         recordId)
        }
        post("exitPayment", body, callback)
    }

    // ── help ──────────────────────────────────────────────────────────────────
    override fun help(
        outlet: String,
        terminal: String,
        companyCode: String,
        installationPoint: String,
        action: String,
        callback: (String) -> Unit
    ) {
        val body = JSONObject().apply {
            put("companyCode",       companyCode)
            put("application",       "Parking")
            put("intallationPoint",  installationPoint)  // spec typo preserved
            put("outlet",            outlet)
            put("terminal",          terminal)
            put("dateTime",          java.text.SimpleDateFormat("yyyyMMddHHmmss", java.util.Locale.getDefault()).format(java.util.Date()))
            put("action",            action)
        }
        post("help", body, callback)
    }

    // ── HTTP helper ───────────────────────────────────────────────────────────

    /**
     * Serialise [body] to UTF-8 bytes ONCE, then optionally sign and send.
     * The same byte array is used for both the HMAC body-hash and the request body,
     * so there is no risk of a re-serialisation mismatch.
     */
    private fun post(endpoint: String, body: JSONObject, callback: (String) -> Unit) {
        val url      = "${baseUrl.trimEnd('/')}/$endpoint"
        // Derive the path component for HMAC signing (scheme/host deliberately excluded)
        val path     = "/${url.substringAfter("://").substringAfter('/')}"
        val bodyText = body.toString()
        val bodyBytes: ByteArray = bodyText.toByteArray(Charsets.UTF_8)

        AppLogger.logRequest("RPS[HTTP]", "POST $url  HMAC=${if (hmac != null) "ON(${hmac.clientId})" else "OFF"}")
        AppLogger.logVerbose("RPS[BODY]", body.toString(2))   // verbose: full body LogCat only

        try {
            val builder = Request.Builder()
                .url(url)
                .post(bodyBytes.toRequestBody(JSON_MEDIA))
                .addHeader("Content-Type", "application/json")

            // Sign only when credentials are supplied
            if (hmac != null) {
                val authHeader = HmacSigner.buildHeader(hmac, path, "POST", bodyBytes)
                builder.addHeader("Authorization", authHeader)
                AppLogger.logRequest("RPS[HMAC]", "Signed — clientId=${hmac.clientId}")
            }

            val response = client.newCall(builder.build()).execute()
            val resBody  = response.body?.string() ?: "{}"
            AppLogger.logResponse("RPS[HTTP]",   "HTTP ${response.code} $endpoint")
            AppLogger.logVerbose("RPS[RSBODY]", resBody)   // verbose: full response LogCat only
            callback(resBody)
        } catch (e: Exception) {
            AppLogger.logError("RPS[HTTP]", "$endpoint failed: ${e.message}")
            callback(JSONObject().apply {
                put("responseCode",        "99")
                put("responseDescription", "Network error: ${e.message}")
                put("displayMessage",      "Connection error. Please try again.")
            }.toString())
        }
    }
}