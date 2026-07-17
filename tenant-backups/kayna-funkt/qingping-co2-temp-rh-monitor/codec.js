/**
 * v4-kompatibler Payload-Decoder für ChirpStack
 *
 * @param {Object} input - Objekt mit den Eingabeparametern
 * @param {number[]} input.bytes - Byte-Array vom Gerät
 * @param {number}   input.fPort - LoRaWAN-Port
 * @returns {Object} Ergebnisobjekt mit den decodierten Daten, Warnungen und Fehlern
 */
function decodeUplink(input) {
  // Lese Bytes und Port aus dem Input-Objekt
  const bytes = input.bytes;
  const port = input.fPort;

  // Rufe die eigentliche Decodierfunktion auf
  const decodedData = decodePayload(bytes, port);

  // Baue das v4-Antwortobjekt
  return {
    data: decodedData,
    warnings: [],
    errors: []
  };
}

/**
 * Kern-Decoder: Wandelt das Byte-Array in ein lesbares Objekt um
 *
 * @param {number[]} bytes - Byte-Array vom Gerät
 * @param {number}   port  - LoRaWAN-Port (hier ungenutzt)
 * @returns {Object} Objekt mit allen Data Keys
 */
function decodePayload(bytes, port) {
  // Ergebnisobjekt initialisieren
  const result = {};

  // 1. Device Address (erstes Byte als Hex-String)
  const rawDeviceAddress = bytes[0];
  const deviceAddressHex = rawDeviceAddress.toString(16).toUpperCase().padStart(2, '0');
  result.deviceAddress = deviceAddressHex;

  // 2. Report Code (zweites Byte als Hex-String)
  const rawReportCode = bytes[1];
  const reportCodeHex = rawReportCode.toString(16).toUpperCase().padStart(2, '0');
  result.reportCode = reportCodeHex;

  // 3. Data Length (drittes Byte, als Zahl)
  const rawDataLengthHex = bytes[2].toString(16);
  const dataLength = parseInt(rawDataLengthHex, 16);
  result.dataLength = dataLength;

  // 4. Data Type (viertes Byte als Hex-String)
  const rawDataType = bytes[3];
  const dataTypeHex = rawDataType.toString(16).toUpperCase().padStart(2, '0');
  result.dataType = dataTypeHex;

  // Wenn Data Type "01" (Hex) ist, dekodiere zusätzliche Felder
  if (dataTypeHex === "01") {

    // 5. Timestamp (Bytes 4–7 als Hex-String)
    const timestampBytes = bytes.slice(4, 8);
    const timestampHex = bytesToHexString(timestampBytes);
    result.timestamp = timestampHex;

    // 6. Temperatur und Luftfeuchtigkeit (Bytes 8–10)
    const thBytes = bytes.slice(8, 11);
    const thValue = parseInt(bytesToHexString(thBytes), 16);
    // Obere 4 Bits: Temperatur (Offset 500, geteilt durch 10)
    const rawTemperature = (thValue >> 12) & 0x0FFF;
    const temperatureCelsius = (rawTemperature - 500) / 10.0;
    // Untere 12 Bits: Luftfeuchtigkeit (geteilt durch 10)
    const rawHumidity = thValue & 0x0FFF;
    const humidityPercent = rawHumidity / 10.0;
    result.temperature = temperatureCelsius;
    result.humidity = humidityPercent;

    // 7. CO₂-Wert (Bytes 11–12 als Zahl)
    const co2Bytes = bytes.slice(11, 13);
    const co2Hex = bytesToHexString(co2Bytes);
    const co2Value = parseInt(co2Hex, 16);
    result.co2 = co2Value;

    // 8. Batterielevel (Byte 13 als Zahl)
    const rawBattery = bytes[13];
    const batteryLevel = rawBattery; // angenommen 0–255
    result.battery = batteryLevel;

    // 9. Version Code (Bytes 14–19 als Hex-String)
    const versionCodeBytes = bytes.slice(14, 20);
    const versionCodeHex = bytesToHexString(versionCodeBytes);
    result.versionCode = versionCodeHex;

    // 10. CRC (Bytes 20–21 als Hex-String)
    const crcBytes = bytes.slice(20, 22);
    const crcHex = bytesToHexString(crcBytes);
    result.crc = crcHex;
  }

  return result;
}

/**
 * Hilfsfunktion: Wandelt ein Byte-Array in einen Hex-String um
 *
 * @param {number[]} byteArray - Array von Bytes
 * @returns {string} Zusammengesetzter Hex-String, Großbuchstaben, zweistellig pro Byte
 */
function bytesToHexString(byteArray) {
  let hexString = "";
  for (let i = 0; i < byteArray.length; i++) {
    const byte = byteArray[i] & 0xFF;
    const hex = byte.toString(16).toUpperCase().padStart(2, '0');
    hexString += hex;
  }
  return hexString;
}
