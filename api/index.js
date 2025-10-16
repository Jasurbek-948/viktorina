const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// CORS sozlamalari
const corsOptions = {
    origin: ['http://localhost:3001', 'https://viktorina-utuu.vercel.app'], // O'z frontend manzillingizni qo'shing
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Security middleware
app.set('trust proxy', true);
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    }
});
app.use(limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/admin', require('./routes/adminCompetitionRoutes'));
app.use('/api/admin', require('./routes/adminQuizRoutes'));
app.use('/api/admin', require('./routes/adminUserRoutes'));
app.use('/api/admin', require('./routes/adminStatsRoutes'));
app.use('/api', require('./routes/adminAuth'));

// Error handling middleware
app.use(require('./middleware/errorHandler'));

app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Quiz App API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
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
    });
}