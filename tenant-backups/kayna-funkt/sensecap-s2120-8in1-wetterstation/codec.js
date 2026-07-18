/**
 * SenseCAP S2120 payload decoder for ChirpStack v4.
 *
 * Supported payload formats:
 * - Firmware before v2.0: frame identifiers 0x01 and 0x02
 * - Firmware v2.0 and later: frame identifiers 0x4A, 0x4B and 0x4C
 * - Battery, device information, interval, error and sensor status frames
 *
 * Important behavior:
 * - Available measurements are always returned.
 * - Sensor error frames do not invalidate valid measurements.
 * - Missing measurement groups are omitted.
 * - Missing values are never replaced with false zero values.
 * - Sensor errors are returned as warnings, not decoder errors.
 */
function decodeUplink(input) {
  var bytes =
    input && input.bytes
      ? input.bytes
      : [];

  var fPort =
    input && input.fPort !== undefined
      ? input.fPort
      : 0;

  var data = {
    decoder_valid: true,
    f_port: fPort
  };

  var warnings = [];

  /*
   * Empty application payloads can occur on fPort 0
   * when the device answers LoRaWAN MAC commands.
   */
  if (bytes.length === 0) {
    data.payload_empty = true;

    return {
      data: data
    };
  }

  /*
   * SenseCAP uses fPort 199 for management,
   * configuration and device-status payloads.
   *
   * These payloads do not contain normal S2120
   * weather measurement frames.
   */
  if (fPort === 199) {
    data.management_payload = true;
    data.payload_hex = bytesToHex(bytes);

    warnings.push(
      'SenseCAP management payload on fPort 199; no weather measurements are contained in this frame.'
    );

    return {
      data: data,
      warnings: warnings
    };
  }

  decodeFrames(
    bytes,
    data,
    warnings
  );

  var result = {
    data: data
  };

  if (warnings.length > 0) {
    result.warnings = warnings;
  }

  return result;
}

/**
 * Decodes all concatenated SenseCAP frames.
 *
 * @param {number[]} bytes Complete uplink payload.
 * @param {object} data Decoded ChirpStack data object.
 * @param {string[]} warnings Decoder warnings.
 */
function decodeFrames(
  bytes,
  data,
  warnings
) {
  var offset = 0;

  var frameIdentifiers = [];

  var primaryWeatherFrameReceived = false;
  var secondaryWeatherFrameReceived = false;
  var extendedWeatherFrameReceived = false;
  var sensorErrorPresent = false;

  while (offset < bytes.length) {
    var frameIdentifier =
      readUInt8(
        bytes,
        offset
      );

    var frameLength =
      getFrameLength(
        frameIdentifier
      );

    var frameIdentifierHex =
      byteToHex(
        frameIdentifier
      );

    /*
     * An unknown frame cannot safely be skipped because
     * its length is unknown. Previously decoded values
     * are still returned.
     */
    if (frameLength === 0) {
      data.decoder_valid = false;

      data.unparsed_payload_hex =
        bytesToHex(
          bytes.slice(offset)
        );

      warnings.push(
        'Unknown frame identifier 0x' +
        frameIdentifierHex +
        ' at byte offset ' +
        offset +
        '. Remaining bytes were not decoded.'
      );

      break;
    }

    /*
     * Keep previously decoded measurements when the
     * final frame is incomplete.
     */
    if (
      offset + frameLength >
      bytes.length
    ) {
      data.decoder_valid = false;

      data.unparsed_payload_hex =
        bytesToHex(
          bytes.slice(offset)
        );

      warnings.push(
        'Truncated frame 0x' +
        frameIdentifierHex +
        ' at byte offset ' +
        offset +
        '.'
      );

      break;
    }

    frameIdentifiers.push(
      frameIdentifierHex
    );

    switch (frameIdentifier) {
      /*
       * Primary weather data:
       * - Air temperature
       * - Air humidity
       * - Light intensity
       * - UV index
       * - Wind speed
       */
      case 0x01:
      case 0x4A:
        decodePrimaryWeatherFrame(
          bytes,
          offset,
          data
        );

        primaryWeatherFrameReceived = true;
        break;

      /*
       * Secondary weather data:
       * - Wind direction
       * - Rainfall intensity
       * - Barometric pressure
       */
      case 0x02:
      case 0x4B:
        decodeSecondaryWeatherFrame(
          bytes,
          offset,
          data
        );

        secondaryWeatherFrameReceived = true;
        break;

      /*
       * Extended weather data:
       * - Peak wind gust
       * - Cumulative rainfall
       */
      case 0x4C:
        decodeExtendedWeatherFrame(
          bytes,
          offset,
          data
        );

        extendedWeatherFrameReceived = true;
        break;

      /*
       * Battery frame.
       */
      case 0x03:
        decodeBatteryFrame(
          bytes,
          offset,
          data
        );
        break;

      /*
       * Device information frame.
       */
      case 0x04:
        decodeDeviceInformationFrame(
          bytes,
          offset,
          data
        );
        break;

      /*
       * Measurement interval frame.
       */
      case 0x05:
        decodeIntervalFrame(
          bytes,
          offset,
          data
        );
        break;

      /*
       * Sensor error frame.
       *
       * This does not invalidate already decoded values.
       */
      case 0x06:
        decodeErrorFrame(
          bytes,
          offset,
          data,
          warnings
        );

        sensorErrorPresent =
          readUInt8(
            bytes,
            offset + 1
          ) !== 0x00;
        break;

      /*
       * Sensor status frame.
       */
      case 0x10:
        decodeSensorStatusFrame(
          bytes,
          offset,
          data
        );
        break;

      /*
       * Frames with known lengths but without documented
       * S2120 weather measurement decoding are safely skipped.
       */
      default:
        data[
          'frame_0x' +
          frameIdentifierHex +
          '_payload_hex'
        ] =
          bytesToHex(
            bytes.slice(
              offset + 1,
              offset + frameLength
            )
          );

        warnings.push(
          'Frame 0x' +
          frameIdentifierHex +
          ' was skipped because no measurement decoder is defined for it.'
        );
        break;
    }

    offset += frameLength;
  }

  data.frame_identifiers =
    frameIdentifiers.join(',');

  data.primary_weather_data_available =
    primaryWeatherFrameReceived;

  data.secondary_weather_data_available =
    secondaryWeatherFrameReceived;

  data.extended_weather_data_available =
    extendedWeatherFrameReceived;

  data.sensor_error_present =
    sensorErrorPresent;

  if (
    primaryWeatherFrameReceived ||
    secondaryWeatherFrameReceived ||
    extendedWeatherFrameReceived
  ) {
    data.weather_data_available = true;

    data.weather_data_complete =
      primaryWeatherFrameReceived &&
      secondaryWeatherFrameReceived &&
      extendedWeatherFrameReceived &&
      !sensorErrorPresent;
  } else {
    data.weather_data_available = false;
    data.weather_data_complete = false;
  }

  /*
   * A missing 0x4B frame must not cause the valid
   * 0x4A and 0x4C measurements to be discarded.
   */
  if (
    !secondaryWeatherFrameReceived &&
    (
      primaryWeatherFrameReceived ||
      extendedWeatherFrameReceived
    )
  ) {
    warnings.push(
      'The secondary weather frame is missing. Wind direction, rainfall intensity and barometric pressure are therefore not included.'
    );
  }
}

