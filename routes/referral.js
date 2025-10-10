// routes/referral.js
const express = require('express');
const router = express.Router();
const Referral = require('../models/Referral');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Referral code olish yoki yaratish
router.get('/my-code', auth, async (req, res) => {
    try {
        let user = await User.findById(req.user.id);

        // Agar referral code bo'lmasa, yaratamiz
        if (!user.referralCode) {
            user.generateReferralCode();
            await user.save();
        }

        const referralStats = await Referral.aggregate([
            { $match: { referrerId: user._id, status: 'completed' } },
            {
                $group: {
                    _id: null,
                    totalReferrals: { $sum: 1 },
                    totalPoints: { $sum: '$pointsEarned' }
                }
            }
        ]);

        const stats = referralStats[0] || { totalReferrals: 0, totalPoints: 0 };

        res.json({
            success: true,
            referralCode: user.referralCode,
            referralLink: `https://t.me/your_bot_username?start=${user.referralCode}`,
            stats: {
                totalReferrals: stats.totalReferrals,
                totalPoints: stats.totalPoints,
                pendingReferrals: await Referral.countDocuments({
                    referrerId: user._id,
                    status: 'pending'
                })
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Do'stni taklif qilish orqali ro'yxatdan o'tganlar ro'yxati
router.get('/my-referrals', auth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const referrals = await Referral.find({ referrerId: req.user.id })
            .populate('referredUserId', 'firstName lastName username telegramId createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Referral.countDocuments({ referrerId: req.user.id });

        res.json({
            success: true,
            referrals,
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

// Referral orqali ro'yxatdan o'tish (auth middleware siz)
router.post('/signup/:referralCode', async (req, res) => {
    try {
        const { referralCode } = req.params;
        const { telegramId, username, firstName, lastName } = req.body;

        // Referral code ni tekshiramiz
        const referrer = await User.findOne({ referralCode });
        if (!referrer) {
            return res.status(400).json({ error: 'Noto\'g\'ri referral code' });
        }

        // Foydalanuvchi allaqachon ro'yxatdan o'tganmi tekshiramiz
        const existingUser = await User.findOne({ telegramId });
        if (existingUser) {
            return res.status(400).json({ error: 'Foydalanuvchi allaqachon ro\'yxatdan o\'tgan' });
        }

        // Yangi foydalanuvchi yaratamiz
        const newUser = new User({
            telegramId,
            username,
            firstName,
            lastName,
            referredBy: referrer._id
        });

        // Referral code yaratamiz
        newUser.generateReferralCode();
        await newUser.save();

        // Referral yozuvini yaratamiz
        const referral = new Referral({
            referrerId: referrer._id,
            referredUserId: newUser._id,
            referralCode,
            status: 'completed',
            pointsEarned: 500, // Do'st taklif qilish uchun beriladigan ball
            completedAt: new Date()
        });

        await referral.save();

        // Referrer ga ball beramiz
        referrer.totalReferrals += 1;
        referrer.referralPoints += 500;
        referrer.totalPoints += 500;
        referrer.monthlyPoints += 500;
        referrer.dailyPoints += 500;
        await referrer.save();

        res.status(201).json({
            success: true,
            message: 'Ro\'yxatdan o\'tish muvaffaqiyatli amalga oshirildi',
            user: {
                id: newUser._id,
                firstName: newUser.firstName,
                referralCode: newUser.referralCode
            },
            bonus: {
                points: 500,
                message: 'Referral orqali ro\'yxatdan o\'tganingiz uchun 500 ball qo\'lga kiritdingiz'
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Top referrers (leaderboard uchun)
router.get('/leaderboard', auth, async (req, res) => {
    try {
        const timeRange = req.query.timeRange || 'all-time'; // all-time, monthly, weekly
        let dateFilter = {};

        if (timeRange === 'monthly') {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            dateFilter = { createdAt: { $gte: startOfMonth } };
        } else if (timeRange === 'weekly') {
            const startOfWeek = new Date();
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            dateFilter = { createdAt: { $gte: startOfWeek } };
        }

        const topReferrers = await Referral.aggregate([
            { $match: { ...dateFilter, status: 'completed' } },
            {
                $group: {
                    _id: '$referrerId',
                    totalReferrals: { $sum: 1 },
                    totalPoints: { $sum: '$pointsEarned' }
                }
            },
            { $sort: { totalReferrals: -1 } },
            { $limit: 50 },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $project: {
                    _id: 0,
                    userId: '$_id',
                    firstName: { $arrayElemAt: ['$user.firstName', 0] },
                    lastName: { $arrayElemAt: ['$user.lastName', 0] },
                    username: { $arrayElemAt: ['$user.username', 0] },
                    totalReferrals: 1,
                    totalPoints: 1
                }
            }
        ]);

        res.json({
            success: true,
            timeRange,
            leaderboard: topReferrers
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;