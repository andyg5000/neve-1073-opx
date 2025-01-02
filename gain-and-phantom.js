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
        micGain: 0, // Default mic gain
        lineGain: 0, // Default line gain
        diGain: 0, // Default DI gain
    })),
};

// Create a single socket connection
const client = new net.Socket();

function parseIncomingData(data) {
    const hexData = data.toString('hex');
    console.log('Received:', hexData);

    // Extract channel ID (10th byte in the payload)
    const channelId = parseInt(hexData.substring(18, 20), 16);

    // Extract front/back (11th to 14th bytes)
    const connectionHex = hexData.substring(20, 28);
    const connectionFlag = parseInt(connectionHex, 16);

    // Extract settings bitfield (15th to 18th bytes)
    const settingsHex = hexData.substring(28, 36);
    const settings = parseInt(settingsHex, 16);

    // Extract gain encoding (last 6 characters)
    const gainEncoding = hexData.substring(hexData.length - 6);
    const micGain = parseInt(gainEncoding.substring(0, 2), 16);
    const lineGain = parseInt(gainEncoding.substring(2, 4), 16);
    const diGain = parseInt(gainEncoding.substring(4, 6), 16);

    // Update channel state
    if (state.channels[channelId] !== undefined) {
        // Decode connection (front/back)
        state.channels[channelId].connection = (connectionFlag === 0x00000001) ? "front" : "back";

        // Decode specific settings from the bitfield
        state.channels[channelId].phantom = !!(settings & 0x00000001);
        state.channels[channelId].pad = !!(settings & 0x00000100);
        state.channels[channelId].lowZ = !!(settings & 0x00010000);

        // Decode input type
        if (settings & 0x02000000) {
            state.channels[channelId].input = "di";
        } else if (settings & 0x01000000) {
            state.channels[channelId].input = "line";
        } else {
            state.channels[channelId].input = "mic";
        }

        // Update gain values
        state.channels[channelId].micGain = micGain;
        state.channels[channelId].lineGain = lineGain;
        state.channels[channelId].diGain = diGain;

        // Log updated state
        console.log(`Updated state for channel ${channelId}:`, state.channels[channelId]);
    } else {
        console.warn(`Unknown channel ID: ${channelId}`);
    }
}

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

    // Clamp and encode gain values
    // @todo : This isn't working properly, but is close.
    const micGain = Math.min(Math.max(state.channels[channelId].micGain, 0), 70).toString(16).padStart(2, '0');
    const lineGain = Math.min(Math.max(state.channels[channelId].lineGain, 0), 60).toString(16).padStart(2, '0');
    const diGain = Math.min(Math.max(state.channels[channelId].diGain, 0), 255).toString(16).padStart(2, '0');

    // Combine gains into the last 6 characters
    const gainHex = `${micGain}${lineGain}${diGain}`;

    const suffix = "123c"; // Fixed suffix
    return `${header}${channelHex}${operationFlag}${settingsHex}${gainHex}${suffix}`;
}


// Function to send a payload and update state
function sendPayload(channelId, phantom, pad, lowZ, input, connection, gain) {
    // Update the state object
    state.channels[channelId-1] = { phantom, pad, lowZ, input, connection, gain };

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

// Handle incoming data
client.on('data', (data) => {
    let parsed =  parseIncomingData(data);
    // console.log(parsed);
    // console.log(state);
});

// Handle connection errors
client.on('error', (err) => {
    console.error('Connection error:', err.message);
});

// Handle connection close
client.on('close', () => {
    console.log('Connection closed.');
});


// Example Usage
sendPayload(2, false, false, false, "mic", "front", 0);
console.log(state)
