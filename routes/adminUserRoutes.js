const express = require('express');
const router = express.Router();
const User = require('../models/User');
const QuizAttempt = require('../models/QuizAttempt');
const Competition = require('../models/Competition');
const Referral = require('../models/Referral');
const adminAuth = require('../middleware/adminAuth');

// ✅ Barcha foydalanuvchilarni olish (admin paneli uchun)
router.get('/users', adminAuth, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            region,
            accountType,
            isActive,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Search va filter query
        const query = {};

        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } },
                { telegramId: { $regex: search, $options: 'i' } }
            ];
        }

        if (region && region !== 'all') {
            query.region = region;
        }

        if (accountType && accountType !== 'all') {
            query.accountType = accountType;
        }

        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        // Sort
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const users = await User.find(query)
            .select('telegramId firstName lastName username region accountType totalPoints monthlyPoints dailyPoints quizzesCompleted accuracy currentStreak rank level isActive lastActive createdAt avatar')
            .sort(sortOptions)
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await User.countDocuments(query);

        // Umumiy statistika
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        const todayActiveUsers = await User.countDocuments({
            lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        res.json({
            success: true,
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            },
            stats: {
                totalUsers,
                activeUsers,
                todayActiveUsers,
                inactiveUsers: totalUsers - activeUsers
            }
        });

    } catch (error) {
        console.error('Foydalanuvchilarni olish xatosi:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ✅ Foydalanuvchining to'liq ma'lumotlarini olish
router.get('/users/:id', adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate('referredBy', 'firstName lastName username telegramId')
            .populate('achievements.achievementId');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Foydalanuvchi topilmadi'
            });
        }

        // Quiz attempts statistikasi
        const quizStats = await QuizAttempt.aggregate([
            { $match: { userId: user._id, completed: true } },
            {
                $group: {
                    _id: null,
                    totalAttempts: { $sum: 1 },
                    totalPointsEarned: { $sum: '$totalPoints' },
                    averageAccuracy: { $avg: '$accuracy' },
                    averageTimePerQuiz: { $avg: '$totalTime' },
                    totalTimeSpent: { $sum: '$totalTime' }
                }
            }
        ]);

        // Category performance
        const categoryPerformance = await QuizAttempt.aggregate([
            { $match: { userId: user._id, completed: true } },
            {
                $lookup: {
                    from: 'quizzes',
                    localField: 'quizId',
                    foreignField: '_id',
                    as: 'quiz'
                }
            },
            { $unwind: '$quiz' },
            {
                $group: {
                    _id: '$quiz.category',
                    totalQuizzes: { $sum: 1 },
                    averageAccuracy: { $avg: '$accuracy' },
                    totalPoints: { $sum: '$totalPoints' },
                    averageTime: { $avg: '$totalTime' }
                }
            },
            {
                $project: {
                    category: '$_id',
                    totalQuizzes: 1,
                    averageAccuracy: { $round: ['$averageAccuracy', 2] },
                    totalPoints: 1,
                    averageTime: { $round: ['$averageTime', 2] }
                }
            },
            { $sort: { totalPoints: -1 } }
        ]);

        // Competition participation
        const competitions = await Competition.find({
            'leaderboard.userId': user._id
        })
            .select('name startDate endDate isActive prizePool winners leaderboard')
            .populate('winners.userId', 'firstName lastName username');

        const competitionStats = competitions.map(comp => {
            const userEntry = comp.leaderboard.find(entry =>
                entry.userId.toString() === user._id.toString()
            );
            const userWon = comp.winners.find(winner =>
                winner.userId._id.toString() === user._id.toString()
            );

            return {
                competitionId: comp._id,
                name: comp.name,
                startDate: comp.startDate,
                endDate: comp.endDate,
                isActive: comp.isActive,
                userRank: userEntry?.rank || null,
                userPoints: userEntry?.points || 0,
                quizzesCompleted: userEntry?.quizzesCompleted || 0,
                accuracy: userEntry?.accuracy || 0,
                prizeWon: userWon?.prize || 0,
                finalRank: userWon?.rank || null
            };
        });

        // Referral history
        const referralStats = await Referral.find({ referrerId: user._id })
            .populate('referredUserId', 'firstName lastName username telegramId createdAt')
            .sort({ createdAt: -1 });

        // So'nggi quiz attempts
        const recentAttempts = await QuizAttempt.find({ userId: user._id })
            .populate('quizId', 'title category difficulty totalPoints')
            .populate('competitionId', 'name')
            .sort({ completedAt: -1 })
            .limit(10)
            .select('quizId competitionId totalCorrect totalPoints accuracy totalTime completedAt');

        // Daily progress (oxirgi 7 kun)
        const dailyProgress = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);

            const dayAttempts = await QuizAttempt.find({
                userId: user._id,
                completedAt: { $gte: date, $lt: nextDay }
            });

            dailyProgress.push({
                date: date.toISOString().split('T')[0],
                quizzesCompleted: dayAttempts.length,
                pointsEarned: dayAttempts.reduce((sum, attempt) => sum + attempt.totalPoints, 0),
                accuracy: dayAttempts.length > 0 ?
                    dayAttempts.reduce((sum, attempt) => sum + attempt.accuracy, 0) / dayAttempts.length : 0
            });
        }

        // Foydalanuvchi ma'lumotlarini formatlash
        const userData = {
            basicInfo: {
                id: user._id,
                telegramId: user.telegramId,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                phone: user.phone,
                region: user.region,
                birthDate: user.birthDate,
                age: user.age,
                bio: user.bio,
                accountType: user.accountType,
                experienceLevel: user.experienceLevel,
                quizFrequency: user.quizFrequency,
                interests: user.interests,
                email: user.email,
                avatar: user.avatar,
                isActive: user.isActive,
                onboardingCompleted: user.onboardingCompleted,
                createdAt: user.createdAt,
                lastActive: user.lastActive
            },
            pointsStats: {
                totalPoints: user.totalPoints,
                monthlyPoints: user.monthlyPoints,
                dailyPoints: user.dailyPoints,
                weeklyPoints: user.weeklyPoints,
                referralPoints: user.referralPoints,
                subscriptionPoints: user.subscriptionPoints,
                totalAchievementPoints: user.totalAchievementPoints
            },
            quizStats: {
                quizzesCompleted: user.quizzesCompleted,
                correctAnswers: user.correctAnswers,
                totalQuestions: user.totalQuestions,
                accuracy: user.accuracy,
                currentStreak: user.currentStreak,
                longestStreak: user.longestStreak
            },
            rankStats: {
                rank: user.rank,
                level: user.level,
                experience: user.experience
            },
            detailedStats: quizStats[0] || {
                totalAttempts: 0,
                totalPointsEarned: 0,
                averageAccuracy: 0,
                averageTimePerQuiz: 0,
                totalTimeSpent: 0
            },
            categoryPerformance,
            competitions: competitionStats,
            referrals: {
                referralCode: user.referralCode,
                referredBy: user.referredBy,
                totalReferrals: user.totalReferrals,
                referralHistory: referralStats
            },
            subscriptions: {
                totalSubscriptions: user.subscribedChannels.length,
                activeSubscriptions: user.activeSubscriptions,
                subscriptionPoints: user.subscriptionPoints,
                channels: user.subscribedChannels
            },
            achievements: {
                total: user.achievements.length,
                totalPoints: user.totalAchievementPoints,
                list: user.achievements
            },
            preferences: Object.fromEntries(user.preferences),
            recentActivity: {
                attempts: recentAttempts,
                dailyProgress
            },
            ipInfo: {
                currentIp: user.ipAddress,
                ipHistory: user.ipHistory
            }
        };

        res.json({
            success: true,
            user: userData
        });

    } catch (error) {
        console.error('Foydalanuvchi ma\'lumotlarini olish xatosi:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ✅ Foydalanuvchini yangilash (admin tomonidan)
router.put('/users/:id', adminAuth, async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            username,
            phone,
            region,
            birthDate,
            bio,
            accountType,
            experienceLevel,
            quizFrequency,
            interests,
            isActive,
            totalPoints,
            monthlyPoints,
            dailyPoints,
            rank,
            level
        } = req.body;

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Foydalanuvchi topilmadi'
            });
        }

        // Username unikalligini tekshirish
        if (username && username !== user.username) {
            const existingUser = await User.findOne({
                username,
                _id: { $ne: user._id }
            });

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Bu username band'
                });
            }
        }

        // Yangilash
        const updateFields = {
            firstName, lastName, username, phone, region,
            birthDate, bio, accountType, experienceLevel,
            quizFrequency, interests, isActive
        };

        // Ballarni yangilash (faqat admin)
        if (totalPoints !== undefined) user.totalPoints = totalPoints;
        if (monthlyPoints !== undefined) user.monthlyPoints = monthlyPoints;
        if (dailyPoints !== undefined) user.dailyPoints = dailyPoints;
        if (rank !== undefined) user.rank = rank;
        if (level !== undefined) user.level = level;

        Object.keys(updateFields).forEach(key => {
            if (updateFields[key] !== undefined) {
                user[key] = updateFields[key];
            }
        });

        await user.save();

        res.json({
            success: true,
            message: 'Foydalanuvchi ma\'lumotlari yangilandi',
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                isActive: user.isActive,
                totalPoints: user.totalPoints,
                rank: user.rank,
                level: user.level
            }
        });

    } catch (error) {
        console.error('Foydalanuvchi yangilash xatosi:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ✅ Foydalanuvchini bloklash/ochirish
router.patch('/users/:id/status', adminAuth, async (req, res) => {
    try {
        const { isActive } = req.body;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isActive },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Foydalanuvchi topilmadi'
            });
        }

        res.json({
            success: true,
            message: `Foydalanuvchi ${isActive ? 'faollashtirildi' : 'bloklandi'}`,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                isActive: user.isActive
            }
        });

    } catch (error) {
        console.error('Foydalanuvchi statusini o\'zgartirish xatosi:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ✅ Foydalanuvchining quiz attempts tarixi
router.get('/users/:id/quiz-attempts', adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 20, startDate, endDate } = req.query;

        const query = { userId: req.params.id };

        if (startDate || endDate) {
            query.completedAt = {};
            if (startDate) query.completedAt.$gte = new Date(startDate);
            if (endDate) query.completedAt.$lte = new Date(endDate);
        }

        const attempts = await QuizAttempt.find(query)
            .populate('quizId', 'title category difficulty totalQuestions totalPoints')
            .populate('competitionId', 'name')
            .sort({ completedAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await QuizAttempt.countDocuments(query);

        // Umumiy statistika
        const stats = await QuizAttempt.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalAttempts: { $sum: 1 },
                    totalPoints: { $sum: '$totalPoints' },
                    averageAccuracy: { $avg: '$accuracy' },
                    totalCorrect: { $sum: '$totalCorrect' },
                    totalTime: { $sum: '$totalTime' }
                }
            }
        ]);

        res.json({
            success: true,
            attempts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            },
            stats: stats[0] || {
                totalAttempts: 0,
                totalPoints: 0,
                averageAccuracy: 0,
                totalCorrect: 0,
                totalTime: 0
            }
        });

    } catch (error) {
        console.error('Quiz attempts olish xatosi:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ✅ Foydalanuvchining referral tarixi
router.get('/users/:id/referrals', adminAuth, async (req, res) => {
    try {
        const referrals = await Referral.find({ referrerId: req.params.id })
            .populate('referredUserId', 'firstName lastName username telegramId createdAt totalPoints rank')
            .sort({ createdAt: -1 });

        const referralStats = await Referral.aggregate([
            { $match: { referrerId: req.params.id } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalPoints: { $sum: '$pointsEarned' }
                }
            }
        ]);

        res.json({
            success: true,
            referrals,
            stats: {
                total: referrals.length,
                completed: referralStats.find(s => s._id === 'completed')?.count || 0,
                pending: referralStats.find(s => s._id === 'pending')?.count || 0,
                totalPoints: referralStats.reduce((sum, stat) => sum + stat.totalPoints, 0)
            }
        });

    } catch (error) {
        console.error('Referral tarixini olish xatosi:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ✅ Foydalanuvchi statistikalari
router.get('/users/:id/stats', adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Foydalanuvchi topilmadi'
            });
        }

        // Haftalik progress
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const weeklyStats = await QuizAttempt.aggregate([
            {
                $match: {
                    userId: user._id,
                    completedAt: { $gte: oneWeekAgo }
                }
            },
            {
                $group: {
                    _id: null,
                    quizzesCompleted: { $sum: 1 },
                    totalPoints: { $sum: '$totalPoints' },
                    averageAccuracy: { $avg: '$accuracy' },
                    totalTime: { $sum: '$totalTime' }
                }
            }
        ]);

        // Oylik progress
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const monthlyStats = await QuizAttempt.aggregate([
            {
                $match: {
                    userId: user._id,
                    completedAt: { $gte: oneMonthAgo }
                }
            },
            {
                $group: {
                    _id: null,
                    quizzesCompleted: { $sum: 1 },
                    totalPoints: { $sum: '$totalPoints' },
                    averageAccuracy: { $avg: '$accuracy' }
                }
            }
        ]);

        res.json({
            success: true,
            stats: {
                overall: {
                    totalPoints: user.totalPoints,
                    quizzesCompleted: user.quizzesCompleted,
                    accuracy: user.accuracy,
                    currentStreak: user.currentStreak,
                    rank: user.rank,
                    level: user.level
                },
                weekly: weeklyStats[0] || {
                    quizzesCompleted: 0,
                    totalPoints: 0,
                    averageAccuracy: 0,
                    totalTime: 0
                },
                monthly: monthlyStats[0] || {
                    quizzesCompleted: 0,
                    totalPoints: 0,
                    averageAccuracy: 0
                },
                pointsBreakdown: {
                    quizPoints: user.totalPoints - user.referralPoints - user.subscriptionPoints,
                    referralPoints: user.referralPoints,
                    subscriptionPoints: user.subscriptionPoints,
                    achievementPoints: user.totalAchievementPoints
                }
            }
        });

    } catch (error) {
        console.error('Statistika olish xatosi:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ✅ Foydalanuvchini o'chirish
router.delete('/users/:id', adminAuth, async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Foydalanuvchi topilmadi'
            });
        }

        // Bog'liq ma'lumotlarni o'chirish
        await QuizAttempt.deleteMany({ userId: req.params.id });
        await Referral.deleteMany({
            $or: [
                { referrerId: req.params.id },
                { referredUserId: req.params.id }
            ]
        });

        // Competition leaderboarddan o'chirish
        await Competition.updateMany(
            { 'leaderboard.userId': req.params.id },
            { $pull: { leaderboard: { userId: req.params.id } } }
        );

        res.json({
            success: true,
            message: 'Foydalanuvchi va uning barcha ma\'lumotlari o\'chirildi'
        });

    } catch (error) {
        console.error('Foydalanuvchi o\'chirish xatosi:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;