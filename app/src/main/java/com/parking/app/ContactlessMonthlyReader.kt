package com.parking.app

import CTOS.CtCL

/**
 * Reads the UID of a Mifare contactless card using the Castles CtCL API.
 *
 * - Blocking — always call from a background thread (never from Main).
 * - Calls powerOff() before powerOn() to ensure a clean RF state.
 * - Always releases RF in the finally block — never leaves RF on,
 *   even on error or timeout, so Middleware can use the reader immediately after.
 * - Only used when the Monthly button is pressed and busy=true — no ECR
 *   transaction is in flight at the same time.
 *
 * Returns the card UID as uppercase hex (e.g. "A1B2C3D4"),
 * or null if no card was detected within the timeout or on hardware error.
 */
class ContactlessMonthlyReader {

    companion object {
        const val DEFAULT_TIMEOUT_MS = 15_000L
        private const val POLL_INTERVAL_MS = 150L
        private const val RF_SETTLE_MS     = 100L
    }

    fun readUid(timeoutMs: Long = DEFAULT_TIMEOUT_MS): String? {
        val cl = CtCL()
        return try {
            // ── 1. Ensure RF field is off before starting ─────────────────────
            cl.powerOff()
            Thread.sleep(RF_SETTLE_MS)
            cl.powerOn()

            val ATQA = ByteArray(2)
            val SAK  = ByteArray(1)
            val CSN  = ByteArray(10)

            val deadline = System.currentTimeMillis() + timeoutMs
            var ret: Int

            // ── 2. Poll for Type-A (Mifare) card ─────────────────────────────
            do {
                ret = cl.typeAActiveFromIdle(0, ATQA, SAK, CSN)
                if (ret == 0) break
                if (Thread.currentThread().isInterrupted) {
                    AppLogger.logRequest("CONTACTLESS", "Thread interrupted — aborting")
                    return null
                }
                Thread.sleep(POLL_INTERVAL_MS)
            } while (System.currentTimeMillis() < deadline)

            if (ret != 0) {
                AppLogger.logRequest("CONTACTLESS",
                    "No card detected within ${timeoutMs}ms (ret=0x${ret.toString(16).uppercase()})")
                return null
            }

            // ── 3. Extract UID ────────────────────────────────────────────────
            val uidLen = cl.getCSNLen()
            val uid    = CSN.take(uidLen).joinToString("") { "%02X".format(it) }

            AppLogger.logRequest("CONTACTLESS",
                "Card detected — UID=$uid " +
                "SAK=0x${(SAK[0].toInt() and 0xFF).toString(16).uppercase()} " +
                "uidLen=$uidLen")

            uid

        } catch (e: InterruptedException) {
            AppLogger.logRequest("CONTACTLESS", "Reader interrupted")
            null
        } catch (e: Exception) {
            AppLogger.logError("CONTACTLESS", "CtCL error: ${e.message}")
            null
        } finally {
            // ── 4. Always release RF — even on error or timeout ───────────────
            try { cl.powerOff() } catch (_: Exception) {}
        }
    }
}
