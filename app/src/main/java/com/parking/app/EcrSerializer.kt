package com.parking.app

/**
 * Builds the ECR request string per spec Appendix A.
 * Fields are separated by ASCII 0x1C (File Separator).
 * All 47 field positions must be present even if empty.
 */
object EcrSerializer {

    private val FS = '\u001C'

    fun serialize(req: EcrRequest): String {
        // Build 47-field array (indices 0-46 matching spec field numbers 1-47)
        val fields = Array(47) { "" }

        fields[0]  = req.systemId                    // Field 1:  System Identification
        fields[1]  = req.transactionType             // Field 3:  Transaction Type (after FS)
        fields[2]  = req.originalAmount              // Field 5:  Original Transaction Amount
        fields[3]  = ""                              // Field 7:  Account Number
        fields[4]  = ""                              // Field 9:  Expiration Date
        fields[5]  = ""                              // Field 11: Valid From
        fields[6]  = req.origReferenceNumber         // Field 13: Orig. Refer. Number (for VOID)
        fields[7]  = ""                              // Field 15: Auth Code (for COMPLETION)
        fields[8]  = ""                              // Field 17: CVV2
        fields[9]  = ""                              // Field 19: Contract/Room No
        fields[10] = ""                              // Field 21: Start Date
        fields[11] = ""                              // Field 23: Ext. Terminal Id
        fields[12] = ""                              // Field 25: Ext. Merchant Id
        fields[13] = ""                              // Field 27: Ext. Reference Number
        fields[14] = ""                              // Field 29: Receipt Content
        fields[15] = req.prepareReceiptTicket        // Field 31: Prepare Receipt Ticket
        fields[16] = ""                              // Field 33: Language
        fields[17] = ""                              // Field 35: Currency Code
        fields[18] = ""                              // Field 37: Loyalty Transaction Type
        fields[19] = ""                              // Field 39: Loyalty Identification Method
        fields[20] = ""                              // Field 41: Orig. Loyalty Reference Number
        fields[21] = ""                              // Field 43: Cashier Id
        fields[22] = req.returnPanEncrypted          // Field 45: Return PAN encrypted
        fields[23] = req.genericLoyaltyFlag          // Field 47: Generic Loyalty Flag
        fields[24] = req.genericLoyaltyBins          // Field 49: Generic Loyalty Bins
        fields[25] = ""                              // Field 51: Gift Transaction type
        fields[26] = ""                              // Field 53: Orig. Gift Reference Number
        fields[27] = ""                              // Field 55: Supply CVM result
        fields[28] = ""                              // Field 57: BOC loyalty items
        fields[29] = ""                              // Field 59: Password
        fields[30] = "00"                            // Field 61: Message Code (default "00")
        fields[31] = "000"                           // Field 63: Message Type (default "000")
        fields[32] = ""                              // Field 65: Length
        fields[33] = ""                              // Field 67: Checkout Date
        fields[34] = ""                              // Field 69: Batch Number
        fields[35] = ""                              // Field 71: Agreement Number
        fields[36] = ""                              // Field 73: Agreement Date
        fields[37] = ""                              // Field 75: Session ID
        fields[38] = ""                              // Field 77: Cashback Amount
        fields[39] = ""                              // Field 79: EAC account number
        fields[40] = ""                              // Field 81: EAC Phone number
        fields[41] = ""                              // Field 83: EAC Payment flag
        fields[42] = ""                              // Field 85: EAC Beneficiary Outlet
        fields[43] = ""                              // Field 87: No. of Installments
        fields[44] = ""                              // Field 89: 1st Installment Date
        fields[45] = ""                              // Field 91: BIN in Receipt
        fields[46] = req.orderNumber                 // Field 93: Order Number

        return fields.joinToString(FS.toString()) + FS
    }
}
