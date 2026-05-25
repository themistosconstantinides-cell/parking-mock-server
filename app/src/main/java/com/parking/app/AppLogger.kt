package com.parking.app

import android.content.Context
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

object AppLogger {

    private const val TAG = "PARKING_APP"
    private lateinit var logFile: File

    fun init(context: Context) {
        val dir = File(context.filesDir, "logs")
        if (!dir.exists()) dir.mkdirs()

        val date = SimpleDateFormat("yyyyMMdd", Locale.getDefault()).format(Date())
        logFile = File(dir, "log_$date.txt")
    }

    private fun write(text: String) {
        try {
            logFile.appendText(text + "\n")
        } catch (e: Exception) {
            Log.e(TAG, "File log error")
        }
    }

    private fun now(): String {
        return SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
    }

    fun logButton(btn: String) {
        val msg = "${now()} | BUTTON | $btn"
        Log.d(TAG, msg)
        write(msg)
    }

    fun logRequest(type: String, msg: String) {
        val text = "${now()} | REQUEST [$type] | $msg"
        Log.d(TAG, text)
        write(text)
    }

    fun logResponse(type: String, msg: String) {
        val text = "${now()} | RESPONSE [$type] | $msg"
        Log.d(TAG, text)
        write(text)
    }

    fun logError(type: String, msg: String) {
        val text = "${now()} | ERROR [$type] | $msg"
        Log.e(TAG, text)
        write(text)
    }

    /**
     * Verbose — LogCat only, never written to file.
     * Use for high-frequency / raw data logs (poll responses, JSON bodies, etc.)
     * that are useful for live debugging but would bloat the log file.
     */
    fun logVerbose(type: String, msg: String) {
        Log.d(TAG, "${now()} | VERBOSE [$type] | $msg")
    }
}