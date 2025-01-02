const net = require('net');

// Device configuration
const NEVE_IP = '192.168.9.21';
const NEVE_PORT = 51001;

// Construct the payload for setting channel gain
function constructGainCommand(channelId, gainValue) {
    const header = "380b00001400000063"; // Header and command ID
    const channelHex = channelId.toString(16).padStart(2, '0'); // Convert channel ID to hex
    const gainHex = gainValue.toString(16).padStart(4, '0'); // Convert gain to 4-character hex
    const padding = "0000000100000000"; // Reserved/padding
    const suffix = "123c000000000000"; // Fixed suffix
    return `${header}${channelHex}${padding}${gainHex}${suffix}`;
}

// Send a command to set the gain
function sendGainCommand(channelId, gainValue) {
    const payloadHex = constructGainCommand(channelId, gainValue);
    const payloadBuffer = Buffer.from(payloadHex, 'hex');
    const client = new net.Socket();

    console.log(`Connecting to ${NEVE_IP}:${NEVE_PORT}...`);

    client.connect(NEVE_PORT, NEVE_IP, () => {
        console.log(`Connected to ${NEVE_IP}:${NEVE_PORT}`);
        console.log(`Sending payload: ${payloadHex}`);
        client.write(payloadBuffer);
    });

    client.on('data', (data) => {
        console.log('Received response:');
        console.log(data.toString('hex')); // Output the response in hex format
        client.destroy(); // Close the connection after receiving the response
    });

    client.on('close', () => {
        console.log('Connection closed.');
    });

    client.on('error', (err) => {
        console.error('Connection error:', err.message);
    });
}

// Set gain to 45 (hex 0x2D) for Channel 3 (ID 02)
// sendGainCommand(0, 10);
sendGainCommand(1, 10);
// sendGainCommand(2, 10);
// sendGainCommand(3, 10);
// sendGainCommand(4, 10);
// sendGainCommand(5, 10);
// sendGainCommand(6, 10);
// sendGainCommand(7, 10);
