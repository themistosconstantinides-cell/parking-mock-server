package com.parking.app

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

// Transaction type codes from ECR spec
object TxnType {
    const val SALE      = "00"   // Standard sale
    const val PRE_AUTH  = "01"   // Pre-authorize (may not be supported on all terminals)
    const val VOID      = "04"   // Void a previous transaction
    const val DUPLICATE = "09"   // Reprint last receipt
    const val PAN_CAP   = "14"   // Exit — read card only, no auth (may not be supported)
    const val MONTHLY   = "71"   // Monthly/loyalty card read
}

data class EcrRequest(
    val transactionType: String,
    val originalAmount: String = "0000000000",   // 10 digits, 2 implied decimals e.g. "0000000300" = €3.00
    val origReferenceNumber: String = "",         // For VOID: 4-digit receipt number
    val returnPanEncrypted: String = "1",         // "1" = return encrypted PAN
    val genericLoyaltyFlag: String = "",          // For type 71: "1" = get track2
    val genericLoyaltyBins: String = "",          // For type 71: comma-separated BINs
    val prepareReceiptTicket: String = "0",       // "0" = return receipt, don't print
    val orderNumber: String = "",
    val systemId: String = generateSystemId()
) {
    companion object {
        fun generateSystemId(): String =
            SimpleDateFormat("yyyyMMddHHmmss", Locale.getDefault()).format(Date())

        // Convenience builders
        fun preAuth(amountCents: Int, orderNo: String): EcrRequest = EcrRequest(
            transactionType    = TxnType.PRE_AUTH,   // Using SALE — Pre-Auth not supported on this terminal
            originalAmount     = amountCents.toString().padStart(10, '0'),
            returnPanEncrypted = "1",
            orderNumber        = orderNo,
            systemId           = generateSystemId()
        )

        fun sale(amountCents: Int, orderNo: String): EcrRequest = EcrRequest(
            transactionType    = TxnType.SALE,
            originalAmount     = amountCents.toString().padStart(10, '0'),
            returnPanEncrypted = "1",
            orderNumber        = orderNo,
            systemId           = generateSystemId()
        )

        fun panCapture(orderNo: String): EcrRequest = EcrRequest(
            transactionType    = TxnType.PAN_CAP,
            originalAmount     = "0000000000",
            returnPanEncrypted = "1",
            orderNumber        = orderNo,
            systemId           = generateSystemId()
        )

        fun monthly(loyaltyBins: String, orderNo: String): EcrRequest = EcrRequest(
            transactionType    = TxnType.MONTHLY,
            originalAmount     = "0000000000",
            returnPanEncrypted = "1",
            genericLoyaltyFlag = "1",
            genericLoyaltyBins = loyaltyBins,
            orderNumber        = orderNo,
            systemId           = generateSystemId()
        )

        fun void(receiptNumber: String, orderNo: String): EcrRequest = EcrRequest(
            transactionType      = TxnType.VOID,
            originalAmount       = "0000000000",
            origReferenceNumber  = receiptNumber,
            orderNumber          = orderNo,
            systemId             = generateSystemId()
        )
    }
}