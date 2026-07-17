/*
  LoRaWAN®-LED-Christmas-Tree payload decoder v.1.0 by.: Jan-Ole Giebel
  This code is released under the Apache 2.0 License.

  Copyright 2024 Jan-Ole Giebel

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

function decodeUplink(input) {
    const bytes = input.bytes;
    let decoded = {
        type: bytes[0] === 0x01 ? 'ok' : 'error',
        firmware: {
            version: (bytes[2] << 8) | bytes[3]
        }
    };

    // Define initial offset based on packet type
    let offset = bytes[0] === 0x01 ? 4 : 3;

    while (offset < bytes.length) {
        const fieldId = bytes[offset];
        
        switch (fieldId) {
            case 0x03: // Temperature
                const temp = (bytes[offset + 1] << 8) | bytes[offset + 2];
                decoded.temperature = (temp / 100).toFixed(2);
                offset += 3;
                break;

            case 0x04: // Humidity
                const hum = (bytes[offset + 1] << 8) | bytes[offset + 2];
                decoded.humidity = (hum / 100).toFixed(2);
                offset += 3;
                break;

            case 0x05: // Battery voltage
                const batteryBytes = bytes.slice(offset + 1, offset + 5);
                const batteryFloat = new Float32Array(new Uint8Array(batteryBytes).buffer)[0];
                decoded.batteryVoltage = batteryFloat.toFixed(2);
                offset += 5;
                break;

            case 0x06: // TX Interval
                decoded.txInterval = (bytes[offset + 1] << 24) |
                                   (bytes[offset + 2] << 16) |
                                   (bytes[offset + 3] << 8) |
                                   bytes[offset + 4];
                offset += 5;
                break;

            case 0x07: // Mode
                decoded.mode = bytes[offset + 1];
                offset += 2;
                break;

            case 0x08: // Max Brightness
                decoded.maxBrightness = (bytes[offset + 1] << 8) | bytes[offset + 2];
                offset += 3;
                break;

            default:
                return {
                    errors: [`Unknown field ID: ${fieldId} at offset ${offset}`]
                };
        }
    }

    return {
        data: decoded
    };
}


/*
  LoRaWAN®-LED-Christmas-Tree payload encoder v.1.0 by.: Jan-Ole Giebel
  This code is released under the Apache 2.0 License.

  Copyright 2024 Jan-Ole Giebel

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

function encodeDownlink(input) {
  const bytes = [];
  const data = input.data;
  
  switch (data.command) {
    case 'setInterval':
      bytes.push(0x00);
      bytes.push((data.interval >> 8) & 0xFF);
      bytes.push(data.interval & 0xFF);
      break;
      
    case 'setBrightness':
      bytes.push(0x01);
      bytes.push((data.brightness >> 8) & 0xFF);
      bytes.push(data.brightness & 0xFF);
      break;
      
    case 'setMode':
      bytes.push(0x02);
      bytes.push(data.mode & 0xFF);
      break;
      
    case 'setPixel':
      bytes.push(0x03);
      bytes.push(data.index & 0xFF);
      bytes.push(data.red & 0xFF);
      bytes.push(data.green & 0xFF);
      bytes.push(data.blue & 0xFF);
      break;
      
    case 'setAllPixels':
      bytes.push(0x04);
      bytes.push(data.red & 0xFF);
      bytes.push(data.green & 0xFF);
      bytes.push(data.blue & 0xFF);
      break;
      
    case 'setAnimation':
      bytes.push(0x05);
      bytes.push(data.totalFrames); // Total frames in complete animation
      
      // Process up to 2 frames starting at frameStartIndex
      const framesInPayload = Math.min(2, data.frames.length);
      
      for (let i = 0; i < framesInPayload; i++) {
        const frame = data.frames[i];
        
        // Add frame header
        bytes.push(frame.delay & 0xFF);
        bytes.push(frame.fadeTime & 0xFF);
        
        // Add pixel data
        frame.pixels.forEach(pixel => {
          bytes.push(pixel.red & 0xFF);
          bytes.push(pixel.green & 0xFF);
          bytes.push(pixel.blue & 0xFF);
        });
        
        // Pad frame to 50 bytes if needed
        const pixelsNeeded = 16 - frame.pixels.length;
        for (let p = 0; p < pixelsNeeded; p++) {
          bytes.push(0x00); // R
          bytes.push(0x00); // G
          bytes.push(0x00); // B
        }
      }
      break;
  }
  
  return {
    bytes: bytes,
    fPort: 1
  };
}
