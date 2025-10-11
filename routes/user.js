// routes/user.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const QuizAttempt = require('../models/QuizAttempt');
const Competition = require('../models/Competition');
const auth = require('../middleware/auth');

// Get user profile
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('-__v -createdAt -updatedAt');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: {
                id: user._id,
                telegramId: user.telegramId,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                phone: user.phone,
                region: user.region,
                birthDate: user.birthDate,
                accountType: user.accountType,
                experienceLevel: user.experienceLevel,
                quizFrequency: user.quizFrequency,
                interests: user.interests,
                totalPoints: user.totalPoints,
                monthlyPoints: user.monthlyPoints,
                dailyPoints: user.dailyPoints,
                quizzesCompleted: user.quizzesCompleted,
                correctAnswers: user.correctAnswers,
                totalAnswers: user.totalAnswers,
                accuracy: user.accuracy,
                currentStreak: user.currentStreak,
                longestStreak: user.longestStreak,
                rank: user.rank,
                level: user.level,
                lastActive: user.lastActive,
                isActive: user.isActive,
                preferences: user.preferences
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update user profile
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

        // Update fields
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

        // TO'LIQ yangilangan user ma'lumotlarini qaytarish
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
            email: user.email,
            // Virtual fields
            fullName: user.firstName + (user.lastName ? ' ' + user.lastName : ''),
            age: user.birthDate ? Math.floor((new Date() - new Date(user.birthDate)) / (365.25 * 24 * 60 * 60 * 1000)) : null
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

// Get user statistics
router.get('/statistics', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get recent quiz attempts
        const recentAttempts = await QuizAttempt.find({ userId: req.user.id })
            .populate('quizId', 'title category difficulty totalPoints')
            .sort({ completedAt: -1 })
            .limit(10)
            .select('quizId totalCorrect totalPoints accuracy totalTime completedAt');

        // Get competition participation
        const competitions = await Competition.find({
            'leaderboard.userId': req.user.id
        })
            .select('name startDate endDate isActive')
            .sort({ startDate: -1 })
            .limit(5);

        // Calculate weekly progress
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const weeklyAttempts = await QuizAttempt.find({
            userId: req.user.id,
            completedAt: { $gte: oneWeekAgo }
        });

        const weeklyPoints = weeklyAttempts.reduce((sum, attempt) => sum + attempt.totalPoints, 0);
        const weeklyQuizzes = weeklyAttempts.length;
        const weeklyAccuracy = weeklyAttempts.length > 0 ?
            weeklyAttempts.reduce((sum, attempt) => sum + attempt.accuracy, 0) / weeklyAttempts.length : 0;

        // Get category performance
        const categoryStats = await QuizAttempt.aggregate([
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
            }
        ]);

        // Get daily progress for last 7 days
        const dailyProgress = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);

            const dayAttempts = await QuizAttempt.find({
                userId: req.user.id,
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

        res.json({
            overallStats: {
                totalPoints: user.totalPoints,
                monthlyPoints: user.monthlyPoints,
                dailyPoints: user.dailyPoints,
                quizzesCompleted: user.quizzesCompleted,
                accuracy: user.accuracy,
                currentStreak: user.currentStreak,
                longestStreak: user.longestStreak,
                rank: user.rank,
                level: user.level
            },
            weeklyProgress: {
                points: weeklyPoints,
                quizzes: weeklyQuizzes,
                accuracy: Math.round(weeklyAccuracy)
            },
            categoryPerformance: categoryStats,
            recentActivity: {
                attempts: recentAttempts,
                competitions: competitions.map(comp => ({
                    name: comp.name,
                    startDate: comp.startDate,
                    endDate: comp.endDate,
                    isActive: comp.isActive
                }))
            },
            dailyProgress
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user's quiz history
router.get('/quiz-history', auth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const attempts = await QuizAttempt.find({ userId: req.user.id })
            .populate('quizId', 'title category difficulty totalQuestions totalPoints')
            .populate('competitionId', 'name')
            .sort({ completedAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('quizId competitionId totalCorrect totalPoints accuracy totalTime completedAt');

        const total = await QuizAttempt.countDocuments({ userId: req.user.id });

        res.json({
            attempts,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user's competition history
router.get('/competition-history', auth, async (req, res) => {
    try {
        const competitions = await Competition.find({
            'leaderboard.userId': req.user.id
        })
            .populate('winners.userId', 'firstName lastName username')
            .select('name startDate endDate isActive prizePool winners leaderboard')
            .sort({ startDate: -1 });

        const competitionHistory = competitions.map(comp => {
            const userEntry = comp.leaderboard.find(entry =>
                entry.userId.toString() === req.user.id
            );

            const userWon = comp.winners.find(winner =>
                winner.userId._id.toString() === req.user.id
            );

            return {
                id: comp._id,
                name: comp.name,
                startDate: comp.startDate,
                endDate: comp.endDate,
                isActive: comp.isActive,
                prizePool: comp.prizePool,
                userStats: {
                    rank: userEntry?.rank || null,
                    points: userEntry?.points || 0,
                    quizzesCompleted: userEntry?.quizzesCompleted || 0,
                    accuracy: userEntry?.accuracy || 0
                },
                prizeWon: userWon?.prize || 0,
                finalRank: userWon?.rank || null
            };
        });

        res.json({
            competitions: competitionHistory,
            totalCompetitions: competitions.length,
            activeCompetitions: competitions.filter(comp => comp.isActive).length,
            prizesWon: competitionHistory.reduce((sum, comp) => sum + comp.prizeWon, 0)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user achievements and badges
router.get('/achievements', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const achievements = [
            {
                id: 'quiz_master',
                title: 'Quiz Master',
                description: 'Complete 50 quizzes',
                icon: '🏆',
                progress: user.quizzesCompleted,
                target: 50,
                achieved: user.quizzesCompleted >= 50,
                reward: 500
            },
            {
                id: 'accuracy_pro',
                title: 'Accuracy Pro',
                description: 'Achieve 90% accuracy rate',
                icon: '🎯',
                progress: user.accuracy,
                target: 90,
                achieved: user.accuracy >= 90,
                reward: 300
            },
            {
                id: 'streak_champion',
                title: 'Streak Champion',
                description: 'Maintain a 7-day streak',
                icon: '🔥',
                progress: user.currentStreak,
                target: 7,
                achieved: user.currentStreak >= 7,
                reward: 200
            },
            {
                id: 'point_millionaire',
                title: 'Point Millionaire',
                description: 'Earn 10,000 total points',
                icon: '💰',
                progress: user.totalPoints,
                target: 10000,
                achieved: user.totalPoints >= 10000,
                reward: 1000
            },
            {
                id: 'daily_warrior',
                title: 'Daily Warrior',
                description: 'Complete 30 daily quizzes',
                icon: '⚡',
                progress: Math.min(user.quizzesCompleted, 30),
                target: 30,
                achieved: user.quizzesCompleted >= 30,
                reward: 400
            },
            {
                id: 'competition_hero',
                title: 'Competition Hero',
                description: 'Participate in 5 competitions',
                icon: '🏅',
                progress: 0, // This would need to be calculated from competition history
                target: 5,
                achieved: false,
                reward: 600
            },
            {
                id: 'speed_demon',
                title: 'Speed Demon',
                description: 'Complete 10 quizzes in under 5 minutes each',
                icon: '⚡',
                progress: 0, // This would need specific tracking
                target: 10,
                achieved: false,
                reward: 350
            },
            {
                id: 'category_expert',
                title: 'Category Expert',
                description: 'Master 5 different quiz categories',
                icon: '📚',
                progress: 0, // This would need category tracking
                target: 5,
                achieved: false,
                reward: 450
            }
        ];

        // Calculate total rewards earned
        const totalRewards = achievements
            .filter(ach => ach.achieved)
            .reduce((sum, ach) => sum + ach.reward, 0);

        res.json({
            achievements,
            summary: {
                totalAchievements: achievements.filter(ach => ach.achieved).length,
                totalPossible: achievements.length,
                completionPercentage: Math.round((achievements.filter(ach => ach.achieved).length / achievements.length) * 100),
                totalRewardsEarned: totalRewards
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update user preferences
router.patch('/preferences', auth, async (req, res) => {
    try {
        const { preferences } = req.body;

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (preferences) {
            user.preferences = new Map([
                ...user.preferences,
                ...Object.entries(preferences)
            ]);
            await user.save();
        }

        res.json({
            message: 'Preferences updated successfully',
            preferences: Object.fromEntries(user.preferences)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get leaderboard position
router.get('/leaderboard-position', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user's rank globally
        const usersAbove = await User.countDocuments({
            totalPoints: { $gt: user.totalPoints }
        });

        const globalRank = usersAbove + 1;

        // Get users around current user for context
        const nearbyUsers = await User.find({
            $or: [
                { totalPoints: { $gte: user.totalPoints - 100, $lte: user.totalPoints + 100 } }
            ]
        })
            .sort({ totalPoints: -1, accuracy: -1 })
            .limit(10)
            .select('firstName lastName username totalPoints accuracy level');

        res.json({
            user: {
                rank: globalRank,
                points: user.totalPoints,
                accuracy: user.accuracy,
                level: user.level
            },
            leaderboard: nearbyUsers.map((u, index) => ({
                rank: usersAbove + index + 1,
                name: `${u.firstName} ${u.lastName}`,
                username: u.username,
                points: u.totalPoints,
                accuracy: u.accuracy,
                level: u.level,
                isCurrentUser: u._id.toString() === user._id.toString()
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deactivate account
router.patch('/deactivate', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.isActive = false;
        await user.save();

        res.json({
            message: 'Account deactivated successfully',
            deactivatedAt: new Date()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reactivate account
router.patch('/reactivate', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.isActive = true;
        user.lastActive = new Date();
        await user.save();

        res.json({
            message: 'Account reactivated successfully',
            reactivatedAt: new Date()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;