require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for base64 images

// MQTT connection
// require('./config/mqttConfig'); 

// Routers
const userRouter = require('./router/userRouter');
const familyRouter = require('./router/familyRouter');
const inventoryRouter = require('./router/inventoryRouter');
const pantryRouter = require('./router/pantryRouter');
const shoppingRouter = require('./router/shoppingRouter');
const mealRouter = require('./router/mealRouter');
const utilRouter = require('./router/utilRouter');

// Routes
app.use('/api/auth', userRouter);
app.use('/api/families', familyRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/pantry', pantryRouter);
app.use('/api/shopping', shoppingRouter);
app.use('/api/meals', mealRouter);
app.use('/api/utils', utilRouter);

// Health check
app.get('/api/status', (req, res) => {
    res.json({ 
        message: "🍱 Smart Pantry server is running!", 
        firebase: "connected",
        version: "2.1.0",
        endpoints: {
            auth: '/api/auth',
            families: '/api/families',
            inventory: '/api/inventory',
            pantry: '/api/pantry',
            shopping: '/api/shopping',
            utils: '/api/utils'
        }
    });
});

// Server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🍱 Smart Pantry server running at http://localhost:${PORT}`);
});