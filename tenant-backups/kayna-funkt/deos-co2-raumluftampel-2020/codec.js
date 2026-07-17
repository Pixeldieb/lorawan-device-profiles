/**
 * DEOS SAM CO2 air-quality sensor uplink decoder for ChirpStack v4.
 *
 * Device / protocol:
 * - DEOS SAM, also known by the clevabit codename "Rooclimo"
 * - clevabit General Purpose LoRaWAN Protocol, revision 1.0
 * - Payload encoding: CBOR
 *
 * Documented measurement transfer identifiers:
 * - 1: Temperature in degrees Celsius
 * - 2: Relative humidity in percent
 * - 3: Carbon dioxide concentration in parts per million
 *
 * The first element of the CBOR root array is the protocol header:
 * [vendorId, deviceId, portId]
 *
 * Expected DEOS SAM header from the supplied reference payload:
 * - Vendor ID: 1
 * - Device ID: 102 (0x0066)
 * - Port ID: 1
 */

function decodeUplink(input) {
    try {
        if (!input || !Array.isArray(input.bytes)) {
            return {
                data: {},
                errors: ["The decoder input does not contain a byte array."]
            };
        }

        if (input.bytes.length === 0) {
            return {
                data: {},
                errors: ["The uplink payload is empty."]
            };
        }

        var packet = decodeCbor(input.bytes);

        if (!Array.isArray(packet) || packet.length === 0) {
            return {
                data: {},
                errors: ["The CBOR root element must be a non-empty array."]
            };
        }

        var header = packet[0];

        if (!Array.isArray(header) || header.length < 3) {
            return {
                data: {},
                errors: [
                    "The payload does not contain a valid clevabit protocol header."
                ]
            };
        }

        var vendorId = header[0];
        var deviceId = header[1];
        var sensorPortId = header[2];
        var warnings = [];

        if (vendorId !== 1 || deviceId !== 102) {
            warnings.push(
                "Unexpected protocol header. Expected vendor ID 1 and device ID 102."
            );
        }

        var decoded = {
            protocol: {
                name: "clevabit LoRaWAN Protocol",
                version: "1.0",
                vendor_id: vendorId,
                vendor_id_hex: toHex16(vendorId),
                device_id: deviceId,
                device_id_hex: toHex16(deviceId),
                sensor_port_id: sensorPortId,
                lorawan_f_port: input.fPort
            }
        };

        var additionalMeasurements = {};

        for (var index = 1; index < packet.length; index++) {
            var tuple = packet[index];

            if (!Array.isArray(tuple) || tuple.length < 2) {
                warnings.push(
                    "Ignored malformed measurement tuple at index " +
                    index +
                    "."
                );
                continue;
            }

            var transferId = tuple[0];
            var value = tuple[1];

            switch (transferId) {
                case 1:
                    decoded.temperature = requireFiniteNumber(
                        value,
                        "temperature"
                    );
                    break;

                case 2:
                    decoded.humidity = requireFiniteNumber(
                        value,
                        "humidity"
                    );
                    break;

                case 3:
                    decoded.co2 = requireFiniteNumber(
                        value,
                        "carbon dioxide"
                    );
                    break;

                default:
                    /*
                     * Transfer identifiers other than 1, 2 and 3 are not
                     * defined by the supplied Rooclimo protocol
                     * specification. They are retained without assigning
                     * an undocumented meaning.
                     */
                    additionalMeasurements[
                        "transfer_" + String(transferId)
                    ] = value;
                    break;
            }
        }

        if (Object.keys(additionalMeasurements).length > 0) {
            decoded.additional_measurements = additionalMeasurements;
        }

        if (typeof decoded.temperature !== "number") {
            warnings.push(
                "Temperature measurement with transfer ID 1 is missing."
            );
        }

        if (typeof decoded.humidity !== "number") {
            warnings.push(
                "Humidity measurement with transfer ID 2 is missing."
            );
        }

        if (typeof decoded.co2 !== "number") {
            warnings.push(
                "Carbon dioxide measurement with transfer ID 3 is missing."
            );
        }

        if (
            typeof decoded.temperature === "number" &&
            typeof decoded.humidity === "number" &&
            decoded.humidity > 0 &&
            decoded.humidity <= 100
        ) {
            decoded.dew_point = calculateDewPoint(
                decoded.temperature,
                decoded.humidity
            );
        }

        if (typeof decoded.co2 === "number") {
            decoded.air_quality = classifyCarbonDioxide(decoded.co2);
        }

        var result = {
            data: decoded
        };

        if (warnings.length > 0) {
            result.warnings = warnings;
        }

        return result;
    } catch (error) {
        return {
            data: {},
            errors: [formatError(error)]
        };
    }
}

