/**
 * Miromico miro Click LoRaWAN Button
 * Model: MCO-CLK-LW-EU868
 *
 * ChirpStack v4 JavaScript payload codec
 *
 * Current firmware uplink port: 15
 *
 * Supported uplink messages:
 * - Regular status message
 * - Button press message
 * - Firmware version message
 * - Legacy four-byte button message
 */

function decodeUplink(input) {
    var bytes = input.bytes || [];
    var fPort = input.fPort;

    var data = {};
    var warnings = [];
    var errors = [];

    function readUInt16LE(offset) {
        return (
            bytes[offset] |
            (bytes[offset + 1] << 8)
        ) >>> 0;
    }

    function readUInt32LE(offset) {
        return (
            bytes[offset] |
            (bytes[offset + 1] << 8) |
            (bytes[offset + 2] << 16) |
            (bytes[offset + 3] << 24)
        ) >>> 0;
    }

    function readInt8(offset) {
        var value = bytes[offset];

        if (value > 127) {
            return value - 256;
        }

        return value;
    }

    function toHex(value, width) {
        var hex = (value >>> 0).toString(16).toUpperCase();

        while (hex.length < width) {
            hex = "0" + hex;
        }

        return hex;
    }

    function payloadToHex(payload) {
        var result = [];

        for (var i = 0; i < payload.length; i++) {
            result.push(toHex(payload[i], 2));
        }

        return result.join("");
    }

    function decodeButtonMask(mask) {
        var buttons = [];

        if ((mask & 0x01) !== 0) {
            buttons.push("N");
        }

        if ((mask & 0x02) !== 0) {
            buttons.push("E");
        }

        if ((mask & 0x04) !== 0) {
            buttons.push("S");
        }

        if ((mask & 0x08) !== 0) {
            buttons.push("W");
        }

        return buttons;
    }

    function buttonNameFromMask(mask) {
        switch (mask) {
            case 0x01:
                return "N";

            case 0x02:
                return "E";

            case 0x04:
                return "S";

            case 0x08:
                return "W";

            default:
                return null;
        }
    }

    function decodeConfigurationFlags(flags) {
        return {
            join_strategy: (flags & 0x08) !== 0 ? "SF12" : "SF7",

            ambitious_first_press_enabled:
                (flags & 0x10) !== 0,

            duty_cycle_enabled:
                (flags & 0x20) !== 0,

            buzzer_enabled:
                (flags & 0x40) !== 0,

            confirmed_button_uplinks_enabled:
                (flags & 0x80) !== 0
        };
    }

    data.fPort = fPort;
    data.payload_length = bytes.length;
    data.raw_payload_hex = payloadToHex(bytes);

    if (bytes.length === 0) {
        errors.push("The received payload is empty.");

        return {
            data: data,
            warnings: warnings,
            errors: errors
        };
    }

    /*
     * Legacy firmware format
     *
     * Byte 0: Battery status
     * Byte 1: Button information
     * Byte 2: Press type
     * Byte 3: Counter
     */
    if (
        bytes.length === 4 &&
        !(bytes[0] === 0x04 && bytes[1] === 0x01)
    ) {
        var legacyButtonByte = bytes[1];

        var legacyPressedButtonsMask =
            legacyButtonByte & 0x0F;

        var legacyFirstButtonMask =
            (legacyButtonByte >> 4) & 0x0F;

        data.protocol_version = "legacy";
        data.message_type = "legacy_button_press";

        data.battery_raw = bytes[0];

        if (bytes[0] === 0) {
            data.battery_state = "not_connected";
            data.battery_measurement_available = false;
        } else if (bytes[0] === 255) {
            data.battery_state = "measurement_not_possible";
            data.battery_measurement_available = false;
        } else {
            data.battery_state = "available";
            data.battery_measurement_available = true;
        }

        data.first_button_mask = legacyFirstButtonMask;
        data.first_button =
            buttonNameFromMask(legacyFirstButtonMask);
        data.first_buttons =
            decodeButtonMask(legacyFirstButtonMask);

        data.pressed_buttons_mask =
            legacyPressedButtonsMask;

        data.pressed_buttons =
            decodeButtonMask(legacyPressedButtonsMask);

        data.button_n_pressed =
            (legacyPressedButtonsMask & 0x01) !== 0;

        data.button_e_pressed =
            (legacyPressedButtonsMask & 0x02) !== 0;

        data.button_s_pressed =
            (legacyPressedButtonsMask & 0x04) !== 0;

        data.button_w_pressed =
            (legacyPressedButtonsMask & 0x08) !== 0;

        data.press_type_raw = bytes[2];

        data.press_type =
            (bytes[2] & 0x01) !== 0
                ? "long"
                : "short";

        data.long_press =
            (bytes[2] & 0x01) !== 0;

        data.button_count = bytes[3];

        if (fPort !== 15) {
            warnings.push(
                "Legacy message received on an unexpected FPort."
            );
        }

        return {
            data: data,
            warnings: warnings,
            errors: errors
        };
    }

    if (bytes.length < 2) {
        errors.push(
            "The payload is too short to contain a message header."
        );

        return {
            data: data,
            warnings: warnings,
            errors: errors
        };
    }

    if (fPort !== 15) {
        warnings.push(
            "Current firmware uplinks are normally sent on FPort 15."
        );
    }

    var messageLengthField = bytes[0];
    var messageType = bytes[1];

    data.protocol_version = "current";
    data.message_length_field = messageLengthField;
    data.message_type_id = messageType;
    data.message_type_id_hex = "0x" + toHex(messageType, 2);

    /*
     * Regular status message
     *
     * Expected structure:
     *
     * Byte 0:     0x05
     * Byte 1:     0x02
     * Bytes 2-5:  Used charge, little endian
     * Byte 6:     0x03
     * Byte 7:     0x03
     * Byte 8:     Battery voltage
     * Byte 9:     Internal temperature
     * Byte 10:    0x05
     * Byte 11:    0x04
     * Byte 12:    Button configuration
     * Byte 13:    Configuration flags
     * Bytes 14-15 Status interval, little endian
     */
    if (messageType === 0x02) {
        if (bytes.length < 16) {
            errors.push(
                "A regular status message must contain at least 16 bytes."
            );

            return {
                data: data,
                warnings: warnings,
                errors: errors
            };
        }

        var activeButtonMask =
            bytes[12] & 0x0F;

        var configurationFlags =
            bytes[13];

        var statusIntervalMinutes =
            readUInt16LE(14);

        data.message_type = "status";

        data.used_charge_uah =
            readUInt32LE(2);

        data.battery_voltage_raw =
            bytes[8];

        data.battery_voltage_v =
            (bytes[8] + 170) / 100;

        data.internal_temperature_c =
            readInt8(9);

        data.active_button_mask =
            activeButtonMask;

        data.active_buttons =
            decodeButtonMask(activeButtonMask);

        data.button_n_enabled =
            (activeButtonMask & 0x01) !== 0;

        data.button_e_enabled =
            (activeButtonMask & 0x02) !== 0;

        data.button_s_enabled =
            (activeButtonMask & 0x04) !== 0;

        data.button_w_enabled =
            (activeButtonMask & 0x08) !== 0;

        data.configuration_flags_raw =
            configurationFlags;

        data.configuration =
            decodeConfigurationFlags(configurationFlags);

        data.join_strategy =
            data.configuration.join_strategy;

        data.ambitious_first_press_enabled =
            data.configuration.ambitious_first_press_enabled;

        data.duty_cycle_enabled =
            data.configuration.duty_cycle_enabled;

        data.buzzer_enabled =
            data.configuration.buzzer_enabled;

        data.confirmed_button_uplinks_enabled =
            data.configuration.confirmed_button_uplinks_enabled;

        data.status_interval_minutes =
            statusIntervalMinutes;

        data.status_interval_hours =
            statusIntervalMinutes / 60;

        data.status_interval_days =
            statusIntervalMinutes / 1440;

        if (
            bytes[0] !== 0x05 ||
            bytes[6] !== 0x03 ||
            bytes[7] !== 0x03 ||
            bytes[10] !== 0x05 ||
            bytes[11] !== 0x04
        ) {
            warnings.push(
                "One or more reserved status message bytes differ from the documented values."
            );
        }

        if (
            data.battery_voltage_v < 1.7 ||
            data.battery_voltage_v > 4.25
        ) {
            warnings.push(
                "The decoded battery voltage is outside the expected range."
            );
        }

        return {
            data: data,
            warnings: warnings,
            errors: errors
        };
    }

    /*
     * Button press message
     *
     * Expected structure:
     *
     * Byte 0:     0x04
     * Byte 1:     0x01
     * Byte 2:     Button information
     * Bytes 3-4:  Button counter, little endian
     * Byte 5:     0x05
     * Byte 6:     0x02
     * Bytes 7-10: Used charge, little endian
     *
     * According to the documented example:
     * - Upper nibble: first button
     * - Lower nibble: all pressed buttons
     */
    if (messageType === 0x01) {
        if (bytes.length < 11) {
            errors.push(
                "A button press message must contain at least 11 bytes."
            );

            return {
                data: data,
                warnings: warnings,
                errors: errors
            };
        }

        var buttonInformation = bytes[2];

        var pressedButtonMask =
            buttonInformation & 0x0F;

        var firstButtonMask =
            (buttonInformation >> 4) & 0x0F;

        data.message_type = "button_press";

        data.button_information_raw =
            buttonInformation;

        data.first_button_mask =
            firstButtonMask;

        data.first_button =
            buttonNameFromMask(firstButtonMask);

        data.first_buttons =
            decodeButtonMask(firstButtonMask);

        data.pressed_buttons_mask =
            pressedButtonMask;

        data.pressed_buttons =
            decodeButtonMask(pressedButtonMask);

        data.button_n_pressed =
            (pressedButtonMask & 0x01) !== 0;

        data.button_e_pressed =
            (pressedButtonMask & 0x02) !== 0;

        data.button_s_pressed =
            (pressedButtonMask & 0x04) !== 0;

        data.button_w_pressed =
            (pressedButtonMask & 0x08) !== 0;

        data.button_count =
            readUInt16LE(3);

        data.used_charge_uah =
            readUInt32LE(7);

        if (
            bytes[0] !== 0x04 ||
            bytes[5] !== 0x05 ||
            bytes[6] !== 0x02
        ) {
            warnings.push(
                "One or more reserved button message bytes differ from the documented values."
            );
        }

        if (data.first_button === null) {
            warnings.push(
                "The first-button field does not contain exactly one recognized button."
            );
        }

        if (data.pressed_buttons.length === 0) {
            warnings.push(
                "The message does not indicate any pressed button."
            );
        }

        return {
            data: data,
            warnings: warnings,
            errors: errors
        };
    }

    /*
     * Firmware version message
     *
     * Expected structure:
     *
     * Byte 0:     0x05
     * Byte 1:     0x05
     * Bytes 2-5:  Git hash, little endian
     */
    if (messageType === 0x05) {
        if (bytes.length < 6) {
            errors.push(
                "A firmware version message must contain at least 6 bytes."
            );

            return {
                data: data,
                warnings: warnings,
                errors: errors
            };
        }

        var gitHash =
            readUInt32LE(2);

        data.message_type =
            "firmware_version";

        data.git_hash =
            toHex(gitHash, 8).toLowerCase();

        if (bytes[0] !== 0x05) {
            warnings.push(
                "The firmware version header differs from the documented value."
            );
        }

        return {
            data: data,
            warnings: warnings,
            errors: errors
        };
    }

    data.message_type = "unknown";

    errors.push(
        "Unsupported Miromico message type: 0x" +
        toHex(messageType, 2) +
        "."
    );

    return {
        data: data,
        warnings: warnings,
        errors: errors
    };
}
