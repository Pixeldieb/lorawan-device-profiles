/*
 * Decoder in JavaScript für die Familie der Tabs-Sensoren von BROWAN für The Things Stack V4
 * 
 * Lizenz: GNU Affero General Public License v3.0 - Siehe dazu die LICENSE-Datei.
 * 
 * Erstellt von Caspar Armster (dasdigidings e.V. / The Things Network Rhein-Sieg) - www.dasdigidings.de
 * Dieser Code basiert auf der Arbeit von Cameron Sharp bei Sensational Systems - cameron@sensational.systems
 */

function decodeUplink(input) {
    // Objekt erstellen, um die dekodierten Daten zu speichern
    var data = {
        "bytes": input.bytes,  // Original-Payload
        "port" : input.fPort  // LoRaWAN-Port
    };

    // Batterie- und Temperaturmessungen
    var battery = input.bytes[1] & 0x0f;
    battery = (25 + battery) / 10;
    var capacity = input.bytes[1] >> 4;
    capacity = (capacity / 15) * 100;

    var temperature = input.bytes[2] & 0x7f;
    temperature = temperature - 32;

    data.battery = battery;
    data.capacity = capacity;
    data.temperature = temperature;

    // Je nach LoRaWAN-Port wissen wir, welcher Tabs-Sensor die Daten liefert
    if (input.fPort === 100) { // Tür- und Fenstersensor
        // Zeitmessung
        var openingStatusTime = (input.bytes[4] << 8) | input.bytes[3];

        // Zählermessung
        var openingStatusCount = ((input.bytes[7] << 16) | (input.bytes[6] << 8)) | input.bytes[5];

        // Statusmessung
        var openingStatus = input.bytes[0] & 0x1;
        var openingStatusOpen = (openingStatus === 1);

        data.openingStatusTime = openingStatusTime;
        data.openingStatusCount = openingStatusCount;
        data.openingStatusOpen = openingStatusOpen;

    } else if (input.fPort === 102) { // Bewegungssensor (PIR)
        // Zeitmessung
        var roomStatusTime = (input.bytes[4] << 8) | input.bytes[3];

        // Zählermessung
        var roomStatusCount = ((input.bytes[7] << 16) | (input.bytes[6] << 8)) | input.bytes[5];

        // Statusmessung
        var roomStatus = input.bytes[0] & 0x1;
        var roomStatusOccupied = (roomStatus === 1);

        data.roomStatusTime = roomStatusTime;
        data.roomStatusCount = roomStatusCount;
        data.roomStatusOccupied = roomStatusOccupied;

    } else if (input.fPort === 103) { // Gesundes Zuhause Sensor IAQ & Temperatur & Luftfeuchtigkeit Sensor
        if (input.bytes.length > 8) { // IAQ-Messung des gesunden Zuhause Sensors
            // VOC Messung
            var voc = (input.bytes[7] << 8) | input.bytes[6];
            var vocError = (voc === 65535);

            // CO2 Messung
            var co2 = (input.bytes[5] << 8) | input.bytes[4];
            var co2Error = (co2 === 65535);

            // IAQ Messung
            var iaq = (input.bytes[9] << 9) | input.bytes[8];

            // Umgebungstemperaturmessung
            var temperatureEnvironment = input.bytes[10] & 0x7f;
            temperatureEnvironment = temperatureEnvironment - 32;
            
            data.voc = voc;
            data.vocError = vocError;
            data.co2 = co2;
            data.co2Error = co2Error;
            data.iaq = iaq;
            data.temperatureEnvironment = temperatureEnvironment;
        }

        // Luftfeuchtigkeitsmessung
        var humidity = input.bytes[3] &= 0x7f;
        var humidityError = (humidity === 127);

        data.humidity = humidity;
        data.humidityError = humidityError;

    } else if (input.fPort === 104) { // Umgebungslichtsensor
        // Lux Messung
        var lux = ((input.bytes[5] << 16) | (input.bytes[4] << 8)) | input.bytes[3];
        lux = lux / 100;

        data.lux = lux;

    } else if (input.fPort === 105) { // Geräuschpegel-Sensor
        // Geräuschpegel Messung
        var soundLevel = input.bytes[3] & 0xff;
        var soundLevelError = (soundLevel === 255);

        data.soundLevel = soundLevel;
        data.soundLevelError = soundLevelError;

    } else if (input.fPort === 106) { // Wassersensor
        // Wasserlecksstatus
        var waterLeakageBit = input.bytes[0] & 0x01;
        var waterLeakage = (waterLeakageBit === 1);
        
        // Umgebungstemperaturmessung
        var temperatureEnvironment = input.bytes[4] & 0x7f;
        temperatureEnvironment = temperatureEnvironment - 32;

        // Luftfeuchtigkeitsmessung
        var humidity = input.bytes[3] &= 0x7f;
        var humidityError = (humidity === 127);

        data.waterLeakage = waterLeakage;
        data.temperatureEnvironment = temperatureEnvironment;
        data.humidity = humidity;
        data.humidityError = humidityError;

    } else if (input.fPort === 136) { // Objekt Locator
        // GNSS Fix?
        var positionGnssFix = ((input.bytes[0] & 0x8) === 0);

        // Genauigkeitsmessung
        var positionAccuracy = input.bytes[10] >> 5;
        positionAccuracy = Math.pow(2, parseInt(positionAccuracy) + 2);

        // Maskiere Endbyte der Genauigkeit, damit der Längengrad nicht beeinflusst wird
        input.bytes[10] &= 0x1f;

        if ((input.bytes[10] & (1 << 4)) !== 0) {
            input.bytes[10] |= 0xe0;
        }

        // Maskiere Endbyte der Breitenangabe, RFU
        input.bytes[6] &= 0x0f;

        // Breiten- und Längengrad Messung
        var positionLatitude = ((input.bytes[6] << 24 | input.bytes[5] << 16) | input.bytes[4] << 8 ) | input.bytes[3];
        var positionLongitude = ((input.bytes[10] << 24 | input.bytes[9] << 16) | input.bytes[8] << 8 ) | input.bytes[7];
        positionLatitude = positionLatitude / 1000000;
        positionLongitude = positionLongitude / 1000000;

        data.positionGnssFix = positionGnssFix;
        data.positionLatitude = positionLatitude;
        data.positionLongitude = positionLongitude;
        data.positionAccuracy = positionAccuracy;
    }

    return {
        data: data,
        warnings: [],
        errors: []
    };
}
