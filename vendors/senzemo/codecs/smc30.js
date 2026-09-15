/*

   _____                                      _____                 __  _      __  
  / ___/___  ____  ____  ___  ____ ___  ____ / ___/___  ____  _____/ /_(_)____/ /__
  \__ \/ _ \/ __ \/_  / / _ \/ __ `__ \/ __ \\__ \/ _ \/ __ \/ ___/ __/ / ___/ //_/
 ___/ /  __/ / / / / /_/  __/ / / / / / /_/ /__/ /  __/ / / (__  ) /_/ / /__/ ,<   
/____/\___/_/ /_/ /___/\___/_/ /_/ /_/\____/____/\___/_/ /_/____/\__/_/\___/_/|_|  
                                                                                   
  Senstick SMC30 HW 3.0 - FW 2.x                             
*/


function decodeUplink(input) {
  const bytes = input.bytes; 
  const port = input.fPort; 

  // If Data Packet
  if (port == 1 || port == 2) {
    
    var Status = bytes[0];
    var Temperature = (bytes[1] << 8) + bytes[2];
    var Humidity = (bytes[3] << 8) + bytes[4];
    var AirPressure = (bytes[5] << 8) + bytes[6];
    var BatteryLevel = bytes[7];  
    var BatteryPercent = percent((BatteryLevel+100)/100);

    return {
      data: {
        Status: Status,
        Temperature: sintToDec(Temperature),
        Humidity: Humidity / 100.0,
        AirPressure: AirPressure / 10.0,
        BatteryLevel: (BatteryLevel + 100) / 100,
        BatteryPercent:BatteryPercent
      },
      	warnings: [],
      	errors: []
    };
  }
  // If Config packet
  else {
    
    var Status = bytes[0];    
    var SendPeriod = bytes[1];
    var MovementThreshold = bytes[2];
    var PacketConfirm = bytes[3];
    var DataRate = bytes[4]; 
    var FamilyId = bytes[5];
    var ProductId = bytes[6];         
    var HW = bytes[7];
    var FW = bytes[8];      
    
    return {
      data: {
        Status: Status,
        SendPeriod: SendPeriod,
        MovementThreshold: MovementThreshold, 
        PacketConfirm: PacketConfirm,
        DataRate: DataRate, 
        FamilyId: FamilyId,
        ProductId: ProductId,    
        HW: HW/10,
        FW: FW/10
      },
      	warnings: [],
      	errors: []
    };
  }
}

function percent (V){
var  x ;
x = (62.5*V) - 100 ;
  return x;
}

function sintToDec(T){
  if (T > 32767) {
    return ((T - 65536) / 100.0);
  }
  else {
    return (T / 100.0);
  }
}

// --- ChirpStack adapter. Everything above is the unmodified TTN decoder. ---

// This decoder has no fPort or length checks: every unrecognised fPort falls into
// the config branch, decoding short payloads into nulls instead of an error.
function senstickAccepts(input)
{
  if ((input.fPort === 1) || (input.fPort === 2))
  {
    return input.bytes.length === 8;
  }

  if (input.fPort === 3)
  {
    return input.bytes.length === 9;
  }

  return false;
}

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

  if (!senstickAccepts(input))
  {
    return unsupported;
  }

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
