package com.parking.app.viewmodel

import android.app.Application
import android.os.Handler
import android.os.Looper
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.MutableLiveData
import com.parking.app.*
import com.parking.app.api.RpsApi
import com.parking.app.api.mock.MockRpsApi
import com.parking.app.api.real.RetrofitRpsApi
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

// ── UI state sealed class ─────────────────────────────────────────────────────
sealed class ParkingUiState {
    data class Idle(
        val message: String,
        val infoText: String,
        val showMonthly: Boolean
    ) : ParkingUiState()
    data class Loading(val message: String) : ParkingUiState()
    data class ShowMessage(
        val title: String,
        val body: String,
        val autoDismissSecs: Long = 5L,
        var dismissScheduled: Boolean = false  // prevents duplicate timers on activity recreation
    ) : ParkingUiState()
    object ReturnToIdle : ParkingUiState()
}

class ParkingViewModel(application: Application) : AndroidViewModel(application) {

    // ── Live data observed by MainActivity ────────────────────────────────────
    val uiState = MutableLiveData<ParkingUiState>()

    // ── App state ─────────────────────────────────────────────────────────────
    var mode                  = "ENTRANCE"
    var companyCode           = ""
    var controller            = "0"   // "0" = no controller, any other = controller installed
    var minAmountCents        = 300
    var defaultAmountCents    = 800
    var helpPhone             = ""
    var outlet                = "0000259010"
    var terminal              = "000025901025"
    var monthlyBins           = ""
    var availablePlacesNormal = -1
    var availablePlaceMonthly = -1
    var charges               = listOf<ParkingCharge>()
    var displayMsgAvailable   = ""
    var keepAliveFreq         = 10
    var busy                  = false
    var showRates             = true   // controlled by Settings "Show Rates" field

    // ── ECR + RPS ─────────────────────────────────────────────────────────────
    lateinit var ecrManager: EcrManager
    private var rpsApi: RpsApi = MockRpsApi()  // default to mock

    private val handler = Handler(Looper.getMainLooper())
    private var keepAliveRunnable: Runnable? = null

