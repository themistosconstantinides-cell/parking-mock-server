package com.parking.app

object MockBackend {

    // Toggle for testing vehicle present: true = vehicle detected, false = no vehicle
    var simulateVehiclePresent = true

    fun vehiclePresent(outlet: String, terminal: String, dateTime: String): String {
        val present = if (simulateVehiclePresent) "1" else "0"
        val msg = if (simulateVehiclePresent)
            "Vehicle detected. Please proceed."
        else
            "No vehicle detected at entrance."
        return """
            {
              "outlet":"$outlet",
              "terminal":"$terminal",
              "installationPoint":"Entrance",
              "dayTime":"$dateTime",
              "vehiclePresent":"$present",
              "displayMessage":"$msg",
              "timeToDisplayMessage":"5",
              "responseCode":"00",
              "availablePlaceMonthly":"-1",
              "availablePlacesNormal":"20",
              "responseDescription":"Successful Response"
            }
        """.trimIndent()
    }

    fun parkingInit(): String {
        return """
            {
              "outlet":"0000259010",
              "terminal":"000025901025",
              "mode":"Entrance",
              "companyCode":"MarinaParking",
              "keepAliveFreq":"10",
              "minimumAmountPreAuth":"300",
              "defaultAmount":"800",
              "phoneForHelp":"99375545",
              "displayMessageOfEntrance":"Welcome to Printec  Parking!",
              "displayMessageOnExit":"Please prepare the card that was used during Entrance.",
              "displayMessageOfAvailablePlaces":"There are {availablePlacesRegular} available places for Normal and {availablePlaceMonthly} for Monthly Customers.",
              "availablePlacesNormal":"20",
              "availablePlaceMonthly":"-1",
              "monthlyCardsBins":"434343;232323",
              "controller":"A",
              "fixAmountSolution":"-1",
              "charges":[
                {"from":"30","to":"120","fee":"200"},
                {"from":"120","to":"180","fee":"400"},
                {"from":"180","to":"240","fee":"500"},
                {"from":"240","fee":"1000"}
              ],
              "responseCode":"00",
              "responseDescription":"Successful Response"
            }
        """.trimIndent()
    }


    fun help(): String {
        return """
            {
              "outlet":"0000259010",
              "terminal":"000025901025",
              "installationPoint":"Entrance",
              "dayTime":"20260415120000",
              "displayMessage":"Please wait for assistance.",
              "timeToDisplayMessage":"20",
              "responseCode":"00",
              "availablePlaceMonthly":"10",
              "availablePlacesRegular":"20",
              "responseDescription":"Successful Response"
            }
        """.trimIndent()
    }

    fun parkingInitInvalidOutlet(): String {
        return """
            {
              "responseCode":"91",
              "responseDescription":"Invalid Outlet Number"
            }
        """.trimIndent()
    }

    fun entranceCall(entry: EntryRecord): String {
        // In production this sends entry to RPS via HTTP POST /entranceCall
        // For now we log what would be sent and return mock approval
        val body = """
            {
              "companyCode":"MarinaParking",
              "application":"Parking",
              "intallationPoint":"Entrance",
              "outlet":"${entry.outlet}",
              "terminal":"${entry.terminalId}",
              "token":"${entry.token}",
              "inputType":"${entry.inputType}",
              "lastDigits":"${entry.lastDigits}",
              "firstDigits":"${entry.firstDigits}",
              "expiryDate":"${entry.expiryDate}",
              "authCode":"${entry.authCode}",
              "rrn":"${entry.rrn}",
              "receiptNumber":"${entry.receiptNumber}",
              "preAuthAmount":"${entry.preAuthAmountCents}",
              "tokenCode":"${entry.tokenCode}",
              "timeOfInput":"${entry.timeOfInput}"
            }
        """.trimIndent()
        AppLogger.logRequest("RPS_ENTRANCE_BODY", body)

        return """
            {
              "outlet":"0000259010",
              "terminal":"000025901025",
              "availablePlaceMonthly":"9",
              "availablePlacesRegular":"19",
              "installationPoint":"Entrance",
              "displayMessage":"Welcome. Have a nice day!!",
              "timeToDisplayMessage":"5",
              "responseCode":"00",
              "responseDescription":"Successful Response"
            }
        """.trimIndent()
    }

    fun entranceCallDeclined(): String {
        return """
            {
              "outlet":"0000259010",
              "terminal":"000025901025",
              "availablePlaceMonthly":"10",
              "availablePlacesRegular":"20",
              "installationPoint":"Entrance",
              "displayMessage":"You have an unpaid case in this parking. Please ask for HELP.",
              "timeToDisplayMessage":"10",
              "responseCode":"05",
              "responseDescription":"Unpaid record with this card."
            }
        """.trimIndent()
    }

    // Toggle for testing exit scenarios:
    // 1 = free (barrierOpen=1, moneyToPay=0)
    // 2 = capture only (amount <= pre-auth, barrierOpen=1)
    // 3 = topup needed (amount > pre-auth, barrierOpen=-2)
    // 4 = barrier failed to open (barrierOpen=0)
    var exitScenario = 3

