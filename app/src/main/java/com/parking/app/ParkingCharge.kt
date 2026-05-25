package com.parking.app

data class ParkingCharge(
    val fromMin:  Int,
    val toMin:    Int?,   // null = open ended (e.g. "240+" minutes)
    val feeCents: Int
)