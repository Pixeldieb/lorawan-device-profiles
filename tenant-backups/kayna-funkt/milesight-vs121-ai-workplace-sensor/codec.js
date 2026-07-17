/**
 * Milesight VS121 AI Workplace Occupancy Sensor
 * ChirpStack v4 Uplink Decoder
 */

function decodeUplink(input) {
    var result = decodeVS121(input.bytes || []);
    var output = {
        data: result.data
    };

    if (result.warnings.length > 0) {
        output.warnings = result.warnings;
    }

    if (result.errors.length > 0) {
        output.errors = result.errors;
    }

    return output;
}

// ChirpStack v3
function Decode(fPort, bytes) {
    return decodeVS121(bytes || []).data;
}

// TTN Legacy
function Decoder(bytes, port) {
    return decodeVS121(bytes || []).data;
}

function decodeVS121(bytes) {
    var decoded = {};
    var warnings = [];
    var errors = [];
    var i = 0;

    while (i < bytes.length) {
        if (i + 1 >= bytes.length) {
            warnings.push("Unvollständiger Kanal-Header bei Byte " + i + ".");
            break;
        }

        var channelId = bytes[i++];
        var channelType = bytes[i++];

        // Protocol / IPSO version
        if (channelId === 0xff && channelType === 0x01) {
            if (!hasBytes(bytes, i, 1, warnings)) break;

            decoded.protocol_version = readUInt8(bytes[i]);
            i += 1;
        }

        // Serial number
        else if (channelId === 0xff && channelType === 0x08) {
            if (!hasBytes(bytes, i, 6, warnings)) break;

            decoded.sn = bytesToHexString(bytes.slice(i, i + 6));
            i += 6;
        }

        // Hardware version
        else if (channelId === 0xff && channelType === 0x09) {
            if (!hasBytes(bytes, i, 2, warnings)) break;

            decoded.hardware_version = readVersion(
                bytes.slice(i, i + 2)
            );

            i += 2;
        }

        // Legacy firmware version
        else if (channelId === 0xff && channelType === 0x0a) {
            if (!hasBytes(bytes, i, 2, warnings)) break;

            decoded.firmware_version = readVersion(
                bytes.slice(i, i + 2)
            );

            i += 2;
        }

        // Device status
        else if (channelId === 0xff && channelType === 0x0b) {
            if (!hasBytes(bytes, i, 1, warnings)) break;

            decoded.device_status = readUInt8(bytes[i]);
            i += 1;
        }

        // LoRaWAN class
        else if (channelId === 0xff && channelType === 0x0f) {
            if (!hasBytes(bytes, i, 1, warnings)) break;

            decoded.lorawan_class = readLoRaWANClass(bytes[i]);
            i += 1;
        }

        // Current firmware version
        else if (channelId === 0xff && channelType === 0x1f) {
            if (!hasBytes(bytes, i, 4, warnings)) break;

            decoded.firmware_version = readVersion(
                bytes.slice(i, i + 4)
            );

            i += 4;
        }

        // Reset event
        else if (channelId === 0xff && channelType === 0xfe) {
            if (!hasBytes(bytes, i, 1, warnings)) break;

            decoded.reset_event = readUInt8(bytes[i]);
            i += 1;
        }

        // TSL version
        else if (channelId === 0xff && channelType === 0xff) {
            if (!hasBytes(bytes, i, 2, warnings)) break;

            decoded.tsl_version = readVersion(
                bytes.slice(i, i + 2)
            );

            i += 2;
        }

        // People counter and region occupancy mask
        else if (channelId === 0x04 && channelType === 0xc9) {
            if (!hasBytes(bytes, i, 4, warnings)) break;

            decoded.people_count_all = readUInt8(bytes[i]);
            decoded.region_count = readUInt8(bytes[i + 1]);

            var regionMask = readUInt16BE(
                bytes.slice(i + 2, i + 4)
            );

            var maxRegions = Math.min(
                decoded.region_count,
                16
            );

            for (
                var regionIndex = 0;
                regionIndex < maxRegions;
                regionIndex++
            ) {
                decoded["region_" + (regionIndex + 1)] =
                    (regionMask >> regionIndex) & 0x01;
            }

            i += 4;
        }

        // People in / out
        else if (channelId === 0x05 && channelType === 0xcc) {
            if (!hasBytes(bytes, i, 4, warnings)) break;

            decoded.people_in = readInt16LE(
                bytes.slice(i, i + 2)
            );

            decoded.people_out = readInt16LE(
                bytes.slice(i + 2, i + 4)
            );

            i += 4;
        }

        // Maximum people count
        else if (channelId === 0x06 && channelType === 0xcd) {
            if (!hasBytes(bytes, i, 1, warnings)) break;

            decoded.people_count_max = readUInt8(bytes[i]);
            i += 1;
        }

        // Region counters 1–8
        else if (channelId === 0x07 && channelType === 0xd5) {
            if (!hasBytes(bytes, i, 8, warnings)) break;

            for (var r1 = 0; r1 < 8; r1++) {
                decoded[
                    "region_" + (r1 + 1) + "_count"
                ] = readUInt8(bytes[i + r1]);
            }

            i += 8;
        }

        // Region counters 9–16
        else if (channelId === 0x08 && channelType === 0xd5) {
            if (!hasBytes(bytes, i, 8, warnings)) break;

            for (var r2 = 0; r2 < 8; r2++) {
                decoded[
                    "region_" + (r2 + 9) + "_count"
                ] = readUInt8(bytes[i + r2]);
            }

            i += 8;
        }

        // People-flow matrix A–D
        else if (
            channelType === 0xda &&
            (
                channelId === 0x09 ||
                channelId === 0x0a ||
                channelId === 0x0b ||
                channelId === 0x0c
            )
        ) {
            if (!hasBytes(bytes, i, 8, warnings)) break;

            var source = String.fromCharCode(
                97 + (channelId - 0x09)
            );

            decoded[source + "_to_a"] = readUInt16LE(
                bytes.slice(i, i + 2)
            );

            decoded[source + "_to_b"] = readUInt16LE(
                bytes.slice(i + 2, i + 4)
            );

            decoded[source + "_to_c"] = readUInt16LE(
                bytes.slice(i + 4, i + 6)
            );

            decoded[source + "_to_d"] = readUInt16LE(
                bytes.slice(i + 6, i + 8)
            );

            i += 8;
        }

        // Total people in / out
        else if (channelId === 0x0d && channelType === 0xcc) {
            if (!hasBytes(bytes, i, 4, warnings)) break;

            decoded.people_total_in = readUInt16LE(
                bytes.slice(i, i + 2)
            );

            decoded.people_total_out = readUInt16LE(
                bytes.slice(i + 2, i + 4)
            );

            i += 4;
        }

        // Dwell time
        else if (channelId === 0x0e && channelType === 0xe4) {
            if (!hasBytes(bytes, i, 5, warnings)) break;

            decoded.dwell_region = readUInt8(bytes[i]);

            decoded.dwell_time_avg = readUInt16LE(
                bytes.slice(i + 1, i + 3)
            );

            decoded.dwell_time_max = readUInt16LE(
                bytes.slice(i + 3, i + 5)
            );

            i += 5;
        }

        // Timestamp
        else if (channelId === 0x0f && channelType === 0x85) {
            if (!hasBytes(bytes, i, 4, warnings)) break;

            decoded.timestamp = readUInt32LE(
                bytes.slice(i, i + 4)
            );

            i += 4;
        }

        // Line-crossing counter
        else if (channelId === 0x10 && channelType === 0xf7) {
            if (!hasBytes(bytes, i, 4, warnings)) break;

            decoded.line_in = readUInt16LE(
                bytes.slice(i, i + 2)
            );

            decoded.line_out = readUInt16LE(
                bytes.slice(i + 2, i + 4)
            );

            i += 4;
        }

        // Historical data
        else if (channelId === 0x20 && channelType === 0xce) {
            var historyResult = readHistoryData(
                bytes,
                i,
                warnings
            );

            if (!historyResult.ok) break;

            if (!decoded.history) {
                decoded.history = [];
            }

            decoded.history.push(historyResult.data);
            i = historyResult.offset;
        }

        // Unknown channel
        else {
            warnings.push(
                "Unbekannter VS121-Kanal 0x" +
                toHex(channelId) +
                "/0x" +
                toHex(channelType) +
                " bei Byte " +
                (i - 2) +
                "."
            );

            decoded.unknown_payload = bytesToHexString(
                bytes.slice(i - 2)
            );

            break;
        }
    }

    return {
        data: decoded,
        warnings: warnings,
        errors: errors
    };
}

