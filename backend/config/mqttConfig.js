const mqtt = require('mqtt');
const db = require('./firebaseConfig');
const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883');

mqttClient.on('connect', () => {
    console.log('✅ Connected to MQTT broker.');
    
    // Subscribe to smart pantry topics
    mqttClient.subscribe('smartpantry/camera/#', (err) => {
        if (!err) console.log('📷 Subscribed to smartpantry/camera/#');
    });
    mqttClient.subscribe('smartpantry/motion/#', (err) => {
        if (!err) console.log('👋 Subscribed to smartpantry/motion/#');
    });
    mqttClient.subscribe('smartpantry/status/#', (err) => {
        if (!err) console.log('📊 Subscribed to smartpantry/status/#');
    });
});

mqttClient.on('message', async (topic, message) => {
    try {
        const payload = message.toString();
        const topicParts = topic.split('/');
        console.log(`📨 MQTT received topic: ${topic}`);

        // smartpantry/motion/{deviceId} — PIR motion detected events
        if (topicParts[1] === 'motion' && topicParts.length === 3) {
            const deviceId = topicParts[2];
            const data = JSON.parse(payload);
            // data: { detected: true, wakeReason: "pir", timestamp: "..." }
            
            await db.ref(`pantry_device/${deviceId}`).update({
                lastMotionDetected: data.timestamp || new Date().toISOString(),
                lastActive: data.timestamp || new Date().toISOString(),
                triggerCount: (await db.ref(`pantry_device/${deviceId}/triggerCount`).once('value')).val() + 1 || 1
            });
            console.log(`👋 Motion detected — device: ${deviceId}, reason: ${data.wakeReason || 'pir'}`);
        }

        // smartpantry/status/{deviceId} — device status updates (heartbeat, battery, etc.)
        if (topicParts[1] === 'status' && topicParts.length === 3) {
            const deviceId = topicParts[2];
            const data = JSON.parse(payload);
            
            await db.ref(`pantry_device/${deviceId}`).update({
                ...data,
                updatedAt: new Date().toISOString()
            });
            console.log(`📊 Status updated for device: ${deviceId}`);
        }

        // smartpantry/camera/{deviceId} — image data handled by pantryRouter via HTTP
        // MQTT is used here only for small notifications, actual image upload goes through REST API
        if (topicParts[1] === 'camera' && topicParts.length === 3) {
            const deviceId = topicParts[2];
            console.log(`📷 Camera event from device: ${deviceId} — image will be processed via REST API`);
        }

    } catch (error) {
        console.error('❌ MQTT processing error:', error.message);
    }
});

mqttClient.on('error', (err) => {
    console.error('❌ MQTT connection error:', err.message);
});

module.exports = mqttClient;