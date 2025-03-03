/*jshint esversion: 8 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pinoLogger = require('./logger');

const connectToDatabase = require('./models/db');
const {loadData} = require("./util/import-mongo/index");


const app = express();
app.use("*",cors());
const port = 3060;

// Connect to MongoDB; we just do this one time
connectToDatabase().then(() => {
    pinoLogger.info('Connected to DB');
})
    .catch((e) => console.error('Failed to connect to DB', e));


app.use(express.json());

// Route files
const giftRoutes = require('./routes/giftRoutes');
const authRoutes = require('./routes/authRoutes');
const searchRoutes = require('./routes/searchRoutes');
const pinoHttp = require('pino-http');
const logger = require('./logger');

app.use(pinoHttp({ logger }));

// Custom route for /api/gifts/search before the main gift routes
app.get('/api/gifts/search', async (req, res, next) => {
    try {
        const db = await connectToDatabase();
        const collection = db.collection("gifts");
        
        // Get search query from request parameters
        const query = req.query.q || '';
        const category = req.query.category;
        const priceMin = req.query.priceMin ? Number(req.query.priceMin) : 0;
        const priceMax = req.query.priceMax ? Number(req.query.priceMax) : Infinity;
        
        // Build MongoDB query
        const searchCriteria = {};
        
        if (query) {
            searchCriteria.$or = [
                { name: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } }
            ];
        }
        
        if (category) {
            searchCriteria.category = category;
        }
        
        searchCriteria.price = { $gte: priceMin, $lte: priceMax };
        
        // Execute search query
        const gifts = await collection.find(searchCriteria).toArray();
        
        res.json(gifts);
    } catch (e) {
        logger.error('Search operation failed', e);
        next(e);
    }
});

// Use Routes
app.use('/api/gifts', giftRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send('Internal Server Error');
});

app.get("/",(req,res)=>{
    res.send("Inside the server");
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