function readHistoryData(bytes, offset, warnings) {
    if (!hasBytes(bytes, offset, 5, warnings)) {
        return {
            ok: false,
            data: {},
            offset: offset
        };
    }

    var data = {};

    data.timestamp = readUInt32LE(
        bytes.slice(offset, offset + 4)
    );

    var dataType = readUInt8(bytes[offset + 4]);
    offset += 5;

    switch (dataType) {
        case 0x01:
            if (!hasBytes(bytes, offset, 4, warnings)) {
                return failHistory(offset);
            }

            data.people_count_all = readUInt8(
                bytes[offset]
            );

            data.region_count = readUInt8(
                bytes[offset + 1]
            );

            var regionMask = readUInt16BE(
                bytes.slice(offset + 2, offset + 4)
            );

            var maxRegions = Math.min(
                data.region_count,
                16
            );

            for (
                var idx = 0;
                idx < maxRegions;
                idx++
            ) {
                data["region_" + (idx + 1)] =
                    (regionMask >> idx) & 0x01;
            }

            offset += 4;
            break;

        case 0x02:
            if (!hasBytes(bytes, offset, 4, warnings)) {
                return failHistory(offset);
            }

            data.people_in = readUInt16LE(
                bytes.slice(offset, offset + 2)
            );

            data.people_out = readUInt16LE(
                bytes.slice(offset + 2, offset + 4)
            );

            offset += 4;
            break;

        case 0x03:
            if (!hasBytes(bytes, offset, 1, warnings)) {
                return failHistory(offset);
            }

            data.people_count_max = readUInt8(
                bytes[offset]
            );

            offset += 1;
            break;

        case 0x04:
        case 0x05:
        case 0x06:
        case 0x07:
            if (!hasBytes(bytes, offset, 4, warnings)) {
                return failHistory(offset);
            }

            var regionStart =
                1 + ((dataType - 0x04) * 4);

            for (var r = 0; r < 4; r++) {
                data[
                    "region_" +
                    (regionStart + r) +
                    "_count"
                ] = readUInt8(bytes[offset + r]);
            }

            offset += 4;
            break;

        case 0x08:
        case 0x09:
        case 0x0a:
        case 0x0b:
        case 0x0c:
        case 0x0d:
        case 0x0e:
        case 0x0f:
            if (!hasBytes(bytes, offset, 4, warnings)) {
                return failHistory(offset);
            }

            var flowPairMap = {
                0x08: ["a_to_a", "a_to_b"],
                0x09: ["a_to_c", "a_to_d"],
                0x0a: ["b_to_a", "b_to_b"],
                0x0b: ["b_to_c", "b_to_d"],
                0x0c: ["c_to_a", "c_to_b"],
                0x0d: ["c_to_c", "c_to_d"],
                0x0e: ["d_to_a", "d_to_b"],
                0x0f: ["d_to_c", "d_to_d"]
            };

            var keys = flowPairMap[dataType];

            data[keys[0]] = readUInt16LE(
                bytes.slice(offset, offset + 2)
            );

            data[keys[1]] = readUInt16LE(
                bytes.slice(offset + 2, offset + 4)
            );

            offset += 4;
            break;

        case 0x10:
            if (!hasBytes(bytes, offset, 4, warnings)) {
                return failHistory(offset);
            }

            data.people_total_in = readUInt16LE(
                bytes.slice(offset, offset + 2)
            );

            data.people_total_out = readUInt16LE(
                bytes.slice(offset + 2, offset + 4)
            );

            offset += 4;
            break;

        case 0x11:
            if (!hasBytes(bytes, offset, 5, warnings)) {
                return failHistory(offset);
            }

            data.dwell_region = readUInt8(
                bytes[offset]
            );

            data.dwell_time_avg = readUInt16LE(
                bytes.slice(offset + 1, offset + 3)
            );

            data.dwell_time_max = readUInt16LE(
                bytes.slice(offset + 3, offset + 5)
            );

            offset += 5;
            break;

        case 0x12:
            if (!hasBytes(bytes, offset, 4, warnings)) {
                return failHistory(offset);
            }

            data.line_in = readUInt16LE(
                bytes.slice(offset, offset + 2)
            );

            data.line_out = readUInt16LE(
                bytes.slice(offset + 2, offset + 4)
            );

            offset += 4;
            break;

        default:
            warnings.push(
                "Unbekannter History-Datentyp 0x" +
                toHex(dataType) +
                "."
            );

            return {
                ok: false,
                data: data,
                offset: offset
            };
    }

    return {
        ok: true,
        data: data,
        offset: offset
    };
}

