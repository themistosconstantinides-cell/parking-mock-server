package com.parking.app

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.ViewModelProvider
import com.parking.app.viewmodel.ParkingUiState
import com.parking.app.viewmodel.ParkingViewModel

// Simple data class for a charge tier
data class ParkingCharge(
    val fromMin: Int,
    val toMin: Int?,
    val feeCents: Int
)

class MainActivity : AppCompatActivity() {

    private lateinit var txtMessage: TextView
    private lateinit var txtInfo: TextView
    private lateinit var progress: ProgressBar
    private lateinit var btnContinue: Button
    private lateinit var btnMonthly: Button
    private lateinit var btnHelp: Button
    private lateinit var btnSettings: ImageView
    private lateinit var cardInfo: android.view.ViewGroup
    private lateinit var btnMonthlyWrap: android.view.ViewGroup
    private lateinit var txtSelectPrompt: android.widget.TextView

    lateinit var viewModel: ParkingViewModel
    private val handler = Handler(Looper.getMainLooper())



    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        AppLogger.init(this)
        setContentView(R.layout.activity_main)

        txtMessage  = findViewById(R.id.txtMessage)
        txtInfo     = findViewById(R.id.txtInfo)
        progress    = findViewById(R.id.progress)
        btnContinue = findViewById(R.id.btnContinue)
        btnMonthly  = findViewById(R.id.btnMonthly)
        btnHelp     = findViewById(R.id.btnHelp)
        btnSettings = findViewById(R.id.btnSettings)
        cardInfo        = findViewById(R.id.cardInfo)
        btnMonthlyWrap  = findViewById(R.id.btnMonthlyWrap)
        txtSelectPrompt = findViewById(R.id.txtSelectPrompt)

        // ── ViewModel setup ───────────────────────────────────────────────────
        viewModel = ViewModelProvider(this)[ParkingViewModel::class.java]

        val prefs     = getSharedPreferences("APP_SETTINGS", MODE_PRIVATE)
        val outlet    = prefs.getString("outlet",     "0000259010")   ?: "0000259010"
        val terminal  = prefs.getString("terminal",   "000025901025") ?: "000025901025"
        val serverUrl = prefs.getString("server_url", "")             ?: ""
        val showRates = (prefs.getString("ecr_port",  "1") ?: "1") != "0"

        viewModel.setup(EcrManager(this), serverUrl, showRates)

        // ── Observe UI state ──────────────────────────────────────────────────
        viewModel.uiState.observe(this) { state ->
            when (state) {
                is ParkingUiState.Idle -> {
                    showLoading(false)
                    setButtons(true)
                    txtMessage.text = state.message
                    txtInfo.text    = state.infoText
                    cardInfo.visibility       = if (state.infoText.isBlank()) View.GONE else View.VISIBLE
                    btnMonthlyWrap.visibility  = if (state.showMonthly) View.VISIBLE else View.GONE
                    btnMonthly.visibility      = if (state.showMonthly) View.VISIBLE else View.GONE
                    txtSelectPrompt.text       = if (state.showMonthly) "Select to continue" else "Tap to continue"
                    txtSelectPrompt.visibility = View.VISIBLE
                }
                is ParkingUiState.Loading -> {
                    showLoading(true)
                    setButtons(false)
                    txtMessage.text = state.message
                    txtInfo.text    = ""
                    txtSelectPrompt.visibility = View.GONE
                }
                is ParkingUiState.ShowMessage -> {
                    showLoading(false)
                    setButtons(false)
                    txtMessage.text = state.title
                    txtInfo.text    = state.body
                    // Auto return to idle — only schedule if not already scheduled
                    if (!state.dismissScheduled) {
                        state.dismissScheduled = true
                        handler.postDelayed({
                            viewModel.init(outlet, terminal)
                        }, state.autoDismissSecs * 1000)
                    }
                }
                is ParkingUiState.ReturnToIdle -> {
                    viewModel.init(outlet, terminal)
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

        btnSettings.setOnClickListener {
            startActivity(Intent(this, PinActivity::class.java))
        }

        // ── Start ─────────────────────────────────────────────────────────────
        instance = this
        // Only init if ViewModel has no data yet (first start)
        // Prevents duplicate init calls on activity recreation
        if (viewModel.uiState.value == null) {
            viewModel.init(outlet, terminal)
            viewModel.scheduleDailyInit()
        }
    }

    private fun setButtons(enabled: Boolean) {
        btnContinue.isEnabled = enabled
        btnMonthly.isEnabled  = enabled
        btnHelp.isEnabled     = enabled
    }

    private fun showLoading(show: Boolean) {
        progress.visibility = if (show) View.VISIBLE else View.GONE
    }

    override fun onResume() {
        super.onResume()
        // Refresh showRates when returning from Settings
        val prefs     = getSharedPreferences("APP_SETTINGS", MODE_PRIVATE)
        val showRates = (prefs.getString("ecr_port", "1") ?: "1") != "0"
        if (viewModel.showRates != showRates) {
            AppLogger.logRequest("MAIN", "showRates changed to $showRates — refreshing display")
            viewModel.showRates = showRates
            // Rebuild info text with new showRates
            val currentState = viewModel.uiState.value
            if (currentState is com.parking.app.viewmodel.ParkingUiState.Idle) {
                viewModel.uiState.value = currentState.copy(
                    infoText = viewModel.buildInfoText()
                )
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        viewModel.ecrManager.unregisterReceiver()
        instance = null
    }

    companion object {
        var instance: MainActivity? = null
    }
}