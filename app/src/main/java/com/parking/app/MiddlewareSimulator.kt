package com.parking.app

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Simulates the Middleware + Payment App when they are not installed.
 * Returns properly formatted ECR response strings (per spec Appendix B)
 * so EcrParser can parse them identically to real responses.
 */
object MiddlewareSimulator {

    private val FS = '\u001C'
    private val GS = '\u001D'

    // Configurable mock outcomes — change these to test different scenarios
    var mockApproved   = true
    var mockLastFour   = "1234"
    var mockFirstSix   = "454891"
    var mockExpiry     = "2704"
    var mockAuthCode   = "020482"
    var mockCardType   = "VISA"
    var mockTerminalId = "000025901004"
    var mockBatch      = "851"
    var mockRrn        = "010056010056"
    var mockReceiptNo  = "0056"

    fun startTransaction(type: String, amount: String = "0000000000"): String {
        val sysId = SimpleDateFormat("yyyyMMddHHmmss", Locale.getDefault()).format(Date())
        return when {
            !mockApproved                          -> buildDeclinedResponse(sysId, type, amount)
            type == TxnType.SALE                   -> buildApprovedResponse(sysId, type, amount)
            type == TxnType.PRE_AUTH               -> buildApprovedResponse(sysId, type, amount)
            type == TxnType.PAN_CAP                -> buildPanCaptureResponse(sysId, type)
            type == TxnType.MONTHLY                -> buildMonthlyResponse(sysId, type)
            type == TxnType.VOID                   -> buildApprovedResponse(sysId, type, amount)
            type == TxnType.DUPLICATE              -> buildDuplicateResponse(sysId, type)
            else                                   -> buildApprovedResponse(sysId, type, amount)
        }
    }

    // ── Approved Sale / Pre-Auth / Void ───────────────────────────────────────
    private fun buildApprovedResponse(sysId: String, type: String, amount: String): String {
        val receipt = buildMockReceipt(type, amount)
        val fields = listOf(
            amount,          // 0  Field 11: Original Amount
            "",              // 1  Field 13: Loyalty Redemption
            "",              // 2  Field 15: Modified Amount
            mockRrn,         // 3  Field 17: RRN
            mockReceiptNo,   // 4  Field 19: Receipt Number
            mockAuthCode,    // 5  Field 21: Auth Code
            mockLastFour,    // 6  Field 23: Account Number (last 4)
            mockExpiry,      // 7  Field 25: Expiry YYMM
            "",              // 8  Field 27: Cardholder Name
            "",              // 9  Field 29: DCC Amount
            "",              // 10 Field 31: DCC Currency
            "",              // 11 Field 33: DCC Rate
            "",              // 12 Field 35: DCC Markup
            "",              // 13 Field 37: DCC Date
            "APPROVED",      // 14 Field 39: Response Text
            mockCardType,    // 15 Field 41: Card Product
            "000",           // 16 Field 43: Original Response Code
            "",              // 17 Field 45: 1st Installment Date
            "0000000000",    // 18 Field 47: Net Amount
            receipt,         // 19 Field 49: Receipt Ticket
            "",              // 20 Field 51: Batch Status
            "",              // 21 Field 53: Currency
            "",              // 22 Field 55: Loyalty Balance
            "",              // 23 Field 57: Loyalty Points
            "",              // 24 Field 59: Loyalty Ref
            buildMockPanEncrypted(), // 25 Field 61: PAN Encrypted
            "",              // 26 Field 63: Track 2
            "",              // 27 Field 65: PIN
            "",              // 28 Field 67: Kilometres
            "",              // 29 Field 69: Gift Balance
            "",              // 30 Field 71: Gift Ref
            "",              // 31 Field 73: CVM Result
            "",              // 32 Field 75: BOC Items
            "0",             // 33 Field 77: Is BOC Loyalty
            "",              // 34 Field 79: BOC Points
            "",              // 35 Field 81: Merchant Discount
            "",              // 36 Field 83: Voucher Discount
            "",              // 37 Field 85: BOC Redemption
            "",              // 38 Field 87: Cashback
            "MOCK_ORDER",    // 39 Field 89: Order Number
            ""               // 40 Field 90: trailing FS
        )
        val header = buildHeader(sysId, type, "00", amount)
        return header + fields.joinToString(FS.toString()) + FS
    }