function failHistory(offset) {
    return {
        ok: false,
        data: {},
        offset: offset
    };
}

function hasBytes(bytes, offset, required, warnings) {
    if (offset + required <= bytes.length) {
        return true;
    }

    warnings.push(
        "Payload zu kurz: benötigt " +
        required +
        " Byte ab Position " +
        offset +
        ", vorhanden sind " +
        Math.max(bytes.length - offset, 0) +
        "."
    );

    return false;
}

function readLoRaWANClass(value) {
    var classes = {
        0: "Class A",
        1: "Class B",
        2: "Class C",
        3: "Class CtoB"
    };

    return classes[value] !== undefined
        ? classes[value]
        : value;
}

function readVersion(bytes) {
    var parts = [];

    for (var i = 0; i < bytes.length; i++) {
        parts.push(
            readUInt8(bytes[i]).toString(10)
        );
    }

    return parts.join(".");
}

function readUInt8(value) {
    return value & 0xff;
}

function readUInt16BE(bytes) {
    return (
        ((bytes[0] & 0xff) << 8) |
        (bytes[1] & 0xff)
    ) & 0xffff;
}

function readUInt16LE(bytes) {
    return (
        ((bytes[1] & 0xff) << 8) |
        (bytes[0] & 0xff)
    ) & 0xffff;
}

function readInt16LE(bytes) {
    var value = readUInt16LE(bytes);

    return value > 0x7fff
        ? value - 0x10000
        : value;
}

function readUInt32LE(bytes) {
    return (
        ((bytes[0] & 0xff)) |
        ((bytes[1] & 0xff) << 8) |
        ((bytes[2] & 0xff) << 16) |
        ((bytes[3] & 0xff) << 24)
    ) >>> 0;
}

function bytesToHexString(bytes) {
    var output = [];

    for (var i = 0; i < bytes.length; i++) {
        output.push(toHex(bytes[i]));
    }

    return output.join("");
}

function toHex(value) {
    return (
        "0" +
        (value & 0xff).toString(16)
    ).slice(-2);
}
