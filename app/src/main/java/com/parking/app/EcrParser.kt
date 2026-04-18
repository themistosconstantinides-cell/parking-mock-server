package com.parking.app

/**
 * Parses the ECR response string from Middleware.
 * Based on the official demo app (EcrService.parseRawResponse) — ECR Protocol V3.6.0.
 *
 * The response is split entirely by FS (0x1C):
 *   chunks[0] = systemId
 *   chunks[1] = transactionType(2) + noInstallments(2) + noPostdated(2) + terminalId(12)
 *   chunks[2] = batchNumber(3) + responseCode(2)
 *   chunks[3..N] = individual fields
 */
object EcrParser {

    private val FS = '\u001C'
    private const val REQUIRED_CHUNKS = 43

    fun parse(raw: String): EcrResponse {
        if (raw.isBlank()) return EcrResponse()

        return try {
            val chunks = raw.split(FS)

            AppLogger.logRequest("ECR_PARSE", "chunks=${chunks.size} required=$REQUIRED_CHUNKS")

            if (chunks.size < REQUIRED_CHUNKS) {
                AppLogger.logError("ECR_PARSE", "Too few chunks: ${chunks.size} < $REQUIRED_CHUNKS")
                // Still try to parse what we have
            }

            fun get(i: Int): String = if (i < chunks.size) chunks[i].trim() else ""

            // chunks[0] = systemId
            val systemId = get(0)

            // chunks[1] = type(2) + installments(2) + postdated(2) + terminalId(12)
            val chunk1          = get(1)
            val transactionType = chunk1.substringSafe(0, 2)
            val noInstallments  = chunk1.substringSafe(2, 4)
            val noPostdated     = chunk1.substringSafe(4, 6)
            val terminalId      = chunk1.substringSafe(6)

            // chunks[2] = batchNumber(3) + responseCode(remainder)
            val chunk2       = get(2)
            val batchNumber  = chunk2.substringSafe(0, 3)
            val responseCode = chunk2.substringSafe(3)

            // chunks[3..N] = fields
            val originalAmount  = get(3)
            // 4 = loyaltyRedemptionIndicator
            // 5 = modifiedAmount
            val rrn             = get(6)
            val receiptNumber   = get(7)
            val authCode        = get(8)
            val accountNumber   = get(9)
            val expiryDate      = get(10)
            // 11 = cardholderName
            // 12-16 = DCC fields
            val responseText    = get(17)
            val cardProductName = get(18)
            val origRespCode    = get(19)
            // 20 = firstInstallmentDate
            val netAmount       = get(21)
            val receiptTicket   = get(22)
            // 23-27 = loyalty/batch fields
            val panEncrypted    = get(28)
            val track2Data      = get(29)
            // 30-35 = other fields
            val isBocLoyalty    = get(36)
            // 37-41 = other fields
            val orderNumber     = get(42)

            val isApproved  = responseCode == "00"
            val amountEuros = originalAmount.toDoubleOrNull()?.div(100.0) ?: 0.0

            AppLogger.logRequest("ECR_PARSE", "type=$transactionType code=$responseCode tid=$terminalId auth=$authCode rrn=$rrn")

            EcrResponse(
                systemId             = systemId,
                transactionType      = transactionType,
                noInstallments       = noInstallments,
                noPostdatedMonths    = noPostdated,
                terminalId           = terminalId,
                batchNumber          = batchNumber,
                responseCode         = responseCode,
                originalAmount       = originalAmount,
                rrn                  = rrn,
                receiptNumber        = receiptNumber,
                authCode             = authCode,
                accountNumber        = accountNumber,
                expiryDate           = expiryDate,
                responseText         = responseText,
                cardProductName      = cardProductName,
                originalResponseCode = origRespCode,
                netAmount            = netAmount,
                receiptTicket        = receiptTicket,
                isBocLoyalty         = isBocLoyalty,
                orderNumber          = orderNumber,
                panEncrypted         = panEncrypted,
                isApproved           = isApproved,
                amountEuros          = amountEuros
            )
        } catch (e: Exception) {
            AppLogger.logError("ECR_PARSE", "Parse error: ${e.message}")
            EcrResponse(responseCode = "99")
        }
    }

    private fun String.substringSafe(start: Int, end: Int = length): String {
        if (start >= length) return ""
        return substring(start, minOf(end, length))
    }
}