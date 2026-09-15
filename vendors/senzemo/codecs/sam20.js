/*

   _____                                      _____                 __  _      __  
  / ___/___  ____  ____  ___  ____ ___  ____ / ___/___  ____  _____/ /_(_)____/ /__
  \__ \/ _ \/ __ \/_  / / _ \/ __ `__ \/ __ \\__ \/ _ \/ __ \/ ___/ __/ / ___/ //_/
 ___/ /  __/ / / / / /_/  __/ / / / / / /_/ /__/ /  __/ / / (__  ) /_/ / /__/ ,<   
/____/\___/_/ /_/ /___/\___/_/ /_/ /_/\____/____/\___/_/ /_/____/\__/_/\___/_/|_|  
                                                                                   
  Senstick SAM20 HW 1.0 - FW 1.0
*/


function decodeUplink(input)
{
  const bytes = input.bytes;
  const port = input.fPort;

  var Status;
  var Temperature;
  var Humidity;
  var AirPressure;
  var BatteryLevel;


  // Alert packet
  if (port == 1)
  {
    if (bytes.length == 1)
    {
      return {
        data: {
          Alert: bytes[0],
          MoveDetected: (bytes[0] == 0x01)
        },
        warnings: [],
        errors: []
      };
    }
  }


  // Data packet
  // Port 2 = Release firmware
  // Port 4 = Debug firmware
  else if ((port == 2) || (port == 4))
  {
    var data = {};
    var logOffset;


    // Normal data packet without Status
    if ((bytes.length == 8) || (bytes.length == 20))
    {
      Status = 0;
      Temperature = bytes[0] << 24 >> 16 | bytes[1];
      Humidity = (bytes[2] << 8) + bytes[3];
      AirPressure = (bytes[4] << 8) + bytes[5];
      BatteryLevel = (bytes[6] << 8) + bytes[7];

      logOffset = 8;
    }


    // Normal data packet with Status
    else if ((bytes.length == 9) || (bytes.length == 21))
    {
      Status = bytes[0];
      Temperature = bytes[1] << 24 >> 16 | bytes[2];
      Humidity = (bytes[3] << 8) + bytes[4];
      AirPressure = (bytes[5] << 8) + bytes[6];
      BatteryLevel = (bytes[7] << 8) + bytes[8];

      logOffset = 9;
    }

    else
    {
      return {
        data: {},
        warnings: [],
        errors: ["Invalid DATA packet length: " + bytes.length]
      };
    }


    data.Status = Status;
    data.Temperature = Temperature / 100;
    data.Humidity = Humidity / 100;
    data.AirPressure = AirPressure / 10;
    data.BatteryLevel = BatteryLevel;
    data.DebugFirmware = (port == 4);


    // Optional 12-byte logging record
    if ((bytes.length == 20) || (bytes.length == 21))
    {
      var LogFCnt =
        (bytes[logOffset] << 16) +
        (bytes[logOffset + 1] << 8) +
        bytes[logOffset + 2];

      var LogStatus = bytes[logOffset + 3];
      var LogTemperature = bytes[logOffset + 4] << 24 >> 16 | bytes[logOffset + 5];
      var LogHumidity = (bytes[logOffset + 6] << 8) + bytes[logOffset + 7];
      var LogAirPressure = (bytes[logOffset + 8] << 8) + bytes[logOffset + 9];
      var LogBatteryLevel = (bytes[logOffset + 10] << 8) + bytes[logOffset + 11];


      data.Logging = {
        FCnt: LogFCnt,
        Status: LogStatus,
        Temperature: LogTemperature / 100,
        Humidity: LogHumidity / 100,
        AirPressure: LogAirPressure / 10,
        BatteryLevel: LogBatteryLevel
      };
    }


    return {
      data: data,
      warnings: [],
      errors: []
    };
  }


  // Config packet
  else if (port == 3)
  {
    if (bytes.length == 9)
    {
      Status = bytes[0];

      var SendPeriod = bytes[1];
      var MoveThr = bytes[2];
      var PacketConfirm = bytes[3];
      var DataRatePlusADR = bytes[4];
      var FamilyId = bytes[5];
      var ProductId = bytes[6];
      var HW = bytes[7];
      var FW = bytes[8];

      var ADRon = Boolean(DataRatePlusADR & (1 << 7));
      var DataRate = (DataRatePlusADR & 0x7F);


      return {
        data: {
          Status: Status,
          SendPeriod: SendPeriod,
          MoveThr: MoveThr,
          PacketConfirm: PacketConfirm,
          DataRate: DataRate,
          ADRon: ADRon,
          FamilyId: FamilyId,
          ProductId: ProductId,
          HW: HW / 10,
          FW: FW / 10
        },
        warnings: [],
        errors: []
      };
    }
  }


  return {
    data: {},
    warnings: [],
    errors: ["Unsupported FPort or packet length"]
  };
}


function map(x, in_min, in_max, out_min, out_max)
{
  var temp = ((x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min);
  temp = temp.toFixed();

  return temp;
}

// --- ChirpStack adapter. Everything above is the unmodified TTN decoder. ---

// The decoder returns nothing for fPort/length combinations it does not handle;
// ChirpStack expects an object.
var senstickDecode = decodeUplink;

decodeUplink = function (input)
{
  var unsupported = {
    data: {},
    warnings: [],
    errors: ["Unsupported FPort or packet length"]
  };

  var result = senstickDecode(input);

  if (result && result.data)
  {
    return result;
  }

  return unsupported;
};

// Senstick devices are configured over NFC, not by downlink.
function encodeDownlink(input)
{
  return {
    bytes: [],
    warnings: [],
    errors: []
  };
}
