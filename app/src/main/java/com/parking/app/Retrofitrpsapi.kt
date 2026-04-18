package com.parking.app.api.real

import com.parking.app.AppLogger
import com.parking.app.EntryRecord
import com.parking.app.api.RpsApi
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Production implementation of RpsApi.
 * Makes real HTTP POST calls to the RPS backend.
 * HMAC authentication: not implemented yet — add in headers when ready.
 *
 * All calls run on the calling thread (caller must use background thread).
 */
class RetrofitRpsApi(private val baseUrl: String) : RpsApi {

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()

    // ── parkingInit ───────────────────────────────────────────────────────────
    override fun parkingInit(outlet: String, terminal: String, callback: (String) -> Unit) {
        val body = JSONObject().apply {
            put("outlet",      outlet)
            put("terminal",    terminal)
            put("application", "Parking")
        }
        post("parkingInit", body, callback)
    }

    // ── vehiclePresent ────────────────────────────────────────────────────────
    override fun vehiclePresent(outlet: String, terminal: String, dateTime: String, callback: (String) -> Unit) {
        val body = JSONObject().apply {
            put("outlet",    outlet)
            put("terminal",  terminal)
            put("dateTime",  dateTime)
        }
        post("vehiclePresent", body, callback)
    }

    // ── entranceCall ──────────────────────────────────────────────────────────
    override fun entranceCall(entry: EntryRecord, callback: (String) -> Unit) {
        val body = JSONObject().apply {
            put("companyCode",        "")           // set at init time
            put("application",        "Parking")
            put("intallationPoint",   "Entrance")
            put("outlet",             entry.outlet)
            put("terminal",           entry.terminalId)
            put("token",              entry.token)
            put("inputType",          entry.inputType)
            put("lastDigits",         entry.lastDigits)
            put("firstDigits",        entry.firstDigits)
            put("expiryDate",         entry.expiryDate)
            put("authCode",           entry.authCode)
            put("rrn",                entry.rrn)
            put("receiptNumber",      entry.receiptNumber)
            put("preAuthAmount",      entry.preAuthAmountCents)
            put("tokenCode",          entry.tokenCode)
            put("timeOfInput",        entry.timeOfInput)
        }
        post("entranceCall", body, callback)
    }

    // ── exitCall ──────────────────────────────────────────────────────────────
    override fun exitCall(
        token: String, timeOfInput: String, lastDigits: String,
        callback: (String) -> Unit
    ) {
        val body = JSONObject().apply {
            put("application",      "Parking")
            put("intallationPoint", "Exit")
            put("token",            token)
            put("inputType",        "Card")
            put("lastDigits",       lastDigits)
            put("firstDigits",      "")
            put("timeOfInput",      timeOfInput)
        }
        post("exitCall", body, callback)
    }

    // ── exitPayment ───────────────────────────────────────────────────────────
    override fun exitPayment(
        token: String, lastDigits: String, firstDigits: String, timeOfInput: String,
        amountPayed: Int, authCode: String, responseCode: String,
        referenceNo: String, originalRefNum: String, recordId: String,
        callback: (String) -> Unit
    ) {
        val body = JSONObject().apply {
            put("application",      "Parking")
            put("intallationPoint", "Exit")
            put("token",            token)
            put("inputType",        "Card")
            put("lastDigits",       lastDigits)
            put("firstDigits",      firstDigits)
            put("timeOfInput",      timeOfInput)
            put("amountPayed",      amountPayed)
            put("authCode",         authCode)
            put("responseCode",     responseCode)
            put("referenceNo",      referenceNo)
            put("originalRefNum",   originalRefNum)
            put("recordId",         recordId)
        }
        post("exitPayment", body, callback)
    }

    // ── help ──────────────────────────────────────────────────────────────────
    override fun help(outlet: String, terminal: String, callback: (String) -> Unit) {
        val body = JSONObject().apply {
            put("outlet",      outlet)
            put("terminal",    terminal)
            put("application", "Parking")
        }
        post("help", body, callback)
    }

    // ── HTTP helper ───────────────────────────────────────────────────────────
    private fun post(endpoint: String, body: JSONObject, callback: (String) -> Unit) {
        val url = "$baseUrl/$endpoint"
        AppLogger.logRequest("RPS[HTTP]", "POST $endpoint")
        try {
            val request = Request.Builder()
                .url(url)
                .post(body.toString().toRequestBody(JSON_MEDIA))
                .addHeader("Content-Type", "application/json")
                // TODO: Add HMAC auth headers here when ready
                // .addHeader("X-App-Id", appId)
                // .addHeader("X-Signature", hmacSignature)
                // .addHeader("X-Nonce", nonce)
                // .addHeader("X-Timestamp", timestamp)
                .build()

            val response = client.newCall(request).execute()
            val resBody  = response.body?.string() ?: "{}"
            AppLogger.logResponse("RPS[HTTP]", "HTTP ${response.code} $endpoint")
            callback(resBody)
        } catch (e: Exception) {
            AppLogger.logError("RPS[HTTP]", "$endpoint failed: ${e.message}")
            // Return error JSON so caller can handle gracefully
            callback(JSONObject().apply {
                put("responseCode",        "99")
                put("responseDescription", "Network error: ${e.message}")
                put("displayMessage",      "Connection error. Please try again.")
            }.toString())
        }
    }
}