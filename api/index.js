const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// ✅ TO'LIQ CORS KONFIGURATSIYASI
const corsOptions = {
    origin: function (origin, callback) {
        // Barcha originlarni ruxsat berish
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
            'http://localhost:5173',
            'https://viktorina-utuu.vercel.app',
            'https://viktorina-frontend.vercel.app',
            'https://*.vercel.app',
            process.env.FRONTEND_URL
        ].filter(Boolean);

        // Development rejimida barcha originlarni ruxsat berish
        if (process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }

        // Productionda allowedOrigins ni tekshirish
        if (!origin || allowedOrigins.some(allowed => origin.match(new RegExp(allowed.replace('*', '.*'))))) {
            callback(null, true);
        } else {
            callback(new Error('CORS policy bilan ruxsat etilmagan'));
        }
    },
    credentials: true, // Cookie va authentication headerlar uchun
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers',
        'X-API-Key'
    ],
    exposedHeaders: [
        'Content-Range',
        'X-Content-Range',
        'Content-Length',
        'X-Total-Count'
    ],
    maxAge: 86400, // Preflight so'rovlari 24 soat cache
    preflightContinue: false,
    optionsSuccessStatus: 204
};

// CORS ni birinchi middleware sifatida qo'llash
app.use(cors(corsOptions));

// Preflight so'rovlarini boshqarish
app.options('*', cors(corsOptions));

// Security middleware
app.set('trust proxy', true);
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    }
}));

// Compression
app.use(compression());

// Logging
app.use(morgan('combined'));

// Rate limiting - CORS dan keyin
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Body parser - CORS dan keyin
app.use(express.json({
    limit: '50mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({
    extended: true,
    limit: '50mb'
}));

// ✅ CORS Headers ni qo'shimcha qo'llash
app.use((req, res, next) => {
    // Barcha response'lar uchun CORS headerlarini qo'shish
    const origin = req.headers.origin;

    if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
    } else {
        res.header('Access-Control-Allow-Origin', '*');
    }

    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, X-Refresh-Token'
    );
    res.header('Access-Control-Expose-Headers',
        'Content-Range, X-Content-Range, Content-Length, X-Total-Count, X-API-Key'
    );

    // Preflight so'rovlarini boshqarish
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    next();
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quiz_competition', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('✅ MongoDB connected successfully'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/quiz', require('./routes/quiz'));
app.use('/api/competition', require('./routes/competition'));
app.use('/api/user', require('./routes/user'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/telegram', require('./routes/telegram'));
app.use('/api/referral', require('./routes/referral'));
app.use('/api/admin', require('./routes/admin'));

// ✅ Admin Routes - CORS bilan ishlashini tekshirish
app.use('/api/admin/competitions', require('./routes/adminCompetitionRoutes'));
app.use('/api/admin/quizzes', require('./routes/adminQuizRoutes'));
app.use('/api/admin/users', require('./routes/adminUserRoutes'));
app.use('/api/admin/stats', require('./routes/adminStatsRoutes'));
app.use('/api/admin/auth', require('./routes/adminAuth'));

// Health check endpoint - CORS bilan
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Quiz App API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        cors: {
            allowedOrigins: [
                'http://localhost:3000',
                'http://localhost:3001',
                'https://viktorina-utuu.vercel.app'
            ]
        }
    });
});

// Test endpoint for CORS
app.get('/api/test-cors', (req, res) => {
    res.json({
        success: true,
        message: 'CORS test successful!',
        origin: req.headers.origin,
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use(require('./middleware/errorHandler'));

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
});

// Vercel uchun eksport
module.exports = app;

// Lokal development uchun
if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🌐 CORS enabled for all origins`);
        console.log(`🔗 Health check: http://localhost:${PORT}/health`);
        console.log(`🔗 CORS test: http://localhost:${PORT}/api/test-cors`);
    });
}