/**
 * Returns the complete length of a frame,
 * including its identifier byte.
 *
 * @param {number} frameIdentifier Frame identifier.
 * @returns {number} Frame length or zero when unknown.
 */
function getFrameLength(
  frameIdentifier
) {
  switch (frameIdentifier) {
    /*
     * Eleven-byte frames.
     */
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

    /*
     * Nine-byte frames.
     */
    case 0x02:
    case 0x4B:
      return 9;

    /*
     * Two-byte frames.
     */
    case 0x03:
    case 0x06:
      return 2;

    /*
     * Five-byte frames.
     */
    case 0x05:
    case 0x34:
      return 5;

    /*
     * Ten-byte frames.
     */
    case 0x04:
    case 0x10:
    case 0x32:
    case 0x35:
    case 0x36:
    case 0x37:
    case 0x38:
    case 0x39:
      return 10;

    /*
     * Seven-byte extended weather frame.
     */
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
 * @param {object} data Decoded data object.
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
 * @param {object} data Decoded data object.
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

  data.barometric_pressure_hpa =
    barometricPressureRaw / 10;

  data.barometric_pressure_pa =
    barometricPressureRaw * 10;
}

/**
 * Decodes frame 0x4C.
 *
 * @param {number[]} bytes Payload bytes.
 * @param {number} offset Frame start offset.
 * @param {object} data Decoded data object.
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
 * @param {object} data Decoded data object.
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
 * @param {object} data Decoded data object.
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

  var gpsIntervalMinutes =
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

  data.gps_interval_minutes =
    gpsIntervalMinutes;

  data.gps_interval_seconds =
    gpsIntervalMinutes * 60;
}

/**
 * Decodes frame 0x05.
 *
 * @param {number[]} bytes Payload bytes.
 * @param {number} offset Frame start offset.
 * @param {object} data Decoded data object.
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

  var gpsIntervalMinutes =
    readUInt16BigEndian(
      bytes,
      offset + 3
    );

  data.measurement_interval_minutes =
    measurementIntervalMinutes;

  data.measurement_interval_seconds =
    measurementIntervalMinutes * 60;

  data.gps_interval_minutes =
    gpsIntervalMinutes;

  data.gps_interval_seconds =
    gpsIntervalMinutes * 60;
}

/**
 * Decodes frame 0x06.
 *
 * The sensor error is exposed as diagnostic data.
 * It does not invalidate other measurements.
 *
 * @param {number[]} bytes Payload bytes.
 * @param {number} offset Frame start offset.
 * @param {object} data Decoded data object.
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
    byteToHex(
      errorCode
    );

  var errorName =
    getSensorErrorName(
      errorCode
    );

  data.sensor_error_code =
    errorCodeHex;

  data.sensor_error =
    errorName;

  if (errorCode !== 0x00) {
    warnings.push(
      'The sensor reported error 0x' +
      errorCodeHex +
      ': ' +
      errorName +
      '. Available measurements were decoded anyway.'
    );
  }
}

/**
 * Decodes frame 0x10.
 *
 * @param {number[]} bytes Payload bytes.
 * @param {number} offset Frame start offset.
 * @param {object} data Decoded data object.
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
 * Returns the symbolic SenseCAP sensor error name.
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
 * @returns {number} Unsigned value.
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
 * @returns {number} Unsigned value.
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
 * @returns {number} Signed value.
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
 * Reads an unsigned 32-bit big-endian integer.
 *
 * This avoids signed 32-bit JavaScript bitwise conversion.
 *
 * @param {number[]} bytes Payload bytes.
 * @param {number} offset Byte offset.
 * @returns {number} Unsigned value.
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
 * Converts one byte to a two-character uppercase
 * hexadecimal string.
 *
 * @param {number} value Byte value.
 * @returns {string} Hexadecimal byte.
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
