#include <Arduino.h>
#include <Arduino_GFX_Library.h>
#include <Wire.h>
#include <time.h>

#include "board.h"

static Arduino_DataBus *bus = new Arduino_ESP32QSPI(PIN_LCD_CS, PIN_LCD_SCK, PIN_LCD_D0, PIN_LCD_D1, PIN_LCD_D2, PIN_LCD_D3);
static Arduino_CO5300 *gfx = new Arduino_CO5300(bus, PIN_LCD_RST, 0, LCD_WIDTH, LCD_HEIGHT, LCD_COL_OFFSET, 0, 0, 0);

static constexpr uint8_t kBrightness = 200;
static constexpr uint8_t kRegSeconds = 0x04;

static bool g_rtcPresent = false;
static time_t g_fallbackBase = 0;
static uint32_t g_fallbackMillis = 0;

static uint8_t fromBcd(uint8_t value) { return (value >> 4) * 10 + (value & 0x0F); }
static uint8_t toBcd(int value) { return static_cast<uint8_t>(((value / 10) << 4) | (value % 10)); }

// Zeitpunkt des Kompilierens als Startwert, solange die RTC noch nie gestellt wurde.
static tm buildTime() {
	static const char months[] = "JanFebMarAprMayJunJulAugSepOctNovDec";
	char month[4] = {0};
	tm t = {};
	sscanf(__DATE__, "%3s %d %d", month, &t.tm_mday, &t.tm_year);
	sscanf(__TIME__, "%d:%d:%d", &t.tm_hour, &t.tm_min, &t.tm_sec);
	t.tm_mon = (strstr(months, month) - months) / 3;
	t.tm_year -= 1900;
	mktime(&t);
	return t;
}

// PCF85063: Register 0x04..0x0A, BCD. Bit 7 der Sekunden (OS) meldet einen Oszillatorstopp.
static bool rtcRead(tm &t, bool &valid) {
	Wire.beginTransmission(RTC_I2C_ADDR);
	Wire.write(kRegSeconds);
	if (Wire.endTransmission(false) != 0) return false;
	uint8_t r[7];
	if (Wire.requestFrom(RTC_I2C_ADDR, static_cast<uint8_t>(sizeof r)) != sizeof r) return false;
	for (uint8_t &value : r) value = Wire.read();
	valid = (r[0] & 0x80) == 0;
	t = {};
	t.tm_sec = fromBcd(r[0] & 0x7F);
	t.tm_min = fromBcd(r[1] & 0x7F);
	t.tm_hour = fromBcd(r[2] & 0x3F);
	t.tm_mday = fromBcd(r[3] & 0x3F);
	t.tm_wday = r[4] & 0x07;
	t.tm_mon = fromBcd(r[5] & 0x1F) - 1;
	t.tm_year = fromBcd(r[6]) + 100;
	return true;
}

static bool rtcWrite(const tm &t) {
	Wire.beginTransmission(RTC_I2C_ADDR);
	Wire.write(kRegSeconds);
	Wire.write(toBcd(t.tm_sec));
	Wire.write(toBcd(t.tm_min));
	Wire.write(toBcd(t.tm_hour));
	Wire.write(toBcd(t.tm_mday));
	Wire.write(static_cast<uint8_t>(t.tm_wday));
	Wire.write(toBcd(t.tm_mon + 1));
	Wire.write(toBcd(t.tm_year - 100));
	return Wire.endTransmission() == 0;
}

static tm now() {
	tm t = {};
	bool valid = false;
	if (g_rtcPresent && rtcRead(t, valid)) return t;
	time_t seconds = g_fallbackBase + (millis() - g_fallbackMillis) / 1000;
	localtime_r(&seconds, &t);
	return t;
}

static void drawCentered(const char *text, uint8_t size, int y, uint16_t color) {
	gfx->setTextSize(size);
	gfx->setTextColor(color, RGB565_BLACK);
	const int width = static_cast<int>(strlen(text)) * 6 * size;
	gfx->setCursor((LCD_WIDTH - width) / 2, y);
	gfx->print(text);
}

static void drawClock(const tm &t) {
	static int lastMinute = -1;
	char text[16];
	if (t.tm_min != lastMinute) {
		lastMinute = t.tm_min;
		snprintf(text, sizeof text, "%02d:%02d", t.tm_hour, t.tm_min);
		drawCentered(text, 12, 170, RGB565_WHITE);
		snprintf(text, sizeof text, "%02d.%02d.%04d", t.tm_mday, t.tm_mon + 1, t.tm_year + 1900);
		drawCentered(text, 3, 300, RGB565_LIGHTGREY);
	}
	snprintf(text, sizeof text, "%02d", t.tm_sec);
	drawCentered(text, 5, 360, RGB565_DARKGREY);
}

void setup() {
	Serial.begin(115200);

	if (!gfx->begin()) Serial.println("CO5300: begin fehlgeschlagen");
	gfx->fillScreen(RGB565_BLACK);
	gfx->setBrightness(kBrightness);

	Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
	tm t = {};
	bool valid = false;
	g_rtcPresent = rtcRead(t, valid);
	if (g_rtcPresent && !valid) {
		t = buildTime();
		rtcWrite(t);
		Serial.println("PCF85063: auf Build-Zeit gestellt");
	}
	if (!g_rtcPresent) {
		tm start = buildTime();
		g_fallbackBase = mktime(&start);
		g_fallbackMillis = millis();
		Serial.println("PCF85063: nicht gefunden, Zeit läuft ab Build-Zeit");
	}
}

void loop() {
	static int lastSecond = -1;
	const tm t = now();
	if (t.tm_sec != lastSecond) {
		lastSecond = t.tm_sec;
		drawClock(t);
	}
	delay(50);
}