/**
 * Decodes the limited CBOR feature set used by the DEOS SAM protocol.
 *
 * The implementation also supports definite and indefinite arrays, maps,
 * byte strings and text strings so malformed or extended packets fail
 * cleanly.
 */
function decodeCbor(bytes) {
    var buffer = new ArrayBuffer(bytes.length);
    var byteView = new Uint8Array(buffer);

    for (var index = 0; index < bytes.length; index++) {
        var byte = bytes[index];

        if (
            !Number.isInteger(byte) ||
            byte < 0 ||
            byte > 255
        ) {
            throw new Error(
                "Payload byte at index " + index + " is invalid."
            );
        }

        byteView[index] = byte;
    }

    var view = new DataView(buffer);
    var offset = 0;

    function ensureAvailable(length) {
        if (
            length < 0 ||
            offset + length > view.byteLength
        ) {
            throw new Error(
                "Unexpected end of CBOR payload at byte " +
                offset +
                "."
            );
        }
    }

    function readUint8() {
        ensureAvailable(1);

        var value = view.getUint8(offset);
        offset += 1;

        return value;
    }

    function readUint16() {
        ensureAvailable(2);

        var value = view.getUint16(offset, false);
        offset += 2;

        return value;
    }

    function readUint32() {
        ensureAvailable(4);

        var value = view.getUint32(offset, false);
        offset += 4;

        return value;
    }

    function readUint64() {
        var high = readUint32();
        var low = readUint32();
        var value = high * 4294967296 + low;

        if (!Number.isSafeInteger(value)) {
            throw new Error(
                "CBOR integer exceeds the JavaScript safe-integer range."
            );
        }

        return value;
    }

    function readFloat16() {
        var value = readUint16();
        var sign = (value & 0x8000) !== 0 ? -1 : 1;
        var exponent = (value >> 10) & 0x1f;
        var fraction = value & 0x03ff;

        if (exponent === 0) {
            if (fraction === 0) {
                return sign === -1 ? -0 : 0;
            }

            return (
                sign *
                Math.pow(2, -14) *
                (fraction / 1024)
            );
        }

        if (exponent === 31) {
            return fraction === 0
                ? sign * Infinity
                : NaN;
        }

        return (
            sign *
            Math.pow(2, exponent - 15) *
            (1 + fraction / 1024)
        );
    }

    function readFloat32() {
        ensureAvailable(4);

        var value = view.getFloat32(offset, false);
        offset += 4;

        return value;
    }

    function readFloat64() {
        ensureAvailable(8);

        var value = view.getFloat64(offset, false);
        offset += 8;

        return value;
    }

    function readLength(additionalInformation) {
        if (additionalInformation < 24) {
            return additionalInformation;
        }

        switch (additionalInformation) {
            case 24:
                return readUint8();

            case 25:
                return readUint16();

            case 26:
                return readUint32();

            case 27:
                return readUint64();

            case 31:
                return -1;

            default:
                throw new Error(
                    "Invalid CBOR additional-information value " +
                    additionalInformation +
                    "."
                );
        }
    }

    function isBreakByte() {
        ensureAvailable(1);

        return view.getUint8(offset) === 0xff;
    }

    function consumeBreakByte() {
        if (!isBreakByte()) {
            throw new Error(
                "Expected a CBOR break byte at byte " +
                offset +
                "."
            );
        }

        offset += 1;
    }

    function readByteString(length) {
        ensureAvailable(length);

        var output = [];

        for (var index = 0; index < length; index++) {
            output.push(
                view.getUint8(offset + index)
            );
        }

        offset += length;

        return output;
    }

    function decodeUtf8(bytesToDecode) {
        var output = "";
        var index = 0;

        while (index < bytesToDecode.length) {
            var first = bytesToDecode[index++];
            var codePoint;

            if (first < 0x80) {
                codePoint = first;
            } else if ((first & 0xe0) === 0xc0) {
                if (index >= bytesToDecode.length) {
                    throw new Error(
                        "Invalid UTF-8 sequence in CBOR text string."
                    );
                }

                codePoint =
                    ((first & 0x1f) << 6) |
                    (bytesToDecode[index++] & 0x3f);
            } else if ((first & 0xf0) === 0xe0) {
                if (index + 1 >= bytesToDecode.length) {
                    throw new Error(
                        "Invalid UTF-8 sequence in CBOR text string."
                    );
                }

                codePoint =
                    ((first & 0x0f) << 12) |
                    ((bytesToDecode[index++] & 0x3f) << 6) |
                    (bytesToDecode[index++] & 0x3f);
            } else if ((first & 0xf8) === 0xf0) {
                if (index + 2 >= bytesToDecode.length) {
                    throw new Error(
                        "Invalid UTF-8 sequence in CBOR text string."
                    );
                }

                codePoint =
                    ((first & 0x07) << 18) |
                    ((bytesToDecode[index++] & 0x3f) << 12) |
                    ((bytesToDecode[index++] & 0x3f) << 6) |
                    (bytesToDecode[index++] & 0x3f);
            } else {
                throw new Error(
                    "Invalid UTF-8 leading byte in CBOR text string."
                );
            }

            if (codePoint <= 0xffff) {
                output += String.fromCharCode(codePoint);
            } else {
                codePoint -= 0x10000;

                output += String.fromCharCode(
                    0xd800 | (codePoint >> 10),
                    0xdc00 | (codePoint & 0x03ff)
                );
            }
        }

        return output;
    }

    function decodeItem() {
        var initialByte = readUint8();
        var majorType = initialByte >> 5;
        var additionalInformation = initialByte & 0x1f;
        var length;
        var output;
        var index;

        if (majorType === 7) {
            switch (additionalInformation) {
                case 20:
                    return false;

                case 21:
                    return true;

                case 22:
                    return null;

                case 23:
                    return undefined;

                case 24:
                    return readUint8();

                case 25:
                    return readFloat16();

                case 26:
                    return readFloat32();

                case 27:
                    return readFloat64();

                case 31:
                    throw new Error(
                        "Unexpected CBOR break byte."
                    );

                default:
                    if (additionalInformation < 20) {
                        return additionalInformation;
                    }

                    throw new Error(
                        "Unsupported CBOR simple value."
                    );
            }
        }

        length = readLength(additionalInformation);

        switch (majorType) {
            case 0:
                if (length < 0) {
                    throw new Error(
                        "Unsigned integers cannot have indefinite length."
                    );
                }

                return length;

            case 1:
                if (length < 0) {
                    throw new Error(
                        "Negative integers cannot have indefinite length."
                    );
                }

                return -1 - length;

            case 2:
                if (length >= 0) {
                    return readByteString(length);
                }

                output = [];

                while (!isBreakByte()) {
                    var byteStringChunk = decodeItem();

                    if (!Array.isArray(byteStringChunk)) {
                        throw new Error(
                            "Invalid chunk in indefinite CBOR byte string."
                        );
                    }

                    output = output.concat(byteStringChunk);
                }

                consumeBreakByte();

                return output;

            case 3:
                if (length >= 0) {
                    return decodeUtf8(
                        readByteString(length)
                    );
                }

                output = "";

                while (!isBreakByte()) {
                    var textChunk = decodeItem();

                    if (typeof textChunk !== "string") {
                        throw new Error(
                            "Invalid chunk in indefinite CBOR text string."
                        );
                    }

                    output += textChunk;
                }

                consumeBreakByte();

                return output;

            case 4:
                output = [];

                if (length >= 0) {
                    for (
                        index = 0;
                        index < length;
                        index++
                    ) {
                        output.push(
                            decodeItem()
                        );
                    }
                } else {
                    while (!isBreakByte()) {
                        output.push(
                            decodeItem()
                        );
                    }

                    consumeBreakByte();
                }

                return output;

            case 5:
                output = {};

                if (length >= 0) {
                    for (
                        index = 0;
                        index < length;
                        index++
                    ) {
                        var definiteKey = decodeItem();

                        output[String(definiteKey)] =
                            decodeItem();
                    }
                } else {
                    while (!isBreakByte()) {
                        var indefiniteKey = decodeItem();

                        output[String(indefiniteKey)] =
                            decodeItem();
                    }

                    consumeBreakByte();
                }

                return output;

            case 6:
                if (length < 0) {
                    throw new Error(
                        "CBOR tags cannot have indefinite length."
                    );
                }

                /*
                 * Tags are not used by the documented DEOS SAM
                 * measurements. The tagged value is returned without
                 * applying tag semantics.
                 */
                return decodeItem();

            default:
                throw new Error(
                    "Unsupported CBOR major type " +
                    majorType +
                    "."
                );
        }
    }

    var result = decodeItem();

    if (offset !== view.byteLength) {
        throw new Error(
            "The CBOR payload contains " +
            (view.byteLength - offset) +
            " trailing byte(s)."
        );
    }

    return result;
}

