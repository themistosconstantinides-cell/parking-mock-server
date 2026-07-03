package com.parking.app

import android.content.Context
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.ToneGenerator
import android.os.Handler
import android.os.Looper

/**
 * Plays pre-recorded audio files from res/raw/.
 * Supports EN, EL, RU, IW languages.
 * English files: welcome.mp3
 * Other languages: el_welcome.mp3, ru_welcome.mp3, iw_welcome.mp3
 */
object ParkingAudio {

    private var player: MediaPlayer? = null
    private var enabled = true
    var currentLang = "en"  // set by MainActivity based on selected language

    fun setEnabled(value: Boolean) {
        enabled = value
        if (!value) stop()
    }

    private fun resId(context: Context, name: String): Int {
        val prefixed = if (currentLang == "en") name else "${currentLang}_$name"
        val id = context.resources.getIdentifier(prefixed, "raw", context.packageName)
        if (id == 0) {
            AppLogger.logError("AUDIO", "Missing file: $prefixed — falling back to EN")
            return context.resources.getIdentifier(name, "raw", context.packageName)
        }
        return id
    }

    fun play(context: Context, name: String) {
        if (!enabled) return   // silent skip — no log spam when voice is disabled
        playInternal(context, name)
    }

    private fun playInternal(context: Context, name: String) {
        val id = resId(context, name)
        if (id == 0) {
            AppLogger.logError("AUDIO", "File not found: $name")
            return
        }
        try {
            stop()
            AppLogger.logRequest("AUDIO", "playing ${if (currentLang == "en") name else "${currentLang}_$name"}.mp3")
            val mp = MediaPlayer.create(context, id)
            if (mp == null) {
                AppLogger.logError("AUDIO", "MediaPlayer.create returned null for $name")
                return
            }
            mp.setOnCompletionListener { it.release(); player = null }
            mp.start()
            player = mp
        } catch (e: Exception) {
            AppLogger.logError("AUDIO", "Playback error: ${e.message}")
        }
    }

    /**
     * Short confirmation beep — plays regardless of voice enabled state.
     * Used for hardware card-read feedback (monthly card detected).
     */
    fun beep() {
        try {
            val tg = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 90)
            tg.startTone(ToneGenerator.TONE_PROP_BEEP, 180)
            Handler(Looper.getMainLooper()).postDelayed({ tg.release() }, 300)
        } catch (e: Exception) {
            AppLogger.logError("AUDIO", "Beep error: ${e.message}")
        }
    }

    fun stop() {
        try {
            player?.stop()
            player?.release()
        } catch (_: Exception) {}
        player = null
    }

    // ── All audio — respects voice assistant setting ──────────────────────────
    fun welcome(context: Context, isExit: Boolean)  = play(context, if (isExit) "exit_welcome" else "welcome")
    fun tapCard(context: Context)                   = play(context, "tap_card")
    fun readingCard(context: Context)               = play(context, "reading_card")
    fun processing(context: Context)                = play(context, "processing")
    fun thankYou(context: Context)                  = play(context, "thank_you")
    fun paymentRequired(context: Context)           = play(context, "payment_required")
    fun paymentOk(context: Context)                 = play(context, "payment_ok")
    fun checkingVehicle(context: Context)           = play(context, "checking_vehicle")
    fun cardProblem(context: Context)               = play(context, "card_problem")
    fun technicalProblem(context: Context)          = play(context, "technical_problem")
    fun contactStaff(context: Context)              = play(context, "contact_staff")
    fun connectionError(context: Context)           = play(context, "connection_error")
    fun helpCalled(context: Context)                = play(context, "help")
    fun configError(context: Context)               = play(context, "config_error")
}