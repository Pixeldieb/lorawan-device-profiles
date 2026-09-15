/*

   _____                                      _____                 __  _      __  
  / ___/___  ____  ____  ___  ____ ___  ____ / ___/___  ____  _____/ /_(_)____/ /__
  \__ \/ _ \/ __ \/_  / / _ \/ __ `__ \/ __ \\__ \/ _ \/ __ \/ ___/ __/ / ___/ //_/
 ___/ /  __/ / / / / /_/  __/ / / / / / /_/ /__/ /  __/ / / (__  ) /_/ / /__/ ,<   
/____/\___/_/ /_/ /___/\___/_/ /_/ /_/\____/____/\___/_/ /_/____/\__/_/\___/_/|_|  
                                                                                   
  Senstick SPU30 HW 1.0 - FW 1.0                             
*/


function decodeUplink(input)
{
  const bytes = input.bytes; 
  const port = input.fPort; 
  
  var Status;
  var Temperature;
  var Humidity;
  var AirPressure;
  var Co2;
  var VOCindex;
  var BatteryLevel; 


  // If Data Packet
  if (port == 2)
  { 
    if (bytes.length == 10)
    {
      Temperature = bytes[0]<<24>>16 | bytes[1];
      Humidity = (bytes[2] << 8) + bytes[3];
      AirPressure = (bytes[4] << 8) + bytes[5];
      Co2 = (bytes[6] << 8) + bytes[7];
      BatteryLevel = (bytes[8] << 8) + bytes[9]; 

      return {
        data: {
          Status: 0,
          Temperature: Temperature/100,
          Humidity: Humidity/100,
          AirPressure: AirPressure/10,
          Co2: Co2,
          BatteryLevel: BatteryLevel
        },
        	warnings: [],
        	errors: []
      };      
    }
    else if (bytes.length == 11)
    {
      Status = bytes[0];
      Temperature = bytes[1]<<24>>16 | bytes[2];
      Humidity = (bytes[3] << 8) + bytes[4];
      AirPressure = (bytes[5] << 8) + bytes[6];
      Co2 = (bytes[7] << 8) + bytes[8];
      BatteryLevel = (bytes[9] << 8) + bytes[10]; 

      return {
        data: {
          Status: Status,
          Temperature: Temperature/100,
          Humidity: Humidity/100,
          AirPressure: AirPressure/10,
          Co2: Co2,
          BatteryLevel: BatteryLevel
        },
        	warnings: [],
        	errors: []
      };      
    }
    else if (bytes.length == 12)
    {
      Temperature = bytes[0]<<24>>16 | bytes[1];
      Humidity = (bytes[2] << 8) + bytes[3];
      AirPressure = (bytes[4] << 8) + bytes[5];
      Co2 = (bytes[6] << 8) + bytes[7];
      VOCindex = (bytes[8] << 8) + bytes[9];
      BatteryLevel = (bytes[10] << 8) + bytes[11]; 

      return {
        data: {
          Status: 0,
          Temperature: Temperature/100,
          Humidity: Humidity/100,
          AirPressure: AirPressure/10,
          Co2: Co2,
          VOCindex: VOCindex,
          BatteryLevel: BatteryLevel
        },
        	warnings: [],
        	errors: []
      };
    }
    
    else if (bytes.length == 13)
    {
      Status = bytes[0];
      Temperature = bytes[1]<<24>>16 | bytes[2];
      Humidity = (bytes[3] << 8) + bytes[4];
      AirPressure = (bytes[5] << 8) + bytes[6];
      Co2 = (bytes[7] << 8) + bytes[8];
      VOCindex = (bytes[9] << 8) + bytes[10];
      BatteryLevel = (bytes[11] << 8) + bytes[12]; 

      return {
        data: {
          Status: Status,
          Temperature: Temperature/100,
          Humidity: Humidity/100,
          AirPressure: AirPressure/10,
          Co2: Co2,
          VOCindex: VOCindex,
          BatteryLevel: BatteryLevel
        },
        	warnings: [],
        	errors: []
      };      
    }
  }
  
  // If Config packet
  else if (port == 3)
  {
    if (bytes.length == 11)
    {
          Status = bytes[0];    
      var SendPeriod = bytes[1];
      var PacketConfirm = bytes[2];
      var DataRatePlusADR = bytes[3]; 
      var Co2MidThreshold = bytes[4];
      var Co2HighThreshold = bytes[5];
      var LedIntensity = bytes[6];
      var FamilyId = bytes[7];
      var ProductId = bytes[8];         
      var HW = bytes[9];
      var FW = bytes[10];       
        
      var ADRon = Boolean(DataRatePlusADR & (1 << 7));
      var DataRate = (DataRatePlusADR & 0x7F);
             
      
      return {
        data: {
          Status: Status,
          SendPeriod: SendPeriod,
          PacketConfirm: PacketConfirm,
          DataRate: DataRate,
          ADRon: ADRon,
          Co2MidThreshold: Co2MidThreshold * 10,
          Co2HighThreshold: Co2HighThreshold * 10,
          LedIntensity: LedIntensity,
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
