package com.parking.app

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.Button
import android.widget.RadioButton
import android.widget.RadioGroup
import androidx.appcompat.widget.SwitchCompat
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.parking.app.api.real.RetrofitRpsApi
import org.json.JSONObject
import com.parking.app.HmacCredentials

class SettingsActivity : AppCompatActivity() {

    private lateinit var edtOutlet:       EditText
    private lateinit var edtTerminal:     EditText
    private lateinit var edtUrl:          EditText
    private lateinit var edtTellInterval: EditText
    private lateinit var edtHmacClientId: EditText
    private lateinit var edtHmacSecret:   EditText
    private lateinit var btnSave:         Button
    private lateinit var btnInit:         Button
    private lateinit var btnContinue:     Button
    private lateinit var btnLogs:         Button
    private lateinit var btnVoice:        SwitchCompat
    private lateinit var btnHmac:         SwitchCompat
    private lateinit var btnShowRates:    SwitchCompat
    private lateinit var txtInitStatus:  TextView
    private lateinit var progressInit:   ProgressBar
    private lateinit var rgMonthlyMethod: RadioGroup
    private lateinit var rbKeyIn:         RadioButton
    private lateinit var rbContactless:   RadioButton

    private lateinit var prefs: android.content.SharedPreferences
    private val handler       = Handler(Looper.getMainLooper())
    private val INACTIVITY_MS = 5 * 60 * 1000L
    private var inactivityRunnable: Runnable? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        edtOutlet        = findViewById(R.id.edtOutlet)
        edtTerminal      = findViewById(R.id.edtTerminal)
        edtUrl           = findViewById(R.id.edtUrl)
        edtHmacClientId  = findViewById(R.id.edtHmacClientId)
        edtHmacSecret    = findViewById(R.id.edtHmacSecret)
        btnSave          = findViewById(R.id.btnSave)
        btnInit          = findViewById(R.id.btnInit)
        btnContinue      = findViewById(R.id.btnContinue)
        btnLogs          = findViewById(R.id.btnLogs)
        btnVoice         = findViewById(R.id.btnVoice)
        btnHmac          = findViewById(R.id.btnHmac)
        btnShowRates     = findViewById(R.id.btnShowRates)
        edtTellInterval  = findViewById(R.id.edtTellInterval)
        txtInitStatus    = findViewById(R.id.txtInitStatus)
        progressInit     = findViewById(R.id.progressInit)
        rgMonthlyMethod  = findViewById(R.id.rgMonthlyMethod)
        rbKeyIn          = findViewById(R.id.rbKeyIn)
        rbContactless    = findViewById(R.id.rbContactless)

        prefs = getSharedPreferences("APP_SETTINGS", MODE_PRIVATE)
        ParkingAudio.stop()  // stop any playing audio when entering settings
        startInactivityTimer()

        // Load saved values
        edtOutlet.setText(prefs.getString("outlet",          ""))
        edtTerminal.setText(prefs.getString("terminal",      ""))
        edtUrl.setText(prefs.getString("server_url",         ""))
        edtTellInterval.setText(prefs.getInt("tell_interval_sec", 3).toString())
        btnShowRates.isChecked = prefs.getBoolean("show_rates", true)

        // Load saved monthly input method
        val savedMethod = prefs.getString("monthly_input_method", "keyin")
        if (savedMethod == "contactless") rbContactless.isChecked = true else rbKeyIn.isChecked = true
        // Dev defaults — overwrite with real credentials for each production terminal
        val savedClientId = prefs.getString("hmac_client_id", "") ?: ""
        val savedSecret   = prefs.getString("hmac_secret",    "") ?: ""
        val displayClientId = if (savedClientId.isNotBlank()) savedClientId else "MarinaParking-T01"
        val displaySecret   = if (savedSecret.isNotBlank()) savedSecret
            else "Y2hhbmdlbWUtZGV2LXNoYXJlZC1obWFjLWtleS0wMDAwMDAwMDAwMDAwMDA="
        edtHmacClientId.setText(displayClientId)
        edtHmacSecret.setText(displaySecret)
        // Persist defaults immediately so updateHmacButton() never sees blank prefs
        // and incorrectly force-disables hmac_enabled on every Settings open.
        if (savedClientId.isBlank() || savedSecret.isBlank()) {
            prefs.edit()
                .putString("hmac_client_id", displayClientId)
                .putString("hmac_secret",    displaySecret)
                .apply()
        }

