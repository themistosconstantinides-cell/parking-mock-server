package com.parking.app

/**
 * Simple translation map for the parking app UI.
 * No Android locale changes, no activity recreate.
 * Just a map of strings per language.
 */
object Translations {

    data class LangStrings(
        val flag:              String,
        val code:              String,
        val tapToContinue:     String,
        val tapToExit:         String,
        val selectToContinue:  String,
        val bankCard:          String,
        val monthlyCard:       String,
        val freeSpaces:        String,
        val parkingRates:      String,
        val normal:            String,
        val monthly:           String,
        val welcomeEntrance:   String,   // shown as main message on idle entrance screen
        val welcomeExit:       String    // shown as main message on idle exit screen
    )

    val EN = LangStrings(
        flag             = "🇬🇧",
        code             = "EN",
        tapToContinue    = "To park, tap the BANK CARD button below",
        tapToExit        = "To exit, tap the BANK CARD button below",
        selectToContinue = "Select your card type below",
        bankCard         = "BANK CARD",
        monthlyCard      = "MONTHLY CARD",
        freeSpaces       = "FREE SPACES",
        parkingRates     = "PARKING RATES",
        normal           = "Normal",
        monthly          = "Monthly",
        welcomeEntrance  = "Welcome! Please use your bank card to enter.",
        welcomeExit      = "Please present the card you used at entrance."
    )

    val EL = LangStrings(
        flag             = "🇬🇷",
        code             = "EL",
        tapToContinue    = "Για να παρκάρετε, πατήστε ΤΡΑΠΕΖΙΚΗ ΚΑΡΤΑ παρακάτω",
        tapToExit        = "Για έξοδο, πατήστε ΤΡΑΠΕΖΙΚΗ ΚΑΡΤΑ παρακάτω",
        selectToContinue = "Επιλέξτε τύπο κάρτας παρακάτω",
        bankCard         = "ΤΡΑΠΕΖΙΚΗ ΚΑΡΤΑ",
        monthlyCard      = "ΜΗΝΙΑΙΑ ΚΑΡΤΑ",
        freeSpaces       = "ΕΛΕΥΘΕΡΕΣ ΘΕΣΕΙΣ",
        parkingRates     = "ΤΙΜΕΣ ΠΑΡΚΙΝΓΚ",
        normal           = "Κανονικές",
        monthly          = "Μηνιαίες",
        welcomeEntrance  = "Καλωσορίσατε! Χρησιμοποιήστε την τραπεζική σας κάρτα για είσοδο.",
        welcomeExit      = "Παρακαλώ ετοιμάστε την κάρτα που χρησιμοποιήσατε κατά την είσοδο."
    )

    val RU = LangStrings(
        flag             = "🇷🇺",
        code             = "RU",
        tapToContinue    = "Для парковки нажмите БАНКОВСКАЯ КАРТА ниже",
        tapToExit        = "Для выезда нажмите БАНКОВСКАЯ КАРТА ниже",
        selectToContinue = "Выберите тип карты ниже",
        bankCard         = "БАНКОВСКАЯ КАРТА",
        monthlyCard      = "МЕСЯЧНАЯ КАРТА",
        freeSpaces       = "СВОБОДНЫЕ МЕСТА",
        parkingRates     = "ТАРИФЫ",
        normal           = "Обычные",
        monthly          = "Месячные",
        welcomeEntrance  = "Добро пожаловать! Используйте банковскую карту для въезда.",
        welcomeExit      = "Пожалуйста, приготовьте карту, использованную при въезде."
    )

    val IW = LangStrings(
        flag             = "🇮🇱",
        code             = "IW",
        tapToContinue    = "לחניה, לחץ על כרטיס בנק למטה",
        tapToExit        = "ליציאה, לחץ על כרטיס בנק למטה",
        selectToContinue = "בחר סוג כרטיס למטה",
        bankCard         = "כרטיס בנק",
        monthlyCard      = "כרטיס חודשי",
        freeSpaces       = "מקומות פנויים",
        parkingRates     = "תעריפי חניה",
        normal           = "רגיל",
        monthly          = "חודשי",
        welcomeEntrance  = "ברוכים הבאים! השתמש בכרטיס הבנק שלך לכניסה.",
        welcomeExit      = "אנא הכן את הכרטיס שהשתמשת בו בכניסה."
    )

    val ALL = listOf(EN, EL, RU, IW)

    fun forCode(code: String): LangStrings =
        ALL.find { it.code == code.uppercase() } ?: EN
}