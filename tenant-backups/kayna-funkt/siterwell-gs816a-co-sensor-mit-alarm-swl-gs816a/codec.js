function decodeUplink(input) {
  var bytes = input.bytes || [];

  if (bytes.length !== 18) {
    return {
      data: {
        error: "Unexpected payload length",
        expectedLength: 18,
        receivedLength: bytes.length,
        fPort: input.fPort,
        rawHex: bytesToHex(bytes)
      },
      warnings: [
        "Siterwell GS816A payload should contain 18 bytes."
      ]
    };
  }

  var deviceStatus = bytes[5];
  var sensorStatus = bytes[7];

  // Byte 12 = Low Byte, Byte 13 = High Byte.
  var coPpm = bytes[11] | (bytes[12] << 8);

  var checksumCalculated = 0;

  for (var i = 0; i < 17; i++) {
    checksumCalculated =
      (checksumCalculated + bytes[i]) & 0xFF;
  }

  var data = {
    manufacturer: "Siterwell",
    model: decodeModel(bytes[2]),
    sensorType: "carbon_monoxide_alarm",

    fPort: input.fPort,

    protocolVersion: bytes[0],
    deviceTypeCode: bytes[1],
    deviceType: decodeDeviceType(bytes[1]),
    modelCode: bytes[2],
    softwareVersion: bytes[3],
    hardwareVersion: bytes[4],

    batteryPercent: bytes[10],
    coPpm: coPpm,

    tamperAlarm: getBit(deviceStatus, 7),
    buzzerFault: getBit(deviceStatus, 6),
    endOfLifeWarning: getBit(deviceStatus, 5),
    lowBatteryWarning: getBit(deviceStatus, 4),
    remoteRfTest: getBit(deviceStatus, 2),
    localKeyTest: getBit(deviceStatus, 1),
    heartbeat: getBit(deviceStatus, 0),

    coAlarm: getBit(sensorStatus, 6),
    alarmSilenced: getBit(sensorStatus, 5),
    coSensorFault: getBit(sensorStatus, 4),

    checksumReceived: bytes[17],
    checksumCalculated: checksumCalculated,
    checksumValid: bytes[17] === checksumCalculated,

    rawHex: bytesToHex(bytes)
  };

  data.event = determineEvent(data);

  var warnings = [];

  if (!data.checksumValid) {
    warnings.push(
      "Checksum mismatch: received " +
      toHex(data.checksumReceived) +
      ", calculated " +
      toHex(data.checksumCalculated)
    );
  }

  if (data.batteryPercent > 100) {
    warnings.push(
      "Invalid battery percentage: " +
      data.batteryPercent
    );
  }

  return {
    data: data,
    warnings: warnings
  };
}

function determineEvent(data) {
  if (data.coAlarm) {
    return "co_alarm";
  }

  if (data.coSensorFault) {
    return "co_sensor_fault";
  }

  if (data.lowBatteryWarning) {
    return "low_battery";
  }

  if (data.endOfLifeWarning) {
    return "end_of_life";
  }

  if (data.buzzerFault) {
    return "buzzer_fault";
  }

  if (data.tamperAlarm) {
    return "tamper_alarm";
  }

  if (data.remoteRfTest) {
    return "remote_rf_test";
  }

  if (data.localKeyTest) {
    return "local_test_button";
  }

  if (data.heartbeat) {
    return "heartbeat";
  }

  return "normal";
}

function decodeDeviceType(value) {
  switch (value) {
    case 1:
      return "smoke_alarm";
    case 2:
      return "heat_alarm";
    case 3:
      return "co_alarm";
    case 4:
      return "gas_alarm";
    case 5:
      return "heat_smoke_combo";
    case 6:
      return "co_smoke_combo";
    case 7:
      return "co_smoke_heat_combo";
    case 8:
      return "co_gas_combo";
    case 9:
      return "pir";
    case 10:
      return "water_leak_alarm";
    case 11:
      return "door_sensor";
    case 12:
      return "temperature_humidity_sensor";
    default:
      return "unknown";
  }
}

function decodeModel(value) {
  if (value === 2) {
    return "GS816A-H01";
  }

  return "unknown";
}

function getBit(value, bit) {
  return ((value >> bit) & 0x01) === 1;
}

function bytesToHex(bytes) {
  return bytes.map(function (value) {
    return toHex(value);
  }).join("");
}

function toHex(value) {
  return ("0" + value.toString(16))
    .slice(-2)
    .toUpperCase();
}
