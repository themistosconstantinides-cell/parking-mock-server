package com.parking.app

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Holds all data extracted from the ECR Pre-Auth response at entry.
 * Passed to RPS in entranceCall so RPS can later execute TopUp/Capture/Release.
 *
 * tokenCode format (for TopUp/Capture APIs):
 *   <terminalId(12)><authCode(6)><receiptNo(4)><last4digits(4)><"C">
 *   e.g. "000025901004020482005612345C"
 */
data class EntryRecord(
    // Card identification
    val token: String,           // SHA-512 hash — used to match entry/exit
    val lastDigits: String,      // Last 4 digits of PAN
    val firstDigits: String,     // First 6 digits (empty until ECR supports it)
    val expiryDate: String,      // YYMM

    // Pre-auth transaction fields
    val terminalId: String,        // ECR hardware TID — used only inside tokenCode
    val configuredTerminal: String, // Settings terminal — sent as "terminal" in entranceCall
    val authCode: String,          // Authorization code from ECR field 21
    val rrn: String,               // Retrieval Reference Number from ECR field 17
    val receiptNumber: String,     // Transaction receipt number from ECR field 19
    val preAuthAmountCents: Int,   // Amount that was pre-authorized

    // Metadata
    val inputType: String,       // "Bank Card" or "Monthly Card"
    val timeOfInput: String,     // Timestamp when Continue was pressed (YYYYMMDDHHmmss)
    val outlet: String,
    val companyCode: String      // From parkingInit response — sent back in entranceCall
) {
    /**
     * tokenCode used in TopUp/Capture/Release API calls:
     * <terminalId><authCode><receiptNo><last4><"C">
     */
    val tokenCode: String
        get() = "${terminalId}${authCode}${receiptNumber}${lastDigits}C"

    companion object {
        fun currentTimestamp(): String =
            SimpleDateFormat("yyyyMMddHHmmss", Locale.getDefault()).format(Date())

        fun fromEcrResponse(
            ecr: EcrResponse,
            token: String,
            inputType: String,
            timeOfInput: String,
            preAuthAmountCents: Int,
            outlet: String,
            companyCode: String,
            configuredTerminal: String
        ): EntryRecord = EntryRecord(
            token              = token,
            lastDigits         = ecr.accountNumber.takeLast(4),
            firstDigits        = ecr.firstDigits.take(6),
            expiryDate         = ecr.expiryDate,
            terminalId         = ecr.terminalId,       // ECR TID — for tokenCode only
            configuredTerminal = configuredTerminal,   // Settings terminal — sent in entranceCall
            authCode           = ecr.authCode,
            rrn                = ecr.rrn,
            receiptNumber      = ecr.receiptNumber,
            preAuthAmountCents = preAuthAmountCents,
            inputType          = inputType,
            timeOfInput        = timeOfInput,
            outlet             = outlet,
            companyCode        = companyCode
        )
    }
}