function requireFiniteNumber(value, measurementName) {
    if (
        typeof value !== "number" ||
        !Number.isFinite(value)
    ) {
        throw new Error(
            "The " +
            measurementName +
            " measurement is not a finite number."
        );
    }

    return value;
}

/**
 * Calculates the dew point using the Magnus formula.
 * This is a derived value and is not transmitted by the sensor.
 */
function calculateDewPoint(
    temperature,
    relativeHumidity
) {
    var coefficientA = 17.62;
    var coefficientB = 243.12;

    var gamma =
        Math.log(relativeHumidity / 100) +
        (
            coefficientA *
            temperature
        ) /
        (
            coefficientB +
            temperature
        );

    var dewPoint =
        (
            coefficientB *
            gamma
        ) /
        (
            coefficientA -
            gamma
        );

    return roundTo(dewPoint, 2);
}

/**
 * Classifies the CO2 value using the thresholds stated in the DEOS SAM
 * product sheet:
 *
 * - Green: below 800 ppm
 * - Yellow: from 800 ppm
 * - Red: from 1000 ppm
 */
function classifyCarbonDioxide(carbonDioxide) {
    if (carbonDioxide >= 1000) {
        return "poor";
    }

    if (carbonDioxide >= 800) {
        return "moderate";
    }

    return "good";
}

function roundTo(value, decimalPlaces) {
    var factor = Math.pow(
        10,
        decimalPlaces
    );

    return (
        Math.round(
            value *
            factor
        ) /
        factor
    );
}

function toHex16(value) {
    if (
        !Number.isInteger(value) ||
        value < 0 ||
        value > 0xffff
    ) {
        return null;
    }

    return (
        "0x" +
        value
            .toString(16)
            .toUpperCase()
            .padStart(4, "0")
    );
}

function formatError(error) {
    if (
        error &&
        typeof error.message === "string"
    ) {
        return error.message;
    }

    return String(error);
}
