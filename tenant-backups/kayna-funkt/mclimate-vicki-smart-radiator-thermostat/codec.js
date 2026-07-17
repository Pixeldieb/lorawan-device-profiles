// The Things Industries / Main
function decodeUplink(input) {
    var bytes = input.bytes;
    var data = {};
    var resultToPass = {};
    var toBool = function (value) { return value == '1' };

    function merge_obj(obj1, obj2) {
        var obj3 = {};
        for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
        for (var attrname2 in obj2) { obj3[attrname2] = obj2[attrname2]; }
        return obj3;
    }

    function handleKeepalive(bytes, data){
        var tmp = ("0" + bytes[6].toString(16)).substr(-2);
        var motorRange1 = tmp[1];
        var motorRange2 = ("0" + bytes[5].toString(16)).substr(-2);
        var motorRange = (parseInt(motorRange1, 16) << 8) | parseInt(motorRange2, 16);

        var motorPos2 = ("0" + bytes[4].toString(16)).substr(-2);
        var motorPos1 = tmp[0];
        var motorPosition = (parseInt(motorPos1, 16) << 8) | parseInt(motorPos2, 16);

        var batteryTmp = ("0" + bytes[7].toString(16)).substr(-2)[0];
        var batteryVoltageCalculated = 2 + parseInt("0x" + batteryTmp, 16) * 0.1;

        var decbin = function(number) {
            if (number < 0) {
                number = 0xFFFFFFFF + number + 1;
            }
            number = number.toString(2);
            return "00000000".substr(number.length) + number;
        }
        var byte7Bin = decbin(bytes[7]);
        var openWindow = byte7Bin[4];
        var highMotorConsumption = byte7Bin[5];
        var lowMotorConsumption = byte7Bin[6];
        var brokenSensor = byte7Bin[7];
        var byte8Bin = decbin(bytes[8]);
        var childLock = byte8Bin[0];
        var calibrationFailed = byte8Bin[1];
        var attachedBackplate = byte8Bin[2];
        var perceiveAsOnline = byte8Bin[3];
        var antiFreezeProtection = byte8Bin[4];

        var sensorTemp = 0;
        if (Number(bytes[0].toString(16))  == 1) {
            sensorTemp = (bytes[2] * 165) / 256 - 40;
        }
        if (Number(bytes[0].toString(16)) == 81) {
            sensorTemp = (bytes[2] - 28.33333) / 5.66666;
        }
        data.reason = Number(bytes[0].toString(16));
        data.targetTemperature = Number(bytes[1]);
        data.sensorTemperature = Number(sensorTemp.toFixed(2));
        data.relativeHumidity = Number(((bytes[3] * 100) / 256).toFixed(2));
        data.motorRange = motorRange;
        data.motorPosition = motorPosition;
        data.batteryVoltage = Number(batteryVoltageCalculated.toFixed(2));
        data.openWindow = toBool(openWindow);
        data.highMotorConsumption = toBool(highMotorConsumption);
        data.lowMotorConsumption = toBool(lowMotorConsumption);
        data.brokenSensor = toBool(brokenSensor);
        data.childLock = toBool(childLock);
        data.calibrationFailed = toBool(calibrationFailed);
        data.attachedBackplate = toBool(attachedBackplate);
        data.perceiveAsOnline = toBool(perceiveAsOnline);
        data.antiFreezeProtection = toBool(antiFreezeProtection);
        data.valveOpenness = motorRange != 0 ? Math.round((1-(motorPosition/motorRange))*100) : 0;
        if(!data.hasOwnProperty('targetTemperatureFloat')){
            data.targetTemperatureFloat = parseFloat(bytes[1]);
        }
        return data;
    }
   
    function handleResponse(bytes, data){
        var commands = bytes.map(function(byte, i){
        	return ("0" + byte.toString(16)).substr(-2); 
        });
        // commands = commands.slice(0,-9);
        var command_len = 0;
        commands.map(function (command, i) {
            switch (command) {
                case '01':
                    {
                        command_len = 9;
                        var data = { decodeKeepalive: true };
                        resultToPass = merge_obj(resultToPass, data);
                    }
                    break;
			case '81':
                    {
                        command_len = 9;
                        var data = { decodeKeepalive: true };
                        resultToPass = merge_obj(resultToPass, data);
                    }
                    break;
                case '04':
                    {
                        command_len = 2;
                        var hardwareVersion = commands[i + 1];
                        var softwareVersion = commands[i + 2];
                        var dataK = { 'deviceVersions': { 'hardware': Number(hardwareVersion), 'software': Number(softwareVersion) } };
                        resultToPass = merge_obj(resultToPass, dataK);
                    }
                break;
                case '12':
                    {
                        command_len = 1;
                        var dataC = { 'keepAliveTime': parseInt(commands[i + 1], 16) };
                        resultToPass = merge_obj(resultToPass, dataC);
                    }
                break;
                case '13':
                    {
                        command_len = 4;
                        var enabled = toBool(parseInt(commands[i + 1], 16));
                        var duration = parseInt(commands[i + 2], 16) * 5;
                        var tmp = ("0" + commands[i + 4].toString(16)).substr(-2);
                        var motorPos2 = ("0" + commands[i + 3].toString(16)).substr(-2);
                        var motorPos1 = tmp[0];
                        var motorPosition = (parseInt(motorPos1, 16) << 8) | parseInt(motorPos2, 16);
                        var delta = Number(tmp[1]);

                        var dataD = { 'openWindowParams': { 'enabled': enabled, 'duration': duration, 'motorPosition': motorPosition, 'delta': delta } };
                        resultToPass = merge_obj(resultToPass, dataD);
                    }
                break;
                case '14':
                    {
                        command_len = 1;
                        var dataB = { 'childLock': toBool(parseInt(commands[i + 1], 16)) };
                        resultToPass = merge_obj(resultToPass, dataB);
                    }
                break;
                case '15':
                    {
                        command_len = 2;
                        var dataA = { 'temperatureRangeSettings': { 'min': parseInt(commands[i + 1], 16), 'max': parseInt(commands[i + 2], 16) } };
                        resultToPass = merge_obj(resultToPass, dataA);
                    }
                break;
                case '16':
                    {
                        command_len = 2;
                        var data = { 'internalAlgoParams': { 'period': parseInt(commands[i + 1], 16), 'pFirstLast': parseInt(commands[i + 2], 16), 'pNext': parseInt(commands[i + 3], 16) } };
                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                case '17':
                    {
                        command_len = 2;
                        var dataF = { 'internalAlgoTdiffParams': { 'warm': parseInt(commands[i + 1], 16), 'cold': parseInt(commands[i + 2], 16) } };
                        resultToPass = merge_obj(resultToPass, dataF);
                    }
                break;
                case '18':
                    {
                        command_len = 1;
                        var dataE = { 'operationalMode': parseInt(commands[i + 1], 16) };
                        resultToPass = merge_obj(resultToPass, dataE);
                    }
                break;
                case '19':
                    {
                        command_len = 1;
                        var commandResponse = parseInt(commands[i + 1], 16);
                        var periodInMinutes = commandResponse * 5 / 60;
                        var dataH = { 'joinRetryPeriod': periodInMinutes };
                        resultToPass = merge_obj(resultToPass, dataH);
                    }
                break;
                case '1b':
                    {
                        command_len = 1;
                        var dataG = { 'uplinkType': parseInt(commands[i + 1], 16) };
                        resultToPass = merge_obj(resultToPass, dataG);
                    }
                break;
                case '1d':
                    {
                        // get default keepalive if it is not available in data
                        command_len = 2;
                        var wdpC = commands[i + 1] == '00' ? false : parseInt(commands[i + 1], 16);
                        var wdpUc = commands[i + 2] == '00' ? false : parseInt(commands[i + 2], 16);
                        var dataJ = { 'watchDogParams': { 'wdpC': wdpC, 'wdpUc': wdpUc } };
                        resultToPass = merge_obj(resultToPass, dataJ);
                    }
                break;
                case '1f':
                    {
                        command_len = 1;
                        var data = { 'primaryOperationalMode': commands[i + 1] };
                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                case '21':
                    {
                        command_len = 6;
                        var data = {'batteryRangesBoundaries':{ 
                            'Boundary1': (parseInt(commands[i + 1], 16) << 8) | parseInt(commands[i + 2], 16), 
                            'Boundary2': (parseInt(commands[i + 3], 16) << 8) | parseInt(commands[i + 4], 16), 
                            'Boundary3': (parseInt(commands[i + 5], 16) << 8) | parseInt(commands[i + 6], 16), 
                        }};
                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                case '23':
                    {
                        command_len = 4;
                        var data = {'batteryRangesOverVoltage':{ 
                            'Range1': parseInt(commands[i + 2], 16), 
                            'Range2': parseInt(commands[i + 3], 16), 
                            'Range3': parseInt(commands[i + 4], 16), 
                        }};
                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                case '27':
                    {
                        command_len = 1;
                        var data = {'OVAC': parseInt(commands[i + 1], 16)};
                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                case '28':
                    {
                        command_len = 1;
                        var data = { 'manualTargetTemperatureUpdate': parseInt(commands[i + 1], 16) };
                        resultToPass = merge_obj(resultToPass, data);

                    }
                break;
                case '29':
                    {
                        command_len = 2;
                        var data = { 'proportionalAlgoParams': { 'coefficient': parseInt(commands[i + 1], 16), 'period': parseInt(commands[i + 2], 16) } };
                        resultToPass = merge_obj(resultToPass, data);

                    }
                break;
                case '2b':
                    {
                        command_len = 1;
                        var data = { 'algoType': commands[i + 1] };
                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                case '36':
                    {
                        command_len = 3;
                        var kp = ((parseInt(commands[i + 1], 16) << 16) | (parseInt(commands[i + 2], 16) << 8) | parseInt(commands[i + 3], 16)) / 131072;
                        var data = { 'proportionalGain': Number(kp).toFixed(5) };
                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                case '3d':
                    {
                        command_len = 3;
                        var ki = ((parseInt(commands[i + 1], 16) << 16) | (parseInt(commands[i + 2], 16) << 8) | parseInt(commands[i + 3], 16)) / 131072;
                        var data = { 'integralGain': Number(ki).toFixed(5) };
                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                case '3f':
                    {
                        command_len = 2;
                        var data = { 'integralValue' : ((parseInt(commands[i + 1], 16) << 8) | parseInt(commands[i + 2], 16))/10 };
                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                case '40':
                    {
                        command_len = 1;
                        var data = { 'piRunPeriod' : parseInt(commands[i + 1], 16) };
                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                case '42':
                    {
                        command_len = 1;
                        var data = { 'tempHysteresis' : parseInt(commands[i + 1], 16) };
                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                case '44':
                    {
                        command_len = 2;
                        var data = { 'extSensorTemperature' : ((parseInt(commands[i + 1], 16) << 8) | parseInt(commands[i + 2], 16))/10 };
                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                case '46':
                    {
                        command_len = 3;
                        var enabled = toBool(parseInt(commands[i + 1], 16));
                        var duration = parseInt(commands[i + 2], 16) * 5;
                        var delta = parseInt(commands[i + 3], 16) /10;

                        var data = { 'openWindowParams': { 'enabled': enabled, 'duration': duration, 'delta': delta } };
                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                case '48':
                    {
                        command_len = 1;
                        var data = { 'forceAttach' : parseInt(commands[i + 1], 16) };
                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                case '4a':
                    {
                        command_len = 3;
                        var activatedTemperature = parseInt(commands[i + 1], 16)/10;
                        var deactivatedTemperature = parseInt(commands[i + 2], 16)/10;
                        var targetTemperature = parseInt(commands[i + 3], 16);

                        var data = { 'antiFreezeParams': { 'activatedTemperature': activatedTemperature, 'deactivatedTemperature': deactivatedTemperature, 'targetTemperature': targetTemperature } };
                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                case '4b':
                    {
                        command_len = 1;
                        var data = { 'patchVersion' : parseInt(commands[i + 1], 16) };
                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                case '4d':
                    {
                        command_len = 2;
                        var data = { 'piMaxIntegratedError' : ((parseInt(commands[i + 1], 16) << 8) | parseInt(commands[i + 2], 16))/10 };
                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                case '50':
                    {
                        command_len = 2;
                        var data = { 'effectiveMotorRange': { 'minValveOpenness': 100 - parseInt(commands[i + 2], 16), 'maxValveOpenness': 100 - parseInt(commands[i + 1], 16) } };
                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                case '52':
                    {
                        command_len = 2;
                        var data = { 'targetTemperatureFloat' : ((parseInt(commands[i + 1], 16) << 8) | parseInt(commands[i + 2], 16))/10 };
                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                case '54':
                    {
                        command_len = 1;
                        var offset =  (parseInt(commands[i + 1], 16) - 28) * 0.176;
                        var data = { 'temperatureOffset' : offset };
                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                case '58':
                    {
                        command_len = 1;
                        var notificationByte = parseInt(commands[i + 1], 16);
                        
                        // Extract notification flags from bits
                        var temperatureRestoredAfterManualBoost = !!(notificationByte & 0x01);  // Bit 0
                        var temperatureChangedByHeatingSchedule = !!(notificationByte & 0x02);   // Bit 1
                        
                        var data = {
                            notifications: {
                                temperatureRestoredAfterManualBoost: temperatureRestoredAfterManualBoost,
                                temperatureChangedByHeatingSchedule: temperatureChangedByHeatingSchedule
                            }
                        };
                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                
                case '5a':
                    {
                        command_len = 41;
                        var eventsGroup = parseInt(commands[i + 1], 16); // 0 = events 0-7, 1 = events 8-15, 2 = events 16-19
                        var eventGroupIndex = {0: '0-7', 1: '8-15', 2: '16-19'};
                        var heatingEvents = [];
                        
                        // Process up to 8 events for groups 0 and 1, but only 4 events for group 2
                        var eventsToProcess = (eventsGroup === 2) ? 4 : 8;
                        for (var eventIdx = 0; eventIdx < eventsToProcess; eventIdx++) {
                            // Each event takes 5 bytes (hour, minute, temp high, temp low, weekday bitmask)
                            var offset = i + 2 + (eventIdx * 5);
                            
                            // Check if this event is configured
                            // Make sure we have valid values at this offset
                            if (offset >= commands.length || offset + 4 >= commands.length) {
                                continue;
                            }

                            var hour = parseInt(commands[offset], 16);
                            var minute = parseInt(commands[offset + 1], 16);
                            var tempHigh = parseInt(commands[offset + 2], 16);
                            var tempLow = parseInt(commands[offset + 3], 16);
                            var weekdayByte = parseInt(commands[offset + 4], 16);
                            
                            // Skip events that are not configured (zeros or NaN values)
                            if (isNaN(hour) || isNaN(minute) || isNaN(tempHigh) || isNaN(tempLow) || isNaN(weekdayByte) ||
                                (hour === 0 && minute === 0 && tempHigh === 0 && tempLow === 0 && weekdayByte === 0)) {
                                continue;
                            }
                            
                            // Calculate actual event index in the full range (0-23)
                            var globalEventIndex = (eventsGroup * 8) + eventIdx;
                            // Decode weekday bitmask (bit 0=Mon, bit 1=Tue, bit 2=Wed, bit 3=Thu, bit 4=Fri, bit 5=Sat, bit 6=Sun)
                            var weekdays = {
                                monday: !!(weekdayByte & 0x01),     // bit 0
                                tuesday: !!(weekdayByte & 0x02),    // bit 1
                                wednesday: !!(weekdayByte & 0x04),  // bit 2
                                thursday: !!(weekdayByte & 0x08),   // bit 3
                                friday: !!(weekdayByte & 0x10),     // bit 4
                                saturday: !!(weekdayByte & 0x20),   // bit 5
                                sunday: !!(weekdayByte & 0x40)      // bit 6
                            };
                            
                            // Create heating event object
                            var heatingEvent = {
                                index: globalEventIndex,
                                start: (hour < 10 ? '0' + hour : hour) + ':' + (minute < 10 ? '0' + minute : minute),
                                targetTemperature: ((tempHigh << 8) | tempLow) / 10,
                                weekdays: weekdays
                            };
                            heatingEvents.push(heatingEvent);
                        }
                        var data = {
                            heatingEventGroup: eventGroupIndex[eventsGroup],
                            heatingEvents: heatingEvents
                        };

                        resultToPass = merge_obj(resultToPass, data);
                    }
                break;
                case '5c': {
                    command_len = 4;
                    // Note: Months are 0-11 (January=0, December=11)
                    var startMonth = parseInt(commands[i + 1], 16);
                    var startDay = parseInt(commands[i + 2], 16);
                    var endMonth = parseInt(commands[i + 3], 16);
                    var endDay = parseInt(commands[i + 4], 16);
                    
                    // Convert to human-readable month names
                    var monthNames = [
                        'January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'
                    ];
                    
                    var data = {
                        heatingSchedule: {
                            start: startDay + ' ' + monthNames[startMonth],
                            end: endDay + ' ' + monthNames[endMonth],
                        }
                    };
                    resultToPass = merge_obj(resultToPass, data);
                    break;
                }
                
                case '5e': {
                    command_len = 4;
                    // Parse 32-bit UNIX timestamp (4 bytes)
                    var unixTimestamp = (parseInt(commands[i + 1], 16) << 24) | 
                                       (parseInt(commands[i + 2], 16) << 16) | 
                                       (parseInt(commands[i + 3], 16) << 8) | 
                                       parseInt(commands[i + 4], 16);
                    
                    // Convert UNIX timestamp to JavaScript Date
                    var dateObj = new Date(unixTimestamp * 1000); // Convert seconds to milliseconds
                    var date = dateObj.getUTCDate() + '/' + (dateObj.getUTCMonth() + 1) + '/' + dateObj.getUTCFullYear()
                    var time = dateObj.getUTCHours() + ':' + (dateObj.getUTCMinutes() < 10 ? '0' : '') + dateObj.getUTCMinutes()
                    var data = {
                        deviceTime: "" + date + " " + time
                    };
                    resultToPass = merge_obj(resultToPass, data);
                    break;
                }
                
                case '60': {
                    command_len = 1;
                    var offsetByte = parseInt(commands[i + 1], 16);
                    var offsetHours = (offsetByte & 0x80) ? (offsetByte - 256) : offsetByte;
                    var data = { deviceTimeZone: offsetHours };
                    resultToPass = merge_obj(resultToPass, data);
                    break;
                }
                case '62': {
                    command_len = 1;
                    var timeValue = parseInt(commands[i + 1], 16);
                    var data = { autoSetpointRestoreStatus: timeValue === 0 ? 0 : timeValue * 10 };
                    resultToPass = merge_obj(resultToPass, data);
                    break;
                }
                case '64': {
                    command_len = 1;
                    var ledDurationValue = parseInt(commands[i + 1], 16);
                    var durationInSeconds = ledDurationValue / 2; // As per the docs, value is divided by 2 to get seconds
                    
                    var data = {
                        ledIndicationDuration: durationInSeconds
                    };
                    
                    resultToPass = merge_obj(resultToPass, data);
                    break;
                }
                case '66': {
                    command_len = 2;

                    var tempHigh = parseInt(commands[i + 1], 16);
                    var tempLow = parseInt(commands[i + 2], 16);
                    var targetTemp = (tempHigh << 8) | tempLow;
                    var data = {
                        offlineTargetTemperature: targetTemp === 0 ? 0 : targetTemp / 10
                    };
                    resultToPass = merge_obj(resultToPass, data);
                    break;
                }
                case '68': {
                    command_len = 1;
                    var data = { internalAlgoTempState: parseInt(commands[i + 1], 16) };
                    resultToPass = merge_obj(resultToPass, data);
                    break;
                }
                case '6a': {
                    command_len = 12;
                    var temperatureLevels = {};
                    
                    // Process 6 scale levels (0-5), each with a 2-byte temperature value
                    for (var level = 0; level < 6; level++) {
                        var tempHighByte = parseInt(commands[i + 1 + (level * 2)], 16);
                        var tempLowByte = parseInt(commands[i + 2 + (level * 2)], 16);
                        var tempValue = (tempHighByte << 8) | tempLowByte;
                        
                        // The temperature values are pre-multiplied by 10
                        temperatureLevels['level' + level] = tempValue / 10;
                    }
                    
                    var data = {
                        temperatureLevels: temperatureLevels
                    };
                    
                    resultToPass = merge_obj(resultToPass, data);
                    break;
                }
                case '6c': {
                    command_len = 4;
                 
                    var eventsHighByte = parseInt(commands[i + 2], 16);   // Events 19-16
                    var eventsMidByte = parseInt(commands[i + 3], 16);    // Events 15-8
                    var eventsLowByte = parseInt(commands[i + 4], 16);    // Events 7-0
                    var eventsByte = (eventsHighByte << 16) | (eventsMidByte << 8) | eventsLowByte;
                    
                    // Create a more structured and readable format for heating events
                    var heatingEventStates = {};
                    
                    // Process all 20 events (0-19) in a single loop
                    for (var eventIdx = 0; eventIdx < 20; eventIdx++) {
                        // Calculate which bit to check
                        var bitPosition;
                        if (eventIdx >= 16) {
                            // Events 16-19 in high byte
                            bitPosition = eventIdx - 16;
                            heatingEventStates[eventIdx] = !!(eventsHighByte & (1 << bitPosition));
                        } else if (eventIdx >= 8) {
                            // Events 8-15 in mid byte
                            bitPosition = eventIdx - 8;
                            heatingEventStates[eventIdx] = !!(eventsMidByte & (1 << bitPosition));
                        } else {
                            // Events 0-7 in low byte
                            bitPosition = eventIdx;
                            heatingEventStates[eventIdx] = !!(eventsLowByte & (1 << bitPosition));
                        }
                    }
                    
                    var data = {
                        heatingEventStates: heatingEventStates
                    };
                    
                    resultToPass = merge_obj(resultToPass, data);
                    break;
                }
                case '6e': {
                    command_len = 1;
                    var data = { timeRequestByMACcommand: parseInt(commands[i + 1], 16) };
                    resultToPass = merge_obj(resultToPass, data);
                    break;
                }
                case 'a0': {
                    command_len = 4;
                    var fuota_address = (parseInt(commands[i + 1], 16) << 24) | 
                                      (parseInt(commands[i + 2], 16) << 16) | 
                                      (parseInt(commands[i + 3], 16) << 8) | 
                                      parseInt(commands[i + 4], 16);
                    var fuota_address_raw = commands[i + 1] + commands[i + 2] + 
                                          commands[i + 3] + commands[i + 4];
                    resultToPass = merge_obj(resultToPass, { fuota: { fuota_address: fuota_address, fuota_address_raw: fuota_address_raw } });
                    break;
                }
                default:
                    break;
            }
            commands.splice(i,command_len);
        });
        return resultToPass;
    }
    
    if (bytes[0].toString(16) == 1 || bytes[0].toString(16) == 81) {
        data = merge_obj(data, handleKeepalive(bytes, data));
    } else {
        data = merge_obj(data, handleResponse(bytes, data));
        var shouldKeepAlive = data.hasOwnProperty('decodeKeepalive') ? true : false;

        if ('decodeKeepalive' in data) {
            delete data.decodeKeepalive;
        }
        if (shouldKeepAlive) {
            bytes = bytes.slice(-9);
            data = merge_obj(data, handleKeepalive(bytes, data));
        }
    }

    return {
        data: data
    };
}
