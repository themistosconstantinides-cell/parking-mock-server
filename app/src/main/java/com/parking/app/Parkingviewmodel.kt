package com.parking.app.viewmodel

import android.app.Application
import android.os.Handler
import android.os.Looper
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.MutableLiveData
import com.parking.app.*
import com.parking.app.api.RpsApi
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
        val message:     String,
        val infoText:    String,
        val showMonthly: Boolean,
        val isKeepAlive: Boolean = false  // true = silent refresh, false = play welcome audio
    ) : ParkingUiState()
    data class Loading(val message: String) : ParkingUiState()
    data class ShowMessage(
        val title: String,
        val body: String,
        val autoDismissSecs: Long = 5L,
        var dismissScheduled: Boolean = false,
        val reinitOnDismiss: Boolean = true,
        val noDismiss: Boolean = false  // true = no auto-dismiss, ECR result drives next state
    ) : ParkingUiState()
    object ReturnToIdle              : ParkingUiState()
    object LaunchMonthlyKeyIn        : ParkingUiState()
    object LaunchMonthlyContactless  : ParkingUiState()  // CtCL Mifare card read
    data class PromptLostTicket(val amountCents: Int) : ParkingUiState()
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
    var outlet                = ""
    var terminal              = ""
    var monthlyBins           = ""
    var availablePlacesNormal = -1
    var availablePlaceMonthly = -1
    var charges               = listOf<ParkingCharge>()
    var displayMsgAvailable   = ""
    var keepAliveFreq         = 10
    var busy                  = false
    var showRates             = true   // controlled by Settings "Show Rates" field
    var fixAmountCents        = -1     // -1 = off, >0 = fixed price SALE mode (entrance only)
    var lostTicketAmountCents = -1     // -1 = off, >0 = lost ticket fee charged at exit (from defaultAmount)
    var defaultFixAmountCents = 0      // local Settings fallback when server sends defaultAmount=0

    // ── Voice & language (from parkingInit — server controlled) ──────────────
    var voiceAssistantEnabled = true   // "1" = on, "0" = off
    var defaultLanguage       = "EN"   // "EN","EL","RU","IW"

    // Callback set by MainActivity — called when server changes language via parkingInit
    var onLanguageChanged: ((String) -> Unit)? = null

    // ── TELL credentials (from parkingInit — optional) ────────────────────────
    var tellApiUrl              = ""
    var tellHwId                = ""
    var tellApiKey              = ""
    var tellAppId               = ""
    var tellPassword            = ""
    var tellVehicleInput        = "in1"
    var tellPollerRef: TellPoller? = null  // set by MainActivity after poller starts; null = no check
    var lastMonthlyTimeOfInput = ""
    val hasTellConfig get() = tellApiUrl.isNotBlank() && tellHwId.isNotBlank()

    // Last known Idle state — used to restore screen after no-vehicle message
    var _lastIdleState: ParkingUiState.Idle? = null

    // ── ECR + RPS ─────────────────────────────────────────────────────────────
    lateinit var ecrManager: EcrManager
    private var rpsApi: RpsApi = RetrofitRpsApi("")  // replaced at setup()

    private val handler = Handler(Looper.getMainLooper())
    private var keepAliveRunnable: Runnable? = null
    private var busySafetyRunnable: Runnable? = null
    private val BUSY_SAFETY_TIMEOUT_MS = 300_000L  // 5 minutes max for any operation

    private fun startBusySafetyTimer() {
        busySafetyRunnable?.let { handler.removeCallbacks(it) }
        busySafetyRunnable = Runnable {
            if (busy) {
                AppLogger.logError("SAFETY", "busy=true for 5 minutes — force reset")
                busy = false
                cancelBusySafetyTimer()
                uiState.value = ParkingUiState.ShowMessage(
                    "Session Timeout",
                    "Operation timed out. Please try again.",
                    8L
                )
            }
        }
        handler.postDelayed(busySafetyRunnable!!, BUSY_SAFETY_TIMEOUT_MS)
    }

    internal fun cancelBusySafetyTimer() {
        busySafetyRunnable?.let { handler.removeCallbacks(it) }
        busySafetyRunnable = null
    }

    // ── Setup ─────────────────────────────────────────────────────────────────
    fun setup(
        ecrManager:      EcrManager,
        serverUrl:       String,
        showRates:       Boolean,
        hmacCredentials: HmacCredentials? = null
    ) {
        this.ecrManager = ecrManager
        this.showRates  = showRates
        val hmacLabel = if (hmacCredentials != null) "HMAC ON (${hmacCredentials.clientId})" else "HMAC OFF"
        AppLogger.logRequest("RPS", "Using RetrofitRpsApi → $serverUrl  $hmacLabel")
        rpsApi = RetrofitRpsApi(serverUrl, hmacCredentials)
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    private var initInProgress = false

    fun init(outlet: String, terminal: String) {
        if (initInProgress) {
            AppLogger.logRequest("INIT", "skipped — init already in progress")
            return
        }
        initInProgress = true
        // Only set outlet/terminal from Settings (manual entry) — never from API responses
        this.outlet   = outlet
        this.terminal = terminal
        Thread {
            AppLogger.logRequest("INIT", "calling parkingInit outlet=$outlet terminal=$terminal")
            rpsApi.parkingInit(outlet, terminal) { res ->
                AppLogger.logResponse("INIT", res)
                postOnMain {
                    initInProgress = false
                    applyInitResponse(res)
                }
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
                    when (responseCode) {
                        "08", "99" -> {
                            // Temporary issue — show message and auto-retry after 30 seconds
                            AppLogger.logRequest("INIT", "Temporary error $responseCode — will retry in 30s")
                            uiState.value = ParkingUiState.ShowMessage(
                                "Technical Issue",
                                "$errorMsg\nRetrying in 30 seconds...",
                                30L
                            )
                            handler.postDelayed({
                                AppLogger.logRequest("INIT", "Auto-retry after $responseCode")
                                val prefs    = getApplication<android.app.Application>().getSharedPreferences("APP_SETTINGS", android.app.Application.MODE_PRIVATE)
                                val outlet   = prefs.getString("outlet",   this.outlet)   ?: this.outlet
                                val terminal = prefs.getString("terminal", this.terminal) ?: this.terminal
                                init(outlet, terminal)
                            }, 30_000L)
                        }
                        else -> {
                            // Configuration error (91, 92, 93) — stay on Settings, admin must fix
                            uiState.value = ParkingUiState.ShowMessage(
                                "Configuration Error",
                                errorMsg,
                                Long.MAX_VALUE / 1000,
                                reinitOnDismiss = false
                            )
                        }
                    }
                }
                return
            }

            availablePlacesNormal = json.optString("availablePlacesNormal", "-1").toIntOrNull() ?: -1
            availablePlaceMonthly = json.optString("availablePlaceMonthly", "-1").toIntOrNull() ?: -1

            // ── flagsForAction — evaluated on BOTH full init AND keep-alive ──
            // Format: 4-char string — position 0 = restart, position 1 = update
            // e.g. "1000" → restart app; "0100" → force full re-init
            val flagsForAction = json.optString("flagsForAction", "0000")
            val ctx = if (isKeepAlive) "KEEP_ALIVE" else "INIT"
            AppLogger.logRequest(ctx, "flagsForAction=$flagsForAction")
            if (flagsForAction.length >= 1 && flagsForAction[0] == '1') {
                AppLogger.logRequest(ctx, "flagsForAction[0]='1' → scheduling app restart")
                handler.postDelayed({
                    AppLogger.logRequest("RESTART", "Restarting app per flagsForAction")
                    val app    = getApplication<Application>()
                    val intent = app.packageManager.getLaunchIntentForPackage(app.packageName)
                    intent?.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK)
                    if (intent != null) app.startActivity(intent)
                    android.os.Process.killProcess(android.os.Process.myPid())
                }, 3_000L)
            }
            if (flagsForAction.length >= 2 && flagsForAction[1] == '1') {
                AppLogger.logRequest(ctx, "flagsForAction[1]='1' → forcing full re-init")
                handler.post {
                    val prefs    = getApplication<Application>().getSharedPreferences("APP_SETTINGS", Application.MODE_PRIVATE)
                    val outlet   = prefs.getString("outlet",   this.outlet)   ?: this.outlet
                    val terminal = prefs.getString("terminal", this.terminal) ?: this.terminal
                    init(outlet, terminal)
                }
            }

            if (isKeepAlive) {
                val prevNormal  = availablePlacesNormal
                val prevMonthly = availablePlaceMonthly
                val newNormal   = json.optString("availablePlacesNormal", "-1").toIntOrNull() ?: -1
                val newMonthly  = json.optString("availablePlaceMonthly", "-1").toIntOrNull() ?: -1
                // Log to file only when places count changes; otherwise verbose (LogCat only)
                if (newNormal != prevNormal || newMonthly != prevMonthly) {
                    AppLogger.logRequest("KEEP_ALIVE", "Places changed — normal:$prevNormal→$newNormal monthly:$prevMonthly→$newMonthly")
                } else {
                    AppLogger.logVerbose("KEEP_ALIVE", "OK — normal:$newNormal monthly:$newMonthly")
                }
                // Pick up minimumAmountPreAuth changes without a full re-init
                val newMinAmount = json.optString("minimumAmountPreAuth", "").toIntOrNull()
                if (newMinAmount != null && newMinAmount != minAmountCents) {
                    AppLogger.logRequest("KEEP_ALIVE", "minimumAmountPreAuth changed: $minAmountCents → $newMinAmount")
                    minAmountCents = newMinAmount
                }
                refreshIdleState()
                return
            }

            mode               = json.optString("mode", "Entrance").uppercase()
            companyCode        = json.optString("companyCode", "")
            controller         = json.optString("controller", "0")
            minAmountCents     = json.optString("minimumAmountPreAuth", "300").toIntOrNull() ?: 300
            defaultAmountCents = json.optString("defaultAmount", "800").toIntOrNull() ?: 800
            fixAmountCents     = json.optString("fixAmountSolution", "-1").toIntOrNull() ?: -1
            AppLogger.logRequest("INIT", "fixAmountSolution=$fixAmountCents ${if (fixAmountCents > 0) "→ SALE mode (entrance only)" else "→ pre-auth mode"}")
            lostTicketAmountCents = json.optString("defaultAmount", "-1").toIntOrNull() ?: -1
            if (lostTicketAmountCents <= 0 && defaultFixAmountCents > 0) {
                lostTicketAmountCents = defaultFixAmountCents
                AppLogger.logRequest("INIT", "defaultAmount=0 from server — using local default: $lostTicketAmountCents cents")
            } else {
                AppLogger.logRequest("INIT", "defaultAmount=$lostTicketAmountCents ${if (lostTicketAmountCents > 0) "→ lost-ticket enabled" else "→ lost-ticket disabled"}")
            }
            helpPhone          = json.optString("phoneForHelp", "")
            monthlyBins        = json.optString("monthlyCardsBins", "").replace(";", ",")
            keepAliveFreq      = json.optString("keepAliveFreq", "10").toIntOrNull() ?: 10
            displayMsgAvailable= json.optString("displayMessageOfAvailablePlaces", "")
            charges            = parseCharges(json.optJSONArray("charges"))

            // TELL credentials — optional, only present when TELL is configured on server
            tellApiUrl       = json.optString("tellApiUrl",       "")
            tellHwId         = json.optString("tellHwId",         "")
            tellApiKey       = json.optString("tellApiKey",       "")
            tellAppId        = json.optString("tellAppId",        "")
            tellPassword     = json.optString("tellPassword",     "")
            tellVehicleInput = json.optString("tellVehicleInput", "in1")
            AppLogger.logRequest("INIT", "TELL config: ${if (hasTellConfig) "present (${tellVehicleInput})" else "not present — using 30s repeat"}")

            // ── Voice assistant + language (server controlled, Settings overrides) ──
            voiceAssistantEnabled = json.optString("voiceAssistant", "1") != "0"
            defaultLanguage       = json.optString("defaultLanguage", "EN").uppercase()
            // If Settings voice is OFF → always silent regardless of server
            // If Settings voice is ON → follow server's voiceAssistant value
            val prefs      = getApplication<Application>().getSharedPreferences("APP_SETTINGS", Application.MODE_PRIVATE)
            val settingsOn = prefs.getBoolean("voice_enabled", true)
            val finalVoice = settingsOn && voiceAssistantEnabled
            AppLogger.logRequest("INIT", "voice: server=$voiceAssistantEnabled settings=$settingsOn final=$finalVoice")
            ParkingAudio.setEnabled(finalVoice)
            // User manual language selection overrides server defaultLanguage
            val userLangOverride = prefs.getString("lang_user_override", null)
            val effectiveLang    = userLangOverride ?: defaultLanguage
            AppLogger.logRequest("INIT", "language: server=$defaultLanguage userOverride=$userLangOverride effective=$effectiveLang")
            onLanguageChanged?.invoke(effectiveLang)

            AppLogger.logRequest("INIT", "parsed ${charges.size} charges, mode=$mode")

            val serverDisplayMsg = if (mode == "ENTRANCE")
                json.optString("displayMessageOfEntrance", "Welcome")
            else
                json.optString("displayMessageOnExit", "Please present your card")

            // Use translated welcome message if available, otherwise use server string
            // onLanguageChanged callback provides current lang — use defaultLanguage from server
            val lang        = Translations.forCode(defaultLanguage)
            val translatedMsg = if (mode == "ENTRANCE")
                lang.welcomeEntrance.ifBlank { serverDisplayMsg }
            else
                lang.welcomeExit.ifBlank { serverDisplayMsg }

            val idleState = ParkingUiState.Idle(
                message     = translatedMsg,
                infoText    = buildInfoText(),
                showMonthly = availablePlaceMonthly >= 0
            )
            _lastIdleState = idleState
            uiState.value  = idleState

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
                uiState.value = current.copy(infoText = buildInfoText(), isKeepAlive = true)
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
                        AppLogger.logVerbose("KEEP_ALIVE", "sending outlet=$savedOutlet")
                        rpsApi.parkingInit(savedOutlet, savedTerminal) { res ->
                            AppLogger.logVerbose("KEEP_ALIVE", res)
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
    // Return to Idle without triggering a full reinit — used when no vehicle detected
    // Poller and keep-alive continue running unchanged
    fun returnToIdleNoReinit() {
        busy = false
        cancelBusySafetyTimer()
        // Restore Idle state using the last known Idle message — poller keeps running
        val lastIdle = _lastIdleState
        if (lastIdle != null) {
            uiState.value = lastIdle.copy(isKeepAlive = true)
        }
    }

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
            val prefs         = getApplication<Application>().getSharedPreferences("APP_SETTINGS", Application.MODE_PRIVATE)
            val savedOutlet   = prefs.getString("outlet",   outlet)   ?: outlet
            val savedTerminal = prefs.getString("terminal", terminal) ?: terminal
            AppLogger.logRequest("DAILY_INIT", "outlet=$savedOutlet terminal=$savedTerminal (from Settings)")
            init(savedOutlet, savedTerminal)
            scheduleDailyInit()
        }, delay)
    }

    // ── Vehicle check helper ──────────────────────────────────────────────────
    /**
     * If TELL is active and last known state is "no vehicle", does an immediate
     * on-demand poll to catch arrivals since the last background tick (up to 3 s gap).
     * Calls [onConfirmed] when vehicle is present (or no TELL configured).
     * Sets busy=false and shows "No vehicle" message if still not detected.
     * [timeOfInput] captured by caller so the timestamp is consistent.
     */
    private fun checkVehicleThenRun(
        timeOfInput:    String,
        noVehicleBody:  String,
        onConfirmed:    () -> Unit
    ) {
        val poller = tellPollerRef
        if (hasTellConfig && poller != null && !poller.lastVehicleDetected) {
            // Last tick said no vehicle — do a fresh poll to catch arrivals in the gap
            AppLogger.logRequest("VEHICLE", "TELL: lastDetected=false — polling now to confirm")
            uiState.value = ParkingUiState.Loading("Checking vehicle...")
            poller.pollNow { detected ->
                if (detected) {
                    AppLogger.logRequest("VEHICLE", "TELL pollNow: vehicle confirmed — proceeding")
                    onConfirmed()
                } else {
                    busy = false
                    cancelBusySafetyTimer()
                    AppLogger.logRequest("VEHICLE", "TELL pollNow: no vehicle — blocking")
                    uiState.value = ParkingUiState.ShowMessage(
                        title           = "No vehicle detected",
                        body            = noVehicleBody,
                        autoDismissSecs = 4L,
                        reinitOnDismiss = false
                    )
                }
            }
        } else {
            // TELL says vehicle present, or no TELL — proceed immediately
            onConfirmed()
        }
    }

    // ── Entrance flow ─────────────────────────────────────────────────────────
    fun runEntranceFlow() {
        busy = true
        startBusySafetyTimer()
        val timeOfInput = currentTimestamp()
        checkVehicleThenRun(timeOfInput, "Please drive up to the entrance barrier.") {
            startEntranceEcr(timeOfInput)
        }
    }

    private fun handleVehiclePresentResponse(res: String, timeOfInput: String, isEntrance: Boolean, isMonthly: Boolean = false) {
        try {
            val json    = JSONObject(res)
            val code    = json.optString("responseCode", "99")
            val present = json.optString("vehiclePresent", "0")
            val msg     = json.optString("displayMessage", "")
            val secs    = json.optString("timeToDisplayMessage", "5").toLongOrNull() ?: 5L

            when {
                code == "99" -> {
                    // Network error — fail safe: do NOT proceed, show error
                    busy = false
                    cancelBusySafetyTimer()
                    AppLogger.logError("VEHICLE", "Network error — cannot verify vehicle")
                    callHelpBackground("VehiclePresent network error")
                    uiState.value = ParkingUiState.ShowMessage(
                        "Connection Error",
                        "Unable to verify vehicle. Please contact staff.",
                        10L
                    )
                }
                code != "00" || present != "1" -> {
                    busy = false
                    cancelBusySafetyTimer()
                    AppLogger.logRequest("VEHICLE", "Not present or error — code=$code present=$present")
                    uiState.value = ParkingUiState.ShowMessage(
                        "No vehicle detected",
                        msg.ifBlank { "No vehicle present at entrance." },
                        secs
                    )
                }
                else -> {
                    AppLogger.logRequest("VEHICLE", "Vehicle detected — proceeding")
                    if (isMonthly) {
                        lastMonthlyTimeOfInput = timeOfInput
                        uiState.value = resolveMonthlyInputState()
                    } else {
                        if (isEntrance) startEntranceEcr(timeOfInput) else startExitEcr(timeOfInput)
                    }
                }
            }
        } catch (e: Exception) {
            busy = false
            cancelBusySafetyTimer()
            AppLogger.logError("VEHICLE", "Parse error: ${e.message}")
            uiState.value = ParkingUiState.ShowMessage("Technical Issue Detected", "Please contact our staff.", 8L)
        }
    }

    private fun startEntranceEcr(timeOfInput: String) {
        if (fixAmountCents > 0) {
            // Fixed amount mode — SALE transaction, no pre-auth
            uiState.value = ParkingUiState.Loading("Processing €%.2f...".format(fixAmountCents / 100.0))
            val request = EcrRequest.sale(fixAmountCents, generateOrderNo())
            ecrManager.sendTransaction(request) { result ->
                postOnMain {
                    handleEcrResult(result, "ENTRANCE") { ecr ->
                        val lastFour = ecr.accountNumber.takeLast(4)
                        val token    = TokenHelper.buildBankCardToken(ecr.firstDigits.take(6).ifBlank { "000000" }, lastFour, ecr.expiryDate, outlet)
                        val entry    = EntryRecord.fromEcrResponse(ecr, token, "Bank Card", timeOfInput, fixAmountCents, outlet, companyCode, terminal)
                        callEntranceApi(entry)
                    }
                }
            }
        } else {
            // Standard mode — Pre-Auth
            uiState.value = ParkingUiState.Loading("Pre-authorizing €%.2f...".format(minAmountCents / 100.0))
            val request = EcrRequest.preAuth(minAmountCents, generateOrderNo())
            ecrManager.sendTransaction(request) { result ->
                postOnMain {
                    handleEcrResult(result, "ENTRANCE") { ecr ->
                        val lastFour = ecr.accountNumber.takeLast(4)
                        val token    = TokenHelper.buildBankCardToken(ecr.firstDigits.take(6).ifBlank { "000000" }, lastFour, ecr.expiryDate, outlet)
                        val entry    = EntryRecord.fromEcrResponse(ecr, token, "Bank Card", timeOfInput, minAmountCents, outlet, companyCode, terminal)
                        callEntranceApi(entry, preAuthEcr = ecr)  // pass ecr so denial can void it
                    }
                }
            }
        }
    }

    // ── Exit flow ─────────────────────────────────────────────────────────────
    fun runExitFlow() {
        busy = true
        startBusySafetyTimer()
        val timeOfInput = currentTimestamp()
        checkVehicleThenRun(timeOfInput, "Please drive up to the exit barrier.") {
            startExitEcr(timeOfInput)
        }
    }

    private fun startExitEcr(timeOfInput: String) {
        uiState.value = ParkingUiState.Loading("Card Validation.\nPlease wait...")
        // Type 14 — PAN Capture: zero-amount, no host auth, just reads and encrypts the card
        val request = EcrRequest.panCapture(generateOrderNo())
        ecrManager.sendTransaction(request) { result ->
            postOnMain {
                handleEcrResult(result, "EXIT_READ") { ecr ->
                    val lastFour = ecr.accountNumber.takeLast(4)
                    val token    = TokenHelper.buildBankCardToken(ecr.firstDigits.take(6).ifBlank { "000000" }, lastFour, ecr.expiryDate, outlet)
                    callExitApi(token, lastFour, ecr.firstDigits.take(6), "Card", timeOfInput)
                }
            }
        }
    }

    // ── Monthly flow ──────────────────────────────────────────────────────────
    fun runMonthlyFlow() {
        busy = true
        startBusySafetyTimer()
        val timeOfInput = currentTimestamp()
        val body = if (mode == "ENTRANCE") "Please drive up to the entrance barrier." else "Please drive up to the exit barrier."
        checkVehicleThenRun(timeOfInput, body) {
            lastMonthlyTimeOfInput = timeOfInput
            uiState.value = resolveMonthlyInputState()
        }
    }

    /** Returns the correct monthly input state based on the Settings preference. */
    private fun resolveMonthlyInputState(): ParkingUiState {
        val prefs  = getApplication<Application>().getSharedPreferences("APP_SETTINGS", Application.MODE_PRIVATE)
        val method = prefs.getString("monthly_input_method", "keyin")
        return if (method == "contactless")
            ParkingUiState.LaunchMonthlyContactless
        else
            ParkingUiState.LaunchMonthlyKeyIn
    }

    fun runMonthlyKeyInFlow(cardNumber: String) {
        val timeOfInput = lastMonthlyTimeOfInput
        AppLogger.logRequest("MONTHLY_KEYIN", "Processing card: *${cardNumber.takeLast(4)}")
        ParkingAudio.beep()
        uiState.value = ParkingUiState.Loading("Validating monthly card...")
        val token = TokenHelper.buildMonthlyCardToken(cardNumber, outlet)
        if (mode == "ENTRANCE") {
            val entry = EntryRecord(
                token              = token,
                lastDigits         = cardNumber.takeLast(4),   // last 4 digits only
                firstDigits        = "",
                expiryDate         = "",
                terminalId         = terminal,
                configuredTerminal = terminal,
                authCode           = "111111",          // spec §1.7: hardcoded for monthly card entrance
                rrn                = "112233445566",     // spec §1.7: hardcoded referenceNo for monthly card
                receiptNumber      = "",
                preAuthAmountCents = 0,
                inputType          = "Monthly Card",
                timeOfInput        = timeOfInput,
                outlet             = outlet,
                companyCode        = companyCode
            )
            callEntranceApi(entry)
        } else {
            callExitApi(token, cardNumber.takeLast(4), "", "Monthly Card", timeOfInput)  // last 4 digits only
        }
    }

    // ── Help flow ─────────────────────────────────────────────────────────────
    fun runHelpFlow() {
        if (busy) return
        busy = true
        Thread {
            AppLogger.logRequest("HELP", "sending")
            rpsApi.help(outlet, terminal, companyCode, mode.capitalize(Locale.getDefault()), "Help Button") { res ->
                AppLogger.logResponse("HELP", res)
                postOnMain {
                    busy = false
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
    private fun callEntranceApi(entry: EntryRecord, preAuthEcr: EcrResponse? = null) {
        AppLogger.logRequest("RPS_ENTRANCE", "sending outlet=${entry.outlet} terminal=${entry.terminalId} inputType=${entry.inputType}")
        AppLogger.logRequest("RPS_ENTRANCE", "token=${entry.token.take(20)}... tokenCode=${entry.tokenCode}")
        Thread {
            rpsApi.entranceCall(entry) { res ->
                AppLogger.logResponse("RPS_ENTRANCE", res)
                postOnMain {
                    busy = false
                    cancelBusySafetyTimer()
                    try {
                        val json            = JSONObject(res)
                        val code            = json.optString("responseCode", "99")
                        val msg             = json.optString("displayMessage", "")
                        val secs            = json.optString("timeToDisplayMessage", "5").toLongOrNull() ?: 5L
                        val respOutlet      = json.optString("outlet",   "(empty)")
                        val respTerminal    = json.optString("terminal", "(empty)")
                        AppLogger.logRequest("RPS_ENTRANCE", "server echoed outlet=$respOutlet terminal=$respTerminal code=$code")
                        if (respOutlet.isBlank() || respOutlet == "(empty)") {
                            AppLogger.logError("RPS_ENTRANCE", "⚠ Server returned empty outlet — sent=${entry.outlet}, server config issue")
                        }
                        when (code) {
                            "00" -> {
                                updateAvailablePlaces(json)
                                uiState.value = ParkingUiState.ShowMessage("Welcome!", msg, secs)
                            }
                            "99" -> {
                                AppLogger.logError("RPS_ENTRANCE", "Network error")
                                callHelpBackground("Entrance network error")
                                uiState.value = ParkingUiState.ShowMessage(
                                    "Connection Error",
                                    "Unable to reach server. Please contact staff.",
                                    10L
                                )
                            }
                            else -> {
                                AppLogger.logError("RPS_ENTRANCE", "Denied: $code — $msg")
                                // Void the pre-auth silently — SALE mode passes null so no void there
                                if (preAuthEcr != null) voidPreAuth(preAuthEcr)
                                val displayMsg = when {
                                    // Duplicate card — already has an active entry
                                    msg.contains("already", ignoreCase = true) ->
                                        "This card was already used without Exit.\nPlease use a different card."
                                    // Other denial — show server reason + reversal note
                                    preAuthEcr != null ->
                                        "${msg.ifBlank { "Please contact staff." }}\n\nThe pre-authorization of " +
                                        "€%.2f will be reversed.".format(minAmountCents / 100.0)
                                    else -> msg.ifBlank { "Please contact staff." }
                                }
                                uiState.value = ParkingUiState.ShowMessage(
                                    "Access Denied",
                                    displayMsg,
                                    secs.coerceAtLeast(8L)
                                )
                            }
                        }
                    } catch (e: Exception) {
                        AppLogger.logError("RPS_ENTRANCE", "Parse error: ${e.message}")
                        callHelpBackground("Entrance parse error")
                        uiState.value = ParkingUiState.ShowMessage("Technical Issue Detected", "Please contact our staff.", 8L)
                    }
                }
            }
        }.start()
    }

    private fun callExitApi(token: String, lastDigits: String, firstDigits: String, inputType: String, timeOfInput: String) {
        AppLogger.logRequest("RPS_EXIT", "token=${token.take(20)}... lastDigits=$lastDigits inputType=$inputType")
        Thread {
            rpsApi.exitCall(token, timeOfInput, lastDigits, firstDigits, inputType, outlet, terminal, companyCode) { res ->
                AppLogger.logResponse("RPS_EXIT", res)
                postOnMain {
                    try {
                        val json        = JSONObject(res)
                        val code        = json.optString("responseCode", "99")
                        val moneyToPay  = json.optString("moneyToPay", "0").toIntOrNull() ?: 0
                        val barrierOpen = json.optString("barrierOpen", "0")
                        val msg         = json.optString("displayMessage", "")
                        val secs        = json.optString("timeToDisplayMessage", "5").toLongOrNull() ?: 5L
                        val recordId    = json.optString("recordId", "")

                        if (code == "99") {
                            busy = false
                            cancelBusySafetyTimer()
                            AppLogger.logError("RPS_EXIT", "Network error")
                            callHelpBackground("Exit network error")
                            uiState.value = ParkingUiState.ShowMessage(
                                "Connection Error",
                                "Unable to reach server. Please contact staff.",
                                10L
                            )
                            return@postOnMain
                        }

                        updateAvailablePlaces(json)
                        when (barrierOpen) {
                            "1"  -> {
                                busy = false
                                cancelBusySafetyTimer()
                                uiState.value = ParkingUiState.ShowMessage(
                                    title = "Thank you!",
                                    body  = msg,
                                    autoDismissSecs = secs
                                )
                            }
                            "-2" -> runExitPaymentFlow(moneyToPay, recordId, token, lastDigits, timeOfInput, msg, secs)
                            "0"  -> {
                                busy = false
                                cancelBusySafetyTimer()
                                when (code) {
                                    "05" -> {
                                        // Card has no entry record — prompt for lost ticket payment if configured
                                        AppLogger.logRequest("RPS_EXIT", "responseCode=05 — no entry record; lostTicketAmountCents=$lostTicketAmountCents")
                                        if (lostTicketAmountCents > 0) {
                                            uiState.value = ParkingUiState.PromptLostTicket(lostTicketAmountCents)
                                        } else {
                                            uiState.value = ParkingUiState.ShowMessage(
                                                title           = "No Entry Found",
                                                body            = msg.ifBlank { "Please contact staff." },
                                                autoDismissSecs = secs
                                            )
                                        }
                                    }
                                    else -> {
                                        AppLogger.logError("RPS_EXIT", "Barrier not opened — code=$code")
                                        callHelpBackground("Barrier failed code=$code")
                                        uiState.value = ParkingUiState.ShowMessage("Technical Issue Detected", msg.ifBlank { "Please contact staff." }, secs)
                                    }
                                }
                            }
                            else -> { busy = false; cancelBusySafetyTimer(); uiState.value = ParkingUiState.ShowMessage("Error", msg.ifBlank { "Please contact staff." }, secs) }
                        }
                    } catch (e: Exception) {
                        busy = false
                        cancelBusySafetyTimer()
                        AppLogger.logError("RPS_EXIT", "Parse error: ${e.message}")
                        callHelpBackground("Exit parse error")
                        uiState.value = ParkingUiState.ShowMessage("Technical Issue Detected", "Please contact our staff.", 8L)
                    }
                }
            }
        }.start()
    }

    private fun runExitPaymentFlow(
        amountCents: Int, @Suppress("UNUSED_PARAMETER") recordId: String, token: String,
        lastDigits: String, exitTimeOfInput: String,
        displayMsg: String, displaySecs: Long
    ) {
        val amountFormatted = "€%.2f".format(amountCents / 100.0)
        // Show amount for 5 seconds then activate card reader
        uiState.value = ParkingUiState.ShowMessage(
            title     = "Amount Due: $amountFormatted",
            body      = "Tap your card / wallet to proceed.",
            noDismiss = true  // ECR result drives next state — never auto-dismiss
        )
        handler.postDelayed({
            // After 5s — activate card reader (screen stays on Amount Due)
            AppLogger.logRequest("EXIT_PAYMENT", "Starting ECR SALE for $amountFormatted")
            val request = EcrRequest.sale(amountCents, generateOrderNo())
            ecrManager.sendTransaction(request) { result ->
                postOnMain {
                    handleEcrResult(result, "EXIT_PAYMENT") { ecr ->
                        AppLogger.logRequest("RPS_EXIT_PAYMENT", "auth=${ecr.authCode} amt=$amountCents")
                        Thread {
                            rpsApi.exitPayment(
                                token, lastDigits, "", exitTimeOfInput,
                                amountCents, ecr.authCode, ecr.responseCode,
                                ecr.rrn, ecr.receiptNumber,
                                outlet, terminal, companyCode
                            ) { res ->
                                AppLogger.logResponse("RPS_EXIT_PAYMENT", res)
                                postOnMain {
                                    busy = false
                                    cancelBusySafetyTimer()
                                    try {
                                        val json        = JSONObject(res)
                                        val code        = json.optString("responseCode", "99")
                                        val msg         = json.optString("displayMessage", "Thank you!")
                                        val secs        = json.optString("timeToDisplayMessage", "5").toLongOrNull() ?: 5L
                                        val barrierOpen = json.optString("barrierOpen", "1")
                                        updateAvailablePlaces(json)
                                        when {
                                            code == "99" -> {
                                                AppLogger.logError("RPS_EXIT_PAYMENT", "Network error")
                                                callHelpBackground("ExitPayment network error")
                                                uiState.value = ParkingUiState.ShowMessage("Technical Issue Detected", "Please contact our staff.", 10L)
                                            }
                                            barrierOpen == "1" -> uiState.value = ParkingUiState.ShowMessage(
                                                title           = "Thank you!",
                                                body            = "Payment approved.\nPlease proceed.",
                                                autoDismissSecs = 10L
                                            )
                                            else -> {
                                                AppLogger.logError("RPS_EXIT_PAYMENT", "Barrier not open: $barrierOpen")
                                                callHelpBackground("ExitPayment barrier failed")
                                                uiState.value = ParkingUiState.ShowMessage("Technical Issue Detected", "Please contact our staff.", secs)
                                            }
                                        }
                                    } catch (_: Exception) {
                                        callHelpBackground("ExitPayment parse error")
                                        uiState.value = ParkingUiState.ShowMessage("Technical Issue Detected", "Please contact our staff.", 8L)
                                    }
                                }
                            }
                        }.start()
                    }
                }
            }
        }, 5_000L)
    }

    // ── Manual exit payment (lost card via Help button) ───────────────────
    fun runManualPaymentFlow() {
        if (lostTicketAmountCents <= 0) return
        busy = true
        startBusySafetyTimer()
        val timeOfInput     = currentTimestamp()
        val amountFormatted = "€%.2f".format(lostTicketAmountCents / 100.0)
        AppLogger.logRequest("MANUAL_PAY", "Starting — amount=$lostTicketAmountCents")
        uiState.value = ParkingUiState.Loading("Processing $amountFormatted...")
        val request = EcrRequest.sale(lostTicketAmountCents, generateOrderNo())
        ecrManager.sendTransaction(request) { result ->
            postOnMain {
                handleEcrResult(result, "MANUAL_PAY") { ecr ->
                    val lastFour = ecr.accountNumber.takeLast(4)
                    val token    = TokenHelper.buildBankCardToken(
                        ecr.firstDigits.take(6).ifBlank { "000000" }, lastFour, ecr.expiryDate, outlet
                    )
                    callExitFixedPaymentApi(ecr, token, lastFour, timeOfInput)
                }
            }
        }
    }

    private fun callExitFixedPaymentApi(ecr: EcrResponse, token: String, lastDigits: String, timeOfInput: String) {
        AppLogger.logRequest("RPS_MANUAL_PAY", "token=${token.take(20)}... amt=$lostTicketAmountCents auth=${ecr.authCode}")
        Thread {
            rpsApi.exitPayment(
                token, lastDigits, "", timeOfInput,
                lostTicketAmountCents, ecr.authCode, ecr.responseCode,
                ecr.rrn, ecr.receiptNumber,
                outlet, terminal, companyCode,
                inputType = "Lost Card"
            ) { res ->
                AppLogger.logResponse("RPS_MANUAL_PAY", res)
                postOnMain {
                    busy = false
                    cancelBusySafetyTimer()
                    try {
                        val json        = JSONObject(res)
                        val code        = json.optString("responseCode", "99")
                        val secs        = json.optString("timeToDisplayMessage", "5").toLongOrNull() ?: 5L
                        val barrierOpen = json.optString("barrierOpen", "1")
                        updateAvailablePlaces(json)
                        when {
                            code == "99" -> {
                                AppLogger.logError("RPS_MANUAL_PAY", "Network error")
                                callHelpBackground("ManualPay network error")
                                uiState.value = ParkingUiState.ShowMessage("Connection Error", "Unable to reach server.\nPlease contact staff.", 10L)
                            }
                            barrierOpen == "1" -> uiState.value = ParkingUiState.ShowMessage(
                                title           = "Thank you!",
                                body            = "Payment approved.\nPlease proceed.",
                                autoDismissSecs = 10L
                            )
                            else -> {
                                AppLogger.logError("RPS_MANUAL_PAY", "Barrier not open: $barrierOpen code=$code")
                                callHelpBackground("ManualPay barrier failed")
                                uiState.value = ParkingUiState.ShowMessage("Technical Issue Detected", "Please contact our staff.", secs)
                            }
                        }
                    } catch (_: Exception) {
                        callHelpBackground("ManualPay parse error")
                        uiState.value = ParkingUiState.ShowMessage("Technical Issue Detected", "Please contact our staff.", 8L)
                    }
                }
            }
        }.start()
    }

    // ── ECR result handler ────────────────────────────────────────────────────
    private fun handleEcrResult(result: MiddlewareResult, ctx: String, onApproved: (EcrResponse) -> Unit) {
        val mwCode = result.middlewareCode
        val ecr    = result.ecrResponse
        AppLogger.logResponse("ECR[$ctx]", "mw=$mwCode ecr=${ecr?.responseCode}")
        when {
            mwCode != "00" -> {
                busy = false
                cancelBusySafetyTimer()
                val desc = middlewareCodeDescription(mwCode)
                uiState.value = ParkingUiState.ShowMessage("Technical Issue Detected", "Please contact our staff.", 5L)
                callHelpBackground("MW error: $desc")
            }
            ecr == null || !ecr.isApproved -> {
                busy = false
                cancelBusySafetyTimer()
                val desc = ecr?.responseCodeDescription() ?: "Unknown error"
                uiState.value = ParkingUiState.ShowMessage(
                    "Problem with the Card.",
                    "Please try again.\n$desc",
                    6L
                )
                callHelpBackground("ECR decline: ${ecr?.responseCode} $desc")
            }
            else -> onApproved(ecr)
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private fun voidPreAuth(ecr: EcrResponse) {
        AppLogger.logRequest("ECR_VOID", "Reversing pre-auth receipt=${ecr.receiptNumber} amt=${ecr.originalAmount}")
        Thread {
            val voidReq = EcrRequest.void(ecr.receiptNumber, generateOrderNo())
            ecrManager.sendTransaction(voidReq) { result ->
                AppLogger.logResponse("ECR_VOID", "mw=${result.middlewareCode} ecr=${result.ecrResponse?.responseCode}")
            }
        }.start()
    }

    private fun callHelpBackground(reason: String) {
        Thread {
            AppLogger.logRequest("HELP_AUTO", reason)
            rpsApi.help(outlet, terminal, companyCode, mode.capitalize(Locale.getDefault()), "ECR Decline. $reason") {}
        }.start()
    }

    private fun updateAvailablePlaces(json: JSONObject) {
        json.optString("availablePlacesRegular").toIntOrNull()?.let { availablePlacesNormal = it }
        json.optString("availablePlaceMonthly").toIntOrNull()?.let  { availablePlaceMonthly = it }
    }

    fun buildInfoText(
        labelFreeSpaces: String = "FREE SPACES",
        labelRates: String = "PARKING RATES",
        labelNormal: String = "Normal",
        labelMonthly: String = "Monthly"
    ): String {
        val sb = StringBuilder()
        if (mode == "ENTRANCE" && (availablePlacesNormal >= 0 || availablePlaceMonthly >= 0)) {
            sb.append("$labelFreeSpaces\n")
            val parts = mutableListOf<String>()
            if (availablePlacesNormal >= 0) parts.add("$labelNormal: $availablePlacesNormal")
            if (availablePlaceMonthly >= 0) parts.add("$labelMonthly: $availablePlaceMonthly")
            sb.append("  ${parts.joinToString("   ")}\n")
        }
        if (showRates && charges.isNotEmpty()) {
            if (sb.isNotEmpty()) sb.append("\n")
            sb.append("$labelRates\n")
            charges.forEachIndexed { i, charge ->
                val from = formatMinutes(charge.fromMin)
                val to   = if (charge.toMin != null) formatMinutes(charge.toMin) else "..."
                val fee  = "€%.2f".format(charge.feeCents / 100.0)
                sb.append("  ${i + 1}. $from - $to  →  $fee\n")
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

    internal fun formatMinutes(minutes: Int): String {
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