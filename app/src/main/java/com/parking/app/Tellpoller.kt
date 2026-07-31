package com.parking.app

import android.content.Context
import android.os.Handler
import android.os.Looper
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Polls TELL Gate Control PRO getStatus API directly from the app.
 * Self-registers with TELL on first use using gc/addappid.
 * Stores appId in SharedPreferences — one registration per device.
 *
 * Design notes:
 *  - One shared OkHttpClient for all instances (companion object) — prevents DNS
 *    exhaustion when the poller is restarted frequently (e.g. after re-init).
 *  - isPollInFlight guard ensures only ONE poll thread runs at a time.  Without
 *    this, a slow response (up to the 5 s timeout) would let the 3 s scheduler
 *    stack up concurrent DNS lookups that overwhelm the device resolver.
 *  - Timeouts are 5 s — strictly less than the 3 s interval × 2, so a stalled
 *    poll can never block more than one extra cycle.
 */
class TellPoller(
    private val context:      Context,
    private val apiUrl:       String,
    private val hwId:         String,
    private val apiKey:       String,
    private val password:     String,
    private val providedAppId: String,  // appId from server — use directly if not blank
    private val vehicleInput: String,
    private val intervalMs:   Long,
    private val onVehicleDetected:    () -> Unit,
    private val onRegistrationFailed: () -> Unit = {},
    private val onVehicleLeft:        () -> Unit = {},
    initialLastDetected:      Boolean = false   // inherit state from previous poller on restart
) {

    companion object {
        /** Shared across all TellPoller instances so restarting the poller reuses
         *  the existing connection pool instead of opening fresh sockets. */
        private val sharedClient = OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(5, TimeUnit.SECONDS)
            .writeTimeout(5, TimeUnit.SECONDS)
            .build()
    }

    private val PREFS_KEY_APP_ID = "tell_app_id_${hwId.replace(":", "")}"

    private val handler     = Handler(Looper.getMainLooper())
    private var running     = false

    /** True while a background poll() call is in-flight — prevents stacking. */
    @Volatile private var isPollInFlight = false

    var lastVehicleDetected = initialLastDetected  // last known vehicle state — read by ViewModel
        private set
    private var appId: String? = null

    private var pollRunnable: Runnable? = null

    fun start() {
        if (running) return
        running = true
        AppLogger.logRequest("TELL_POLL", "Starting — interval=${intervalMs}ms input=$vehicleInput hwId=$hwId")
        Thread { registerAndStart() }.start()
    }

    // ── Immediate on-demand poll ───────────────────────────────────────────────
    // Used by ViewModel when driver taps a button before the scheduled poll fires.
    fun pollNow(onResult: (Boolean) -> Unit) {
        Thread {
            val id = appId ?: run {
                AppLogger.logRequest("TELL_POLL", "pollNow — no appId yet, using lastVehicleDetected=$lastVehicleDetected")
                handler.post { onResult(lastVehicleDetected) }
                return@Thread
            }
            try {
                val body = JSONObject().apply {
                    put("hwId",   hwId)
                    put("hwName", "ParkTec-Server")
                    put("appId",  id)
                }
                val request = Request.Builder()
                    .url("${apiUrl.trimEnd('/')}/getgeneral")
                    .post(body.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .addHeader("Content-Type", "application/json")
                    .addHeader("api-key",    apiKey)
                    .addHeader("User-Agent", "ParkTec-Server/1.0")
                    .build()

                val response = sharedClient.newCall(request).execute()
                val resBody  = response.body?.string() ?: ""
                AppLogger.logVerbose("TELL_POLL", "pollNow HTTP ${response.code} — $resBody")

                if (response.isSuccessful) {
                    val json     = JSONObject(resBody)
                    val inputVal = json.optJSONObject("statusResult")
                        ?.optJSONObject("deviceStatus")
                        ?.optInt(vehicleInput, 0) ?: 0
                    val detected = inputVal == 1
                    lastVehicleDetected = detected
                    AppLogger.logRequest("TELL_POLL", "pollNow $vehicleInput=$inputVal detected=$detected")
                    handler.post { onResult(detected) }
                } else {
                    AppLogger.logError("TELL_POLL", "pollNow HTTP ${response.code} — falling back to lastVehicleDetected=$lastVehicleDetected")
                    handler.post { onResult(lastVehicleDetected) }
                }
            } catch (e: Exception) {
                AppLogger.logError("TELL_POLL", "pollNow error: ${e.message} — falling back to lastVehicleDetected=$lastVehicleDetected")
                handler.post { onResult(lastVehicleDetected) }
            }
        }.start()
    }

    fun stop() {
        running = false
        pollRunnable?.let { handler.removeCallbacks(it) }
        pollRunnable = null
        // lastVehicleDetected intentionally NOT reset — caller passes it as initialLastDetected
        // to the next TellPoller so pollNow fallback uses the last real state, not false
        AppLogger.logRequest("TELL_POLL", "Stopped")
    }

    // ── Step 1: Get or register appId ─────────────────────────────────────────
    private fun registerAndStart() {
        // If server provided an appId directly — use it, skip registration
        if (providedAppId.isNotBlank()) {
            AppLogger.logRequest("TELL_POLL", "Using server-provided appId: $providedAppId")
            appId = providedAppId
            handler.post { schedulePoll() }
            return
        }

        val prefs  = context.getSharedPreferences("APP_SETTINGS", Context.MODE_PRIVATE)
        val stored = prefs.getString(PREFS_KEY_APP_ID, null)

        if (!stored.isNullOrBlank()) {
            AppLogger.logRequest("TELL_POLL", "Using stored appId: $stored")
            appId = stored
            handler.post { schedulePoll() }
            return
        }

        // Not registered yet — call addappid
        AppLogger.logRequest("TELL_POLL", "No appId stored — registering with TELL gc/addappid")
        try {
            val body = JSONObject().apply {
                put("hwid",     hwId)
                put("password", password)
            }
            AppLogger.logRequest("TELL_POLL", "addappid REQ: ${body.toString(2)}")

            val request = Request.Builder()
                .url("${apiUrl.trimEnd('/')}/addappid")
                .post(body.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                .addHeader("Content-Type", "application/json")
                .addHeader("api-key",      apiKey)
                .addHeader("User-Agent",   "ParkTec-Server/1.0")
                .build()

            val response = sharedClient.newCall(request).execute()
            val resBody  = response.body?.string() ?: ""
            AppLogger.logRequest("TELL_POLL", "addappid RES HTTP ${response.code}: $resBody")

            if (!response.isSuccessful) {
                AppLogger.logError("TELL_POLL", "addappid failed HTTP ${response.code} — falling back to 30s repeat")
                handler.post { onRegistrationFailed() }
                return
            }

            val json  = JSONObject(resBody)
            val newId = json.optString("appId", "")
                .ifBlank   { json.optString("appid", "") }
                .ifBlank   { json.optString("id", "") }

            if (newId.isBlank()) {
                AppLogger.logError("TELL_POLL", "addappid returned no appId — falling back to 30s repeat")
                handler.post { onRegistrationFailed() }
                return
            }

            AppLogger.logRequest("TELL_POLL", "✅ Registered — appId: $newId")
            prefs.edit().putString(PREFS_KEY_APP_ID, newId).apply()
            appId = newId
            handler.post { schedulePoll() }

        } catch (e: Exception) {
            AppLogger.logError("TELL_POLL", "addappid error: ${e.javaClass.simpleName} — ${e.message} — falling back to 30s repeat")
            handler.post { onRegistrationFailed() }
        }
    }

    // ── Step 2: Poll getgeneral ───────────────────────────────────────────────
    private fun schedulePoll() {
        if (!running) return
        pollRunnable = Runnable {
            if (!isPollInFlight) {
                Thread { poll() }.start()
            } else {
                AppLogger.logVerbose("TELL_POLL", "poll skipped — previous still in flight")
            }
            schedulePoll()
        }
        handler.postDelayed(pollRunnable!!, intervalMs)
    }

    private fun poll() {
        isPollInFlight = true
        val id = appId ?: run { isPollInFlight = false; return }
        try {
            val body = JSONObject().apply {
                put("hwId",   hwId)
                put("hwName", "ParkTec-Server")
                put("appId",  id)
            }
            val request = Request.Builder()
                .url("${apiUrl.trimEnd('/')}/getgeneral")
                .post(body.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                .addHeader("Content-Type", "application/json")
                .addHeader("api-key",      apiKey)
                .addHeader("User-Agent",   "ParkTec-Server/1.0")
                .build()

            val response = sharedClient.newCall(request).execute()
            val resBody  = response.body?.string() ?: run {
                AppLogger.logError("TELL_POLL", "Empty response body")
                return
            }

            AppLogger.logVerbose("TELL_POLL", "HTTP ${response.code} — $resBody")

            if (response.code == 403) {
                // appId rejected — clear stored appId and re-register next cycle
                AppLogger.logError("TELL_POLL", "403 Access Denied — clearing stored appId, will re-register")
                context.getSharedPreferences("APP_SETTINGS", Context.MODE_PRIVATE)
                    .edit().remove(PREFS_KEY_APP_ID).apply()
                appId = null
                return
            }

            if (!response.isSuccessful) {
                AppLogger.logError("TELL_POLL", "HTTP error ${response.code}")
                return
            }

            val json         = JSONObject(resBody)
            val deviceStatus = json.optJSONObject("statusResult")
                ?.optJSONObject("deviceStatus")
            val inputVal     = deviceStatus?.optInt(vehicleInput, 0) ?: 0
            val detected     = inputVal == 1
            AppLogger.logVerbose("TELL_POLL", "$vehicleInput=$inputVal detected=$detected lastState=$lastVehicleDetected")

            if (detected && !lastVehicleDetected) {
                AppLogger.logRequest("TELL_POLL", "🚗 Vehicle arrived on $vehicleInput")
                handler.post { onVehicleDetected() }
            } else if (!detected && lastVehicleDetected) {
                AppLogger.logRequest("TELL_POLL", "🚫 Vehicle left on $vehicleInput")
                handler.post { onVehicleLeft() }
            }
            lastVehicleDetected = detected

        } catch (e: Exception) {
            AppLogger.logError("TELL_POLL", "Poll error: ${e.javaClass.simpleName} — ${e.message}")
        } finally {
            isPollInFlight = false
        }
    }
}
