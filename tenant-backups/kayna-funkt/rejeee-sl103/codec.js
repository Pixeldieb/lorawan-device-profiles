function decodeUplink(input) {
    var obj = {};
    var warnings = [];
    var len = input.bytes ? input.bytes.length : 0;
    var offset = 0, dtype = 0, dlen = 0;

    do {
        dtype = input.bytes[offset++];
        if (0xFF == dtype) {
            /* 0xFF is ACK from Device */
            obj.ackcmd = input.bytes[offset++];
            obj.ackstatus = input.bytes[offset++];
        } else if (0x00 === dtype) {
            /* first is device information(0x00) */
            obj.battery = (input.bytes[offset++] & 0x1F);
            obj.res = input.bytes[offset++];
        } else if (0x01 == dtype) {
            offset += 8;
        } else if (0x02 == dtype) {
            offset += 8;
        } else if (0x03 == dtype) {
            offset += 2;
        } else if (0x04 == dtype) {
            /* temperature sensor, value unit is 0.1 */
            obj.temperature = (((input.bytes[offset] & 0x80 ? input.bytes[offset] - 0x100 : input.bytes[offset]) << 8) + input.bytes[offset + 1]) / 10;
            offset += 2;
        } else if (0x05 == dtype) {
            /* humidity sensor, value unit is 1 %RH */
            obj.humidity = input.bytes[offset++];
        } else if (0x06 == dtype) {
            obj.oxygen = input.bytes[offset++];
        } else if (0x07 == dtype) {
            offset += 4;
        } else if (0x08 == dtype) {
            /* ignore */
            offset += 4;
        } else if (0x09 == dtype) {
            /* ignore */
            offset += 1;
        } else if (0x14 == dtype) {
            /* Mutil-temperature sensor, value unit 0.1 */
            dlen = input.bytes[offset++];
            if (dlen >= 2) {
                obj.temperature1 = (((input.bytes[offset] & 0x80 ? input.bytes[offset] - 0x100 : input.bytes[offset]) << 8) + input.bytes[offset + 1]) / 10;
                offset += 2;
                dlen -= 2;
            }

            if (dlen >= 2) {
                obj.temperature2 = (((input.bytes[offset] & 0x80 ? input.bytes[offset] - 0x100 : input.bytes[offset]) << 8) + input.bytes[offset + 1]) / 10;
                offset += 2;
                dlen -= 2;
            }

           if (dlen >= 2) {
                obj.temperature3 = (((input.bytes[offset] & 0x80 ? input.bytes[offset] - 0x100 : input.bytes[offset]) << 8) + input.bytes[offset + 1]) / 10;
                offset += 2;
                dlen -= 2;
            }
            if (dlen > 0) {
                offset += dlen;
            }
        } else if (0x15 == dtype) {
            /* Mutil-humidity sensor, value unit 1 %RH */
            dlen = input.bytes[offset++];
            if (dlen >= 1) {
                obj.humidity1 = input.bytes[offset++];
                dlen -= 1;
            }

            if (dlen >= 1) {
                obj.humidity2 = input.bytes[offset++];
                dlen -= 1;
            }

            if (dlen > 0) {
                offset += dlen;
            }
        } else {
            /* ignore all > 0x10 */
            if(dtype > 0x10){
                dlen = input.bytes[offset++];
                if (dlen > 0) {
                    offset += dlen;
                }
            }
        }
    } while (len > offset);

    return {
        data: obj,
        warnings: warnings
    };
}
