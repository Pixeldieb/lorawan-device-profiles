/**
 * SenseCAP S2120 payload decoder for ChirpStack v4.
 *
 * Supported payload formats:
 * - Firmware before v2.0: frame identifiers 0x01 and 0x02
 * - Firmware v2.0 and later: frame identifiers 0x4A, 0x4B and 0x4C
 * - Battery, device information, interval, error and sensor status frames
 *
 * The decoder returns flat, human-readable fields and does not expose the
 * internal SenseCAP measurement identifiers as telemetry values.
 */
function decodeUplink(input) {
  var warnings = [];
  var errors = [];

  var data = {
    decoder_valid: true,
    f_port: input.fPort,
    payload_hex: bytesToHex(input.bytes)
  };

  try {
    decodePayload(
      input.bytes,
      data,
      warnings,
      errors
    );
  } catch (error) {
    data.decoder_valid = false;

    errors.push(
      String(
        error && error.message
          ? error.message
          : error
      )
    );
  }

  var result = {
    data: data
  };

  if (warnings.length > 0) {
    result.warnings = warnings;
  }

  if (errors.length > 0) {
    result.errors = errors;
  }

  return result;
}

/**
 * Decodes all concatenated frames in an uplink payload.
 *
 * @param {number[]} bytes Payload bytes.
 * @param {object} data Flat decoded output object.
 * @param {string[]} warnings Decoder warnings.
 * @param {string[]} errors Decoder errors.
 */
function decodePayload(
  bytes,
  data,
  warnings,
  errors
) {
  if (!bytes || bytes.length === 0) {
    data.decoder_valid = false;

    errors.push(
      'The uplink payload is empty.'
    );

    return;
  }

  var offset = 0;
  var frameIdentifiers = [];
  var unparsedFrameIdentifiers = [];
  var unparsedFrameData = [];
  var weatherFrameFound = false;

  while (offset < bytes.length) {
    var frameIdentifier =
      bytes[offset] & 0xFF;

    var frameLength =
      getFrameLength(frameIdentifier);

    var frameIdentifierHex =
      byteToHex(frameIdentifier);

    if (frameLength === 0) {
      data.decoder_valid = false;

      errors.push(
        'Unknown frame identifier 0x' +
        frameIdentifierHex +
        ' at byte offset ' +
        offset +
        '.'
      );

      break;
    }

    if (
      offset + frameLength >
      bytes.length
    ) {
      data.decoder_valid = false;

      errors.push(
        'Truncated frame 0x' +
        frameIdentifierHex +
        ' at byte offset ' +
        offset +
        ': expected ' +
        frameLength +
        ' bytes but only ' +
        (bytes.length - offset) +
        ' bytes remain.'
      );

      break;
    }

    frameIdentifiers.push(
      frameIdentifierHex
    );

    switch (frameIdentifier) {
      case 0x01:
      case 0x4A:
        decodePrimaryWeatherFrame(
          bytes,
          offset,
          data
        );

        weatherFrameFound = true;
        break;

      case 0x02:
      case 0x4B:
        decodeSecondaryWeatherFrame(
          bytes,
          offset,
          data
        );

        weatherFrameFound = true;
        break;

      case 0x4C:
        decodeExtendedWeatherFrame(
          bytes,
          offset,
          data
        );

        weatherFrameFound = true;
        break;

      case 0x03:
        decodeBatteryFrame(
          bytes,
          offset,
          data
        );
        break;

      case 0x04:
        decodeDeviceInformationFrame(
          bytes,
          offset,
          data
        );
        break;

      case 0x05:
        decodeIntervalFrame(
          bytes,
          offset,
          data
        );
        break;

      case 0x06:
        decodeErrorFrame(
          bytes,
          offset,
          data,
          warnings
        );
        break;

      case 0x10:
        decodeSensorStatusFrame(
          bytes,
          offset,
          data
        );
        break;

      default:
        unparsedFrameIdentifiers.push(
          frameIdentifierHex
        );

        unparsedFrameData.push(
          frameIdentifierHex +
          ':' +
          bytesToHex(
            bytes.slice(
              offset + 1,
              offset + frameLength
            )
          )
        );
        break;
    }

    offset += frameLength;
  }

  data.frame_identifiers =
    frameIdentifiers.join(',');

  if (
    weatherFrameFound &&
    data.sensor_data_valid === undefined
  ) {
    data.sensor_data_valid = true;
  }

  if (
    unparsedFrameIdentifiers.length > 0
  ) {
    data.unparsed_frame_count =
      unparsedFrameIdentifiers.length;

    data.unparsed_frame_identifiers =
      unparsedFrameIdentifiers.join(',');

    data.unparsed_frame_data =
      unparsedFrameData.join('|');

    warnings.push(
      'The payload contains recognized frame lengths without documented decoding logic: ' +
      unparsedFrameIdentifiers.join(', ') +
      '.'
    );
  }
}

