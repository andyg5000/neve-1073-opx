const net = require('net');

// Device configuration
const NEVE_IP = '192.168.9.21';
const NEVE_PORT = 51001;

// Payload for polling
const pollingPayload = "380b0000140000006500000000000000000000000000000000000000";
const idleResponse = "380b000003000000680004";
let state = 0;

// Function to poll the device
function pollDevice() {
    if (state == 1) {
        return;
    }
    state = 1;
    const payloadBuffer = Buffer.from(pollingPayload, 'hex');
    const client = new net.Socket();

    // console.log(`Connecting to ${NEVE_IP}:${NEVE_PORT} to poll...`);

    client.connect(NEVE_PORT, NEVE_IP, () => {
        // console.log(`Connected to ${NEVE_IP}:${NEVE_PORT}`);
        // console.log(`Sending polling payload: ${pollingPayload}`);
        client.write(payloadBuffer); // Send the polling payload
    });

    client.on('data', (data) => {
        // console.log('Received response:');

        const response = data.toString('hex'); // Output the response in hex format
        if (response != idleResponse) {
            console.log(response);
        }
    });

    client.on('close', () => {
        state = 0;
        console.log('Connection closed by the server.');
    });

    client.on('error', (err) => {
        state = 0;
        console.error('Connection error:', err.message);
    });
}

// Poll every 5 seconds
setInterval(pollDevice, 4000);
// pollDevice();
