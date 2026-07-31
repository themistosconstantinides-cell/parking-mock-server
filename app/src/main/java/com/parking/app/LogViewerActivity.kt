package com.parking.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Spannable
import android.text.SpannableStringBuilder
import android.text.style.ForegroundColorSpan
import android.widget.Button
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import java.io.File

class LogViewerActivity : AppCompatActivity() {

    private lateinit var txtLogs: TextView
    private lateinit var scrollView: ScrollView
    private lateinit var btnRefresh: Button
    private lateinit var btnExport: Button
    private lateinit var btnClear: Button
    private lateinit var progressLoad: ProgressBar
    private var latestFile: File? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    companion object {
        private const val MAX_LINES = 500   // show only the last 500 lines
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_log_viewer)

        txtLogs      = findViewById(R.id.txtLogs)
        scrollView   = findViewById(R.id.scrollLogs)
        btnRefresh   = findViewById(R.id.btnRefresh)
        btnExport    = findViewById(R.id.btnExport)
        btnClear     = findViewById(R.id.btnClear)
        progressLoad = findViewById(R.id.progressLoad)

        loadLogs()
        btnRefresh.setOnClickListener { loadLogs() }
        btnExport.setOnClickListener  { exportLogs() }
        btnClear.setOnClickListener   { clearLogs() }
    }

    private fun loadLogs() {
        progressLoad.visibility = android.view.View.VISIBLE
        txtLogs.text = ""
        btnRefresh.isEnabled = false

        Thread {
            try {
                val dir = File(filesDir, "logs")
                if (!dir.exists()) {
                    mainHandler.post { showText("No logs found") }
                    return@Thread
                }
                val files = dir.listFiles()
                if (files.isNullOrEmpty()) {
                    mainHandler.post { showText("No logs available") }
                    return@Thread
                }
                latestFile = files.sortedByDescending { it.lastModified() }.first()
                val allLines = latestFile!!.readLines()
                // Keep only the last MAX_LINES to avoid OOM / UI freeze
                val lines = if (allLines.size > MAX_LINES) {
                    allLines.takeLast(MAX_LINES)
                } else {
                    allLines
                }
                val totalLines = allLines.size
                val spannable = buildSpannable(lines, totalLines)
                mainHandler.post {
                    txtLogs.text = spannable
                    progressLoad.visibility = android.view.View.GONE
                    btnRefresh.isEnabled = true
                    scrollView.post { scrollView.fullScroll(ScrollView.FOCUS_DOWN) }
                }
            } catch (e: Exception) {
                mainHandler.post { showText("Error: ${e.message}") }
            }
        }.start()
    }

    private fun showText(msg: String) {
        txtLogs.text = msg
        progressLoad.visibility = android.view.View.GONE
        btnRefresh.isEnabled = true
    }

    private fun buildSpannable(lines: List<String>, totalLines: Int): SpannableStringBuilder {
        val sb = SpannableStringBuilder()

        // Header showing how many lines are loaded
        if (totalLines > MAX_LINES) {
            val header = "── Showing last $MAX_LINES of $totalLines lines ──\n"
            val start = sb.length
            sb.append(header)
            sb.setSpan(ForegroundColorSpan(0xFFFFBB33.toInt()), start, sb.length,
                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
        }

        for (line in lines) {
            val color = when {
                line.contains("ERROR")    -> 0xFFFF4444.toInt()  // red
                line.contains("BUTTON")   -> 0xFFFFBB33.toInt()  // orange
                line.contains("REQUEST")  -> 0xFF33B5E5.toInt()  // blue
                line.contains("RESPONSE") -> 0xFF99CC00.toInt()  // green
                else                      -> 0xFF888888.toInt()  // gray
            }
            // Truncate long JSON lines to keep log readable
            val display = if (line.length > 120 && line.contains("{")) {
                line.take(120) + "..."
            } else {
                line
            }
            val start = sb.length
            sb.append(display).append("\n")
            sb.setSpan(
                ForegroundColorSpan(color),
                start, sb.length,
                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
            )
        }
        return sb
    }

    private fun clearLogs() {
        try {
            val dir = File(filesDir, "logs")
            dir.listFiles()?.forEach { it.delete() }
            txtLogs.text = "Logs cleared"
            latestFile = null
            Toast.makeText(this, "Logs cleared", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(this, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun exportLogs() {
        try {
            val file = latestFile
            if (file == null || !file.exists()) {
                Toast.makeText(this, "No log file to export", Toast.LENGTH_SHORT).show()
                return
            }

            // Try USB OTG first
            val usbDest = findUsbDestination(file.name)
            if (usbDest != null) {
                file.copyTo(usbDest, overwrite = true)
                Toast.makeText(this, "Saved to USB: ${usbDest.absolutePath}", Toast.LENGTH_LONG).show()
                AppLogger.logRequest("EXPORT", "Log saved to USB ${usbDest.absolutePath}")
                return
            }

            // No USB — share via system share sheet (works on all API levels, no permissions needed)
            val uri: Uri = FileProvider.getUriForFile(
                this, "${packageName}.fileprovider", file
            )
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, "ParkingApp Logs - ${file.name}")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(Intent.createChooser(intent, "Share Logs"))
        } catch (e: Exception) {
            Toast.makeText(this, "Export error: ${e.message}", Toast.LENGTH_LONG).show()
            AppLogger.logError("EXPORT", e.message ?: "unknown")
        }
    }

    private fun findUsbDestination(fileName: String): java.io.File? {
        val volumes = getExternalFilesDirs(null)
        for (volume in volumes) {
            if (volume == null) continue
            val isRemovable = try {
                val sm = getSystemService(android.os.storage.StorageManager::class.java)
                sm?.getStorageVolume(volume)?.isRemovable == true
            } catch (_: Exception) { false }

            if (isRemovable) {
                val logDir = java.io.File(volume.parentFile?.parentFile?.parentFile?.parentFile ?: volume, "ParkingLogs")
                logDir.mkdirs()
                return java.io.File(logDir, fileName)
            }
        }
        return null
    }
}