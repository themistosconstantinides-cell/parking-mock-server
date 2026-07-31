package com.parking.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper

/**
 * Launches ParkingApp after device boot — waits for Middleware to be ready.
 *
 * Strategy:
 * 1. Catch BOOT_COMPLETED
 * 2. Wait for Middleware package to be available (poll every 5s, max 2 min)
 * 3. Once Middleware is ready → launch MainActivity
 *
 * This ensures Middleware and Payment App are fully started before Parking App.
 */
class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val MIDDLEWARE_PACKAGE = "com.printec.app.middleware.cy.jcc"
        private const val POLL_INTERVAL_MS   = 5_000L   // check every 5 seconds
        private const val MAX_WAIT_MS        = 120_000L  // give up after 2 minutes
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED &&
            intent.action != "android.intent.action.QUICKBOOT_POWERON") return

        AppLogger.init(context)
        AppLogger.logRequest("BOOT", "Device booted — waiting for Middleware...")

        waitForMiddlewareAndLaunch(context)
    }

    private fun waitForMiddlewareAndLaunch(context: Context) {
        val handler   = Handler(Looper.getMainLooper())
        var elapsed   = 0L

        val checker = object : Runnable {
            override fun run() {
                val middlewareReady = isPackageInstalled(context, MIDDLEWARE_PACKAGE)
                AppLogger.logRequest("BOOT", "Middleware ready=$middlewareReady elapsed=${elapsed/1000}s")

                when {
                    middlewareReady -> {
                        // Middleware is up — wait one extra 3s for it to fully initialize
                        AppLogger.logRequest("BOOT", "Middleware found — launching in 3s")
                        handler.postDelayed({ launchApp(context) }, 3_000L)
                    }
                    elapsed >= MAX_WAIT_MS -> {
                        // Timed out — launch anyway
                        AppLogger.logRequest("BOOT", "Timeout waiting for Middleware — launching anyway")
                        launchApp(context)
                    }
                    else -> {
                        // Not ready yet — check again
                        elapsed += POLL_INTERVAL_MS
                        handler.postDelayed(this, POLL_INTERVAL_MS)
                    }
                }
            }
        }

        // Start checking after 10s (give Android time to finish booting)
        handler.postDelayed(checker, 10_000L)
    }

    private fun isPackageInstalled(context: Context, packageName: String): Boolean {
        return try {
            context.packageManager.getPackageInfo(packageName, 0)
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun launchApp(context: Context) {
        AppLogger.logRequest("BOOT", "Launching ParkingApp")
        try {
            val intent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            AppLogger.logError("BOOT", "Failed to launch: ${e.message}")
        }
    }
}