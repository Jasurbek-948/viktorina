const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const app = express();


app.use(cors({
    origin: function (origin, callback) {
        if (process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }

        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
            'http://localhost:5173',
            'https://viktorina-utuu.vercel.app',
            'https://viktorina-frontend.vercel.app'
        ];

        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('CORS not allowed'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers'
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

app.options('*', cors());

app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false
}));

app.use(compression());
app.use(morgan('combined'));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: {
        success: false,
        error: 'Too many requests'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quiz_competition', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('✅ MongoDB connected successfully'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

app.get('/api/test-cors', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.json({
        success: true,
        message: 'CORS test successful!',
        origin: req.headers.origin,
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.json({
        success: true,
        message: 'Quiz App API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

app.use('/api/auth', require('../routes/auth'));
app.use('/api/quiz', require('../routes/quiz'));
app.use('/api/user', require('../routes/user'));
app.use('/api/leaderboard', require('../routes/leaderboard'));
app.use('/api/telegram', require('../routes/telegram'));
app.use('/api/referral', require('../routes/referral'));
app.use('/api/admin', require('../routes/admin'));

app.use('/api/admin/competitions', require('../routes/adminCompetitionRoutes'));
app.use('/api/admin/quizzes', require('../routes/adminQuizRoutes'));
app.use('/api/admin/users', require('../routes/adminUserRoutes'));
app.use('/api/admin/stats', require('../routes/adminStatsRoutes'));
app.use('/api/admin/auth', require('../routes/adminAuth'));

app.use(require('../middleware/errorHandler'));

app.use('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
});

module.exports = app;

if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🌐 CORS enabled for all origins`);
    });
}