        // Disable Continue if outlet/terminal not configured
        val savedOutlet   = prefs.getString("outlet",   "") ?: ""
        val savedTerminal = prefs.getString("terminal", "") ?: ""
        btnContinue.isEnabled = savedOutlet.isNotBlank() && savedTerminal.isNotBlank()

        // Save
        btnSave.setOnClickListener {
            val outlet   = edtOutlet.text.toString().trim()
            val terminal = edtTerminal.text.toString().trim()
            if (outlet.isBlank() || terminal.isBlank()) {
                Toast.makeText(this, "Outlet and Terminal are required", Toast.LENGTH_SHORT).show()
                btnContinue.isEnabled = false
                return@setOnClickListener
            }
            val tellInterval  = edtTellInterval.text.toString().trim().toIntOrNull()?.coerceIn(1, 60) ?: 3
            val monthlyMethod = if (rbContactless.isChecked) "contactless" else "keyin"
            prefs.edit()
                .putString("outlet",                outlet)
                .putString("terminal",              terminal)
                .putString("server_url",            edtUrl.text.toString().trim())
                .putBoolean("show_rates",           btnShowRates.isChecked)
                .putInt("tell_interval_sec",        tellInterval)
                .putString("hmac_client_id",        edtHmacClientId.text.toString().trim())
                .putString("hmac_secret",           edtHmacSecret.text.toString().trim())
                .putString("monthly_input_method",  monthlyMethod)
                .apply()
            Toast.makeText(this, "Settings saved", Toast.LENGTH_SHORT).show()
            showStatus("", isError = false)
            updateHmacButton()   // refresh button state after save
            btnContinue.isEnabled = true
        }

        // Init
        btnInit.setOnClickListener {
            val outlet    = edtOutlet.text.toString().trim()
            val terminal  = edtTerminal.text.toString().trim()
            val serverUrl = edtUrl.text.toString().trim()

            if (outlet.isBlank() || terminal.isBlank()) {
                showStatus("Outlet and Terminal are required", isError = true)
                return@setOnClickListener
            }

            AppLogger.logButton("INIT")
            setInitRunning(true)
            showStatus("Connecting to server...", isError = false)

            val hmac = buildHmacCredentials()
            if (serverUrl.isBlank()) {
                showStatus("Server URL is required", isError = true)
                setInitRunning(false)
                return@setOnClickListener
            }
            val api = RetrofitRpsApi(serverUrl, hmac)

            Thread {
                AppLogger.logRequest("INIT", "Manual init from Settings — outlet=$outlet terminal=$terminal")
                api.parkingInit(outlet, terminal) { res ->
                    AppLogger.logResponse("INIT", res)
                    runOnUiThread {
                        setInitRunning(false)
                        handleInitResponse(res, outlet)
                    }
                }
            }.start()
        }

        // Continue
        btnContinue.setOnClickListener { finish() }

