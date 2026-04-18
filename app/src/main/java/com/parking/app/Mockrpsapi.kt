package com.parking.app.api.mock

import com.parking.app.AppLogger
import com.parking.app.EntryRecord
import com.parking.app.MockBackend
import com.parking.app.api.RpsApi

/**
 * Mock implementation of RpsApi.
 * Used in the mock build flavor — no real HTTP calls.
 * Delegates to MockBackend which returns hardcoded spec-compliant JSON.
 */
class MockRpsApi : RpsApi {

    override fun parkingInit(outlet: String, terminal: String, callback: (String) -> Unit) {
        AppLogger.logRequest("RPS[MOCK]", "parkingInit outlet=$outlet")
        callback(MockBackend.parkingInit())
    }

    override fun vehiclePresent(outlet: String, terminal: String, dateTime: String, callback: (String) -> Unit) {
        AppLogger.logRequest("RPS[MOCK]", "vehiclePresent outlet=$outlet vehicle=${MockBackend.simulateVehiclePresent}")
        callback(MockBackend.vehiclePresent(outlet, terminal, dateTime))
    }

    override fun entranceCall(entry: EntryRecord, callback: (String) -> Unit) {
        AppLogger.logRequest("RPS[MOCK]", "entranceCall token=${entry.token.take(16)}...")
        callback(MockBackend.entranceCall(entry))
    }

    override fun exitCall(
        token: String, timeOfInput: String, lastDigits: String,
        callback: (String) -> Unit
    ) {
        AppLogger.logRequest("RPS[MOCK]", "exitCall scenario=${MockBackend.exitScenario} token=${token.take(16)}...")
        callback(MockBackend.exitCall(token, timeOfInput, lastDigits))
    }

    override fun exitPayment(
        token: String, lastDigits: String, firstDigits: String, timeOfInput: String,
        amountPayed: Int, authCode: String, responseCode: String,
        referenceNo: String, originalRefNum: String, recordId: String,
        callback: (String) -> Unit
    ) {
        AppLogger.logRequest("RPS[MOCK]", "exitPayment amt=$amountPayed auth=$authCode")
        callback(MockBackend.exitPayment(
            token, lastDigits, firstDigits, timeOfInput,
            amountPayed, authCode, responseCode, referenceNo, originalRefNum, recordId
        ))
    }

    override fun help(outlet: String, terminal: String, callback: (String) -> Unit) {
        AppLogger.logRequest("RPS[MOCK]", "help")
        callback(MockBackend.help())
    }
}