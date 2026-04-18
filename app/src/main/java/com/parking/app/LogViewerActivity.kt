package com.parking.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.text.Spannable
import android.text.SpannableStringBuilder
import android.text.style.ForegroundColorSpan
import android.widget.Button
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
    private var latestFile: File? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_log_viewer)

        txtLogs   = findViewById(R.id.txtLogs)
        scrollView = findViewById(R.id.scrollLogs)
        btnRefresh = findViewById(R.id.btnRefresh)
        btnExport  = findViewById(R.id.btnExport)
        btnClear   = findViewById(R.id.btnClear)

        loadLogs()
        btnRefresh.setOnClickListener { loadLogs() }
        btnExport.setOnClickListener  { exportLogs() }
        btnClear.setOnClickListener   { clearLogs() }
    }

    private fun loadLogs() {
        try {
            val dir = File(filesDir, "logs")
            if (!dir.exists()) { txtLogs.text = "No logs found"; return }
            val files = dir.listFiles()
            if (files.isNullOrEmpty()) { txtLogs.text = "No logs available"; return }
            latestFile = files.sortedByDescending { it.lastModified() }.first()
            val lines  = latestFile!!.readLines()
            renderLogs(lines)
            // Auto-scroll to bottom
            scrollView.post { scrollView.fullScroll(ScrollView.FOCUS_DOWN) }
        } catch (e: Exception) {
            txtLogs.text = "Error: ${e.message}"
        }
    }

    private fun renderLogs(lines: List<String>) {
        val sb = SpannableStringBuilder()
        for (line in lines) {
            val color = when {
                line.contains("ERROR")    -> 0xFFFF4444.toInt()  // red
                line.contains("BUTTON")   -> 0xFFFFBB33.toInt()  // orange
                line.contains("REQUEST")  -> 0xFF33B5E5.toInt()  // blue
                line.contains("RESPONSE") -> 0xFF99CC00.toInt()  // green
                else                      -> 0xFF888888.toInt()  // gray
            }
            // Truncate long JSON responses to keep log readable
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
        txtLogs.text = sb
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

            // Try USB OTG first, then fall back to Downloads
            val destFile = findExportDestination(file.name)
            if (destFile != null) {
                file.copyTo(destFile, overwrite = true)
                Toast.makeText(this, "Saved to: ${destFile.absolutePath}", Toast.LENGTH_LONG).show()
                AppLogger.logRequest("EXPORT", "Log saved to ${destFile.absolutePath}")
            } else {
                // No external storage — fall back to share intent
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
            }
        } catch (e: Exception) {
            Toast.makeText(this, "Export error: ${e.message}", Toast.LENGTH_LONG).show()
            AppLogger.logError("EXPORT", e.message ?: "unknown")
        }
    }

    private fun findExportDestination(fileName: String): java.io.File? {
        // Check all external storage volumes (includes USB OTG)
        val volumes = getExternalFilesDirs(null)
        for (volume in volumes) {
            if (volume == null) continue
            // Skip internal storage (first volume) — prefer USB
            val isRemovable = try {
                val sm = getSystemService(android.os.storage.StorageManager::class.java)
                val vol = sm?.getStorageVolume(volume)
                vol?.isRemovable == true
            } catch (_: Exception) { false }

            if (isRemovable) {
                // Found USB/SD — save here
                val logDir = java.io.File(volume.parentFile?.parentFile?.parentFile?.parentFile ?: volume, "ParkingLogs")
                logDir.mkdirs()
                return java.io.File(logDir, fileName)
            }
        }

        // No USB found — try Downloads as fallback
        return try {
            val downloads = android.os.Environment.getExternalStoragePublicDirectory(
                android.os.Environment.DIRECTORY_DOWNLOADS
            )
            if (downloads != null && (downloads.exists() || downloads.mkdirs())) {
                java.io.File(downloads, "parking_${fileName}")
            } else null
        } catch (_: Exception) { null }
    }
}