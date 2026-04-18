package com.parking.app

import java.security.MessageDigest

/**
 * SHA-512 token generation per parking spec.
 *
 * Bank card token:
 *   SHA512( <6 first digits> <4 last digits> <YYMM expiry> <10-digit outlet> <2-digit App PAN seq> )
 *
 * Monthly card token:
 *   SHA512( <16-digit card no> <YYMM expiry> <10-digit outlet> <2-digit App PAN seq> )
 */
object TokenHelper {

    fun buildBankCardToken(
        firstSix: String,
        lastFour: String,
        expiryYYMM: String,
        outlet: String,
        appPanSeq: String = "01"
    ): String {
        val raw = firstSix.padEnd(6, '0').take(6) +
                lastFour.padEnd(4, '0').take(4) +
                expiryYYMM.padEnd(4, '0').take(4) +
                outlet.padEnd(10, '0').take(10) +
                appPanSeq.padEnd(2, '0').take(2)
        return sha512(raw)
    }

    fun buildMonthlyCardToken(
        cardNumber: String,      // full card number from track2/PAN
        outlet: String
        // Per spec section 2.5: MonthlyCardHashNumber = SHA512(CardNo + outletNo)
        // No expiry or appPanSeq for monthly cards
    ): String {
        val raw = cardNumber + outlet
        return sha512(raw)
    }

    // Extract first 6 digits from encrypted PAN field
    // Per spec: first 6 digits are BIN (not currently returned by ECR, will be future)
    fun extractFirstSix(panEncrypted: String): String {
        // When ECR returns firstDigits directly, use that
        // For now return empty — spec says field not yet available
        return ""
    }

    // Extract last 4 digits from accountNumber field (already last 4)
    fun extractLastFour(accountNumber: String): String = accountNumber.takeLast(4)

    private fun sha512(input: String): String {
        val digest = MessageDigest.getInstance("SHA-512")
        val hashBytes = digest.digest(input.toByteArray(Charsets.UTF_8))
        return hashBytes.joinToString("") { "%02x".format(it) }
    }
}