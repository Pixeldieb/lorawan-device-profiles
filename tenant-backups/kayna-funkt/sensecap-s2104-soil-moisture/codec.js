function DecodeUplink(input) {
  var bytes = input.bytes;
  var fPort = input.fPort;

  var bytesString = bytes2HexString(bytes).toLocaleUpperCase();
  var decoded = {
    valid: true,
    err: 0,
    payload: bytesString,
    messages: [],
  };

  if (!crc16Check(bytesString)) {
    decoded.valid = false;
    decoded.err = -1;
    return { data: decoded };
  }

  if ((bytesString.length / 2 - 2) % 7 !== 0) {
    decoded.valid = false;
    decoded.err = -2;
    return { data: decoded };
  }

  var sensorEuiLowBytes;
  var sensorEuiHighBytes;

  var frameArray = divideBy7Bytes(bytesString);
  for (var forFrame = 0; forFrame < frameArray.length; forFrame++) {
    var frame = frameArray[forFrame];
    var channel = strTo10SysNub(frame.substring(0, 2));
    var dataID = strTo10SysNub(frame.substring(2, 6));
    var dataValue = frame.substring(6, 14);
    var realDataValue = isSpecialDataId(dataID)
      ? ttnDataSpecialFormat(dataID, dataValue)
      : ttnDataFormat(dataValue);

    if (checkDataIdIsMeasureUpload(dataID)) {
      decoded.messages.push({
        type: "report_telemetry",
        measurementId: dataID,
        measurementValue: realDataValue,
      });
    } else if (isSpecialDataId(dataID) || dataID === 5 || dataID === 6) {
      switch (dataID) {
        case 0x00:
          var versionData = sensorAttrForVersion(realDataValue);
          decoded.messages.push({
            type: "upload_version",
            hardwareVersion: versionData.ver_hardware,
            softwareVersion: versionData.ver_software,
          });
          break;
        case 1:
          break;
        case 2:
          sensorEuiLowBytes = realDataValue;
          break;
        case 3:
          sensorEuiHighBytes = realDataValue;
          break;
        case 7:
          decoded.messages.push(
            {
              type: "upload_battery",
              battery: realDataValue.power,
            },
            {
              type: "upload_interval",
              interval: parseInt(realDataValue.interval) * 60,
            }
          );
          break;
        case 0x120:
          decoded.messages.push({
            type: "report_remove_sensor",
            channel: 1,
          });
          break;
        default:
          break;
      }
    } else {
      decoded.messages.push({
        type: "unknown_message",
        dataID: dataID,
        dataValue: dataValue,
      });
    }
  }

  if (sensorEuiHighBytes && sensorEuiLowBytes) {
    decoded.messages.unshift({
      type: "upload_sensor_id",
      channel: 1,
      sensorId: (sensorEuiHighBytes + sensorEuiLowBytes).toUpperCase(),
    });
  }

  return { data: decoded };
}

// Utility Functions (identical to original version)

function crc16Check(data) {
  return true;
}

function bytes2HexString(arrBytes) {
  var str = "";
  for (var i = 0; i < arrBytes.length; i++) {
    var tmp;
    var num = arrBytes[i];
    if (num < 0) {
      tmp = (255 + num + 1).toString(16);
    } else {
      tmp = num.toString(16);
    }
    if (tmp.length === 1) {
      tmp = "0" + tmp;
    }
    str += tmp;
  }
  return str;
}

function divideBy7Bytes(str) {
  var frameArray = [];
  for (var i = 0; i < str.length - 4; i += 14) {
    frameArray.push(str.substring(i, i + 14));
  }
  return frameArray;
}

function littleEndianTransform(data) {
  var dataArray = [];
  for (var i = 0; i < data.length; i += 2) {
    dataArray.push(data.substring(i, i + 2));
  }
  return dataArray.reverse();
}

function strTo10SysNub(str) {
  return parseInt(littleEndianTransform(str).join(""), 16);
}

function checkDataIdIsMeasureUpload(dataId) {
  return parseInt(dataId) > 4096;
}

function isSpecialDataId(dataID) {
  switch (dataID) {
    case 0:
    case 1:
    case 2:
    case 3:
    case 4:
    case 7:
    case 0x120:
      return true;
    default:
      return false;
  }
}

function ttnDataSpecialFormat(dataId, str) {
  var strReverse = littleEndianTransform(str);
  if (dataId === 2 || dataId === 3) {
    return strReverse.join("");
  }

  var str2 = toBinary(strReverse);
  var dataArray = [];

  switch (dataId) {
    case 0:
    case 1:
      for (var k = 0; k < str2.length; k += 16) {
        var segment = str2.substring(k, k + 16);
        var major = parseInt(segment.substring(0, 8), 2) || 0;
        var minor = parseInt(segment.substring(8, 16), 2) || 0;
        dataArray.push(major + "." + minor);
      }
      return dataArray.join(",");
    case 4:
      for (var i = 0; i < str2.length; i += 8) {
        var item = parseInt(str2.substring(i, i + 8), 2);
        dataArray.push(item < 10 ? "0" + item : item.toString());
      }
      return dataArray.join("");
    case 7:
      return {
        interval: parseInt(str2.substr(0, 16), 2),
        power: parseInt(str2.substr(-16, 16), 2),
      };
  }
}

function ttnDataFormat(str) {
  var strReverse = littleEndianTransform(str);
  var str2 = toBinary(strReverse);

  if (str2[0] === "1") {
    var inverted = str2
      .split("")
      .map((b) => (b === "1" ? "0" : "1"))
      .join("");
    return parseFloat("-" + (parseInt(inverted, 2) + 1) / 1000);
  }

  return parseInt(str2, 2) / 1000;
}

function sensorAttrForVersion(dataValue) {
  var arr = dataValue.split(",");
  return {
    ver_hardware: arr[0],
    ver_software: arr[1],
  };
}

function toBinary(arr) {
  return arr
    .map((item) => {
      var bin = parseInt(item, 16).toString(2);
      return bin.padStart(8, "0");
    })
    .join("");
}
