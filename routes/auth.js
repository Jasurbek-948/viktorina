// routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Yangilangan /me endpoint
router.get('/me', async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'No token provided',
                code: 'NO_TOKEN'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'quiz_app_fallback_secret_2024');
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        // Update last active
        user.lastActive = new Date();
        await user.save();

        const userResponse = {
            id: user._id,
            telegramId: user.telegramId,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            name: user.firstName + (user.lastName ? ' ' + user.lastName : ''),
            phone: user.phone,
            region: user.region,
            birthDate: user.birthDate,
            bio: user.bio,
            accountType: user.accountType,
            experienceLevel: user.experienceLevel,
            quizFrequency: user.quizFrequency,
            interests: user.interests,
            totalPoints: user.totalPoints,
            monthlyPoints: user.monthlyPoints,
            dailyPoints: user.dailyPoints,
            quizzesCompleted: user.quizzesCompleted,
            correctAnswers: user.correctAnswers,
            totalQuestions: user.totalQuestions,
            accuracy: user.accuracy,
            currentStreak: user.currentStreak,
            longestStreak: user.longestStreak,
            rank: user.rank,
            level: user.level,
            lastActive: user.lastActive,
            preferences: user.preferences,
            onboardingCompleted: user.onboardingCompleted
        };

        res.json({
            success: true,
            user: userResponse
        });

    } catch (error) {
        console.error('Get me error:', error);

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token',
                code: 'INVALID_TOKEN'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired',
                code: 'TOKEN_EXPIRED'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

router.post('/register', async (req, res) => {
    try {
        const {
            telegramId,
            accountType,
            experienceLevel,
            quizFrequency,
            interests,
            name,
            birthDate,
            phone,
            region
        } = req.body;

        console.log('Registration request received:', req.body);

        if (!telegramId) {
            return res.status(400).json({
                success: false,
                error: 'Telegram ID is required',
                code: 'MISSING_TELEGRAM_ID'
            });
        }

        // Check if user already exists
        let user = await User.findOne({ telegramId });

        if (user) {
            return res.status(400).json({
                success: false,
                error: 'User already exists',
                code: 'USER_EXISTS'
            });
        }

        // Process name - split into firstName and lastName
        let firstName = '';
        let lastName = '';

        if (name) {
            const nameParts = name.trim().split(/\s+/);
            firstName = nameParts[0] || '';
            lastName = nameParts.slice(1).join(' ') || '';
        }

        // If no name provided, use default
        if (!firstName) {
            firstName = 'User';
            lastName = '';
        }

        // Validate required fields
        if (!firstName.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Name is required',
                code: 'MISSING_NAME'
            });
        }

        // Create new user
        user = new User({
            telegramId: telegramId.toString(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone || '',
            region: region || '',
            birthDate: birthDate ? new Date(birthDate) : undefined,
            accountType: accountType || 'personal',
            experienceLevel: experienceLevel || 'beginner',
            quizFrequency: quizFrequency || 'occasionally',
            interests: interests || [],
            isActive: true,
            lastActive: new Date(),
            onboardingCompleted: true
        });

        await user.save();

        console.log('User registered successfully:', user._id);

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'quiz_app_fallback_secret_2024',
            { expiresIn: '30d' }
        );

        // Prepare response
        const userResponse = {
            id: user._id,
            telegramId: user.telegramId,
            firstName: user.firstName,
            lastName: user.lastName,
            name: user.firstName + (user.lastName ? ' ' + user.lastName : ''),
            username: user.username,
            phone: user.phone,
            region: user.region,
            birthDate: user.birthDate,
            bio: user.bio,
            accountType: user.accountType,
            experienceLevel: user.experienceLevel,
            quizFrequency: user.quizFrequency,
            interests: user.interests,
            totalPoints: user.totalPoints,
            monthlyPoints: user.monthlyPoints,
            dailyPoints: user.dailyPoints,
            quizzesCompleted: user.quizzesCompleted,
            accuracy: user.accuracy,
            currentStreak: user.currentStreak,
            longestStreak: user.longestStreak,
            rank: user.rank,
            level: user.level,
            lastActive: user.lastActive,
            preferences: user.preferences,
            onboardingCompleted: user.onboardingCompleted
        };

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: userResponse
        });

    } catch (error) {
        console.error('Registration error:', error);

        // Mongoose validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors,
                code: 'VALIDATION_ERROR'
            });
        }

        // Duplicate key error
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                error: 'User with this Telegram ID already exists',
                code: 'DUPLICATE_TELEGRAM_ID'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'SERVER_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Yangilangan profile update endpoint
router.put('/profile', async (req, res) => {
    try {
        const {
            name,
            birthDate,
            phone,
            region,
            bio
        } = req.body;

        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'No token provided',
                code: 'NO_TOKEN'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'quiz_app_fallback_secret_2024');
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        // Update fields
        if (name) {
            const nameParts = name.trim().split(/\s+/);
            user.firstName = nameParts[0] || '';
            user.lastName = nameParts.slice(1).join(' ') || '';
        }
        if (birthDate !== undefined) user.birthDate = birthDate ? new Date(birthDate) : null;
        if (phone !== undefined) user.phone = phone;
        if (region !== undefined) user.region = region;
        if (bio !== undefined) user.bio = bio;

        await user.save();

        const userResponse = {
            id: user._id,
            telegramId: user.telegramId,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            name: user.firstName + (user.lastName ? ' ' + user.lastName : ''),
            phone: user.phone,
            region: user.region,
            birthDate: user.birthDate,
            bio: user.bio,
            accountType: user.accountType,
            experienceLevel: user.experienceLevel,
            quizFrequency: user.quizFrequency,
            interests: user.interests,
            totalPoints: user.totalPoints,
            monthlyPoints: user.monthlyPoints,
            dailyPoints: user.dailyPoints,
            quizzesCompleted: user.quizzesCompleted,
            accuracy: user.accuracy,
            currentStreak: user.currentStreak,
            longestStreak: user.longestStreak,
            rank: user.rank,
            level: user.level,
            lastActive: user.lastActive,
            preferences: user.preferences,
            onboardingCompleted: user.onboardingCompleted
        };

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: userResponse
        });

    } catch (error) {
        console.error('Profile update error:', error);

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token',
                code: 'INVALID_TOKEN'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

module.exports = router;