package com.parking.app

import android.content.Intent
import android.os.Bundle
import android.os.CountDownTimer
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class PinActivity : AppCompatActivity() {

    private val PIN             = "7746832"
    private val TIMEOUT_MS      = 30_000L  // 30 seconds — auto close if no PIN entered
    private var countDownTimer: CountDownTimer? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_pin)
        ParkingAudio.stop()

        val edtPin   = findViewById<EditText>(R.id.edtPin)
        val btn      = findViewById<Button>(R.id.btnEnter)
        val txtError = findViewById<TextView>(R.id.txtError)

        btn.setOnClickListener {
            if (edtPin.text.toString() == PIN) {
                countDownTimer?.cancel()
                startActivity(Intent(this, SettingsActivity::class.java))
                finish()
            } else {
                txtError.text = "Wrong PIN"
            }
        }

        // Auto-dismiss after timeout — return to main screen
        startTimeout(txtError)
    }

    private fun startTimeout(txtError: TextView) {
        countDownTimer = object : CountDownTimer(TIMEOUT_MS, 1000) {
            override fun onTick(millisUntilFinished: Long) {
                val secs = millisUntilFinished / 1000
                txtError.text = "Auto-closing in ${secs}s"
            }
            override fun onFinish() {
                AppLogger.logRequest("PIN", "Timeout — returning to main screen")
                finish()  // close PIN screen — MainActivity comes back to front
            }
        }.start()
    }

    override fun onDestroy() {
        super.onDestroy()
        countDownTimer?.cancel()
    }
}