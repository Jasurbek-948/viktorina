const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// ✅ PROXY SOZLAMALARI - BIRINCHI BO'LIB QO'YISH KERAK
// Vercel, Heroku yoki boshqa cloud platformalar uchun trust proxy ni yoqish
app.set('trust proxy', 1); // 1 - birinchi proxy ga ishonish

// ✅ Rate Limit sozlamalari - trust proxy dan keyin
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 daqiqa
    max: 1000, // Har bir IP uchun 15 daqiqada maksimal 1000 so'rov
    message: {
        success: false,
        error: 'Juda ko\'p so\'rovlar. Iltimos, 15 daqiqadan keyin qayta urining.'
    },
    standardHeaders: true, // RateLimit-* headerlarni qaytarish
    legacyHeaders: false, // X-RateLimit-* headerlarni o'chirish
    // ✅ Proxy uchun maxsus keyGenerator
    keyGenerator: (req, res) => {
        // Proxy mavjud bo'lsa, X-Forwarded-For dan IP ni olish
        if (req.headers['x-forwarded-for']) {
            const forwardedIps = req.headers['x-forwarded-for'].split(',');
            return forwardedIps[0].trim(); // Birinchi IP ni olish (foydalanuvchi IP si)
        }
        // Proxy bo'lmasa, standart IP ni olish
        return req.ip;
    },
    // ✅ Handler xatoliklarni to'g'ri boshqarish
    handler: (req, res, next, options) => {
        res.status(429).json({
            success: false,
            error: options.message.error,
            retryAfter: Math.ceil(options.windowMs / 1000),
            limit: options.max,
            windowMs: options.windowMs
        });
    }
});

// ✅ Middleware larni TO'G'RI TARTIBDA qo'llash
app.use(limiter); // Rate limit birinchi bo'lib

// CORS sozlamalari
app.use(cors({
    origin: function (origin, callback) {
        // Development mode da barcha origin larni ruxsat berish
        if (process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }

        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
            'http://localhost:5173',
            'https://viktorina-utuu.vercel.app',
            'https://viktorina-frontend.vercel.app',
            'https://publicly-living-bee.ngrok-free.app'
        ];

        // Agar origin yo'q bo'lsa (masalan, mobile app) yoki allowedOrigins da bo'lsa
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

// Boshqa middleware lar
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false
}));

app.use(compression());
app.use(morgan('combined'));

// Body parser middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// MongoDB ulanishi
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quiz_competition', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('✅ MongoDB connected successfully'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Test endpointlari
app.get('/api/test-cors', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.json({
        success: true,
        message: 'CORS test successful!',
        origin: req.headers.origin,
        clientIp: req.ip,
        forwardedFor: req.headers['x-forwarded-for'],
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
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        trustProxy: app.get('trust proxy'),
        clientIp: req.ip,
        forwardedFor: req.headers['x-forwarded-for']
    });
});

// API route lar
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

// Xato handler middleware
app.use(require('../middleware/errorHandler'));

// 404 handler
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
        console.log(`🔒 Trust proxy: ${app.get('trust proxy')}`);
    });
}