/**
 * Returns the complete frame length in bytes,
 * including the identifier byte.
 *
 * @param {number} frameIdentifier Frame identifier.
 * @returns {number} Frame length in bytes, or zero when unknown.
 */
function getFrameLength(
  frameIdentifier
) {
  switch (frameIdentifier) {
    case 0x01:
    case 0x20:
    case 0x21:
    case 0x30:
    case 0x31:
    case 0x33:
    case 0x40:
    case 0x41:
    case 0x42:
    case 0x43:
    case 0x44:
    case 0x45:
    case 0x4A:
      return 11;

    case 0x02:
    case 0x4B:
      return 9;

    case 0x03:
    case 0x06:
      return 2;

    case 0x05:
    case 0x34:
      return 5;

    case 0x04:
    case 0x10:
    case 0x32:
    case 0x35:
    case 0x36:
    case 0x37:
    case 0x38:
    case 0x39:
      return 10;

    case 0x4C:
      return 7;

    default:
      return 0;
  }
}

/**
 * Decodes frame 0x01 or 0x4A.
 *
 * @param {number[]} bytes Payload bytes.
 * @param {number} offset Frame start offset.
 * @param {object} data Decoded output object.
 */
function decodePrimaryWeatherFrame(
  bytes,
  offset,
  data
) {
  data.air_temperature_c =
    readInt16BigEndian(
      bytes,
      offset + 1
    ) / 10;

  data.air_humidity_percent =
    readUInt8(
      bytes,
      offset + 3
    );

  data.light_intensity_lux =
    readUInt32BigEndian(
      bytes,
      offset + 4
    );

  data.uv_index =
    readUInt8(
      bytes,
      offset + 8
    ) / 10;

  data.wind_speed_m_s =
    readUInt16BigEndian(
      bytes,
      offset + 9
    ) / 10;
}

/**
 * Decodes frame 0x02 or 0x4B.
 *
 * @param {number[]} bytes Payload bytes.
 * @param {number} offset Frame start offset.
 * @param {object} data Decoded output object.
 */
function decodeSecondaryWeatherFrame(
  bytes,
  offset,
  data
) {
  var barometricPressureRaw =
    readUInt16BigEndian(
      bytes,
      offset + 7
    );

  data.wind_direction_degrees =
    readUInt16BigEndian(
      bytes,
      offset + 1
    );

  data.rainfall_intensity_mm_h =
    readUInt32BigEndian(
      bytes,
      offset + 3
    ) / 1000;

  data.barometric_pressure_pa =
    barometricPressureRaw * 10;

  data.barometric_pressure_hpa =
    barometricPressureRaw / 10;
}

/**
 * Decodes frame 0x4C.
 *
 * @param {number[]} bytes Payload bytes.
 * @param {number} offset Frame start offset.
 * @param {object} data Decoded output object.
 */
function decodeExtendedWeatherFrame(
  bytes,
  offset,
  data
) {
  data.peak_wind_gust_m_s =
    readUInt16BigEndian(
      bytes,
      offset + 1
    ) / 10;

  data.cumulative_rainfall_mm =
    readUInt32BigEndian(
      bytes,
      offset + 3
    ) / 1000;
}

/**
 * Decodes frame 0x03.
 *
 * @param {number[]} bytes Payload bytes.
 * @param {number} offset Frame start offset.
 * @param {object} data Decoded output object.
 */
function decodeBatteryFrame(
  bytes,
  offset,
  data
) {
  data.battery_percent =
    readUInt8(
      bytes,
      offset + 1
    );
}

/**
 * Decodes frame 0x04.
 *
 * @param {number[]} bytes Payload bytes.
 * @param {number} offset Frame start offset.
 * @param {object} data Decoded output object.
 */
