// ChirpStack v4 device-profile codec

function decodeUplink(input) {
  // bytes:
  // 0..1: sequence
  // 2: battery*10
  // 3..4: humidity*10 (uint16)
  // 5..6: temperature*10 (int16 signed)
  const bytes = input.bytes;

  const bat = bytes[2] / 10.0;
  const humi = ((bytes[3] << 8) | bytes[4]) / 10.0;

  let tempRaw = (bytes[5] << 8) | bytes[6];
  if (tempRaw & 0x8000) tempRaw -= 0x10000;
  const temp = tempRaw / 10.0;

  return {
    data: {
      battery: bat,
      humidity: humi,
      temperature: temp
    }
  };
}

/**
 * Downlink: set reporting interval.
 * According to Makerfabs examples, the downlink expects "seconds" encoded as
 * 4 bytes big-endian. Minimum is clamped to 300 seconds (5 minutes).
 * You can send either:
 *   { "minutes": 20 }
 * or
 *   { "seconds": 1200 }
 */
function encodeDownlink(input) {
  const data = (input && input.data) ? input.data : {};

  let seconds;
  if (typeof data.seconds === "number") {
    seconds = Math.round(data.seconds);
  } else if (typeof data.minutes === "number") {
    seconds = Math.round(data.minutes * 60);
  } else {
    return { errors: ["Provide {minutes:number} or {seconds:number}"] };
  }

  // clamp to device limits (min 5 min)
  if (seconds < 300) seconds = 300;

  // 4-byte big-endian
  const bytes = [
    (seconds >> 24) & 0xFF,
    (seconds >> 16) & 0xFF,
    (seconds >> 8) & 0xFF,
    seconds & 0xFF
  ];

  return {
    fPort: 1,
    bytes
  };
}

// Optional: only if you ever need to interpret downlink bytes back to JSON
function decodeDownlink(input) {
  if (input.fPort !== 1 || !input.bytes || input.bytes.length < 4) {
    return { errors: ["Unsupported downlink"] };
  }

  const b = input.bytes;
  const seconds = ((b[0] << 24) >>> 0) + (b[1] << 16) + (b[2] << 8) + b[3];

  return {
    data: {
      seconds,
      minutes: seconds / 60
    }
  };
}
