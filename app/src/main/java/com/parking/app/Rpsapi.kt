package com.parking.app.api

import com.parking.app.EntryRecord

interface RpsApi {
    fun parkingInit(outlet: String, terminal: String, callback: (String) -> Unit)
    fun vehiclePresent(outlet: String, terminal: String, dateTime: String, callback: (String) -> Unit)
    fun entranceCall(entry: EntryRecord, callback: (String) -> Unit)
    fun exitCall(
        token: String,
        timeOfInput: String,
        lastDigits: String,
        firstDigits: String,
        inputType: String,
        outlet: String,
        terminal: String,
        companyCode: String,
        callback: (String) -> Unit
    )
    fun exitPayment(
        token: String,
        lastDigits: String,
        firstDigits: String,
        timeOfInput: String,
        amountPayed: Int,
        authCode: String,
        responseCode: String,
        referenceNo: String,
        originalRefNum: String,
        recordId: String,
        outlet: String,
        terminal: String,
        companyCode: String,
        callback: (String) -> Unit
    )
    fun help(
        outlet: String,
        terminal: String,
        companyCode: String,
        installationPoint: String,
        action: String,
        callback: (String) -> Unit
    )
}