    // ── Setup ─────────────────────────────────────────────────────────────────
    fun setup(ecrManager: EcrManager, serverUrl: String, showRates: Boolean) {
        this.ecrManager = ecrManager
        this.showRates  = showRates
        rpsApi = if (serverUrl.isBlank()) {
            AppLogger.logRequest("RPS", "No server URL — using MockRpsApi")
            MockRpsApi()
        } else {
            AppLogger.logRequest("RPS", "Using RetrofitRpsApi → $serverUrl")
            RetrofitRpsApi(serverUrl)
        }
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    fun init(outlet: String, terminal: String) {
        // Only set outlet/terminal from Settings (manual entry) — never from API responses
        this.outlet   = outlet
        this.terminal = terminal
        Thread {
            AppLogger.logRequest("INIT", "calling parkingInit outlet=$outlet terminal=$terminal")
            rpsApi.parkingInit(outlet, terminal) { res ->
                AppLogger.logResponse("INIT", res)
                postOnMain { applyInitResponse(res) }
            }
        }.start()
    }

    fun applyInitResponse(res: String, isKeepAlive: Boolean = false) {
        try {
            val json = JSONObject(res)
            val responseCode = json.optString("responseCode", "99")
            if (responseCode != "00") {
                val errorMsg = rpsErrorDescription(responseCode)
                AppLogger.logError(if (isKeepAlive) "KEEP_ALIVE" else "INIT", "Bad response: $responseCode — $errorMsg")
                if (!isKeepAlive) {
                    uiState.value = ParkingUiState.ShowMessage("Configuration Error", errorMsg, 30L)
                }
                return
            }

            availablePlacesNormal = json.optString("availablePlacesNormal", "-1").toIntOrNull() ?: -1
            availablePlaceMonthly = json.optString("availablePlaceMonthly", "-1").toIntOrNull() ?: -1

            if (isKeepAlive) {
                AppLogger.logRequest("KEEP_ALIVE", "OK — normal:$availablePlacesNormal monthly:$availablePlaceMonthly")
                refreshIdleState()
                return
            }

            mode               = json.optString("mode", "Entrance").uppercase()
            companyCode        = json.optString("companyCode", "")
            controller         = json.optString("controller", "0")
            // outlet and terminal are NOT updated from server response — manual entry only
            minAmountCents     = json.optString("minimumAmountPreAuth", "300").toIntOrNull() ?: 300
            defaultAmountCents = json.optString("defaultAmount", "800").toIntOrNull() ?: 800
            helpPhone          = json.optString("phoneForHelp", "")
            monthlyBins        = json.optString("monthlyCardsBins", "").replace(";", ",")
            keepAliveFreq      = json.optString("keepAliveFreq", "10").toIntOrNull() ?: 10
            displayMsgAvailable= json.optString("displayMessageOfAvailablePlaces", "")
            charges            = parseCharges(json.optJSONArray("charges"))

            AppLogger.logRequest("INIT", "parsed ${charges.size} charges, mode=$mode")

            val displayMsg = if (mode == "ENTRANCE")
                json.optString("displayMessageOfEntrance", "Welcome")
            else
                json.optString("displayMessageOnExit", "Please present your card")

            uiState.value = ParkingUiState.Idle(
                message     = displayMsg,
                infoText    = buildInfoText(),
                showMonthly = availablePlaceMonthly >= 0
            )

            startKeepAlive()

        } catch (e: Exception) {
            AppLogger.logError(if (isKeepAlive) "KEEP_ALIVE" else "INIT", "Parse error: ${e.message}")
            if (!isKeepAlive) uiState.value = ParkingUiState.ShowMessage("Error", "Init failed. Please restart.")
        }
    }

    private fun refreshIdleState() {
        if (!busy) {
            val current = uiState.value
            if (current is ParkingUiState.Idle) {
                uiState.value = current.copy(infoText = buildInfoText())
            }
        }
    }

    // ── Keep-alive ────────────────────────────────────────────────────────────
    fun startKeepAlive() {
        keepAliveRunnable?.let { handler.removeCallbacks(it) }
        if (keepAliveFreq < 0) return
        keepAliveRunnable = object : Runnable {
            override fun run() {
                if (!busy) {
                    Thread {
                        // Re-read outlet/terminal from SharedPreferences — never use cached values
                        val prefs         = getApplication<Application>().getSharedPreferences("APP_SETTINGS", Application.MODE_PRIVATE)
                        val savedOutlet   = prefs.getString("outlet",   outlet)   ?: outlet
                        val savedTerminal = prefs.getString("terminal", terminal) ?: terminal
                        AppLogger.logRequest("KEEP_ALIVE", "sending outlet=$savedOutlet")
                        rpsApi.parkingInit(savedOutlet, savedTerminal) { res ->
                            AppLogger.logResponse("KEEP_ALIVE", res)
                            postOnMain { applyInitResponse(res, isKeepAlive = true) }
                        }
                    }.start()
                } else {
                    AppLogger.logRequest("KEEP_ALIVE", "skipped — busy")
                }
                handler.postDelayed(this, (keepAliveFreq * 60 * 1000).toLong())
            }
        }
        handler.postDelayed(keepAliveRunnable!!, (keepAliveFreq * 60 * 1000).toLong())
    }

    // ── Daily 03:00 init ──────────────────────────────────────────────────────
    fun scheduleDailyInit() {
        val now    = Calendar.getInstance()
        val target = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 3)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            if (before(now)) add(Calendar.DAY_OF_YEAR, 1)
        }
        val delay = target.timeInMillis - now.timeInMillis
        AppLogger.logRequest("DAILY_INIT", "Scheduled in ${delay / 60000}min at 03:00")
        handler.postDelayed({
            AppLogger.logRequest("DAILY_INIT", "Firing 03:00 init")
            // Re-read outlet/terminal from SharedPreferences — never use cached values
            // outlet and terminal can only be changed via manual Settings entry
            val prefs    = getApplication<Application>().getSharedPreferences("APP_SETTINGS", Application.MODE_PRIVATE)
            val savedOutlet   = prefs.getString("outlet",   outlet)   ?: outlet
            val savedTerminal = prefs.getString("terminal", terminal) ?: terminal
            AppLogger.logRequest("DAILY_INIT", "outlet=$savedOutlet terminal=$savedTerminal (from Settings)")
            init(savedOutlet, savedTerminal)
            scheduleDailyInit()
        }, delay)
    }

    // ── Entrance flow ─────────────────────────────────────────────────────────
    fun runEntranceFlow() {
        busy = true
        val timeOfInput = currentTimestamp()

        if (controller != "0") {
            // Controller configured — check vehicle present first
            uiState.value = ParkingUiState.Loading("Checking vehicle...")
            Thread {
                rpsApi.vehiclePresent(outlet, terminal, timeOfInput) { res ->
                    postOnMain { handleVehiclePresentResponse(res, timeOfInput, isEntrance = true) }
                }
            }.start()
        } else {
            // No controller — go straight to ECR
            startEntranceEcr(timeOfInput)
        }
    }

    private fun handleVehiclePresentResponse(res: String, timeOfInput: String, isEntrance: Boolean) {
        try {
            val json    = JSONObject(res)
            val code    = json.optString("responseCode", "99")
            val present = json.optString("vehiclePresent", "0")
            val msg     = json.optString("displayMessage", "")
            val secs    = json.optString("timeToDisplayMessage", "5").toLongOrNull() ?: 5L

            if (code != "00" || present != "1") {
                // No vehicle or error — show message and return
                busy = false
                AppLogger.logRequest("VEHICLE", "Not present or error — code=$code present=$present")
                uiState.value = ParkingUiState.ShowMessage(
                    "No vehicle detected",
                    msg.ifBlank { "No vehicle present at entrance." },
                    secs
                )
            } else {
                // Vehicle present — proceed with ECR
                AppLogger.logRequest("VEHICLE", "Vehicle detected — proceeding with ECR")
                if (isEntrance) startEntranceEcr(timeOfInput) else startExitEcr(timeOfInput)
            }
        } catch (e: Exception) {
            busy = false
            AppLogger.logError("VEHICLE", "Parse error: ${e.message}")
            uiState.value = ParkingUiState.ShowMessage("Error", "Vehicle check failed. Please try again.", 5L)
        }
    }

    private fun startEntranceEcr(timeOfInput: String) {
        uiState.value = ParkingUiState.Loading("Pre-authorizing €%.2f...".format(minAmountCents / 100.0))
        val request = EcrRequest.preAuth(minAmountCents, generateOrderNo())
        ecrManager.sendTransaction(request) { result ->
            postOnMain {
                handleEcrResult(result, "ENTRANCE") { ecr ->
                    val lastFour = ecr.accountNumber.takeLast(4)
                    val token    = TokenHelper.buildBankCardToken("000000", lastFour, ecr.expiryDate, outlet)
                    val entry    = EntryRecord.fromEcrResponse(ecr, token, "Bank Card", timeOfInput, minAmountCents, outlet)
                    callEntranceApi(entry)
                }
            }
        }
    }

    // ── Exit flow ─────────────────────────────────────────────────────────────
    fun runExitFlow() {
        busy = true
        val timeOfInput = currentTimestamp()

        if (controller != "0") {
            // Controller configured — check vehicle present first
            uiState.value = ParkingUiState.Loading("Checking vehicle...")
            Thread {
                rpsApi.vehiclePresent(outlet, terminal, timeOfInput) { res ->
                    postOnMain { handleVehiclePresentResponse(res, timeOfInput, isEntrance = false) }
                }
            }.start()
        } else {
            // No controller — go straight to ECR
            startExitEcr(timeOfInput)
        }
    }

    private fun startExitEcr(timeOfInput: String) {
        uiState.value = ParkingUiState.Loading("Reading your card...")
        val request = EcrRequest.panCapture(generateOrderNo())
        ecrManager.sendTransaction(request) { result ->
            postOnMain {
                handleEcrResult(result, "EXIT_READ") { ecr ->
                    val lastFour = ecr.accountNumber.takeLast(4)
                    val token    = TokenHelper.buildBankCardToken("000000", lastFour, ecr.expiryDate, outlet)
                    callExitApi(token, lastFour, timeOfInput)
                }
            }
        }
    }

    // ── Monthly flow ──────────────────────────────────────────────────────────
    fun runMonthlyFlow() {
        busy = true
        val timeOfInput = currentTimestamp()
        uiState.value = ParkingUiState.Loading("Reading monthly card...")

        val request = EcrRequest.monthly(monthlyBins, generateOrderNo())
        ecrManager.sendTransaction(request) { result ->
            postOnMain {
                handleEcrResult(result, "MONTHLY") { ecr ->
                    val cardNumber = extractCardFromTrack2(ecr.receiptTicket).ifBlank { ecr.accountNumber }
                    val lastFour   = ecr.accountNumber.takeLast(4)
                    val token      = TokenHelper.buildMonthlyCardToken(cardNumber, outlet)
                    if (mode == "ENTRANCE") {
                        val entry = EntryRecord.fromEcrResponse(ecr, token, "Monthly Card", timeOfInput, 0, outlet)
                        callEntranceApi(entry)
                    } else {
                        callExitApi(token, lastFour, timeOfInput)
                    }
                }
            }
        }
    }

    // ── Help flow ─────────────────────────────────────────────────────────────
    fun runHelpFlow() {
        Thread {
            AppLogger.logRequest("HELP", "sending")
            rpsApi.help(outlet, terminal) { res ->
                AppLogger.logResponse("HELP", res)
                postOnMain {
                    try {
                        val json  = JSONObject(res)
                        val msg   = json.optString("displayMessage", "Please wait for assistance.")
                        val secs  = json.optString("timeToDisplayMessage", "10").toLongOrNull() ?: 10L
                        val phone = if (helpPhone.isNotBlank()) "\nFor help call: $helpPhone" else ""
                        uiState.value = ParkingUiState.ShowMessage("HELP", msg + phone, secs)
                    } catch (e: Exception) {
                        uiState.value = ParkingUiState.ShowMessage("HELP", "For help call: $helpPhone", 10L)
                    }
                }
            }
        }.start()
    }

    // ── RPS API calls ─────────────────────────────────────────────────────────
    private fun callEntranceApi(entry: EntryRecord) {
        AppLogger.logRequest("RPS_ENTRANCE", "token=${entry.token.take(20)}... tokenCode=${entry.tokenCode}")
        Thread {
            rpsApi.entranceCall(entry) { res ->
                AppLogger.logResponse("RPS_ENTRANCE", res)
                postOnMain {
                    busy = false
                    try {
                        val json = JSONObject(res)
                        val code = json.optString("responseCode", "99")
                        val msg  = json.optString("displayMessage", "")
                        val secs = json.optString("timeToDisplayMessage", "5").toLongOrNull() ?: 5L
                        updateAvailablePlaces(json)
                        val title = if (code == "00") "Welcome!" else "Access Denied"
                        uiState.value = ParkingUiState.ShowMessage(title, msg, secs)
                    } catch (e: Exception) {
                        uiState.value = ParkingUiState.ShowMessage("Error", "Please try again", 5L)
                    }
                }
            }
        }.start()
    }

    private fun callExitApi(token: String, lastDigits: String, timeOfInput: String) {
        AppLogger.logRequest("RPS_EXIT", "token=${token.take(20)}... lastDigits=$lastDigits")
        Thread {
            rpsApi.exitCall(token, timeOfInput, lastDigits) { res ->
                AppLogger.logResponse("RPS_EXIT", res)
                postOnMain {
                    try {
                        val json        = JSONObject(res)
                        val moneyToPay  = json.optString("moneyToPay", "0").toIntOrNull() ?: 0
                        val barrierOpen = json.optString("barrierOpen", "0")
                        val msg         = json.optString("displayMessage", "")
                        val secs        = json.optString("timeToDisplayMessage", "5").toLongOrNull() ?: 5L
                        val recordId    = json.optString("recordId", "")
                        updateAvailablePlaces(json)
                        when (barrierOpen) {
                            "1"  -> { busy = false; uiState.value = ParkingUiState.ShowMessage("Thank you!", msg, secs) }
                            "-2" -> runExitPaymentFlow(moneyToPay, recordId, token, lastDigits, timeOfInput, msg, secs)
                            "0"  -> { busy = false; AppLogger.logError("RPS_EXIT", "Barrier failed"); uiState.value = ParkingUiState.ShowMessage("Please contact staff", msg, secs) }
                            else -> { busy = false; uiState.value = ParkingUiState.ShowMessage("Error", msg.ifBlank { "Please try again" }, secs) }
                        }
                    } catch (e: Exception) {
                        busy = false
                        uiState.value = ParkingUiState.ShowMessage("Error", "Please try again", 5L)
                    }
                }
            }
        }.start()
    }

    private fun runExitPaymentFlow(
        amountCents: Int, recordId: String, token: String,
        lastDigits: String, exitTimeOfInput: String,
        displayMsg: String, displaySecs: Long
    ) {
        uiState.value = ParkingUiState.ShowMessage("Payment required", displayMsg, displaySecs)
        handler.postDelayed({
            uiState.value = ParkingUiState.Loading("€%.2f — tap card".format(amountCents / 100.0))
            val request = EcrRequest.preAuth(amountCents, generateOrderNo())
            ecrManager.sendTransaction(request) { result ->
                postOnMain {
                    handleEcrResult(result, "EXIT_PAYMENT") { ecr ->
                        AppLogger.logRequest("RPS_EXIT_PAYMENT", "auth=${ecr.authCode} amt=$amountCents")
                        Thread {
                            rpsApi.exitPayment(
                                token, lastDigits, "", exitTimeOfInput,
                                amountCents, ecr.authCode, ecr.responseCode,
                                ecr.rrn, ecr.receiptNumber, recordId
                            ) { res ->
                                AppLogger.logResponse("RPS_EXIT_PAYMENT", res)
                                postOnMain {
                                    busy = false
                                    try {
                                        val json        = JSONObject(res)
                                        val msg         = json.optString("displayMessage", "Thank you!")
                                        val secs        = json.optString("timeToDisplayMessage", "5").toLongOrNull() ?: 5L
                                        val barrierOpen = json.optString("barrierOpen", "1")
                                        updateAvailablePlaces(json)
                                        val title = if (barrierOpen == "1") "Payment OK" else "Please contact staff"
                                        uiState.value = ParkingUiState.ShowMessage(title, msg, secs)
                                    } catch (_: Exception) {
                                        uiState.value = ParkingUiState.ShowMessage("Payment OK", "Thank you!", 5L)
                                    }
                                }
                            }
                        }.start()
                    }
                }
            }
        }, displaySecs * 1000)
    }

    // ── ECR result handler ────────────────────────────────────────────────────
    private fun handleEcrResult(result: MiddlewareResult, ctx: String, onApproved: (EcrResponse) -> Unit) {
        val mwCode = result.middlewareCode
        val ecr    = result.ecrResponse
        AppLogger.logResponse("ECR[$ctx]", "mw=$mwCode ecr=${ecr?.responseCode}")
        when {
            mwCode != "00" -> {
                busy = false
                val desc = middlewareCodeDescription(mwCode)
                uiState.value = ParkingUiState.ShowMessage("Technical problem", "Please press Help for assistance.\n$desc", 5L)
                callHelpBackground("MW error: $desc")
            }
            ecr == null || !ecr.isApproved -> {
                busy = false
                val desc = ecr?.responseCodeDescription() ?: "Unknown error"
                uiState.value = ParkingUiState.ShowMessage("Problem with card", "Please try again.\n$desc", 6L)
                callHelpBackground("ECR decline: ${ecr?.responseCode} $desc")
            }
            else -> onApproved(ecr)
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private fun callHelpBackground(reason: String) {
        Thread {
            AppLogger.logRequest("HELP_AUTO", reason)
            rpsApi.help(outlet, terminal) {}
        }.start()
    }

    private fun updateAvailablePlaces(json: JSONObject) {
        json.optString("availablePlacesRegular").toIntOrNull()?.let { availablePlacesNormal = it }
        json.optString("availablePlaceMonthly").toIntOrNull()?.let  { availablePlaceMonthly = it }
    }

    fun buildInfoText(): String {
        val sb = StringBuilder()
        if (availablePlacesNormal >= 0 || availablePlaceMonthly >= 0) {
            sb.append("AVAILABLE SPACES\n")
            val parts = mutableListOf<String>()
            if (availablePlacesNormal >= 0) parts.add("Normal: $availablePlacesNormal")
            if (availablePlaceMonthly >= 0) parts.add("Monthly: $availablePlaceMonthly")
            sb.append("  ${parts.joinToString("   ")}\n")
        }
        if (showRates && charges.isNotEmpty()) {
            if (sb.isNotEmpty()) sb.append("\n")
            sb.append("PARKING RATES\n")
            charges.forEachIndexed { i, charge ->
                val from  = formatMinutes(charge.fromMin)
                val to    = if (charge.toMin != null) formatMinutes(charge.toMin) else "..."
                val fee   = "EUR %.2f".format(charge.feeCents / 100.0)
                val label = "  ${i + 1}. $from - $to"
                sb.append(label.padEnd(24))
                sb.append("$fee\n")
            }
        }
        return sb.toString().trimEnd()
    }

    private fun parseCharges(arr: JSONArray?): List<ParkingCharge> {
        if (arr == null) return emptyList()
        val list = mutableListOf<ParkingCharge>()
        for (i in 0 until arr.length()) {
            val obj  = arr.getJSONObject(i)
            val from = obj.optString("from", "0").toIntOrNull() ?: 0
            val to   = obj.optString("to", "").toIntOrNull()
            val fee  = obj.optString("fee", "0").toIntOrNull() ?: 0
            list.add(ParkingCharge(from, to, fee))
        }
        return list
    }

    private fun formatMinutes(minutes: Int): String {
        return if (minutes < 60) "$minutes min"
        else if (minutes % 60 == 0) "${minutes / 60}h"
        else "${minutes / 60}h ${minutes % 60}min"
    }

    private fun extractCardFromTrack2(track2: String): String =
        track2.substringBefore('=').filter { it.isDigit() }

    private fun generateOrderNo(): String =
        SimpleDateFormat("HHmmssSSS", Locale.getDefault()).format(Date())

    private fun currentTimestamp(): String =
        SimpleDateFormat("yyyyMMddHHmmss", Locale.getDefault()).format(Date())

    private fun middlewareCodeDescription(code: String): String = when (code) {
        "01" -> "Middleware not installed"
        "02" -> "Missing order request"
        "03" -> "Timeout — no response from payment app"
        "04" -> "Payment app not found"
        "05" -> "No response from payment app"
        "06" -> "Request format error"
        "07" -> "Response format error"
        "98" -> "Unsupported action"
        else -> "Unknown error: $code"
    }

    private fun postOnMain(action: () -> Unit) {
        handler.post(action)
    }

    fun rpsErrorDescription(code: String): String = when (code) {
        "91" -> "Invalid Outlet Number. Please check Settings."
        "92" -> "Invalid Company Code. Please contact support."
        "93" -> "Invalid Application. Please contact support."
        "08" -> "Technical issue on server. Please wait for assistance."
        "31" -> "TopUp declined. ECR should be used."
        "99" -> "Network error. Please check connection."
        else -> "Server error: $code. Please contact support."
    }

    override fun onCleared() {
        super.onCleared()
        handler.removeCallbacksAndMessages(null)
        keepAliveRunnable?.let { handler.removeCallbacks(it) }
    }
}