    fun exitCall(token: String, timeOfInput: String, lastDigits: String): String {
        AppLogger.logRequest("RPS_EXIT_BODY", "token=${token.take(20)}... lastDigits=$lastDigits timeOfInput=$timeOfInput")
        return when (exitScenario) {
            1 -> exitCallFree(token, timeOfInput, lastDigits)
            2 -> exitCallCaptureOnly(token, timeOfInput, lastDigits)
            4 -> exitCallBarrierFailed(token, timeOfInput, lastDigits)
            else -> exitCallNeedPayment(token, timeOfInput, lastDigits)
        }
    }

    fun exitCallFree(token: String, timeOfInput: String, lastDigits: String): String {
        return """
            {
              "outlet":"0000259010",
              "terminal":"000025901025",
              "availablePlaceMonthly":"10",
              "availablePlacesRegular":"20",
              "installationPoint":"Exit",
              "displayMessage":"Your card has been charged. Thank you for your visit. Have a nice day!!!",
              "timeToDisplayMessage":"5",
              "timeSpent":"1800",
              "moneyToPay":"0",
              "barrierOpen":"1",
              "timeOfServer":"20260415120000",
              "responseCode":"00",
              "responseDescription":"Successful Response",
              "recordId":"1234567890ABCDEF1234567890ABCDEF"
            }
        """.trimIndent()
    }

    fun exitCallCaptureOnly(token: String, timeOfInput: String, lastDigits: String): String {
        return """
            {
              "outlet":"0000259010",
              "terminal":"000025901025",
              "availablePlaceMonthly":"10",
              "availablePlacesRegular":"20",
              "installationPoint":"Exit",
              "displayMessage":"Your card has been charged 2.00 Euro. Thank you for your visit. Have a nice day!!!",
              "timeToDisplayMessage":"5",
              "timeSpent":"3600",
              "moneyToPay":"200",
              "barrierOpen":"1",
              "timeOfServer":"20260415120000",
              "responseCode":"00",
              "responseDescription":"Successful Response",
              "recordId":"1234567890ABCDEF1234567890ABCDEF"
            }
        """.trimIndent()
    }

    fun exitCallNeedPayment(token: String, timeOfInput: String, lastDigits: String): String {
        return """
            {
              "outlet":"0000259010",
              "terminal":"000025901025",
              "availablePlaceMonthly":"10",
              "availablePlacesRegular":"20",
              "installationPoint":"Exit",
              "displayMessage":"Charge is 3.56 Euro. Prepare your card for the payment. Please wait...",
              "timeToDisplayMessage":"10",
              "timeSpent":"7200",
              "moneyToPay":"356",
              "barrierOpen":"-2",
              "timeOfServer":"20260415120000",
              "responseCode":"21",
              "responseDescription":"Topup declined. ECR should be used.",
              "recordId":"1234567890ABCDEF1234567890ABCDEF"
            }
        """.trimIndent()
    }

    fun exitCallBarrierFailed(token: String, timeOfInput: String, lastDigits: String): String {
        return """
            {
              "outlet":"0000259010",
              "terminal":"000025901025",
              "availablePlaceMonthly":"10",
              "availablePlacesRegular":"20",
              "installationPoint":"Exit",
              "displayMessage":"An error occurred. Please try again or press Help for assistance.",
              "timeToDisplayMessage":"10",
              "timeSpent":"3600",
              "moneyToPay":"0",
              "barrierOpen":"0",
              "timeOfServer":"20260415120000",
              "responseCode":"99",
              "responseDescription":"Barrier failed to open.",
              "recordId":"1234567890ABCDEF1234567890ABCDEF"
            }
        """.trimIndent()
    }

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
        recordId: String
    ): String {
        // Log the full request body that will be sent to RPS in production
        val body = """
            {
              "companyCode":"MarinaParking",
              "application":"Parking",
              "intallationPoint":"Exit",
              "outlet":"0000259010",
              "terminal":"000025901025",
              "token":"${token.take(20)}...",
              "inputType":"Card",
              "lastDigits":"$lastDigits",
              "firstDigits":"$firstDigits",
              "timeOfInput":"$timeOfInput",
              "amountPayed":"$amountPayed",
              "authCode":"$authCode",
              "responseCode":"$responseCode",
              "referenceNo":"$referenceNo",
              "originalRefNum":"$originalRefNum",
              "recordId":"$recordId"
            }
        """.trimIndent()
        AppLogger.logRequest("RPS_EXIT_PAYMENT_BODY", body)

        return """
            {
              "outlet":"0000259010",
              "terminal":"000025901025",
              "availablePlaceMonthly":"10",
              "availablePlacesRegular":"20",
              "installationPoint":"Exit",
              "displayMessage":"Thank you for parking here. Have a nice day!!",
              "timeToDisplayMessage":"5",
              "timeSpent":"7200",
              "moneyToPay":"$amountPayed",
              "barrierOpen":"1",
              "timeOfServer":"20260415120000",
              "responseCode":"00",
              "responseDescription":"Successful Response",
              "recordId":"$recordId"
            }
        """.trimIndent()
    }
}