function decodeDeviceInformationFrame(
  bytes,
  offset,
  data
) {
  var measurementIntervalMinutes =
    readUInt16BigEndian(
      bytes,
      offset + 6
    );

  var reservedIntervalMinutes =
    readUInt16BigEndian(
      bytes,
      offset + 8
    );

  data.battery_percent =
    readUInt8(
      bytes,
      offset + 1
    );

  data.hardware_version =
    readUInt8(
      bytes,
      offset + 2
    ) +
    '.' +
    readUInt8(
      bytes,
      offset + 3
    );

  data.firmware_version =
    readUInt8(
      bytes,
      offset + 4
    ) +
    '.' +
    readUInt8(
      bytes,
      offset + 5
    );

  data.measurement_interval_minutes =
    measurementIntervalMinutes;

  data.measurement_interval_seconds =
    measurementIntervalMinutes * 60;

  data.reserved_interval_minutes =
    reservedIntervalMinutes;

  data.reserved_interval_seconds =
    reservedIntervalMinutes * 60;
}

/**
 * Decodes frame 0x05.
 *
 * @param {number[]} bytes Payload bytes.
 * @param {number} offset Frame start offset.
 * @param {object} data Decoded output object.
 */
function decodeIntervalFrame(
  bytes,
  offset,
  data
) {
  var measurementIntervalMinutes =
    readUInt16BigEndian(
      bytes,
      offset + 1
    );

  var reservedIntervalMinutes =
    readUInt16BigEndian(
      bytes,
      offset + 3
    );

  data.measurement_interval_minutes =
    measurementIntervalMinutes;

  data.measurement_interval_seconds =
    measurementIntervalMinutes * 60;

  data.reserved_interval_minutes =
    reservedIntervalMinutes;

  data.reserved_interval_seconds =
    reservedIntervalMinutes * 60;
}

/**
 * Decodes frame 0x06.
 *
 * @param {number[]} bytes Payload bytes.
 * @param {number} offset Frame start offset.
 * @param {object} data Decoded output object.
 * @param {string[]} warnings Decoder warnings.
 */
function decodeErrorFrame(
  bytes,
  offset,
  data,
  warnings
) {
  var errorCode =
    readUInt8(
      bytes,
      offset + 1
    );

  var errorCodeHex =
    byteToHex(errorCode);

  var errorName =
    getSensorErrorName(
      errorCode
    );

  data.sensor_error_code =
    errorCodeHex;

  data.sensor_error =
    errorName;

  data.sensor_data_valid =
    errorCode === 0x00;

  if (errorCode !== 0x00) {
    warnings.push(
      'The sensor reported error 0x' +
      errorCodeHex +
      ': ' +
      errorName +
      '.'
    );
  }
}

/**
 * Decodes frame 0x10.
 *
 * @param {number[]} bytes Payload bytes.
 * @param {number} offset Frame start offset.
 * @param {object} data Decoded output object.
 */
function decodeSensorStatusFrame(
  bytes,
  offset,
  data
) {
  var statusByte =
    readUInt8(
      bytes,
      offset + 1
    );

  data.sensor_channel =
    (statusByte >> 4) & 0x0F;

  data.sensor_status =
    (statusByte >> 3) & 0x01;

  data.sensor_channel_type =
    statusByte & 0x07;

  data.sensor_eui =
    bytesToHex(
      bytes.slice(
        offset + 2,
        offset + 10
      )
    );
}

/**
 * Returns the symbolic name for a
 * SenseCAP sensor error code.
 *
 * @param {number} errorCode Numeric sensor error code.
 * @returns {string} Symbolic error name.
 */