        // Voice toggle
        btnVoice.isChecked = prefs.getBoolean("voice_enabled", true)
        btnVoice.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean("voice_enabled", isChecked).apply()
            ParkingAudio.setEnabled(isChecked)
        }

        // HMAC toggle — ON only when clientId + secret are both non-blank
        updateHmacButton()
        btnHmac.setOnCheckedChangeListener { _, isChecked ->
            val clientId = edtHmacClientId.text.toString().trim()
            val secret   = edtHmacSecret.text.toString().trim()
            if (isChecked && (clientId.isBlank() || secret.isBlank())) {
                Toast.makeText(this, "Enter HMAC Client ID and Secret first, then Save", Toast.LENGTH_LONG).show()
                btnHmac.isChecked = false
                return@setOnCheckedChangeListener
            }
            prefs.edit().putBoolean("hmac_enabled", isChecked).apply()
        }

        // View logs
        btnLogs.setOnClickListener {
            startActivity(Intent(this, LogViewerActivity::class.java))
        }
    }

    private fun handleInitResponse(res: String, outlet: String) {
        try {
            val json = JSONObject(res)
            val code = json.optString("responseCode", "99")
            if (code == "00") {
                showStatus("✓ Init successful — outlet=$outlet", isError = false)
                btnContinue.isEnabled = true
                // Signal MainActivity to re-init when it resumes
                prefs.edit().putBoolean("pending_reinit", true).apply()
                AppLogger.logRequest("INIT", "Success — main screen updated showRates=${prefs.getBoolean("show_rates", true)}")
            } else {
                val errorMsg = rpsErrorDescription(code)
                showStatus("✗ $errorMsg", isError = true)
                btnContinue.isEnabled = false
                AppLogger.logError("INIT", "Failed: $code — $errorMsg")
            }
        } catch (e: Exception) {
            showStatus("✗ Network error — check server URL", isError = true)
            btnContinue.isEnabled = false
            AppLogger.logError("INIT", "Exception: ${e.message}")
        }
    }

    private fun showStatus(msg: String, isError: Boolean) {
        txtInitStatus.text = msg
        txtInitStatus.setTextColor(
            if (isError) android.graphics.Color.RED
            else android.graphics.Color.parseColor("#2E7D32")
        )
        txtInitStatus.visibility = if (msg.isBlank()) View.GONE else View.VISIBLE
    }

    private fun setInitRunning(running: Boolean) {
        progressInit.visibility = if (running) View.VISIBLE else View.GONE
        btnInit.isEnabled       = !running
        btnSave.isEnabled       = !running
        btnContinue.isEnabled   = !running
    }

    private fun rpsErrorDescription(code: String): String = when (code) {
        "91" -> "Invalid Outlet Number — check Settings"
        "92" -> "Invalid Company Code — contact support"
        "93" -> "Invalid Application — contact support"
        "08" -> "Technical issue on server — please wait"
        "99" -> "Network error — check server URL"
        else -> "Server error: $code — contact support"
    }

    override fun dispatchTouchEvent(ev: android.view.MotionEvent): Boolean {
        resetInactivityTimer()
        return super.dispatchTouchEvent(ev)
    }

    private fun startInactivityTimer() {
        inactivityRunnable = Runnable {
            AppLogger.logRequest("SETTINGS", "Inactivity timeout — closing Settings")
            finish()
        }
        handler.postDelayed(inactivityRunnable!!, INACTIVITY_MS)
    }

    private fun resetInactivityTimer() {
        inactivityRunnable?.let { handler.removeCallbacks(it) }
        startInactivityTimer()
    }

    override fun onDestroy() {
        super.onDestroy()
        inactivityRunnable?.let { handler.removeCallbacks(it) }
    }

    private fun updateVoiceLabel() {
        btnVoice.isChecked = prefs.getBoolean("voice_enabled", true)
    }

    /**
     * Refresh the HMAC toggle button label and colour.
     * Green = HMAC ON (every request is signed).
     * Red   = HMAC OFF (no Authorization header sent — use for dev/mock).
     * The button is disabled (greyed) when clientId or secret is blank, because
     * enabling HMAC without credentials would immediately cause 401 on every call.
     */
    private fun updateHmacButton() {
        val clientId = prefs.getString("hmac_client_id", "") ?: ""
        val secret   = prefs.getString("hmac_secret",    "") ?: ""
        val hasCredentials = clientId.isNotBlank() && secret.isNotBlank()
        val enabled = prefs.getBoolean("hmac_enabled", false) && hasCredentials

        if (!hasCredentials) {
            prefs.edit().putBoolean("hmac_enabled", false).apply()
        }

        btnHmac.isChecked = enabled
        btnHmac.isEnabled = hasCredentials
    }

    /**
     * Returns [HmacCredentials] if HMAC is enabled and credentials are saved,
     * or null if HMAC is off (no header will be sent).
     */
    private fun buildHmacCredentials(): HmacCredentials? {
        if (!prefs.getBoolean("hmac_enabled", false)) return null
        val clientId = prefs.getString("hmac_client_id", "") ?: ""
        val secret   = prefs.getString("hmac_secret",    "") ?: ""
        if (clientId.isBlank() || secret.isBlank()) return null
        return HmacCredentials(clientId, secret)
    }

}