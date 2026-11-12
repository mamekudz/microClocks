#pragma once

// Waveshare ESP32-S3-Touch-AMOLED-2.06, Pinbelegung laut
// https://docs.waveshare.com/ESP32-S3-Touch-AMOLED-2.06

// AMOLED, CO5300 über QSPI
constexpr int PIN_LCD_D0 = 4;
constexpr int PIN_LCD_D1 = 5;
constexpr int PIN_LCD_D2 = 6;
constexpr int PIN_LCD_D3 = 7;
constexpr int PIN_LCD_RST = 8;
constexpr int PIN_LCD_SCK = 11;
constexpr int PIN_LCD_CS = 12;
constexpr int PIN_LCD_TE = 13;

constexpr int LCD_WIDTH = 410;
constexpr int LCD_HEIGHT = 502;
// Ohne die 22 Pixel Spaltenversatz ist das Bild verschoben.
constexpr int LCD_COL_OFFSET = 22;

// Gemeinsamer I2C-Bus: Touch, AXP2101, QMI8658, PCF85063, ES8311, ES7210
constexpr int PIN_I2C_SCL = 14;
constexpr int PIN_I2C_SDA = 15;

// Touch FT3168
constexpr int PIN_TP_RST = 9;
constexpr int PIN_TP_INT = 38;

// Sensoren
constexpr int PIN_IMU_INT1 = 21;
constexpr int PIN_RTC_INT = 39;
constexpr uint8_t RTC_I2C_ADDR = 0x51;

// TF-Karte (SPI)
constexpr int PIN_SD_MOSI = 1;
constexpr int PIN_SD_SCK = 2;
constexpr int PIN_SD_MISO = 3;
constexpr int PIN_SD_CS = 17;

// Audio
constexpr int PIN_I2S_MCLK = 16;
constexpr int PIN_I2S_DSDIN = 40;
constexpr int PIN_I2S_SCLK = 41;
constexpr int PIN_I2S_ASDOUT = 42;
constexpr int PIN_I2S_LRCK = 45;
constexpr int PIN_PA_CTRL = 46;

// Tasten: BOOT low = gedrückt, PWR (über SYS_OUT) high = gedrückt
constexpr int PIN_BOOT = 0;
constexpr int PIN_PWR = 10;
