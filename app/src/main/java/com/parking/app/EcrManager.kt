package com.parking.app

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat

private const val MIDDLEWARE_PACKAGE   = "com.printec.app.middleware.cy.jcc"
private const val MIDDLEWARE_SERVICE   = "com.printec.app.middleware.cy.jcc.service.MiddlewareService"
private const val ACTION_ORDER_REQUEST = "com.printec.app.middleware.cy.jcc.ORDER_REQUEST"
private const val ACTION_ORDER_RESULT  = "com.printec.app.middleware.cy.jcc.ORDER_RESULT"
private const val EXTRA_ORDER_PAYMENT_REQUEST  = "com.printec.app.middleware.cy.jcc.ORDER_PAYMENT_REQUEST"
private const val EXTRA_ORDER_APP_PACKAGE      = "com.printec.app.middleware.cy.jcc.ORDER_APP_PACKAGE"
private const val EXTRA_MIDDLEWARE_RESPONSE_CODE    = "com.printec.app.middleware.cy.jcc.MIDDLEWARE_RESPONSE_CODE"
private const val EXTRA_MIDDLEWARE_RESPONSE_MESSAGE = "com.printec.app.middleware.cy.jcc.MIDDLEWARE_RESPONSE_MESSAGE"

data class MiddlewareResult(
    val middlewareCode: String,
    val ecrResponse: EcrResponse?
)

class EcrManager(private val context: Context) {

    private var receiver: BroadcastReceiver? = null

    companion object {
        private const val TIMEOUT_MS = 200_000L  // 200 seconds
    }

    fun isMiddlewareAvailable(): Boolean {
        val intent = Intent().apply {
            component = ComponentName(MIDDLEWARE_PACKAGE, MIDDLEWARE_SERVICE)
        }
        return context.packageManager.resolveService(intent, 0) != null
    }

    fun sendTransaction(ecrRequest: EcrRequest, onResult: (MiddlewareResult) -> Unit) {
        val requestString = EcrSerializer.serialize(ecrRequest)
        AppLogger.logRequest("ECR", "type=${ecrRequest.transactionType} amt=${ecrRequest.originalAmount}")
        AppLogger.logRequest("ECR_RAW", requestString.take(120))

        if (isMiddlewareAvailable()) {
            sendViaMiddleware(requestString, onResult)
        } else {
            AppLogger.logError("ECR", "Middleware not found — payment app not installed")
            onResult(MiddlewareResult("99", null))
        }
    }

    private val timeoutHandler = Handler(Looper.getMainLooper())
    private var timeoutRunnable: Runnable? = null

    private fun sendViaMiddleware(requestString: String, onResult: (MiddlewareResult) -> Unit) {
        receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context?, intent: Intent?) {
                cancelTimeout()
                unregisterReceiver()
                val code = intent?.getStringExtra(EXTRA_MIDDLEWARE_RESPONSE_CODE) ?: "99"
                val msg  = intent?.getStringExtra(EXTRA_MIDDLEWARE_RESPONSE_MESSAGE) ?: ""
                AppLogger.logResponse("MW_CODE", code)
                AppLogger.logResponse("MW_MSG", msg.take(120))
                val result = if (code == "00") {
                    MiddlewareResult(code, EcrParser.parse(msg))
                } else {
                    MiddlewareResult(code, null)
                }
                onResult(result)
            }
        }

        val filter = IntentFilter(ACTION_ORDER_RESULT)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(receiver, filter)
        }

        val serviceIntent = Intent().apply {
            component = ComponentName(MIDDLEWARE_PACKAGE, MIDDLEWARE_SERVICE)
            action = ACTION_ORDER_REQUEST
            putExtra(EXTRA_ORDER_PAYMENT_REQUEST, requestString)
            putExtra(EXTRA_ORDER_APP_PACKAGE, context.packageName)
        }

        try {
            ContextCompat.startForegroundService(context, serviceIntent)
            AppLogger.logRequest("ECR", "Intent sent to Middleware — timeout in ${TIMEOUT_MS/1000}s")
            startTimeout(onResult)
        } catch (e: Exception) {
            cancelTimeout()
            unregisterReceiver()
            AppLogger.logError("ECR", "Failed to start Middleware: ${e.message}")
            onResult(MiddlewareResult("99", null))
        }
    }

    private fun startTimeout(onResult: (MiddlewareResult) -> Unit) {
        timeoutRunnable = Runnable {
            AppLogger.logError("ECR", "Timeout after ${TIMEOUT_MS/1000}s — no response from Middleware")
            unregisterReceiver()
            onResult(MiddlewareResult("03", null))  // "03" = Timeout per Middleware spec
        }
        timeoutHandler.postDelayed(timeoutRunnable!!, TIMEOUT_MS)
    }

    private fun cancelTimeout() {
        timeoutRunnable?.let {
            timeoutHandler.removeCallbacks(it)
            timeoutRunnable = null
            AppLogger.logRequest("ECR", "Timeout cancelled — response received")
        }
    }

    fun unregisterReceiver() {
        cancelTimeout()
        receiver?.let {
            try { context.unregisterReceiver(it) } catch (_: Exception) {}
            receiver = null
        }
    }
}