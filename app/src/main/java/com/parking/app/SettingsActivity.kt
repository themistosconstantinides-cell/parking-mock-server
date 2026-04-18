package com.parking.app

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.parking.app.api.mock.MockRpsApi
import com.parking.app.api.real.RetrofitRpsApi
import org.json.JSONObject

class SettingsActivity : AppCompatActivity() {

    private lateinit var edtOutlet: EditText
    private lateinit var edtTerminal: EditText
    private lateinit var edtUrl: EditText
    private lateinit var edtPort: EditText
    private lateinit var btnSave: Button
    private lateinit var btnInit: Button
    private lateinit var btnContinue: Button
    private lateinit var btnLogs: Button
    private lateinit var btnExitScenario: Button
    private lateinit var txtInitStatus: TextView
    private lateinit var progressInit: ProgressBar

    private lateinit var prefs: android.content.SharedPreferences
    private val handler             = Handler(Looper.getMainLooper())
    private val INACTIVITY_MS       = 5 * 60 * 1000L  // 5 minutes
    private var inactivityRunnable: Runnable? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        edtOutlet       = findViewById(R.id.edtOutlet)
        edtTerminal     = findViewById(R.id.edtTerminal)
        edtUrl          = findViewById(R.id.edtUrl)
        edtPort         = findViewById(R.id.edtPort)
        btnSave         = findViewById(R.id.btnSave)
        btnInit         = findViewById(R.id.btnInit)
        btnContinue     = findViewById(R.id.btnContinue)
        btnLogs         = findViewById(R.id.btnLogs)
        btnExitScenario = findViewById(R.id.btnExitScenario)
        txtInitStatus   = findViewById(R.id.txtInitStatus)
        progressInit    = findViewById(R.id.progressInit)

        prefs = getSharedPreferences("APP_SETTINGS", MODE_PRIVATE)
        startInactivityTimer()

        // Load saved values
        edtOutlet.setText(prefs.getString("outlet",     ""))
        edtTerminal.setText(prefs.getString("terminal", ""))
        edtUrl.setText(prefs.getString("server_url",    ""))
        edtPort.setText(prefs.getString("ecr_port",     ""))

        // Save settings
        btnSave.setOnClickListener {
            val outlet   = edtOutlet.text.toString().trim()
            val terminal = edtTerminal.text.toString().trim()
            if (outlet.isBlank() || terminal.isBlank()) {
                Toast.makeText(this, "Outlet and Terminal are required", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            prefs.edit()
                .putString("outlet",     outlet)
                .putString("terminal",   terminal)
                .putString("server_url", edtUrl.text.toString().trim())
                .putString("ecr_port",   edtPort.text.toString().trim())
                .apply()
            Toast.makeText(this, "Settings saved", Toast.LENGTH_SHORT).show()
            showStatus("", isError = false)
        }

        // Init — call RPS directly from Settings and show result here
        btnInit.setOnClickListener {
            val outlet   = edtOutlet.text.toString().trim()
            val terminal = edtTerminal.text.toString().trim()
            val serverUrl = edtUrl.text.toString().trim()

            if (outlet.isBlank() || terminal.isBlank()) {
                showStatus("Outlet and Terminal are required", isError = true)
                return@setOnClickListener
            }

            AppLogger.logButton("INIT")
            setInitRunning(true)
            showStatus("Connecting to server...", isError = false)

            // Choose API — mock if no URL, real if URL set
            val api = if (serverUrl.isBlank()) MockRpsApi() else RetrofitRpsApi(serverUrl)

            Thread {
                AppLogger.logRequest("INIT", "Manual init from Settings — outlet=$outlet terminal=$terminal")
                api.parkingInit(outlet, terminal) { res ->
                    AppLogger.logResponse("INIT", res)
                    runOnUiThread {
                        setInitRunning(false)
                        handleInitResponse(res, outlet, terminal)
                    }
                }
            }.start()
        }

        // Continue → go back to existing MainActivity (don't create new one)
        btnContinue.setOnClickListener {
            finish()  // just close Settings — MainActivity is still in backstack
        }

        // Exit scenario toggle
        updateExitScenarioLabel(btnExitScenario)
        btnExitScenario.setOnClickListener {
            MockBackend.exitScenario = (MockBackend.exitScenario % 4) + 1
            updateExitScenarioLabel(btnExitScenario)
        }

        // Vehicle present toggle
        val btnVehicle = findViewById<Button>(R.id.btnVehiclePresent)
        updateVehicleLabel(btnVehicle)
        btnVehicle.setOnClickListener {
            MockBackend.simulateVehiclePresent = !MockBackend.simulateVehiclePresent
            updateVehicleLabel(btnVehicle)
        }

        // View logs
        btnLogs.setOnClickListener {
            startActivity(Intent(this, LogViewerActivity::class.java))
        }
    }

    private fun handleInitResponse(res: String, outlet: String, terminal: String) {
        try {
            val json = JSONObject(res)
            val code = json.optString("responseCode", "99")

            if (code == "00") {
                // Success — update showRates and refresh main screen
                showStatus("✓ Init successful — outlet=$outlet", isError = false)
                btnContinue.isEnabled = true
                val showRates = (prefs.getString("ecr_port", "1") ?: "1") != "0"
                val main = MainActivity.instance
                if (main != null) {
                    main.viewModel.showRates = showRates
                    main.runOnUiThread { main.viewModel.applyInitResponse(res) }
                    AppLogger.logRequest("INIT", "Success — main screen updated showRates=$showRates")
                } else {
                    AppLogger.logRequest("INIT", "Success — MainActivity not running, will apply on next start")
                }
            } else {
                // Error — show message, stay on Settings screen
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

    // Reset inactivity timer on any touch
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

    private fun updateVehicleLabel(btn: Button) {
        btn.text = if (MockBackend.simulateVehiclePresent)
            "VEHICLE PRESENT: YES"
        else
            "VEHICLE PRESENT: NO"
        btn.backgroundTintList = android.content.res.ColorStateList.valueOf(
            if (MockBackend.simulateVehiclePresent)
                android.graphics.Color.parseColor("#238636")
            else
                android.graphics.Color.parseColor("#C62828")
        )
    }

    private fun updateExitScenarioLabel(btn: Button) {
        btn.text = when (MockBackend.exitScenario) {
            1 -> "EXIT SCENARIO: 1 - Free"
            2 -> "EXIT SCENARIO: 2 - Capture Only"
            3 -> "EXIT SCENARIO: 3 - TopUp Needed"
            4 -> "EXIT SCENARIO: 4 - Barrier Failed"
            else -> "EXIT SCENARIO: ${MockBackend.exitScenario}"
        }
    }
}