package com.parking.app

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.ViewModelProvider
import com.parking.app.viewmodel.ParkingUiState
import com.parking.app.viewmodel.ParkingViewModel
import com.parking.app.api.real.RetrofitRpsApi
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var txtMessage:          TextView
    private lateinit var txtInfo:             TextView
    private lateinit var txtSelectPrompt:     TextView
    private lateinit var progress:            ProgressBar
    private lateinit var btnContinue:         Button
    private lateinit var btnMonthly:          Button
    private lateinit var btnHelp:             Button
    private lateinit var btnInfo:             Button
    private lateinit var btnLang:             Button
    private lateinit var btnSettings:         ImageView
    private lateinit var cardInfo:            View
    private lateinit var btnMonthlyWrap:      View
    private lateinit var txtBankCardLabel:    TextView
    private lateinit var txtMonthlyCardLabel: TextView

    // ── Monthly keypad overlay ────────────────────────────────────────────────
    private lateinit var keypadOverlay:      android.view.ViewGroup
    private lateinit var txtKeypadPrompt:    TextView
    private lateinit var txtKeypadDisplay:   TextView
    private lateinit var btnKeypadCancel:    Button
    private val keypadInput = StringBuilder()
    private val KEYPAD_MAX  = 6

    // ── Contactless monthly overlay ────────────────────────────────────────────
    private lateinit var contactlessOverlay:   android.view.ViewGroup
    private lateinit var txtContactlessPrompt: TextView
    private lateinit var txtContactlessStatus: TextView
    private lateinit var btnContactlessCancel: Button
    private lateinit var progressContactless:  android.widget.ProgressBar
    private val CONTACTLESS_TIMEOUT_MS = 15_000L
    private var contactlessTimeoutRunnable: Runnable? = null
    private var contactlessThread: Thread?  = null

    private lateinit var viewModel: ParkingViewModel
    private val handler = Handler(Looper.getMainLooper())
    private var welcomeRepeatRunnable: Runnable? = null
    private val WELCOME_REPEAT_MS = 10_000L
    private var currentLang = Translations.EN
    private var tellPoller: TellPoller? = null

    private fun applyLang(lang: Translations.LangStrings) {
        currentLang = lang
        ParkingAudio.currentLang = lang.code.lowercase()
        btnLang.text = "🌐 ${lang.flag} ${lang.code}"
        txtBankCardLabel.text    = lang.bankCard
        txtMonthlyCardLabel.text = lang.monthlyCard
        val state = viewModel.uiState.value
        if (state is ParkingUiState.Idle) {
            val isExit = viewModel.mode == "EXIT"
            // Update welcome message — use translation if available, else keep server string
            val translatedMsg = if (isExit)
                lang.welcomeExit.ifBlank { state.message }
            else
                lang.welcomeEntrance.ifBlank { state.message }
            txtMessage.text = translatedMsg
            txtSelectPrompt.text = when {
                state.showMonthly -> lang.selectToContinue
                isExit            -> lang.tapToExit
                else              -> lang.tapToContinue
            }
            txtInfo.text = viewModel.buildInfoText(lang.freeSpaces, lang.parkingRates, lang.normal, lang.monthly)
            cardInfo.visibility = if (txtInfo.text.isBlank()) View.GONE else View.VISIBLE
        }
    }

    private fun resetLangToDefault() {
        val prefs = getSharedPreferences("APP_SETTINGS", MODE_PRIVATE)
        val code  = prefs.getString("default_lang", "EN") ?: "EN"
        applyLang(Translations.forCode(code))
    }

    private fun startTellPoller() {
        AppLogger.logRequest("TELL_POLL", "startTellPoller called — hasTellConfig=${viewModel.hasTellConfig}")
        if (!viewModel.hasTellConfig) return
        val prefs       = getSharedPreferences("APP_SETTINGS", MODE_PRIVATE)
        val intervalSec = prefs.getInt("tell_interval_sec", 3).coerceIn(1, 60)
        tellPoller = TellPoller(
            context             = this,
            apiUrl              = viewModel.tellApiUrl,
            hwId                = viewModel.tellHwId,
            apiKey              = viewModel.tellApiKey,
            password            = viewModel.tellPassword,
            providedAppId       = viewModel.tellAppId,
            vehicleInput        = viewModel.tellVehicleInput,
            intervalMs          = intervalSec * 1000L,
            initialLastDetected = tellPoller?.lastVehicleDetected ?: false,
            onVehicleDetected = {
                if (viewModel.uiState.value is ParkingUiState.Idle && !viewModel.busy) {
                    ParkingAudio.welcome(this, viewModel.mode == "EXIT")
                    startWelcomeRepeat()  // keep repeating while car waits
                }
            },
            onVehicleLeft = {
                stopWelcomeRepeat()  // car gone — stop repeat
            },
            onRegistrationFailed = {
                AppLogger.logRequest("TELL_POLL", "Registration failed — starting 30s welcome repeat as fallback")
                tellPoller = null
                startWelcomeRepeat()
            }
        )
        tellPoller?.start()
        viewModel.tellPollerRef = tellPoller
        // When TELL is active stop the 30s repeat — TELL handles it
        stopWelcomeRepeat()
    }

    private fun stopTellPoller() {
        tellPoller?.stop()
        tellPoller = null
        viewModel.tellPollerRef = null
    }

    private fun startWelcomeRepeat() {
        stopWelcomeRepeat()
        welcomeRepeatRunnable = object : Runnable {
            override fun run() {
                if (viewModel.uiState.value is ParkingUiState.Idle && !viewModel.busy) {
                    ParkingAudio.welcome(this@MainActivity, viewModel.mode == "EXIT")
                }
                handler.postDelayed(this, WELCOME_REPEAT_MS)
            }
        }
        handler.postDelayed(welcomeRepeatRunnable!!, WELCOME_REPEAT_MS)
    }

    private fun stopWelcomeRepeat() {
        welcomeRepeatRunnable?.let { handler.removeCallbacks(it) }
        welcomeRepeatRunnable = null
    }

    private fun hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            or View.SYSTEM_UI_FLAG_FULLSCREEN
                            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    )
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        AppLogger.init(this)
        setContentView(R.layout.activity_main)
        hideSystemUI()

        // Initialise audio and language
        val prefs0 = getSharedPreferences("APP_SETTINGS", MODE_PRIVATE)
        ParkingAudio.setEnabled(prefs0.getBoolean("voice_enabled", true))

        // Pass app version to RetrofitRpsApi so it is included in parkingInit requests
        RetrofitRpsApi.appVersionName = BuildConfig.VERSION_NAME
        RetrofitRpsApi.appVersionCode = BuildConfig.VERSION_CODE.toString()

        txtMessage      = findViewById(R.id.txtMessage)
        txtInfo         = findViewById(R.id.txtInfo)
        txtSelectPrompt = findViewById(R.id.txtSelectPrompt)
        progress        = findViewById(R.id.progress)
        btnContinue         = findViewById(R.id.btnContinue)
        btnMonthly          = findViewById(R.id.btnMonthly)
        btnHelp             = findViewById(R.id.btnHelp)
        btnInfo             = findViewById(R.id.btnInfo)
        btnLang             = findViewById(R.id.btnLang)
        btnSettings         = findViewById(R.id.btnSettings)
        cardInfo            = findViewById(R.id.cardInfo)
        btnMonthlyWrap      = findViewById(R.id.btnMonthlyWrap)
        txtBankCardLabel    = findViewById(R.id.txtBankCardLabel)
        txtMonthlyCardLabel = findViewById(R.id.txtMonthlyCardLabel)

        // ── Keypad overlay setup ───────────────────────────────────────────────
        keypadOverlay    = findViewById(R.id.keypadOverlay)
        txtKeypadPrompt  = findViewById(R.id.txtKeypadPrompt)
        txtKeypadDisplay = findViewById(R.id.txtKeypadDisplay)
        btnKeypadCancel  = findViewById(R.id.btnKeypadCancel)

        // ── Contactless overlay setup ──────────────────────────────────────────
        contactlessOverlay   = findViewById(R.id.contactlessOverlay)
        txtContactlessPrompt = findViewById(R.id.txtContactlessPrompt)
        txtContactlessStatus = findViewById(R.id.txtContactlessStatus)
        btnContactlessCancel = findViewById(R.id.btnContactlessCancel)
        progressContactless  = findViewById(R.id.progressContactless)

        btnContactlessCancel.setOnClickListener {
            AppLogger.logButton("CONTACTLESS_CANCEL")
            hideContactlessOverlay()
            viewModel.busy = false
            viewModel.returnToIdleNoReinit()
        }
        val keypadGrid: android.widget.GridLayout = findViewById(R.id.keypadGrid)

        listOf("1","2","3","4","5","6","7","8","9","⌫","0","OK").forEach { key ->
            val btn = Button(this).apply {
                text     = key
                textSize = 26f
                setTypeface(null, android.graphics.Typeface.BOLD)
                setTextColor(0xFFFFFFFF.toInt())
                val size = resources.getDimensionPixelSize(android.R.dimen.app_icon_size) + 56
                layoutParams = android.widget.GridLayout.LayoutParams().apply {
                    width  = size; height = size
                    setMargins(5, 5, 5, 5)
                }
                setBackgroundColor(when (key) {
                    "⌫"  -> 0xFF2D3748.toInt()
                    "OK" -> 0xFF238636.toInt()
                    else -> 0xFF2E4A6E.toInt()
                })
                setOnClickListener { onKeypadKey(key) }
            }
            keypadGrid.addView(btn)
        }

        btnKeypadCancel.setOnClickListener {
            hideKeypad()
            viewModel.busy = false
            viewModel.returnToIdleNoReinit()
        }

        viewModel = ViewModelProvider(this)[ParkingViewModel::class.java]

        // Init language from saved default
        val defaultLang = getSharedPreferences("APP_SETTINGS", MODE_PRIVATE)
            .getString("default_lang", "EN") ?: "EN"
        currentLang = Translations.forCode(defaultLang)
        ParkingAudio.currentLang = currentLang.code.lowercase()

        val prefs     = getSharedPreferences("APP_SETTINGS", MODE_PRIVATE)
        val outlet    = prefs.getString("outlet",     "") ?: ""
        val terminal  = prefs.getString("terminal",   "") ?: ""
        val serverUrl = prefs.getString("server_url", "") ?: ""
        val showRates = prefs.getBoolean("show_rates", true)
        val hmac      = buildHmacCredentials(prefs)

        viewModel.setup(EcrManager(this), serverUrl, showRates, hmac)

        // Server controls voice and language via parkingInit — apply when received
        viewModel.onLanguageChanged = { langCode ->
            val lang = Translations.forCode(langCode)
            applyLang(lang)
        }

        // ── Observe UI state ──────────────────────────────────────────────────
        viewModel.uiState.observe(this) { state ->
            when (state) {
                is ParkingUiState.Idle -> {
                    val isExit = viewModel.mode == "EXIT"
                    showLoading(false)
                    setButtons(true)
                    txtMessage.textSize = 28f
                    txtMessage.text     = if (isExit)
                        currentLang.welcomeExit.ifBlank { state.message }
                    else
                        currentLang.welcomeEntrance.ifBlank { state.message }
                    txtInfo.text               = viewModel.buildInfoText(
                        currentLang.freeSpaces, currentLang.parkingRates,
                        currentLang.normal, currentLang.monthly
                    )
                    cardInfo.visibility        = if (txtInfo.text.isBlank()) View.GONE else View.VISIBLE
                    btnMonthlyWrap.visibility  = if (state.showMonthly) View.VISIBLE else View.GONE
                    btnMonthly.visibility      = if (state.showMonthly) View.VISIBLE else View.GONE
                    txtSelectPrompt.text       = when {
                        state.showMonthly -> currentLang.selectToContinue
                        isExit            -> currentLang.tapToExit
                        else              -> currentLang.tapToContinue
                    }
                    txtSelectPrompt.visibility = View.VISIBLE
                    btnLang.visibility         = View.VISIBLE
                    btnLang.text               = "🌐 ${currentLang.flag} ${currentLang.code}"
                    txtBankCardLabel.text      = currentLang.bankCard
                    txtMonthlyCardLabel.text   = currentLang.monthlyCard
                    if (!state.isKeepAlive) {
                        // Genuine init — stop existing poller, reset vehicle state, restart fresh
                        stopTellPoller()
                        stopWelcomeRepeat()
                        ParkingAudio.welcome(this, isExit)
                        if (viewModel.hasTellConfig) {
                            startTellPoller()
                        } else {
                            startWelcomeRepeat()
                        }
                    }
                    // Keep-alive: UI updated silently, existing poller/repeat keeps running
                }
                is ParkingUiState.Loading -> {
                    stopWelcomeRepeat()
                    stopTellPoller()
                    // Stop audio only when going to payment app (ECR states)
                    if (!state.message.contains("Checking vehicle", ignoreCase = true)) {
                        ParkingAudio.stop()
                    }
                    btnLang.visibility = View.GONE
                    showLoading(true)
                    setButtons(false)
                    txtMessage.textSize        = 28f
                    txtInfo.textSize           = 16f
                    txtMessage.text            = state.message
                    txtInfo.text               = ""
                    txtSelectPrompt.visibility = View.GONE
                    cardInfo.visibility        = View.GONE
                    when {
                        state.message.contains("Pre-authorizing", ignoreCase = true)   -> ParkingAudio.tapCard(this)
                        state.message.contains("Card Validation", ignoreCase = true)   -> ParkingAudio.tapCard(this)
                        state.message.contains("Tap your card", ignoreCase = true)     -> ParkingAudio.tapCard(this)
                        state.message.contains("Reading your card", ignoreCase = true) -> ParkingAudio.readingCard(this)
                        state.message.contains("Reading monthly", ignoreCase = true)   -> ParkingAudio.readingCard(this)
                        state.message.contains("Checking vehicle", ignoreCase = true)  -> ParkingAudio.checkingVehicle(this)
                        else                                                          -> ParkingAudio.processing(this)
                    }
                }
                is ParkingUiState.ShowMessage -> {
                    stopWelcomeRepeat()
                    // Only stop TELL poller for real transaction states, not for "no vehicle" message
                    if (state.reinitOnDismiss || state.title.contains("No vehicle", ignoreCase = true).not()) {
                        stopTellPoller()
                    }
                    showLoading(false)
                    setButtons(false)
                    btnLang.visibility         = View.GONE
                    txtSelectPrompt.visibility = View.GONE
                    txtMessage.text = state.title
                    // Issue 2: Make amount message larger and more readable
                    if (state.title.contains("Amount Due", ignoreCase = true) ||
                        state.title.contains("Payment OK", ignoreCase = true) ||
                        state.title.contains("Thank you", ignoreCase = true)) {
                        txtMessage.textSize = 42f
                        txtInfo.textSize    = 22f  // body also larger for amount text
                    } else {
                        txtMessage.textSize = 28f
                        txtInfo.textSize    = 16f
                    }
                    txtInfo.text               = state.body
                    cardInfo.visibility        = if (state.body.isBlank()) View.GONE else View.VISIBLE
                    when {
                        state.title.contains("No vehicle", ignoreCase = true)                  -> { /* silent — no audio */ }
                        state.title.contains("Amount Due", ignoreCase = true)                  -> ParkingAudio.paymentRequired(this)
                        state.title.contains("Welcome", ignoreCase = true)                     -> ParkingAudio.thankYou(this)
                        state.title.contains("Thank you", ignoreCase = true)                   -> ParkingAudio.thankYou(this)
                        state.title.contains("Payment OK", ignoreCase = true)                  -> ParkingAudio.paymentOk(this)
                        state.title.contains("Payment required", ignoreCase = true)            -> ParkingAudio.paymentRequired(this)
                        state.title.contains("Problem with the Card", ignoreCase = true)       -> ParkingAudio.cardProblem(this)
                        state.title.contains("Technical Issue", ignoreCase = true)             -> ParkingAudio.technicalProblem(this)
                        state.title.contains("Technical", ignoreCase = true)                   -> ParkingAudio.technicalProblem(this)
                        state.title.contains("Connection", ignoreCase = true)                  -> ParkingAudio.connectionError(this)
                        state.title.contains("Configuration", ignoreCase = true)               -> ParkingAudio.configError(this)
                        state.title.contains("HELP", ignoreCase = true)                        -> ParkingAudio.helpCalled(this)
                        state.title.contains("contact staff", ignoreCase = true)               -> ParkingAudio.contactStaff(this)
                        else                                                             -> ParkingAudio.contactStaff(this)
                    }
                    if (!state.noDismiss && !state.dismissScheduled) {
                        state.dismissScheduled = true
                        handler.postDelayed({
                            if (state.reinitOnDismiss) {
                                resetLangToDefault()
                                val p = getSharedPreferences("APP_SETTINGS", MODE_PRIVATE)
                                val o = p.getString("outlet",   "") ?: ""
                                val t = p.getString("terminal", "") ?: ""
                                viewModel.init(o, t)
                            } else {
                                // Return to Idle silently — restart poller if needed
                                if (viewModel.hasTellConfig && tellPoller == null) {
                                    startTellPoller()
                                }
                                viewModel.returnToIdleNoReinit()
                            }
                        }, state.autoDismissSecs * 1000)
                    }
                }
                is ParkingUiState.ReturnToIdle -> {
                    resetLangToDefault()
                    val p = getSharedPreferences("APP_SETTINGS", MODE_PRIVATE)
                    val o = p.getString("outlet",   "") ?: ""
                    val t = p.getString("terminal", "") ?: ""
                    viewModel.init(o, t)
                }
                is ParkingUiState.LaunchMonthlyKeyIn -> {
                    ParkingAudio.stop()
                    showKeypad()
                }
                is ParkingUiState.LaunchMonthlyContactless -> {
                    ParkingAudio.stop()
                    showContactlessOverlay()
                }
            }
        }

        // ── Button listeners ──────────────────────────────────────────────────
        btnContinue.setOnClickListener {
            if (viewModel.busy) return@setOnClickListener
            AppLogger.logButton("BANK CARD")
            if (viewModel.mode == "ENTRANCE") viewModel.runEntranceFlow()
            else viewModel.runExitFlow()
        }

        btnMonthly.setOnClickListener {
            if (viewModel.busy) return@setOnClickListener
            AppLogger.logButton("MONTHLY")
            viewModel.runMonthlyFlow()
        }

        btnHelp.setOnClickListener {
            AppLogger.logButton("HELP")
            viewModel.runHelpFlow()
        }

        btnLang.setOnClickListener {
            if (viewModel.busy) return@setOnClickListener
            val options = Translations.ALL.map { "${it.flag}  ${it.code}" }.toTypedArray()
            android.app.AlertDialog.Builder(this)
                .setTitle("Select Language")
                .setItems(options) { _, which ->
                    applyLang(Translations.ALL[which])
                    // Save as user override — this takes priority over server defaultLanguage
                    getSharedPreferences("APP_SETTINGS", MODE_PRIVATE).edit()
                        .putString("lang_user_override", Translations.ALL[which].code)
                        .apply()
                    ParkingAudio.welcome(this, viewModel.mode == "EXIT")
                }
                .setOnDismissListener { hideSystemUI() }
                .show()
        }

        btnInfo.setOnClickListener {
            val sb = StringBuilder()
            if (viewModel.charges.isNotEmpty()) {
                sb.append("PARKING RATES\n\n")
                viewModel.charges.forEachIndexed { i, charge ->
                    val from = viewModel.formatMinutes(charge.fromMin)
                    val to   = if (charge.toMin != null) viewModel.formatMinutes(charge.toMin) else "..."
                    val fee  = "€%.2f".format(charge.feeCents / 100.0)
                    sb.append("  ${i + 1}. $from - $to  →  $fee\n")
                }
            }
            if (viewModel.helpPhone.isNotBlank()) {
                if (sb.isNotEmpty()) sb.append("\n")
                sb.append("HELP: ${viewModel.helpPhone}")
            }
            if (sb.isBlank()) return@setOnClickListener

            // Build bold SpannableString
            val spannable = android.text.SpannableString(sb.toString())
            spannable.setSpan(
                android.text.style.StyleSpan(android.graphics.Typeface.BOLD),
                0, sb.length,
                android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
            )
            val dialog = android.app.AlertDialog.Builder(this)
                .setTitle("Information")
                .setMessage(spannable)
                .setPositiveButton("OK", null)
                .setOnDismissListener { hideSystemUI() }
                .show()
            // Make dialog message text larger
            dialog.findViewById<android.widget.TextView>(android.R.id.message)?.textSize = 20f
            // Auto-dismiss after 10 seconds
            handler.postDelayed({ if (dialog.isShowing) dialog.dismiss() }, 10_000L)
        }

        btnSettings.visibility = View.GONE

        // 5 taps on the hidden zone between INFO and HELP within 3 seconds to open Settings
        val tapZone = findViewById<View>(R.id.tapZone)
        var tapCount = 0
        val tapResetHandler = Handler(Looper.getMainLooper())
        var tapResetRunnable: Runnable? = null
        tapZone.setOnClickListener {
            tapCount++
            tapResetRunnable?.let { tapResetHandler.removeCallbacks(it) }
            if (tapCount >= 5) {
                tapCount = 0
                startActivity(Intent(this, PinActivity::class.java))
            } else {
                tapResetRunnable = Runnable { tapCount = 0 }
                tapResetHandler.postDelayed(tapResetRunnable!!, 3000L)
            }
        }

        // ── Start ─────────────────────────────────────────────────────────────
        if (viewModel.uiState.value == null) {
            viewModel.init(outlet, terminal)
            viewModel.scheduleDailyInit()
        }
    }

    private fun setButtons(enabled: Boolean) {
        btnContinue.isEnabled = enabled
        btnMonthly.isEnabled  = enabled
        // HELP and INFO always remain enabled — driver must always be able to call for help
        btnHelp.isEnabled     = true
        btnInfo.isEnabled     = true
    }

    private fun showLoading(show: Boolean) {
        progress.visibility = if (show) View.VISIBLE else View.GONE
    }

    override fun onResume() {
        super.onResume()
        hideSystemUI()
        val prefs     = getSharedPreferences("APP_SETTINGS", MODE_PRIVATE)
        val showRates = prefs.getBoolean("show_rates", true)
        viewModel.showRates = showRates
        ParkingAudio.setEnabled(prefs.getBoolean("voice_enabled", true))
        // Re-apply default language when returning from Settings
        if (prefs.getBoolean("pending_reinit", false)) {
            resetLangToDefault()
        }

        // Re-init if Settings triggered a new init
        if (prefs.getBoolean("pending_reinit", false)) {
            prefs.edit().putBoolean("pending_reinit", false).apply()
            val outlet    = prefs.getString("outlet",     "") ?: ""
            val terminal  = prefs.getString("terminal",   "") ?: ""
            val serverUrl = prefs.getString("server_url", "") ?: ""
            val hmac      = buildHmacCredentials(prefs)
            viewModel.setup(EcrManager(this), serverUrl, showRates, hmac)
            viewModel.init(outlet, terminal)
            return
        }

        val currentState = viewModel.uiState.value
        if (currentState is ParkingUiState.Idle) {
            viewModel.uiState.value = currentState.copy(
                infoText = viewModel.buildInfoText()
            )
        }
    }

    // ── Monthly keypad helpers ─────────────────────────────────────────────────
    private val KEYPAD_TIMEOUT_MS = 30_000L
    private var keypadTimeoutRunnable: Runnable? = null

    private fun showKeypad() {
        keypadInput.clear()
        updateKeypadDisplay()
        txtKeypadPrompt.text = "Enter Monthly Card Number"
        txtKeypadPrompt.setTextColor(0xFFFFFFFF.toInt())
        viewModel.cancelBusySafetyTimer()
        keypadOverlay.visibility = View.VISIBLE
        keypadTimeoutRunnable?.let { handler.removeCallbacks(it) }
        keypadTimeoutRunnable = Runnable {
            AppLogger.logRequest("MONTHLY_KEYIN", "Timeout — no input")
            hideKeypad()
            viewModel.busy = false
            viewModel.returnToIdleNoReinit()
        }
        handler.postDelayed(keypadTimeoutRunnable!!, KEYPAD_TIMEOUT_MS)
    }

    private fun hideKeypad() {
        keypadOverlay.visibility = View.GONE
        keypadInput.clear()
        keypadTimeoutRunnable?.let { handler.removeCallbacks(it) }
        keypadTimeoutRunnable = null
    }

    private fun onKeypadKey(key: String) {
        // Reset timeout on every key press
        keypadTimeoutRunnable?.let { handler.removeCallbacks(it) }
        handler.postDelayed(keypadTimeoutRunnable!!, KEYPAD_TIMEOUT_MS)
        when (key) {
            "⌫"  -> {
                if (keypadInput.isNotEmpty()) keypadInput.deleteCharAt(keypadInput.length - 1)
                updateKeypadDisplay()
            }
            "OK" -> {
                if (keypadInput.length == KEYPAD_MAX) submitKeypad()
                else {
                    txtKeypadPrompt.text = "Please enter all $KEYPAD_MAX digits"
                    txtKeypadPrompt.setTextColor(0xFFFF4444.toInt())
                    handler.postDelayed({
                        txtKeypadPrompt.text = "Enter Monthly Card Number"
                        txtKeypadPrompt.setTextColor(0xFFFFFFFF.toInt())
                    }, 1500)
                }
            }
            else -> {
                if (keypadInput.length < KEYPAD_MAX) {
                    keypadInput.append(key)
                    updateKeypadDisplay()
                    if (keypadInput.length == KEYPAD_MAX) submitKeypad()
                }
            }
        }
    }

    private fun updateKeypadDisplay() {
        // Show actual digit briefly then mask to ●
        val display = (0 until KEYPAD_MAX).map { i ->
            if (i < keypadInput.length - 1) "●"
            else if (i == keypadInput.length - 1) keypadInput[i].toString()
            else "_"
        }.joinToString(" ")
        txtKeypadDisplay.text = display
        // Mask last digit after 500ms
        handler.postDelayed({
            val masked = (0 until KEYPAD_MAX).map { i ->
                if (i < keypadInput.length) "●" else "_"
            }.joinToString(" ")
            txtKeypadDisplay.text = masked
        }, 500)
    }

    private fun submitKeypad() {
        val card = keypadInput.toString()
        AppLogger.logRequest("MONTHLY_KEYIN", "Card entered: ${card.length} digits")
        hideKeypad()
        viewModel.runMonthlyKeyInFlow(card)
    }

    // ── Contactless monthly overlay ────────────────────────────────────────────
    private fun showContactlessOverlay() {
        txtContactlessPrompt.text = "Monthly Card — Contactless"
        txtContactlessStatus.text = "Please tap your monthly card\non the contactless reader"
        txtContactlessStatus.setTextColor(0xFFFFFFFF.toInt())
        progressContactless.visibility = View.VISIBLE
        contactlessOverlay.visibility  = View.VISIBLE

        // Safety timeout — auto-cancel if no card tapped
        contactlessTimeoutRunnable?.let { handler.removeCallbacks(it) }
        contactlessTimeoutRunnable = Runnable {
            AppLogger.logRequest("CONTACTLESS", "Timeout — no card tapped within ${CONTACTLESS_TIMEOUT_MS}ms")
            hideContactlessOverlay()
            viewModel.busy = false
            viewModel.returnToIdleNoReinit()
        }
        handler.postDelayed(contactlessTimeoutRunnable!!, CONTACTLESS_TIMEOUT_MS)

        // Start background CtCL reader thread
        contactlessThread?.interrupt()
        contactlessThread = Thread {
            AppLogger.logRequest("CONTACTLESS", "Reader thread started")
            // Leave 500ms buffer before the UI timeout fires
            val uid = ContactlessMonthlyReader().readUid(CONTACTLESS_TIMEOUT_MS - 500)
            handler.post {
                // Guard: overlay may have been cancelled by user before we got here
                if (contactlessOverlay.visibility != View.VISIBLE) return@post
                if (uid != null) {
                    // Card read successfully
                    progressContactless.visibility = View.GONE
                    txtContactlessStatus.text = "Card detected ✓"
                    txtContactlessStatus.setTextColor(0xFF4CAF50.toInt())
                    AppLogger.logRequest("CONTACTLESS", "UID=$uid — submitting")
                    handler.postDelayed({
                        hideContactlessOverlay()
                        viewModel.runMonthlyKeyInFlow(uid)
                    }, 600)
                } else {
                    // Timeout or hardware error
                    progressContactless.visibility = View.GONE
                    txtContactlessStatus.text = "No card detected.\nPlease try again."
                    txtContactlessStatus.setTextColor(0xFFFF4444.toInt())
                    AppLogger.logRequest("CONTACTLESS", "No UID — returning to idle")
                    handler.postDelayed({
                        hideContactlessOverlay()
                        viewModel.busy = false
                        viewModel.returnToIdleNoReinit()
                    }, 2_000)
                }
            }
        }
        contactlessThread!!.start()
    }

    private fun hideContactlessOverlay() {
        contactlessOverlay.visibility = View.GONE
        contactlessTimeoutRunnable?.let { handler.removeCallbacks(it) }
        contactlessTimeoutRunnable = null
        contactlessThread?.interrupt()
        contactlessThread = null
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        stopWelcomeRepeat()
        stopTellPoller()
        hideContactlessOverlay()
        ParkingAudio.stop()
        if (::viewModel.isInitialized) {
            viewModel.ecrManager.unregisterReceiver()
        }
    }

    /**
     * Returns [HmacCredentials] when HMAC is enabled in Settings and both
     * clientId and secret are non-blank — otherwise null (no signing).
     */
    private fun buildHmacCredentials(
        prefs: android.content.SharedPreferences
    ): HmacCredentials? {
        if (!prefs.getBoolean("hmac_enabled", false)) return null
        val clientId = prefs.getString("hmac_client_id", "") ?: ""
        val secret   = prefs.getString("hmac_secret",    "") ?: ""
        if (clientId.isBlank() || secret.isBlank()) return null
        return HmacCredentials(clientId, secret)
    }
}