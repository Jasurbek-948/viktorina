const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// IP manzilini olish funksiyasi
const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const ips = forwarded.split(',').map(ip => ip.trim());
        return ips[0];
    }
    return req.ip || req.connection.remoteAddress || 'unknown';
};

// /me endpoint
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

        // IP manzilini yangilash
        const clientIp = getClientIp(req);
        user.ipAddress = clientIp;
        user.ipHistory.push({
            ip: clientIp,
            timestamp: new Date()
        });
        if (user.ipHistory.length > 50) { // Tarixni cheklash (masalan, so'nggi 50 ta IP)
            user.ipHistory = user.ipHistory.slice(-50);
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
            onboardingCompleted: user.onboardingCompleted,
            avatar: user.avatar,
            ipAddress: user.ipAddress
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

router.get('/profile/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;

        console.log('📋 Getting profile for Telegram ID:', telegramId);

        if (!telegramId) {
            return res.status(400).json({
                success: false,
                message: 'Telegram ID is required'
            });
        }

        const user = await User.findOne({ telegramId: telegramId.toString() });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // IP manzilini yangilash
        const clientIp = getClientIp(req);
        user.ipAddress = clientIp;
        user.ipHistory.push({
            ip: clientIp,
            timestamp: new Date()
        });
        if (user.ipHistory.length > 50) {
            user.ipHistory = user.ipHistory.slice(-50);
        }
        await user.save();

        return res.status(200).json({
            success: true,
            user: {
                telegramId: user.telegramId,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                phone: user.phone,
                region: user.region,
                totalPoints: user.totalPoints,
                monthlyPoints: user.monthlyPoints,
                dailyPoints: user.dailyPoints,
                weeklyPoints: user.weeklyPoints,
                quizzesCompleted: user.quizzesCompleted,
                correctAnswers: user.correctAnswers,
                totalQuestions: user.totalQuestions,
                accuracy: user.accuracy,
                currentStreak: user.currentStreak,
                longestStreak: user.longestStreak,
                rank: user.rank,
                level: user.level,
                experience: user.experience,
                onboardingCompleted: user.onboardingCompleted || false,
                avatar: user.avatar
            }
        });

    } catch (error) {
        console.error('Error getting profile:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// /check/:telegramId endpoint
router.get('/check-user/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;

        console.log('🔍 Checking user existence for Telegram ID:', telegramId);

        if (!telegramId) {
            return res.status(400).json({
                success: false,
                message: 'Telegram ID is required'
            });
        }

        // Foydalanuvchini bazadan qidirish
        const user = await User.findOne({ telegramId: telegramId.toString() });

        console.log('📊 User found in database:', !!user);

        if (user) {
            // IP manzilini yangilash
            const clientIp = getClientIp(req);
            user.ipAddress = clientIp;
            user.ipHistory.push({
                ip: clientIp,
                timestamp: new Date()
            });
            if (user.ipHistory.length > 50) {
                user.ipHistory = user.ipHistory.slice(-50);
            }
            await user.save();

            return res.status(200).json({
                success: true,
                exists: true,
                user: {
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
                    weeklyPoints: user.weeklyPoints,
                    quizzesCompleted: user.quizzesCompleted,
                    correctAnswers: user.correctAnswers,
                    totalQuestions: user.totalQuestions,
                    accuracy: user.accuracy,
                    currentStreak: user.currentStreak,
                    longestStreak: user.longestStreak,
                    rank: user.rank,
                    level: user.level,
                    experience: user.experience,
                    lastActive: user.lastActive,
                    preferences: user.preferences,
                    onboardingCompleted: user.onboardingCompleted || false,
                    avatar: user.avatar,
                    ipAddress: user.ipAddress,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt
                }
            });
        } else {
            return res.status(200).json({
                success: true,
                exists: false,
                message: 'User not found'
            });
        }

    } catch (error) {
        console.error('❌ Error checking user existence:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while checking user existence',
            error: error.message
        });
    }
});
// /register endpoint
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

        console.log('🎯 Registration request received:', {
            telegramId,
            accountType,
            name: name ? `${name.substring(0, 10)}...` : 'empty',
            phone: phone ? `${phone.substring(0, 10)}...` : 'empty'
        });

        if (!telegramId) {
            return res.status(400).json({
                success: false,
                error: 'Telegram ID is required',
                code: 'MISSING_TELEGRAM_ID'
            });
        }

        // Check if user already exists
        let user = await User.findOne({ telegramId: telegramId.toString() });

        if (user) {
            console.log('⚠️ User already exists with Telegram ID:', telegramId);
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
        if (!firstName.trim()) {
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

        // Validate phone format
        let cleanPhone = '';
        if (phone) {
            cleanPhone = phone.replace(/\D/g, '');
            if (!cleanPhone.startsWith('998')) {
                return res.status(400).json({
                    success: false,
                    error: 'Telefon raqami +998 formatida bo\'lishi kerak',
                    code: 'INVALID_PHONE_FORMAT'
                });
            }
            if (cleanPhone.length !== 12) {
                return res.status(400).json({
                    success: false,
                    error: 'Telefon raqami 12 ta raqamdan iborat bo\'lishi kerak',
                    code: 'INVALID_PHONE_LENGTH'
                });
            }
            cleanPhone = '+' + cleanPhone;
        }

        // Validate birthDate
        let validBirthDate = null;
        if (birthDate) {
            const birthDateObj = new Date(birthDate);
            const today = new Date();
            const minAgeDate = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate());
            const maxAgeDate = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());

            if (birthDateObj < minAgeDate || birthDateObj > maxAgeDate) {
                return res.status(400).json({
                    success: false,
                    error: 'Tug\'ilgan sana noto\'g\'ri',
                    code: 'INVALID_BIRTHDATE'
                });
            }
            validBirthDate = birthDateObj;
        }

        // Generate default avatar URL
        const defaultAvatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${telegramId}`;

        // IP manzilini olish
        const clientIp = getClientIp(req);

        // Create new user - User modeliga mos keladigan ma'lumotlar
        user = new User({
            telegramId: telegramId.toString(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            username: `user${telegramId.toString().slice(-6)}`, // Default username
            phone: cleanPhone || '',
            region: region || '',
            birthDate: validBirthDate,
            accountType: accountType || 'personal',
            experienceLevel: experienceLevel || 'beginner',
            quizFrequency: quizFrequency || 'occasionally',
            interests: interests || [],
            bio: 'Quiz enthusiast and knowledge seeker',
            avatar: defaultAvatarUrl,
            isActive: true,
            lastActive: new Date(),
            onboardingCompleted: true, // RO'YXATDAN O'TGAN FOYDALANUVCHI UCHUN HAR DOIM TRUE
            ipAddress: clientIp,
            ipHistory: [{ ip: clientIp, timestamp: new Date() }],
            // User modelidagi default qiymatlar
            totalPoints: 0,
            monthlyPoints: 0,
            dailyPoints: 0,
            weeklyPoints: 0,
            quizzesCompleted: 0,
            correctAnswers: 0,
            totalQuestions: 0,
            accuracy: 0,
            currentStreak: 0,
            longestStreak: 0,
            rank: 9999,
            level: 1,
            experience: 0,
            preferences: {
                notifications: true,
                darkMode: false,
                language: 'uzbek',
                soundEnabled: true,
                vibrationEnabled: true,
                showLeaderboard: true,
                emailNotifications: false
            }
        });

        await user.save();
        console.log('✅ User registered successfully:', user._id);

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'quiz_app_fallback_secret_2024',
            { expiresIn: '30d' }
        );

        // To'liq foydalanuvchi ma'lumotlarini tayyorlash
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
            weeklyPoints: user.weeklyPoints,
            quizzesCompleted: user.quizzesCompleted,
            correctAnswers: user.correctAnswers,
            totalQuestions: user.totalQuestions,
            accuracy: user.accuracy,
            currentStreak: user.currentStreak,
            longestStreak: user.longestStreak,
            rank: user.rank,
            level: user.level,
            experience: user.experience,
            lastActive: user.lastActive,
            preferences: user.preferences,
            onboardingCompleted: user.onboardingCompleted,
            avatar: user.avatar,
            ipAddress: user.ipAddress,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: userResponse
        });

    } catch (error) {
        console.error('❌ Registration error:', error);

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

// /profile endpoint
router.put('/profile', async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            username,
            birthDate,
            phone,
            region,
            bio,
            avatar
        } = req.body;

        console.log('Received profile update data:', req.body);

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

        // IP manzilini yangilash
        const clientIp = getClientIp(req);
        user.ipAddress = clientIp;
        user.ipHistory.push({
            ip: clientIp,
            timestamp: new Date()
        });
        if (user.ipHistory.length > 50) {
            user.ipHistory = user.ipHistory.slice(-50);
        }

        // Username tekshirish (agar o'zgartirilgan bo'lsa)
        if (username !== undefined && username !== user.username) {
            // Username bandligini tekshirish
            const existingUser = await User.findOne({
                username: username,
                _id: { $ne: user._id }
            });

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    error: 'Bu foydalanuvchi nomi band',
                    code: 'USERNAME_TAKEN'
                });
            }

            // Username formatini tekshirish
            if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
                return res.status(400).json({
                    success: false,
                    error: 'Foydalanuvchi nomi 3-20 belgidan iborat bo\'lishi va faqat harflar, raqamlar va pastki chiziqdan iborat bo\'lishi kerak',
                    code: 'INVALID_USERNAME_FORMAT'
                });
            }

            user.username = username;
        }

        // Update fields - avatar har doim yangilansin
        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (birthDate !== undefined) user.birthDate = birthDate ? new Date(birthDate) : null;
        if (phone !== undefined) user.phone = phone;
        if (region !== undefined) user.region = region;
        if (bio !== undefined) user.bio = bio;

        // AVATAR NI HAR DOIM YANGILASH
        if (avatar !== undefined) {
            user.avatar = avatar;
            console.log('Avatar updated to:', avatar);
        }

        await user.save();
        console.log('User saved successfully, avatar:', user.avatar);

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
            onboardingCompleted: user.onboardingCompleted,
            avatar: user.avatar,
            ipAddress: user.ipAddress
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

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired',
                code: 'TOKEN_EXPIRED'
            });
        }

        // MongoDB duplicate key error
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                error: 'Bu foydalanuvchi nomi band',
                code: 'USERNAME_TAKEN'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

// /refresh-token endpoint
router.post('/refresh-token', async (req, res) => {
    try {
        const { telegramId } = req.body;

        if (!telegramId) {
            return res.status(400).json({
                success: false,
                error: 'Telegram ID is required',
                code: 'MISSING_TELEGRAM_ID'
            });
        }

        // Foydalanuvchini MongoDB dan qidirish
        const user = await User.findOne({ telegramId: telegramId.toString() });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        // IP manzilini yangilash
        const clientIp = getClientIp(req);
        user.ipAddress = clientIp;
        user.ipHistory.push({
            ip: clientIp,
            timestamp: new Date()
        });
        if (user.ipHistory.length > 50) {
            user.ipHistory = user.ipHistory.slice(-50);
        }

        // Yangi JWT token generatsiya qilish
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'quiz_app_fallback_secret_2024',
            { expiresIn: '30d' }
        );

        // Foydalanuvchi ma'lumotlarini tayyorlash
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
            avatar: user.avatar,
            ipAddress: user.ipAddress
        };

        await user.save();

        // Javobni qaytarish
        res.json({
            success: true,
            message: 'Token refreshed successfully',
            token,
            user: userResponse
        });

    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'SERVER_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;