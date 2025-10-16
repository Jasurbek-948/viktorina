const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Competition = require('../models/Competition');
const adminAuth = require('../middleware/adminAuth');

// ✅ Umumiy platforma statistikasi
router.get('/stats/overview', adminAuth, async (req, res) => {
    try {
        // Foydalanuvchi statistikasi
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        const newUsersToday = await User.countDocuments({
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });
        const todayActiveUsers = await User.countDocuments({
            lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        // Quiz statistikasi
        const totalQuizzes = await Quiz.countDocuments();
        const activeQuizzes = await Quiz.countDocuments({ isActive: true });
        const totalQuizAttempts = await QuizAttempt.countDocuments();
        const todayQuizAttempts = await QuizAttempt.countDocuments({
            completedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        // Competition statistikasi
        const totalCompetitions = await Competition.countDocuments();
        const activeCompetitions = await Competition.countDocuments({ isActive: true });
        const totalCompetitionParticipants = await Competition.aggregate([
            { $group: { _id: null, total: { $sum: '$totalParticipants' } } }
        ]);

        // Points statistikasi
        const totalPointsStats = await User.aggregate([
            { $group: { _id: null, totalPoints: { $sum: '$totalPoints' } } }
        ]);

        const stats = {
            users: {
                total: totalUsers,
                active: activeUsers,
                newToday: newUsersToday,
                activeToday: todayActiveUsers,
                growthRate: totalUsers > 0 ? ((newUsersToday / totalUsers) * 100).toFixed(2) : 0
            },
            quizzes: {
                total: totalQuizzes,
                active: activeQuizzes,
                totalAttempts: totalQuizAttempts,
                todayAttempts: todayQuizAttempts,
                avgAttemptsPerUser: totalUsers > 0 ? (totalQuizAttempts / totalUsers).toFixed(2) : 0
            },
            competitions: {
                total: totalCompetitions,
                active: activeCompetitions,
                totalParticipants: totalCompetitionParticipants[0]?.total || 0,
                avgParticipants: totalCompetitions > 0 ?
                    (totalCompetitionParticipants[0]?.total / totalCompetitions).toFixed(2) : 0
            },
            points: {
                totalPoints: totalPointsStats[0]?.totalPoints || 0,
                avgPointsPerUser: totalUsers > 0 ? (totalPointsStats[0]?.totalPoints / totalUsers).toFixed(2) : 0
            }
        };

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('Statistika olish xatosi:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ✅ Oylik progress statistikasi
router.get('/stats/monthly-growth', adminAuth, async (req, res) => {
    try {
        const monthlyStats = await User.aggregate([
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    newUsers: { $sum: 1 },
                    totalPoints: { $sum: '$totalPoints' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
            { $limit: 12 }
        ]);

        const quizAttemptsStats = await QuizAttempt.aggregate([
            {
                $group: {
                    _id: {
                        year: { $year: '$completedAt' },
                        month: { $month: '$completedAt' }
                    },
                    totalAttempts: { $sum: 1 },
                    avgAccuracy: { $avg: '$accuracy' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
            { $limit: 12 }
        ]);

        res.json({
            success: true,
            monthlyStats,
            quizAttemptsStats
        });

    } catch (error) {
        console.error('Oylik statistika olish xatosi:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;