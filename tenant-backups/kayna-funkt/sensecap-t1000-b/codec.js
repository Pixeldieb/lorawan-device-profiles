/**
 * Converts a byte array to a hexadecimal string.
 */
function bytes2HexString(bytes) {
    return bytes.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Converts a hexadecimal string to an integer.
 */
function getInt(hexStr) {
    return parseInt(hexStr, 16);
}

/**
 * Converts minutes from a hexadecimal string.
 */
function getMinsByMin(hexStr) {
    return getInt(hexStr);
}

/**
 * Converts a hexadecimal string representing a timestamp to a UTC timestamp in milliseconds.
 */
function getUTCTimestamp(hexStr) {
    // Assuming the hex string represents seconds since epoch
    return getInt(hexStr) * 1000;
}

/**
 * Decodes the battery percentage.
 */
function getBattery(hexStr) {
    return getInt(hexStr);
}

/**
 * Decodes sensor values with an optional divisor.
 */
function getSensorValue(hexStr, divisor = 1) {
    const value = parseInt(hexStr, 16);
    // Handle signed 16-bit integers if necessary
    if (hexStr.length === 4 && (value & 0x8000)) {
        return (value - 0x10000) / divisor;
    }
    return value / divisor;
}

/**
 * Decodes the motion ID.
 */
function getMotionId(hexStr) {
    return getInt(hexStr);
}

/**
 * Decodes event status from a hexadecimal string (bitmask).
 * This is a placeholder and should be expanded based on actual event definitions.
 */
function getEventStatus(hexStr) {
    const status = getInt(hexStr);
    const events = {};
    // Example: Decode specific bits if they represent different events
    // events.motionDetected = (status & 0x01) > 0;
    // events.tamperAlarm = (status & 0x02) > 0;
    return status; // Or return a more detailed object
}

/**
 * Decodes the working mode.
 */
function getWorkingMode(hexStr) {
    const mode = getInt(hexStr);
    switch (mode) {
        case 0: return "Heartbeat";
        case 1: return "Periodic";
        case 2: return "Event";
        default: return "Unknown";
    }
}

/**
 * Decodes the SOS mode.
 */
function getSOSMode(hexStr) {
    const mode = getInt(hexStr);
    switch (mode) {
        case 0: return "Disabled";
        case 1: return "Enabled";
        default: return "Unknown";
    }
}

/**
 * Decodes the positioning strategy.
 */
function getPositioningStrategy(hexStr) {
    const strategy = getInt(hexStr);
    switch (strategy) {
        case 0: return "GPS";
        case 1: return "Wi-Fi";
        case 2: return "BLE";
        case 3: return "GPS + Wi-Fi";
        case 4: return "GPS + BLE";
        case 5: return "Wi-Fi + BLE";
        case 6: return "GPS + Wi-Fi + BLE";
        default: return "Unknown";
    }
}

/**
 * Decodes Wi-Fi/BLE MAC and RSSI objects.
 */
function getMacAndRssiObj(hexStr) {
    const result = [];
    for (let i = 0; i < hexStr.length; i += 10) { // 6 bytes for MAC + 1 byte for RSSI = 7 bytes = 14 hex chars
        const mac = hexStr.substring(i, i + 12);
        const rssiHex = hexStr.substring(i + 12, i + 14);
        if (mac && rssiHex) {
            const rssi = parseInt(rssiHex, 16);
            result.push({
                mac: mac,
                rssi: (rssi > 127 ? rssi - 256 : rssi) // Convert unsigned byte to signed
            });
        }
    }
    return result;
}

/**
 * Decodes short information from uplink messages.
 */
function getUpShortInfo(dataValue) {
    const measurementArray = [];
    measurementArray.push({
        measurementId: '3000',
        type: 'Battery',
        measurementValue: getBattery(dataValue.substring(0, 2))
    });
    measurementArray.push({
        measurementId: '4097',
        type: 'Air Temperature',
        measurementValue: getSensorValue(dataValue.substring(2, 6), 10)
    });
    measurementArray.push({
        measurementId: '4199',
        type: 'Light',
        measurementValue: getSensorValue(dataValue.substring(6, 10))
    });
    measurementArray.push({
        measurementId: '4210',
        type: 'AccelerometerX',
        measurementValue: getSensorValue(dataValue.substring(10, 14))
    });
    measurementArray.push({
        measurementId: '4211',
        type: 'AccelerometerY',
        measurementValue: getSensorValue(dataValue.substring(14, 18))
    });
    measurementArray.push({
        measurementId: '4212',
        type: 'AccelerometerZ',
        measurementValue: getSensorValue(dataValue.substring(18, 22))
    });
    measurementArray.push({
        measurementId: '4197',
        type: 'Longitude',
        measurementValue: parseFloat(getSensorValue(dataValue.substring(22, 30), 1000000))
    });
    measurementArray.push({
        measurementId: '4198',
        type: 'Latitude',
        measurementValue: parseFloat(getSensorValue(dataValue.substring(30, 38), 1000000))
    });
    return measurementArray;
}

/**
 * Decodes motion sensor settings.
 */
function getMotionSetting(dataValue) {
    const measurementArray = [];
    measurementArray.push({
        measurementId: '3945',
        type: 'Motion Sensitivity',
        measurementValue: getInt(dataValue.substring(0, 2))
    });
    measurementArray.push({
        measurementId: '3946',
        type: 'Motion Tracking Interval',
        measurementValue: getMinsByMin(dataValue.substring(2, 6))
    });
    measurementArray.push({
        measurementId: '3947',
        type: 'Motion Trip Threshold',
        measurementValue: getInt(dataValue.substring(6, 8))
    });
    measurementArray.push({
        measurementId: '3948',
        type: 'Motion Trip Count',
        measurementValue: getInt(dataValue.substring(8, 10))
    });
    return measurementArray;
}

/**
 * Decodes static sensor settings.
 */
function getStaticSetting(dataValue) {
    const measurementArray = [];
    measurementArray.push({
        measurementId: '3949',
        type: 'Static Trip Threshold',
        measurementValue: getInt(dataValue.substring(0, 2))
    });
    measurementArray.push({
        measurementId: '3950',
        type: 'Static Trip Count',
        measurementValue: getInt(dataValue.substring(2, 4))
    });
    measurementArray.push({
        measurementId: '3951',
        type: 'Static Delay Time',
        measurementValue: getMinsByMin(dataValue.substring(4, 6))
    });
    return measurementArray;
}

/**
 * Decodes shock sensor settings.
 */
function getShockSetting(dataValue) {
    const measurementArray = [];
    measurementArray.push({
        measurementId: '3952',
        type: 'Shock Sensitivity',
        measurementValue: getInt(dataValue.substring(0, 2))
    });
    measurementArray.push({
        measurementId: '3953',
        type: 'Shock Tracking Interval',
        measurementValue: getMinsByMin(dataValue.substring(2, 6))
    });
    return measurementArray;
}

/**
 * Decodes temperature sensor settings.
 */
function getTempSetting(dataValue) {
    const measurementArray = [];
    measurementArray.push({
        measurementId: '3954',
        type: 'Temperature Interval',
        measurementValue: getMinsByMin(dataValue.substring(0, 4))
    });
    measurementArray.push({
        measurementId: '3955',
        type: 'Temperature Enable',
        measurementValue: getInt(dataValue.substring(4, 6))
    });
    measurementArray.push({
        measurementId: '3956',
        type: 'Temperature Threshold',
        measurementValue: getSensorValue(dataValue.substring(6, 10), 10)
    });
    measurementArray.push({
        measurementId: '3957',
        type: 'Temperature Alarm Threshold',
        measurementValue: getSensorValue(dataValue.substring(10, 14), 10)
    });
    measurementArray.push({
        measurementId: '3958',
        type: 'Temperature Restore Threshold',
        measurementValue: getSensorValue(dataValue.substring(14, 18), 10)
    });
    measurementArray.push({
        measurementId: '3959',
        type: 'Temperature Alarm Count',
        measurementValue: getInt(dataValue.substring(18, 20))
    });
    return measurementArray;
}

/**
 * Decodes light sensor settings.
 */
function getLightSetting(dataValue) {
    const measurementArray = [];
    measurementArray.push({
        measurementId: '3960',
        type: 'Light Interval',
        measurementValue: getMinsByMin(dataValue.substring(0, 4))
    });
    measurementArray.push({
        measurementId: '3961',
        type: 'Light Enable',
        measurementValue: getInt(dataValue.substring(4, 6))
    });
    measurementArray.push({
        measurementId: '3962',
        type: 'Light Threshold',
        measurementValue: getSensorValue(dataValue.substring(6, 10))
    });
    measurementArray.push({
        measurementId: '3963',
        type: 'Light Alarm Threshold',
        measurementValue: getSensorValue(dataValue.substring(10, 14))
    });
    measurementArray.push({
        measurementId: '3964',
        type: 'Light Restore Threshold',
        measurementValue: getSensorValue(dataValue.substring(14, 18))
    });
    measurementArray.push({
        measurementId: '3965',
        type: 'Light Alarm Count',
        measurementValue: getInt(dataValue.substring(18, 20))
    });
    return measurementArray;
}

/**
 * Decodes positioning status.
 */
function getPositingStatus(hexStr) {
    const status = getInt(hexStr);
    switch (status) {
        case 0: return "No positioning";
        case 1: return "GPS positioning";
        case 2: return "Wi-Fi positioning";
        case 3: return "BLE positioning";
        case 4: return "Base station positioning";
        case 5: return "GPS + Wi-Fi positioning";
        case 6: return "GPS + BLE positioning";
        case 7: return "Wi-Fi + BLE positioning";
        case 8: return "GPS + Wi-Fi + BLE positioning";
        default: return "Unknown";
    }
}

/**
 * Decodes shard flag for fragmented payloads.
 */
function getShardFlag(hexStr) {
    const value = getInt(hexStr);
    return {
        index: (value & 0xF0) >> 4,
        count: value & 0x0F
    };
}


function unpack(messageValue) {
    const frameArray = [];
    let remainingMessage = messageValue;

    while (remainingMessage.length >= 2) {
        const dataId = remainingMessage.substring(0, 2).toUpperCase();
        let dataValue;
        let packageLen;
        let dataObj = {};

        switch (dataId) {
            case '01':
                packageLen = 94; // 2 (dataId) + 92 (dataValue)
                if (remainingMessage.length < packageLen) return frameArray;
                dataValue = remainingMessage.substring(2, packageLen);
                remainingMessage = remainingMessage.substring(packageLen);
                dataObj = { 'dataId': dataId, 'dataValue': dataValue };
                break;
            case '02':
                packageLen = 32;
                if (remainingMessage.length < packageLen) return frameArray;
                dataValue = remainingMessage.substring(2, packageLen);
                remainingMessage = remainingMessage.substring(packageLen);
                dataObj = { 'dataId': dataId, 'dataValue': dataValue };
                break;
            case '03':
                packageLen = 64;
                if (remainingMessage.length < packageLen) return frameArray;
                dataValue = remainingMessage.substring(2, packageLen);
                remainingMessage = remainingMessage.substring(packageLen);
                dataObj = { 'dataId': dataId, 'dataValue': dataValue };
                break;
            case '04':
                packageLen = 20;
                if (remainingMessage.length < packageLen) return frameArray;
                dataValue = remainingMessage.substring(2, packageLen);
                remainingMessage = remainingMessage.substring(packageLen);
                dataObj = { 'dataId': dataId, 'dataValue': dataValue };
                break;
            case '05':
                packageLen = 10;
                if (remainingMessage.length < packageLen) return frameArray;
                dataValue = remainingMessage.substring(2, packageLen);
                remainingMessage = remainingMessage.substring(packageLen);
                dataObj = { 'dataId': dataId, 'dataValue': dataValue };
                break;
            case '06':
                packageLen = 44;
                if (remainingMessage.length < packageLen) return frameArray;
                dataValue = remainingMessage.substring(2, packageLen);
                remainingMessage = remainingMessage.substring(packageLen);
                dataObj = { 'dataId': dataId, 'dataValue': dataValue };
                break;
            case '07':
                packageLen = 84;
                if (remainingMessage.length < packageLen) return frameArray;
                dataValue = remainingMessage.substring(2, packageLen);
                remainingMessage = remainingMessage.substring(packageLen);
                dataObj = { 'dataId': dataId, 'dataValue': dataValue };
                break;
            case '08':
                packageLen = 70;
                if (remainingMessage.length < packageLen) return frameArray;
                dataValue = remainingMessage.substring(2, packageLen);
                remainingMessage = remainingMessage.substring(packageLen);
                dataObj = { 'dataId': dataId, 'dataValue': dataValue };
                break;
            case '09':
                packageLen = 36;
                if (remainingMessage.length < packageLen) return frameArray;
                dataValue = remainingMessage.substring(2, packageLen);
                remainingMessage = remainingMessage.substring(packageLen);
                dataObj = { 'dataId': dataId, 'dataValue': dataValue };
                break;
            case '0A':
                packageLen = 76;
                if (remainingMessage.length < packageLen) return frameArray;
                dataValue = remainingMessage.substring(2, packageLen);
                remainingMessage = remainingMessage.substring(packageLen);
                dataObj = { 'dataId': dataId, 'dataValue': dataValue };
                break;
            case '0B':
                packageLen = 62;
                if (remainingMessage.length < packageLen) return frameArray;
                dataValue = remainingMessage.substring(2, packageLen);
                remainingMessage = remainingMessage.substring(packageLen);
                dataObj = { 'dataId': dataId, 'dataValue': dataValue };
                break;
            case '0C':
                // Data ID 0C seems to be a placeholder or has no dataValue in your original code.
                // If it's a command, it would be handled differently. Assuming it's skipped for now.
                remainingMessage = remainingMessage.substring(2); // Consume the dataId
                continue; // Skip adding to frameArray if no dataValue
            case '0D':
                packageLen = 10;
                if (remainingMessage.length < packageLen) return frameArray;
                dataValue = remainingMessage.substring(2, packageLen);
                remainingMessage = remainingMessage.substring(packageLen);
                dataObj = { 'dataId': dataId, 'dataValue': dataValue };
                break;
            case '0E':
                // Length is dynamically determined by bytes 8-10 (index 4-5 from dataValue start)
                if (remainingMessage.length < 10) return frameArray; // Need at least dataId (2), something (6), and length byte (2)
                const dataValueLength = getInt(remainingMessage.substring(8, 10)) * 2; // Length is in bytes, so multiply by 2 for hex chars
                packageLen = 10 + dataValueLength; // 2 (dataId) + 6 (header) + 2 (len byte) + dataValueLength
                if (remainingMessage.length < packageLen) return frameArray;
                dataValue = remainingMessage.substring(2, 8) + remainingMessage.substring(10, packageLen);
                remainingMessage = remainingMessage.substring(packageLen);
                dataObj = { 'dataId': dataId, 'dataValue': dataValue };
                break;
            case '0F':
                packageLen = 34;
                if (remainingMessage.length < packageLen) return frameArray;
                dataValue = remainingMessage.substring(2, packageLen);
                remainingMessage = remainingMessage.substring(packageLen);
                dataObj = { 'dataId': dataId, 'dataValue': dataValue };
                break;
            case '10':
                packageLen = 26;
                if (remainingMessage.length < packageLen) return frameArray;
                dataValue = remainingMessage.substring(2, packageLen);
                remainingMessage = remainingMessage.substring(packageLen);
                dataObj = { 'dataId': dataId, 'dataValue': dataValue };
                break;
            case '11':
                packageLen = 28;
                if (remainingMessage.length < packageLen) return frameArray;
                dataValue = remainingMessage.substring(2, packageLen);
                remainingMessage = remainingMessage.substring(packageLen);
                dataObj = { 'dataId': dataId, 'dataValue': dataValue };
                break;
            case '1A':
                packageLen = 56;
                if (remainingMessage.length < packageLen) return frameArray;
                dataValue = remainingMessage.substring(2, packageLen);
                remainingMessage = remainingMessage.substring(packageLen);
                dataObj = { 'dataId': dataId, 'dataValue': dataValue };
                break;
            case '1B':
                packageLen = 96;
                if (remainingMessage.length < packageLen) return frameArray;
                dataValue = remainingMessage.substring(2, packageLen);
                remainingMessage = remainingMessage.substring(packageLen);
                dataObj = { 'dataId': dataId, 'dataValue': dataValue };
                break;
            case '1C':
                packageLen = 82;
                if (remainingMessage.length < packageLen) return frameArray;
                dataValue = remainingMessage.substring(2, packageLen);
                remainingMessage = remainingMessage.substring(packageLen);
                dataObj = { 'dataId': dataId, 'dataValue': dataValue };
                break;
            case '1D':
                packageLen = 40;
                if (remainingMessage.length < packageLen) return frameArray;
                dataValue = remainingMessage.substring(2, packageLen);
                remainingMessage = remainingMessage.substring(packageLen);
                dataObj = { 'dataId': dataId, 'dataValue': dataValue };
                break;
            default:
                // If dataId is unknown, stop parsing
                return frameArray;
        }

        // Only push if a dataObj was successfully created and remainingMessage was updated
        if (Object.keys(dataObj).length > 0) {
            frameArray.push(dataObj);
        } else {
            // This case should ideally not be hit if switch cases are exhaustive
            // and packageLen calculations are correct, but as a safeguard:
            break;
        }
    }
    return frameArray;
}

function deserialize(dataId, dataValue) {
    const measurementArray = [];
    let collectTime = 0;
    let groupId = 0;
    let shardFlag = {};
    let payload = '';
    let motionId = '';

    switch (dataId) {
        case '01':
            measurementArray.push(...getUpShortInfo(dataValue.substring(0, 30)));
            measurementArray.push(...getMotionSetting(dataValue.substring(30, 40)));
            measurementArray.push(...getStaticSetting(dataValue.substring(40, 46)));
            measurementArray.push(...getShockSetting(dataValue.substring(46, 52)));
            measurementArray.push(...getTempSetting(dataValue.substring(52, 72)));
            measurementArray.push(...getLightSetting(dataValue.substring(72, 92)));
            break;
        case '02':
            measurementArray.push(...getUpShortInfo(dataValue));
            break;
        case '03':
            measurementArray.push(...getMotionSetting(dataValue.substring(0, 10)));
            measurementArray.push(...getStaticSetting(dataValue.substring(10, 16)));
            measurementArray.push(...getShockSetting(dataValue.substring(16, 22)));
            measurementArray.push(...getTempSetting(dataValue.substring(22, 42)));
            measurementArray.push(...getLightSetting(dataValue.substring(42, 62)));
            break;
        case '04':
            let interval = 0;
            const workMode = getInt(dataValue.substring(0, 2));
            const heartbeatInterval = getMinsByMin(dataValue.substring(4, 8));
            const periodicInterval = getMinsByMin(dataValue.substring(8, 12));
            const eventInterval = getMinsByMin(dataValue.substring(12, 16));
            switch (workMode) {
                case 0:
                    interval = heartbeatInterval;
                    break;
                case 1:
                    interval = periodicInterval;
                    break;
                case 2:
                    interval = eventInterval;
                    break;
            }
            measurementArray.push({
                measurementId: '3940', type: 'Work Mode', measurementValue: workMode
            }, {
                measurementId: '3942', type: 'Heartbeat Interval', measurementValue: heartbeatInterval
            }, {
                measurementId: '3943', type: 'Periodic Interval', measurementValue: periodicInterval
            }, {
                measurementId: '3944', type: 'Event Interval', measurementValue: eventInterval
            }, {
                measurementId: '3941', type: 'SOS Mode', measurementValue: getSOSMode(dataValue.substring(16, 18))
            }, {
                measurementId: '3900', type: 'Uplink Interval', measurementValue: interval
            });
            break;
        case '05':
            measurementArray.push({
                measurementId: '3000', type: 'Battery', measurementValue: getBattery(dataValue.substring(0, 2))
            }, {
                measurementId: '3940', type: 'Work Mode', measurementValue: getWorkingMode(dataValue.substring(2, 4))
            }, {
                measurementId: '3965', type: 'Positioning Strategy', measurementValue: getPositioningStrategy(dataValue.substring(4, 6))
            }, {
                measurementId: '3941', type: 'SOS Mode', measurementValue: getSOSMode(dataValue.substring(6, 8))
            });
            break;
        case '06':
            collectTime = getUTCTimestamp(dataValue.substring(8, 16));
            motionId = getMotionId(dataValue.substring(6, 8));
            measurementArray.push({
                measurementId: '4200', timestamp: collectTime, motionId: motionId, type: 'Event Status', measurementValue: getEventStatus(dataValue.substring(0, 6))
            }, {
                measurementId: '4197', timestamp: collectTime, motionId: motionId, type: 'Longitude', measurementValue: parseFloat(getSensorValue(dataValue.substring(16, 24), 1000000))
            }, {
                measurementId: '4198', timestamp: collectTime, motionId: motionId, type: 'Latitude', measurementValue: parseFloat(getSensorValue(dataValue.substring(24, 32), 1000000))
            }, {
                measurementId: '4097', timestamp: collectTime, motionId: motionId, type: 'Air Temperature', measurementValue: getSensorValue(dataValue.substring(32, 36), 10)
            }, {
                measurementId: '4199', timestamp: collectTime, motionId: motionId, type: 'Light', measurementValue: getSensorValue(dataValue.substring(36, 40))
            }, {
                measurementId: '3000', timestamp: collectTime, motionId: motionId, type: 'Battery', measurementValue: getBattery(dataValue.substring(40, 42))
            });
            break;
        case '07':
            collectTime = getUTCTimestamp(dataValue.substring(8, 16));
            motionId = getMotionId(dataValue.substring(6, 8));
            measurementArray.push({
                measurementId: '4200', timestamp: collectTime, motionId: motionId, type: 'Event Status', measurementValue: getEventStatus(dataValue.substring(0, 6))
            }, {
                measurementId: '5001', timestamp: collectTime, motionId: motionId, type: 'Wi-Fi Scan', measurementValue: getMacAndRssiObj(dataValue.substring(16, 72))
            }, {
                measurementId: '4097', timestamp: collectTime, motionId: motionId, type: 'Air Temperature', measurementValue: getSensorValue(dataValue.substring(72, 76), 10)
            }, {
                measurementId: '4199', timestamp: collectTime, motionId: motionId, type: 'Light', measurementValue: getSensorValue(dataValue.substring(76, 80))
            }, {
                measurementId: '3000', timestamp: collectTime, motionId: motionId, type: 'Battery', measurementValue: getBattery(dataValue.substring(80, 82))
            });
            break;
        case '08':
            collectTime = getUTCTimestamp(dataValue.substring(8, 16));
            motionId = getMotionId(dataValue.substring(6, 8));
            measurementArray.push({
                measurementId: '4200', timestamp: collectTime, motionId: motionId, type: 'Event Status', measurementValue: getEventStatus(dataValue.substring(0, 6))
            }, {
                measurementId: '5002', timestamp: collectTime, motionId: motionId, type: 'BLE Scan', measurementValue: getMacAndRssiObj(dataValue.substring(16, 58))
            }, {
                measurementId: '4097', timestamp: collectTime, motionId: motionId, type: 'Air Temperature', measurementValue: getSensorValue(dataValue.substring(58, 62), 10)
            }, {
                measurementId: '4199', timestamp: collectTime, motionId: motionId, type: 'Light', measurementValue: getSensorValue(dataValue.substring(62, 66))
            }, {
                measurementId: '3000', timestamp: collectTime, motionId: motionId, type: 'Battery', measurementValue: getBattery(dataValue.substring(66, 68))
            });
            break;
        case '09':
            collectTime = getUTCTimestamp(dataValue.substring(8, 16));
            motionId = getMotionId(dataValue.substring(6, 8));
            measurementArray.push({
                measurementId: '4200', timestamp: collectTime, motionId: motionId, type: 'Event Status', measurementValue: getEventStatus(dataValue.substring(0, 6))
            }, {
                measurementId: '4197', timestamp: collectTime, motionId: motionId, type: 'Longitude', measurementValue: parseFloat(getSensorValue(dataValue.substring(16, 24), 1000000))
            }, {
                measurementId: '4198', timestamp: collectTime, motionId: motionId, type: 'Latitude', measurementValue: parseFloat(getSensorValue(dataValue.substring(24, 32), 1000000))
            }, {
                measurementId: '3000', timestamp: collectTime, motionId: motionId, type: 'Battery', measurementValue: getBattery(dataValue.substring(32, 34))
            });
            break;
        case '0A':
            collectTime = getUTCTimestamp(dataValue.substring(8, 16));
            motionId = getMotionId(dataValue.substring(6, 8));
            measurementArray.push({
                measurementId: '4200', timestamp: collectTime, motionId: motionId, type: 'Event Status', measurementValue: getEventStatus(dataValue.substring(0, 6))
            }, {
                measurementId: '5001', timestamp: collectTime, motionId: motionId, type: 'Wi-Fi Scan', measurementValue: getMacAndRssiObj(dataValue.substring(16, 72))
            }, {
                measurementId: '3000', timestamp: collectTime, motionId: motionId, type: 'Battery', measurementValue: getBattery(dataValue.substring(72, 74))
            });
            break;
        case '0B':
            collectTime = getUTCTimestamp(dataValue.substring(8, 16));
            motionId = getMotionId(dataValue.substring(6, 8));
            measurementArray.push({
                measurementId: '4200', timestamp: collectTime, motionId: motionId, type: 'Event Status', measurementValue: getEventStatus(dataValue.substring(0, 6))
            }, {
                measurementId: '5002', timestamp: collectTime, motionId: motionId, type: 'BLE Scan', measurementValue: getMacAndRssiObj(dataValue.substring(16, 58))
            }, {
                measurementId: '3000', timestamp: collectTime, motionId: motionId, type: 'Battery', measurementValue: getBattery(dataValue.substring(58, 60))
            });
            break;
        case '0D':
            const errorCode = getInt(dataValue);
            let error = '';
            switch (errorCode) {
                case 1: error = 'FAILED TO OBTAIN THE UTC TIMESTAMP'; break;
                case 2: error = 'ALMANAC TOO OLD'; break;
                case 3: error = 'DOPPLER ERROR'; break;
                default: error = 'UNKNOWN ERROR'; break;
            }
            measurementArray.push({
                errorCode: errorCode,
                error: error
            });
            break;
        case '0E':
            shardFlag = getShardFlag(dataValue.substring(0, 2));
            groupId = getInt(dataValue.substring(2, 6));
            payload = dataValue.substring(6);
            measurementArray.push({
                measurementId: '6152', groupId: groupId, index: shardFlag.index, count: shardFlag.count,
                type: 'gnss-ng payload', measurementValue: payload
            });
            break;
        case '0F':
            collectTime = getUTCTimestamp(dataValue.substring(8, 16));
            shardFlag = getShardFlag(dataValue.substring(26, 28));
            groupId = getInt(dataValue.substring(28, 32));
            motionId = getMotionId(dataValue.substring(6, 8));
            measurementArray.push({
                measurementId: '4200', timestamp: collectTime, motionId: motionId, groupId: groupId, index: shardFlag.index, count: shardFlag.count, type: 'Event Status', measurementValue: getEventStatus(dataValue.substring(0, 6))
            });
            measurementArray.push({
                measurementId: '4097', timestamp: collectTime, motionId: motionId, groupId: groupId, index: shardFlag.index, count: shardFlag.count, type: 'Air Temperature', measurementValue: getSensorValue(dataValue.substring(16, 20), 10)
            });
            measurementArray.push({
                measurementId: '4199', timestamp: collectTime, motionId: motionId, groupId: groupId, index: shardFlag.index, count: shardFlag.count, type: 'Light', measurementValue: getSensorValue(dataValue.substring(20, 24))
            });
            measurementArray.push({
                measurementId: '3000', timestamp: collectTime, motionId: motionId, groupId: groupId, index: shardFlag.index, count: shardFlag.count, type: 'Battery', measurementValue: getBattery(dataValue.substring(24, 26))
            });
            break;
        case '10':
            collectTime = getUTCTimestamp(dataValue.substring(8, 16));
            shardFlag = getShardFlag(dataValue.substring(18, 20));
            groupId = getInt(dataValue.substring(20, 24));
            motionId = getMotionId(dataValue.substring(6, 8));
            measurementArray.push({
                measurementId: '4200', timestamp: collectTime, motionId: motionId, groupId: groupId, index: shardFlag.index, count: shardFlag.count, type: 'Event Status', measurementValue: getEventStatus(dataValue.substring(0, 6))
            });
            measurementArray.push({
                measurementId: '3000', timestamp: collectTime, motionId: motionId, groupId: groupId, index: shardFlag.index, count: shardFlag.count, type: 'Battery', measurementValue: getBattery(dataValue.substring(16, 18))
            });
            break;
        case '11':
            collectTime = getUTCTimestamp(dataValue.substring(8, 16));
            measurementArray.push({
                measurementId: '3576', timestamp: collectTime, type: 'Positioning Status', measurementValue: getPositingStatus(dataValue.substring(0, 2))
            });
            measurementArray.push({
                timestamp: collectTime, measurementId: '4200', type: 'Event Status', measurementValue: getEventStatus(dataValue.substring(2, 8))
            });
            if (!isNaN(parseFloat(getSensorValue(dataValue.substring(16, 20), 10)))) {
                measurementArray.push({
                    timestamp: collectTime, measurementId: '4097', type: 'Air Temperature', measurementValue: getSensorValue(dataValue.substring(16, 20), 10)
                });
            }
            if (!isNaN(parseFloat(getSensorValue(dataValue.substring(20, 24))))) {
                measurementArray.push({
                    timestamp: collectTime, measurementId: '4199', type: 'Light', measurementValue: getSensorValue(dataValue.substring(20, 24))
                });
            }
            measurementArray.push({
                timestamp: collectTime, measurementId: '3000', type: 'Battery', measurementValue: getBattery(dataValue.substring(24, 26))
            });
            break;
        case '1A':
            collectTime = getUTCTimestamp(dataValue.substring(8, 16));
            motionId = getMotionId(dataValue.substring(6, 8));
            measurementArray.push({
                measurementId: '4200', timestamp: collectTime, motionId: motionId, type: 'Event Status', measurementValue: getEventStatus(dataValue.substring(0, 6))
            }, {
                measurementId: '4197', timestamp: collectTime, motionId: motionId, type: 'Longitude', measurementValue: parseFloat(getSensorValue(dataValue.substring(16, 24), 1000000))
            }, {
                measurementId: '4198', timestamp: collectTime, motionId: motionId, type: 'Latitude', measurementValue: parseFloat(getSensorValue(dataValue.substring(24, 32), 1000000))
            }, {
                measurementId: '4097', timestamp: collectTime, motionId: motionId, type: 'Air Temperature', measurementValue: getSensorValue(dataValue.substring(32, 36), 10)
            }, {
                measurementId: '4199', timestamp: collectTime, motionId: motionId, type: 'Light', measurementValue: getSensorValue(dataValue.substring(36, 40))
            }, {
                measurementId: '4210', timestamp: collectTime, motionId: motionId, type: 'AccelerometerX', measurementValue: getSensorValue(dataValue.substring(40, 44))
            }, {
                measurementId: '4211', timestamp: collectTime, motionId: motionId, type: 'AccelerometerY', measurementValue: getSensorValue(dataValue.substring(44, 48))
            }, {
                measurementId: '4212', timestamp: collectTime, motionId: motionId, type: 'AccelerometerZ', measurementValue: getSensorValue(dataValue.substring(48, 52))
            }, {
                measurementId: '3000', timestamp: collectTime, motionId: motionId, type: 'Battery', measurementValue: getBattery(dataValue.substring(52, 54))
            });
            break;
        case '1B':
            collectTime = getUTCTimestamp(dataValue.substring(8, 16));
            motionId = getMotionId(dataValue.substring(6, 8));
            measurementArray.push({
                measurementId: '4200', timestamp: collectTime, motionId: motionId, type: 'Event Status', measurementValue: getEventStatus(dataValue.substring(0, 6))
            }, {
                measurementId: '5001', timestamp: collectTime, motionId: motionId, type: 'Wi-Fi Scan', measurementValue: getMacAndRssiObj(dataValue.substring(16, 72))
            }, {
                measurementId: '4097', timestamp: collectTime, motionId: motionId, type: 'Air Temperature', measurementValue: getSensorValue(dataValue.substring(72, 76), 10)
            }, {
                measurementId: '4199', timestamp: collectTime, motionId: motionId, type: 'Light', measurementValue: getSensorValue(dataValue.substring(76, 80))
            }, {
                measurementId: '4210', timestamp: collectTime, motionId: motionId, type: 'AccelerometerX', measurementValue: getSensorValue(dataValue.substring(80, 84))
            }, {
                measurementId: '4211', timestamp: collectTime, motionId: motionId, type: 'AccelerometerY', measurementValue: getSensorValue(dataValue.substring(84, 88))
            }, {
                measurementId: '4212', timestamp: collectTime, motionId: motionId, type: 'AccelerometerZ', measurementValue: getSensorValue(dataValue.substring(88, 92))
            }, {
                measurementId: '3000', timestamp: collectTime, motionId: motionId, type: 'Battery', measurementValue: getBattery(dataValue.substring(92, 94))
            });
            break;
        case '1C':
            collectTime = getUTCTimestamp(dataValue.substring(8, 16));
            motionId = getMotionId(dataValue.substring(6, 8));
            measurementArray.push({
                measurementId: '4200', timestamp: collectTime, motionId: motionId, type: 'Event Status', measurementValue: getEventStatus(dataValue.substring(0, 6))
            }, {
                measurementId: '5002', timestamp: collectTime, motionId: motionId, type: 'BLE Scan', measurementValue: getMacAndRssiObj(dataValue.substring(16, 58))
            }, {
                measurementId: '4097', timestamp: collectTime, motionId: motionId, type: 'Air Temperature', measurementValue: getSensorValue(dataValue.substring(58, 62), 10)
            }, {
                measurementId: '4199', timestamp: collectTime, motionId: motionId, type: 'Light', measurementValue: getSensorValue(dataValue.substring(62, 66))
            }, {
                measurementId: '4210', timestamp: collectTime, motionId: motionId, type: 'AccelerometerX', measurementValue: getSensorValue(dataValue.substring(66, 70))
            }, {
                measurementId: '4211', timestamp: collectTime, motionId: motionId, type: 'AccelerometerY', measurementValue: getSensorValue(dataValue.substring(70, 74))
            }, {
                measurementId: '4212', timestamp: collectTime, motionId: motionId, type: 'AccelerometerZ', measurementValue: getSensorValue(dataValue.substring(74, 78))
            }, {
                measurementId: '3000', timestamp: collectTime, motionId: motionId, type: 'Battery', measurementValue: getBattery(dataValue.substring(78, 80))
            });
            break;
        case '1D':
            collectTime = getUTCTimestamp(dataValue.substring(8, 16));
            motionId = getMotionId(dataValue.substring(6, 8));
            measurementArray.push({
                measurementId: '4200', timestamp: collectTime, motionId: motionId, type: 'Event Status', measurementValue: getEventStatus(dataValue.substring(0, 6))
            }, {
                measurementId: '4197', timestamp: collectTime, motionId: motionId, type: 'Longitude', measurementValue: parseFloat(getSensorValue(dataValue.substring(16, 24), 1000000))
            }, {
                measurementId: '4198', timestamp: collectTime, motionId: motionId, type: 'Latitude', measurementValue: parseFloat(getSensorValue(dataValue.substring(24, 32), 1000000))
            }, {
                measurementId: '4210', timestamp: collectTime, motionId: motionId, type: 'AccelerometerX', measurementValue: getSensorValue(dataValue.substring(32, 36))
            }, {
                measurementId: '4211', timestamp: collectTime, motionId: motionId, type: 'AccelerometerY', measurementValue: getSensorValue(dataValue.substring(36, 40))
            }, {
                measurementId: '4212', timestamp: collectTime, motionId: motionId, type: 'AccelerometerZ', measurementValue: getSensorValue(dataValue.substring(40, 44))
            }, {
                measurementId: '3000', timestamp: collectTime, motionId: motionId, type: 'Battery', measurementValue: getBattery(dataValue.substring(44, 46))
            });
            break;
        default:
            // Handle unknown dataId or return an empty array/error
            return [{ errorCode: -1, error: `Unknown Data ID: ${dataId}` }];
    }
    return measurementArray;
}


function messageAnalyzed(messageValue) {
    try {
        const frames = unpack(messageValue);
        const measurementResultArray = [];
        for (const item of frames) {
            const measurementArray = deserialize(item.dataId, item.dataValue);
            measurementResultArray.push(measurementArray);
        }
        return measurementResultArray;
    } catch (e) {
        // In Chirpstack V4, errors should ideally be returned within the data object
        // or as part of the `errors` property.
        return [{ errorCode: -1, error: e.toString() }];
    }
}

function Decode(fPort, bytes, variables) {
    const bytesString = bytes2HexString(bytes).toLocaleUpperCase();
    const decoded = {
        valid: true,
        errors: [], // Use 'errors' array for ChirpStack V4
        payload: bytesString,
        messages: []
    };

    if (fPort === 199 || fPort === 192) {
        decoded.messages.push({
            fport: fPort,
            payload: bytesString
        });
        return decoded;
    }

    if (fPort !== 5) {
        decoded.valid = false;
        decoded.errors.push(`Unsupported fPort: ${fPort}. Only fPort 5, 192, and 199 are supported.`);
        return decoded;
    }

    const measurement = messageAnalyzed(bytesString);

    if (measurement.length === 0 || (measurement.length === 1 && measurement[0].errorCode)) {
        decoded.valid = false;
        decoded.errors.push(measurement[0]?.error || "No valid measurements found or an error occurred during analysis.");
        return decoded;
    }

    for (const message of measurement) {
        if (message.length === 0) {
            continue;
        }
        const elements = [];
        for (const element of message) {
            if (element.errorCode) {
                decoded.valid = false;
                decoded.errors.push(element.error);
            } else {
                elements.push(element);
            }
        }
        if (elements.length > 0) {
            decoded.messages.push(elements);
        }
    }

    // Flatten messages if they are nested arrays of single measurements,
    // or keep structured if each message contains multiple related measurements.
    // For simplicity, let's flatten if each sub-array only contains one item.
    // Adjust this based on your desired output structure for ChirpStack V4.
    const flattenedMessages = [];
    for (const msgArray of decoded.messages) {
        for (const msg of msgArray) {
            flattenedMessages.push(msg);
        }
    }
    decoded.messages = flattenedMessages;

    // ChirpStack V4 expects flat key-value pairs or a structured object.
    // Let's convert the messages array into a more direct object for easier consumption.
    const output = {};
    for (const msg of decoded.messages) {
        if (msg.type && msg.measurementValue !== undefined) {
            // Using a cleaned-up version of 'type' as key, e.g., "Air Temperature" -> "airTemperature"
            const key = msg.type.replace(/[^a-zA-Z0-9]/g, ' ').split(' ').map((word, index) => {
                if (index === 0) return word.toLowerCase();
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            }).join('');
            output[key] = msg.measurementValue;

            if (msg.timestamp) {
                output[`${key}Timestamp`] = new Date(msg.timestamp).toISOString();
            }
            if (msg.motionId) {
                output[`${key}MotionId`] = msg.motionId;
            }
            if (msg.groupId) {
                output[`${key}GroupId`] = msg.groupId;
            }
            if (msg.index !== undefined) {
                output[`${key}ShardIndex`] = msg.index;
            }
            if (msg.count !== undefined) {
                output[`${key}ShardCount`] = msg.count;
            }
        } else if (msg.errorCode) {
            decoded.valid = false;
            decoded.errors.push(`Error: ${msg.error} (Code: ${msg.errorCode})`);
        }
    }

    // Add general payload info if needed, or if no specific messages were parsed
    if (!decoded.valid && decoded.errors.length > 0) {
        output.errors = decoded.errors;
    }
    output.rawPayload = bytesString; // Keep raw payload for debugging
    output.fPort = fPort;

    return output;
}