function getSensorErrorName(
  errorCode
) {
  switch (errorCode) {
    case 0x00:
      return 'CCL_SENSOR_ERROR_NONE';

    case 0x01:
      return 'CCL_SENSOR_NOT_FOUND';

    case 0x02:
      return 'CCL_SENSOR_WAKEUP_ERROR';

    case 0x03:
      return 'CCL_SENSOR_NOT_RESPONSE';

    case 0x04:
      return 'CCL_SENSOR_DATA_EMPTY';

    case 0x05:
      return 'CCL_SENSOR_DATA_HEAD_ERROR';

    case 0x06:
      return 'CCL_SENSOR_DATA_CRC_ERROR';

    case 0x07:
      return 'CCL_SENSOR_DATA_B1_NO_VALID';

    case 0x08:
      return 'CCL_SENSOR_DATA_B2_NO_VALID';

    case 0x09:
      return 'CCL_SENSOR_RANDOM_NOT_MATCH';

    case 0x0A:
      return 'CCL_SENSOR_PUBKEY_SIGN_VERIFY_FAILED';

    case 0x0B:
      return 'CCL_SENSOR_DATA_SIGN_VERIFY_FAILED';

    case 0x0C:
      return 'CCL_SENSOR_DATA_VALUE_HIGH';

    case 0x0D:
      return 'CCL_SENSOR_DATA_VALUE_LOW';

    case 0x0E:
      return 'CCL_SENSOR_DATA_VALUE_MISSED';

    case 0x0F:
      return 'CCL_SENSOR_ARGUMENT_INVALID';

    case 0x10:
      return 'CCL_SENSOR_RS485_MASTER_BUSY';

    case 0x11:
      return 'CCL_SENSOR_RS485_RECEIVE_DATA_ERROR';

    case 0x12:
      return 'CCL_SENSOR_RS485_REGISTER_MISSED';

    case 0x13:
      return 'CCL_SENSOR_RS485_FUNCTION_EXECUTION_ERROR';

    case 0x14:
      return 'CCL_SENSOR_RS485_WRITE_STRATEGY_ERROR';

    case 0x15:
      return 'CCL_SENSOR_CONFIG_ERROR';

    case 0xFF:
      return 'CCL_SENSOR_DATA_ERROR_UNKNOWN';

    default:
      return 'CCL_SENSOR_OTHER_FAILURE';
  }
}

/**
 * Reads an unsigned 8-bit integer.
 *
 * @param {number[]} bytes Payload bytes.
 * @param {number} offset Byte offset.
 * @returns {number} Unsigned 8-bit value.
 */
function readUInt8(
  bytes,
  offset
) {
  return bytes[offset] & 0xFF;
}

/**
 * Reads an unsigned 16-bit big-endian integer.
 *
 * @param {number[]} bytes Payload bytes.
 * @param {number} offset Byte offset.
 * @returns {number} Unsigned 16-bit value.
 */
function readUInt16BigEndian(
  bytes,
  offset
) {
  return (
    readUInt8(
      bytes,
      offset
    ) * 256 +
    readUInt8(
      bytes,
      offset + 1
    )
  );
}

/**
 * Reads a signed 16-bit big-endian integer.
 *
 * @param {number[]} bytes Payload bytes.
 * @param {number} offset Byte offset.
 * @returns {number} Signed 16-bit value.
 */
function readInt16BigEndian(
  bytes,
  offset
) {
  var value =
    readUInt16BigEndian(
      bytes,
      offset
    );

  if (value >= 0x8000) {
    value -= 0x10000;
  }

  return value;
}

/**
 * Reads an unsigned 32-bit big-endian integer
 * without signed bitwise conversion.
 *
 * @param {number[]} bytes Payload bytes.
 * @param {number} offset Byte offset.
 * @returns {number} Unsigned 32-bit value.
 */
function readUInt32BigEndian(
  bytes,
  offset
) {
  return (
    readUInt8(
      bytes,
      offset
    ) * 16777216 +
    readUInt8(
      bytes,
      offset + 1
    ) * 65536 +
    readUInt8(
      bytes,
      offset + 2
    ) * 256 +
    readUInt8(
      bytes,
      offset + 3
    )
  );
}

/**
 * Converts one byte to a two-character
 * uppercase hexadecimal string.
 *
 * @param {number} value Byte value.
 * @returns {string} Two-character hexadecimal string.
 */
function byteToHex(
  value
) {
  var hexadecimal =
    (value & 0xFF)
      .toString(16)
      .toUpperCase();

  if (hexadecimal.length < 2) {
    hexadecimal =
      '0' + hexadecimal;
  }

  return hexadecimal;
}

/**
 * Converts a byte array to an uppercase
 * hexadecimal string.
 *
 * @param {number[]} bytes Byte array.
 * @returns {string} Hexadecimal string.
 */
function bytesToHex(
  bytes
) {
  var hexadecimal = '';

  for (
    var index = 0;
    index < bytes.length;
    index++
  ) {
    hexadecimal +=
      byteToHex(
        bytes[index]
      );
  }

  return hexadecimal;
}
