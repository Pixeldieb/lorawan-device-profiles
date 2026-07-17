/**
 * Milesight EM320-TH
 * Full Uplink Payload Decoder
 * Compatible with ChirpStack v4
 *
 * Decodes:
 * - Battery level (%)
 * - Temperature (°C)
 * - Humidity (%RH)
 */

function decodeUplink(input) {
    var bytes = input.bytes;
    var decoded = {};
    var index = 0;

    while (index < bytes.length) {

        var channelId = bytes[index++];
        var channelType = bytes[index++];

        /**
         * Battery Level
         * Channel ID: 0x01
         * Channel Type: 0x75
         * Data: uint8 (%)
         */
        if (channelId === 0x01 && channelType === 0x75) {
            decoded.battery = bytes[index];
            index += 1;
        }

        /**
         * Temperature
         * Channel ID: 0x03
         * Channel Type: 0x67
         * Data: int16, little-endian, value / 10 (°C)
         */
        else if (channelId === 0x03 && channelType === 0x67) {
            var temperatureRaw = bytes[index] | (bytes[index + 1] << 8);

            // handle signed value
            if (temperatureRaw & 0x8000) {
                temperatureRaw = temperatureRaw - 0x10000;
            }

            decoded.temperature = temperatureRaw / 10;
            index += 2;
        }

        /**
         * Humidity
         * Channel ID: 0x04
         * Channel Type: 0x68
         * Data: uint8, value / 2 (%RH)
         */
        else if (channelId === 0x04 && channelType === 0x68) {
            decoded.humidity = bytes[index] / 2;
            index += 1;
        }

        /**
         * Unknown channel → stop decoding safely
         */
        else {
            break;
        }
    }

    return {
        data: decoded
    };
}