    // ── PAN Capture (type 14) — no auth, just encrypted PAN back ─────────────
    private fun buildPanCaptureResponse(sysId: String, type: String): String {
        val fields = listOf(
            "",              // 0  Original Amount
            "", "", "", "", // 1-4
            "",              // 5  Auth Code (empty for PAN capture)
            mockLastFour,    // 6  Account Number
            mockExpiry,      // 7  Expiry
            "", "", "", "", "", "", "", // 8-14
            mockCardType,    // 15 Card Product
            "", "", "", "",  // 16-19 (receipt empty for PAN cap)
            "", "", "", "", "", "",
            buildMockPanEncrypted(), // 25 PAN Encrypted
            "", "", "", "", "", "", "", "", "", "", "", "", "",
            "0",             // 33 Is BOC Loyalty
            "", "", "", "", "",
            "MOCK_ORDER",    // 39 Order Number
            ""
        )
        val header = buildHeader(sysId, type, "00", "0000000000")
        return header + fields.joinToString(FS.toString()) + FS
    }

    // ── Monthly card / Generic Loyalty (type 71) ──────────────────────────────
    private fun buildMonthlyResponse(sysId: String, type: String): String {
        val fields = listOf(
            "",              // 0
            "", "", "", "",  // 1-4
            "",              // 5  Auth Code
            mockLastFour,    // 6  Account Number
            mockExpiry,      // 7  Expiry
            "", "", "", "", "", "", "", // 8-14
            "MONTHLY",       // 15 Card Product
            "", "", "", "",  // 16-19
            "", "", "", "", "",
            buildMockPanEncrypted(), // 25 PAN Encrypted
            "MOCK_TRACK2_DATA", // 26 Track 2 (returned for type 71)
            "", "", "", "", "", "", "", "", "", "", "", "",
            "0",             // 33 Is BOC Loyalty
            "", "", "", "", "",
            "MOCK_ORDER",    // 39 Order Number
            ""
        )
        val header = buildHeader(sysId, type, "00", "0000000000")
        return header + fields.joinToString(FS.toString()) + FS
    }

    // ── Declined ──────────────────────────────────────────────────────────────
    private fun buildDeclinedResponse(sysId: String, type: String, amount: String): String {
        val fields = listOf(
            amount, "", "", "", "", // 0-4
            "",              // 5  Auth Code (empty when declined)
            mockLastFour,    // 6
            mockExpiry,      // 7
            "", "", "", "", "", "",
            "TRANSACTION DECLINED", // 14
            mockCardType,    // 15
            "912",           // 16 Original Response Code
            "", "0000000000", "", // 17-19
            "", "", "", "", "",
            buildMockPanEncrypted(), // 25
            "", "", "", "", "", "", "", "", "", "", "", "",
            "0",             // 33
            "", "", "", "", "",
            "MOCK_ORDER",    // 39
            ""
        )
        val header = buildHeader(sysId, type, "10", amount) // "10" = Declined
        return header + fields.joinToString(FS.toString()) + FS
    }

    // ── Duplicate (type 09) ───────────────────────────────────────────────────
    private fun buildDuplicateResponse(sysId: String, type: String): String {
        val receipt = buildMockReceipt(type, "0000000000")
        // Duplicate response has fewer fields per spec example
        val fields = MutableList(40) { "" }
        fields[19] = receipt   // Receipt Ticket
        fields[33] = "0"       // Is BOC Loyalty
        fields[39] = "MOCK_ORDER"
        val header = buildHeader(sysId, type, "00", "")
        return header + fields.joinToString(FS.toString()) + FS
    }

    // ── Header builder ────────────────────────────────────────────────────────
    private fun buildHeader(sysId: String, type: String, respCode: String, amount: String): String {
        // Per demo EcrService.parseRawResponse — split entire response by FS:
        // chunks[0] = systemId
        // chunks[1] = type(2) + noInstallments(2) + noPostdated(2) + terminalId(12)
        // chunks[2] = batchNumber(3) + responseCode(2+)
        return "${sysId}${FS}${type}0000${mockTerminalId}${FS}${mockBatch}${respCode}${FS}"
    }

    private fun buildMockReceipt(type: String, amount: String): String {
        val amtFormatted = (amount.toLongOrNull() ?: 0L).let {
            "EUR%.2f".format(it / 100.0)
        }
        return "NC${GS}NLMock Parking Terminal${GS}BL${amtFormatted}${GS}NCAUTH: $mockAuthCode${GS}NL${GS}"
    }

    private fun buildMockPanEncrypted(): String {
        // Token format from spec: SHA512(first6 + last4 + expiry + outlet + appPanSeq)
        // For mock, return a realistic-looking hex string
        return "MOCK_ENC_" + mockFirstSix + mockLastFour + mockExpiry + "0000259010" + "01"
    }
}