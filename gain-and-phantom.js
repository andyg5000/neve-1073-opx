const net = require('net');

// Device configuration
const NEVE_IP = '192.168.9.21';
const NEVE_PORT = 51001;
const KEEP_ALIVE_INTERVAL = 5000; // Send keep-alive every 5 seconds

// State object to track channel configurations
const state = {
    channels: Array.from({ length: 8 }, () => ({
        phantom: false,
        pad: false,
        lowZ: false,
        input: "mic", // Default to mic
        connection: "front", // Default to front
        gain: 0, // Default gain
    })),
};

// Create a single socket connection
const client = new net.Socket();

// Function to construct a payload
function constructPayload(channelId, phantom, pad, lowZ, input, connection, gain) {
    const header = "380b00001400000063"; // Header and command ID
    const channelHex = channelId.toString(16).padStart(2, '0'); // Channel ID

    // Determine the operation flag based on the connection
    let operationFlag = "00000001"; // Default to "front"
    if (connection === "back") {
        operationFlag = "00000000"; // Set to "back"
    }

    // Construct Settings Bitfield for regular features
    let settings = 0x00000000; // Start with all settings off

    // Adjust phantom power based on input
    if (phantom && input === "mic") {
        settings |= 0x00000001; // Enable phantom power
    }

    if (pad) settings |= 0x00000100; // Enable pad
    if (lowZ) settings |= 0x00010000; // Enable low-Z
    if (input === "line") settings |= 0x01000000; // Line input
    if (input === "di") settings |= 0x02000000; // DI input

    const settingsHex = settings.toString(16).padStart(8, '0'); // Convert to hex

    // Adjust gain encoding based on input type
    let gainHex;
    if (input === "di") {
        // DI mode: encode gain as `0014[GainHex]`
        const diGain = Math.min(Math.max(gain, 0), 255); // Clamp gain to 0-255
        const gainValueHex = (0x123c + diGain).toString(16).padStart(4, '0'); // Adjust base gain
        gainHex = `0014${gainValueHex}`;
    } else if (input === "mic") {
        // Mic mode: simpler gain encoding
        const micGain = Math.min(Math.max(gain, 0), 70); // Clamp gain for mic
        gainHex = micGain.toString(16).padStart(4, '0');
    } else {
        // Default mode (line): Standard gain encoding
        const lineGain = Math.min(Math.max(gain, 0), 60); // Clamp gain for line
        gainHex = lineGain.toString(16).padStart(4, '0');
    }

    const suffix = "123c"; // Fixed suffix
    const padding = "000000000000"; // Padding
    return `${header}${channelHex}${operationFlag}${settingsHex}${gainHex}${suffix}`;
}

// Function to send a payload and update state
function sendPayload(channelId, phantom, pad, lowZ, input, connection, gain) {
    // Update the state object
    state.channels[channelId] = { phantom, pad, lowZ, input, connection, gain };

    // Construct and send the payload
    const payloadHex = constructPayload(channelId, phantom, pad, lowZ, input, connection, gain);
    const payloadBuffer = Buffer.from(payloadHex, 'hex');

    console.log(`Sending payload: ${payloadHex}`);
    client.write(payloadBuffer);
}

// Function to send a keep-alive payload
function sendKeepAlive() {
    const keepAlivePayload = Buffer.from("380b0000140000006500000000000000000000000000000000000000", "hex");
    console.log('Sending keep-alive message');
    client.write(keepAlivePayload);
}

// Handle connection setup
client.connect(NEVE_PORT, NEVE_IP, () => {
    console.log(`Connected to ${NEVE_IP}:${NEVE_PORT}`);

    // Enable TCP keep-alive at the socket level
    client.setKeepAlive(true, KEEP_ALIVE_INTERVAL);

    // Start periodic keep-alive messages
    setInterval(sendKeepAlive, KEEP_ALIVE_INTERVAL);
});

// Handle incoming data (responses from the device)
client.on('data', (data) => {
    console.log('Received response:');
    const hexData = data.toString('hex');
    console.log(hexData);

    // Example: Parse the incoming data and update state (you'll need to refine this)
    const channelId = parseInt(hexData.substring(8, 10), 16); // Extract channel ID
    const newGain = parseInt(hexData.substring(16, 20), 16); // Extract new gain value
    if (state.channels[channelId]) {
        state.channels[channelId].gain = newGain;
        console.log(`Updated state for channel ${channelId}:`, state.channels[channelId]);
    }
});

// Handle connection errors
client.on('error', (err) => {
    console.error('Connection error:', err.message);
});

// Handle connection close
client.on('close', () => {
    console.log('Connection closed.');
});

// setTimeout(() => {
// sendPayload(0, false, false, false, "mic", "front", 0);
// sendPayload(1, false, false, false, "mic", "front", 0);
// sendPayload(2, false, false, false, "mic", "front", 0);
// sendPayload(3, false, false, false, "mic", "front", 0);
// sendPayload(4, false, false, false, "mic", "front", 0);
// sendPayload(5, false, false, false, "mic", "front", 0);
// sendPayload(6, false, false, false, "mic", "front", 0);
// sendPayload(7, false, false, false, "mic", "front", 0);
console.log(state);