package com.parking.app

/**
 * Parsed ECR response from Middleware (spec Appendix B).
 * Key fields extracted for parking app logic.
 */
data class EcrResponse(
    // Fixed-length header fields (no FS between them)
    val systemId: String          = "",   // Field 1:  14-char timestamp
    val transactionType: String   = "",   // Field 3:  "00"=Purchase, "04"=Void etc.
    val noInstallments: String    = "",   // Field 4:  "00" normally
    val noPostdatedMonths: String = "",   // Field 5:  "00" normally
    val terminalId: String        = "",   // Field 6:  12-char terminal ID
    val batchNumber: String       = "",   // Field 8:  3-char batch number
    val responseCode: String      = "",   // Field 9:  "00"=Approved, see Appendix C

    // FS-delimited fields
    val originalAmount: String    = "",   // Field 11: 10-digit amount
    val rrn: String               = "",   // Field 17: 12-char Retrieval Reference Number
    val receiptNumber: String     = "",   // Field 19: 4-char Transaction Receipt Number
    val authCode: String          = "",   // Field 21: 6-char Authorization Code
    val accountNumber: String     = "",   // Field 23: last 4 digits of PAN
    val expiryDate: String        = "",   // Field 25: YYMM
    val responseText: String      = "",   // Field 39: e.g. "APPROVED" / "TRANSACTION DECLINED"
    val cardProductName: String   = "",   // Field 41: "VISA", "MASTERCARD" etc.
    val originalResponseCode: String = "",// Field 43: raw issuer code
    val netAmount: String         = "",   // Field 47: tip amount
    val receiptTicket: String     = "",   // Field 49: printable receipt content
    val isBocLoyalty: String      = "",   // Field 77: "0" or "1"
    val orderNumber: String       = "",   // Field 89: mirrored order number
    val panEncrypted: String      = "",   // Field 61: encrypted PAN hex
    val firstDigits: String       = "",   // First 6 digits of PAN (BIN) — now returned by ECR

    // Derived convenience fields
    val isApproved: Boolean       = false,
    val amountEuros: Double       = 0.0
) {
    // Human-readable ECR response code description (Appendix C)
    fun responseCodeDescription(): String = when (responseCode) {
        "00" -> "Approved"
        "10" -> "Declined by host"
        "11" -> "Batch status error"
        "12" -> "Offline declined"
        "13" -> "Offline decline (installments)"
        "14" -> "No transaction match"
        "27" -> "Cashback amount exceeded"
        "28" -> "Cashback not allowed"
        "29" -> "Cashback not supported"
        "30" -> "User cancelled"
        "40" -> "No connection — please try again"
        "50" -> "Timeout — reset payment"
        "51" -> "DCC alert"
        "53" -> "BOC loyalty alert"
        "54" -> "Cashback eligible"
        "98" -> "Unknown transaction"
        "99" -> "Format error"
        else -> "Unknown code: $responseCode"
    }
}