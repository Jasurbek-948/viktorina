// routes/leaderboard.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

console.log('🔧 Leaderboard routes loaded');

// Barcha leaderboard turlari uchun asosiy endpoint
router.get('/', auth, async (req, res) => {
    try {
        console.log('📊 Leaderboard request received:', {
            type: req.query.type,
            timeframe: req.query.timeframe,
            page: req.query.page,
            search: req.query.search
        });

        const { type = 'global', timeframe = 'all-time', page = 1, limit = 50, search = '' } = req.query;
        const skip = (page - 1) * limit;

        // Search filter
        let searchFilter = {};
        if (search && search.trim() !== '') {
            searchFilter = {
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } },
                    { username: { $regex: search, $options: 'i' } }
                ]
            };
        }

        // Sort field ni aniqlash
        let sortField = 'totalPoints';
        let currentUserScoreField = 'totalPoints';

        switch (timeframe) {
            case 'daily':
                sortField = 'dailyPoints';
                currentUserScoreField = 'dailyPoints';
                break;
            case 'weekly':
                sortField = 'weeklyPoints';
                currentUserScoreField = 'weeklyPoints';
                break;
            case 'monthly':
                sortField = 'monthlyPoints';
                currentUserScoreField = 'monthlyPoints';
                break;
            default:
                sortField = 'totalPoints';
                currentUserScoreField = 'totalPoints';
        }

        console.log(`📈 Fetching ${type} leaderboard for ${timeframe}, sort field: ${sortField}`);

        // Foydalanuvchilarni olish
        const users = await User.find({
            ...searchFilter,
            isActive: true
        })
            .select(`firstName lastName username ${sortField} quizzesCompleted accuracy level avatar rankHistory`)
            .sort({ [sortField]: -1, accuracy: -1, quizzesCompleted: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments({
            ...searchFilter,
            isActive: true
        });

        // Leaderboard ni formatlash
        const leaderboard = users.map((user, index) => {
            const userScore = user[sortField] || 0;
            const rank = skip + index + 1;

            return {
                user_id: user._id,
                rank: rank,
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
                username: user.username,
                total_score: userScore,
                quizzes_completed: user.quizzesCompleted || 0,
                accuracy_rate: user.accuracy || 0,
                level: getLevelTitle(user.level || 1),
                avatar_type: user.avatar || 'default',
                trend: getTrend(user.rankHistory || []),
                rank_change: getRankChange(user.rankHistory || [])
            };
        });

        // Joriy foydalanuvchi rank ini hisoblash
        const currentUserScore = req.user[currentUserScoreField] || 0;
        const usersWithHigherScore = await User.countDocuments({
            [sortField]: { $gt: currentUserScore },
            isActive: true
        });
        const currentUserRank = usersWithHigherScore + 1;

        console.log(`✅ Leaderboard fetched: ${leaderboard.length} users, current user rank: ${currentUserRank}`);

        res.json({
            success: true,
            leaderboard,
            currentUser: {
                rank: currentUserRank,
                totalPoints: req.user.totalPoints || 0,
                weeklyPoints: req.user.weeklyPoints || 0,
                monthlyPoints: req.user.monthlyPoints || 0,
                dailyPoints: req.user.dailyPoints || 0,
                quizzesCompleted: req.user.quizzesCompleted || 0,
                accuracy: req.user.accuracy || 0,
                level: getLevelTitle(req.user.level || 1)
            },
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('❌ Leaderboard error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

// Global leaderboard - alohida endpoint
router.get('/global', auth, async (req, res) => {
    try {
        console.log('🌍 Global leaderboard request');
        const { page = 1, limit = 50, search = '' } = req.query;
        const skip = (page - 1) * limit;

        // Search filter
        let searchFilter = {};
        if (search && search.trim() !== '') {
            searchFilter = {
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } },
                    { username: { $regex: search, $options: 'i' } }
                ]
            };
        }

        // Get total count for pagination
        const total = await User.countDocuments({
            ...searchFilter,
            isActive: true
        });

        // Get users with pagination and sorting by total points
        const users = await User.find({
            ...searchFilter,
            isActive: true
        })
            .select('firstName lastName username totalPoints monthlyPoints weeklyPoints dailyPoints quizzesCompleted accuracy level avatar rankHistory')
            .sort({ totalPoints: -1, accuracy: -1, quizzesCompleted: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Format response
        const leaderboard = users.map((user, index) => ({
            user_id: user._id,
            rank: skip + index + 1,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
            username: user.username,
            total_score: user.totalPoints || 0,
            quizzes_completed: user.quizzesCompleted || 0,
            accuracy_rate: user.accuracy || 0,
            level: getLevelTitle(user.level || 1),
            avatar_type: user.avatar || 'default',
            isCurrentUser: user._id.toString() === req.user.id,
            trend: getTrend(user.rankHistory || []),
            rank_change: getRankChange(user.rankHistory || [])
        }));

        // Get current user's rank
        const currentUserRank = await User.countDocuments({
            totalPoints: { $gt: req.user.totalPoints || 0 },
            isActive: true
        }) + 1;

        console.log(`✅ Global leaderboard: ${leaderboard.length} users, current rank: ${currentUserRank}`);

        res.json({
            success: true,
            leaderboard,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            },
            currentUser: {
                rank: currentUserRank,
                score: req.user.totalPoints || 0,
                quizzes: req.user.quizzesCompleted || 0,
                accuracy: req.user.accuracy || 0,
                level: getLevelTitle(req.user.level || 1)
            }
        });

    } catch (error) {
        console.error('❌ Global leaderboard error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

// Weekly leaderboard
router.get('/weekly', auth, async (req, res) => {
    try {
        console.log('📅 Weekly leaderboard request');
        const { page = 1, limit = 50, search = '' } = req.query;
        const skip = (page - 1) * limit;

        // Search filter
        let searchFilter = {};
        if (search && search.trim() !== '') {
            searchFilter = {
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } },
                    { username: { $regex: search, $options: 'i' } }
                ]
            };
        }

        // Haftalik ballar bo'yicha saralash
        const users = await User.find({
            ...searchFilter,
            isActive: true
        })
            .select('firstName lastName username weeklyPoints totalPoints quizzesCompleted accuracy level avatar')
            .sort({ weeklyPoints: -1, totalPoints: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments({
            ...searchFilter,
            isActive: true
        });

        const leaderboard = users.map((user, index) => ({
            user_id: user._id,
            rank: skip + index + 1,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
            username: user.username,
            total_score: user.weeklyPoints || 0,
            quizzes_completed: user.quizzesCompleted || 0,
            accuracy_rate: user.accuracy || 0,
            level: getLevelTitle(user.level || 1),
            avatar_type: user.avatar || 'default',
            isCurrentUser: user._id.toString() === req.user.id,
            trend: 'stable',
            rank_change: 0
        }));

        // Current user rank
        const currentUserRank = await User.countDocuments({
            weeklyPoints: { $gt: req.user.weeklyPoints || 0 },
            isActive: true
        }) + 1;

        console.log(`✅ Weekly leaderboard: ${leaderboard.length} users, current rank: ${currentUserRank}`);

        res.json({
            success: true,
            leaderboard,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            },
            currentUser: {
                rank: currentUserRank,
                score: req.user.weeklyPoints || 0,
                quizzes: req.user.quizzesCompleted || 0,
                accuracy: req.user.accuracy || 0,
                level: getLevelTitle(req.user.level || 1)
            }
        });

    } catch (error) {
        console.error('❌ Weekly leaderboard error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

// Monthly leaderboard
router.get('/monthly', auth, async (req, res) => {
    try {
        console.log('📊 Monthly leaderboard request');
        const { page = 1, limit = 50, search = '' } = req.query;
        const skip = (page - 1) * limit;

        // Search filter
        let searchFilter = {};
        if (search && search.trim() !== '') {
            searchFilter = {
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } },
                    { username: { $regex: search, $options: 'i' } }
                ]
            };
        }

        // Oylik ballar bo'yicha saralash
        const users = await User.find({
            ...searchFilter,
            isActive: true
        })
            .select('firstName lastName username monthlyPoints totalPoints quizzesCompleted accuracy level avatar')
            .sort({ monthlyPoints: -1, totalPoints: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments({
            ...searchFilter,
            isActive: true
        });

        const leaderboard = users.map((user, index) => ({
            user_id: user._id,
            rank: skip + index + 1,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
            username: user.username,
            total_score: user.monthlyPoints || 0,
            quizzes_completed: user.quizzesCompleted || 0,
            accuracy_rate: user.accuracy || 0,
            level: getLevelTitle(user.level || 1),
            avatar_type: user.avatar || 'default',
            isCurrentUser: user._id.toString() === req.user.id,
            trend: 'stable',
            rank_change: 0
        }));

        // Current user rank
        const currentUserRank = await User.countDocuments({
            monthlyPoints: { $gt: req.user.monthlyPoints || 0 },
            isActive: true
        }) + 1;

        console.log(`✅ Monthly leaderboard: ${leaderboard.length} users, current rank: ${currentUserRank}`);

        res.json({
            success: true,
            leaderboard,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            },
            currentUser: {
                rank: currentUserRank,
                score: req.user.monthlyPoints || 0,
                quizzes: req.user.quizzesCompleted || 0,
                accuracy: req.user.accuracy || 0,
                level: getLevelTitle(req.user.level || 1)
            }
        });

    } catch (error) {
        console.error('❌ Monthly leaderboard error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

// Daily leaderboard
router.get('/daily', auth, async (req, res) => {
    try {
        console.log('📅 Daily leaderboard request');
        const { page = 1, limit = 50, search = '' } = req.query;
        const skip = (page - 1) * limit;

        // Search filter
        let searchFilter = {};
        if (search && search.trim() !== '') {
            searchFilter = {
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } },
                    { username: { $regex: search, $options: 'i' } }
                ]
            };
        }

        // Kunlik ballar bo'yicha saralash
        const users = await User.find({
            ...searchFilter,
            isActive: true
        })
            .select('firstName lastName username dailyPoints totalPoints quizzesCompleted accuracy level avatar')
            .sort({ dailyPoints: -1, totalPoints: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments({
            ...searchFilter,
            isActive: true
        });

        const leaderboard = users.map((user, index) => ({
            user_id: user._id,
            rank: skip + index + 1,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
            username: user.username,
            total_score: user.dailyPoints || 0,
            quizzes_completed: user.quizzesCompleted || 0,
            accuracy_rate: user.accuracy || 0,
            level: getLevelTitle(user.level || 1),
            avatar_type: user.avatar || 'default',
            isCurrentUser: user._id.toString() === req.user.id,
            trend: 'stable',
            rank_change: 0
        }));

        // Current user rank
        const currentUserRank = await User.countDocuments({
            dailyPoints: { $gt: req.user.dailyPoints || 0 },
            isActive: true
        }) + 1;

        console.log(`✅ Daily leaderboard: ${leaderboard.length} users, current rank: ${currentUserRank}`);

        res.json({
            success: true,
            leaderboard,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            },
            currentUser: {
                rank: currentUserRank,
                score: req.user.dailyPoints || 0,
                quizzes: req.user.quizzesCompleted || 0,
                accuracy: req.user.accuracy || 0,
                level: getLevelTitle(req.user.level || 1)
            }
        });

    } catch (error) {
        console.error('❌ Daily leaderboard error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

// Friends leaderboard
router.get('/friends', auth, async (req, res) => {
    try {
        console.log('👥 Friends leaderboard request');
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        // Hozircha do'stlar tizimi yo'q, shuning uchun global qaytaramiz
        const users = await User.find({ isActive: true })
            .select('firstName lastName username totalPoints quizzesCompleted accuracy level avatar')
            .sort({ totalPoints: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments({ isActive: true });

        const leaderboard = users.map((user, index) => ({
            user_id: user._id,
            rank: skip + index + 1,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
            username: user.username,
            total_score: user.totalPoints || 0,
            quizzes_completed: user.quizzesCompleted || 0,
            accuracy_rate: user.accuracy || 0,
            level: getLevelTitle(user.level || 1),
            avatar_type: user.avatar || 'default',
            isCurrentUser: user._id.toString() === req.user.id,
            trend: 'stable',
            rank_change: 0
        }));

        // Current user rank
        const currentUserRank = await User.countDocuments({
            totalPoints: { $gt: req.user.totalPoints || 0 },
            isActive: true
        }) + 1;

        console.log(`✅ Friends leaderboard: ${leaderboard.length} users, current rank: ${currentUserRank}`);

        res.json({
            success: true,
            leaderboard,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            },
            currentUser: {
                rank: currentUserRank,
                score: req.user.totalPoints || 0,
                quizzes: req.user.quizzesCompleted || 0,
                accuracy: req.user.accuracy || 0,
                level: getLevelTitle(req.user.level || 1)
            }
        });

    } catch (error) {
        console.error('❌ Friends leaderboard error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

// User rank history
router.get('/user/rank-history', auth, async (req, res) => {
    try {
        console.log('📈 Rank history request for user:', req.user.id);

        const user = await User.findById(req.user.id).select('rankHistory');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        // Oxirgi 7 kunlik history ni qaytaramiz
        const recentHistory = (user.rankHistory || [])
            .slice(-7)
            .map(entry => ({
                date: entry.date,
                rank: entry.rank,
                points: entry.points
            }));

        console.log(`✅ Rank history fetched: ${recentHistory.length} entries`);

        res.json({
            success: true,
            history: recentHistory
        });

    } catch (error) {
        console.error('❌ Rank history error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

// Update all ranks (admin uchun)
router.post('/update-ranks', auth, async (req, res) => {
    try {
        console.log('🔄 Update ranks request');

        // Faqat admin lar uchun ruxsat (soddalik uchun hozircha barcha user lar uchun ochiq)
        // Kelajakda admin tekshiruvi qo'shishingiz mumkin
        const updatedCount = await updateAllUserRanks();

        console.log(`✅ Ranks updated for ${updatedCount} users`);

        res.json({
            success: true,
            message: `Ranks updated for ${updatedCount} users`,
            updatedCount
        });

    } catch (error) {
        console.error('❌ Update ranks error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

// Test endpoint - authentication siz
router.get('/test', (req, res) => {
    console.log('🧪 Leaderboard test endpoint called');
    res.json({
        success: true,
        message: 'Leaderboard API is working!',
        timestamp: new Date().toISOString(),
        endpoints: [
            '/api/leaderboard/global',
            '/api/leaderboard/weekly',
            '/api/leaderboard/monthly',
            '/api/leaderboard/daily',
            '/api/leaderboard/friends',
            '/api/leaderboard/user/rank-history'
        ]
    });
});

// Helper functions

function getLevelTitle(level) {
    const levels = {
        1: 'Beginner',
        2: 'Beginner',
        3: 'Beginner',
        4: 'Intermediate',
        5: 'Intermediate',
        6: 'Intermediate',
        7: 'Advanced',
        8: 'Advanced',
        9: 'Advanced',
        10: 'Expert',
        11: 'Expert',
        12: 'Expert',
        13: 'Master',
        14: 'Master',
        15: 'Grand Master',
        16: 'Grand Master',
        17: 'Grand Master',
        18: 'Legend',
        19: 'Legend',
        20: 'Legend'
    };
    return levels[level] || `Level ${level}`;
}

function getTrend(rankHistory) {
    if (!rankHistory || rankHistory.length < 2) return 'stable';

    const currentRank = rankHistory[rankHistory.length - 1].rank;
    const previousRank = rankHistory[rankHistory.length - 2].rank;

    if (currentRank < previousRank) return 'up';
    if (currentRank > previousRank) return 'down';
    return 'stable';
}

function getRankChange(rankHistory) {
    if (!rankHistory || rankHistory.length < 2) return 0;

    const currentRank = rankHistory[rankHistory.length - 1].rank;
    const previousRank = rankHistory[rankHistory.length - 2].rank;

    return Math.abs(currentRank - previousRank);
}

// Barcha foydalanuvchilarning ranklarini yangilash
async function updateAllUserRanks() {
    try {
        // Barcha foydalanuvchilarni ballari bo'yicha saralab olamiz
        const users = await User.find({ isActive: true })
            .select('totalPoints')
            .sort({ totalPoints: -1 });

        let updatePromises = [];

        // Har bir foydalanuvchiga rank beramiz
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const rank = i + 1;

            // Rank history ga yangi entry qo'shamiz
            const rankHistoryEntry = {
                date: new Date(),
                rank: rank,
                points: user.totalPoints
            };

            updatePromises.push(
                User.findByIdAndUpdate(user._id, {
                    $set: { rank: rank },
                    $push: {
                        rankHistory: {
                            $each: [rankHistoryEntry],
                            $slice: -30 // Oxirgi 30 ta entry ni saqlaymiz
                        }
                    }
                })
            );
        }

        await Promise.all(updatePromises);
        return users.length;

    } catch (error) {
        console.error('Error updating ranks:', error);
        throw error;
    }
}

console.log('✅ Leaderboard routes configured successfully');

module.exports = router;