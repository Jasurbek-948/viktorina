// routes/telegram.js
const express = require('express');
const router = express.Router();
const TelegramChannel = require('../models/TelegramChannel');
const User = require('../models/User');
const auth = require('../middleware/auth');
const axios = require('axios');

// Bot token ini environment dan olamiz
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Kanal qo'shish (admin uchun)
router.post('/channels', auth, async (req, res) => {
    try {
        const { channelId, channelUsername, channelTitle, description, pointsReward, requiredForQuiz } = req.body;

        // Faqat adminlar qo'sha oladi
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Faqat adminlar kanal qo\'sha oladi' });
        }

        const channel = new TelegramChannel({
            channelId,
            channelUsername,
            channelTitle,
            description,
            pointsReward: pointsReward || 100,
            requiredForQuiz: requiredForQuiz || false
        });

        await channel.save();

        res.status(201).json({
            success: true,
            message: 'Kanal muvaffaqiyatli qo\'shildi',
            channel
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Foydalanuvchi kanalga obuna bo'lganmi tekshirish
router.post('/check-subscription', auth, async (req, res) => {
    try {
        const { channelId } = req.body;
        const userId = req.user.id;

        // Kanal ma'lumotlarini olish
        const channel = await TelegramChannel.findOne({ channelId, isActive: true });
        if (!channel) {
            return res.status(404).json({ error: 'Kanal topilmadi yoki faol emas' });
        }

        // Telegram API orqali obunani tekshirish
        const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember`, {
            params: {
                chat_id: channelId,
                user_id: userId
            }
        });

        const chatMember = response.data.result;
        const isSubscribed = ['member', 'administrator', 'creator'].includes(chatMember.status);

        if (isSubscribed) {
            // Foydalanuvchi obuna bo'lgan, ball beramiz
            const user = await User.findById(req.user.id);

            // Agar avval obuna bo'lmagan bo'lsa
            const alreadySubscribed = user.subscribedChannels.some(sub => sub.channelId === channelId);

            if (!alreadySubscribed) {
                user.subscribedChannels.push({
                    channelId,
                    channelUsername: channel.channelUsername,
                    subscribedAt: new Date(),
                    pointsEarned: channel.pointsReward
                });

                user.subscriptionPoints += channel.pointsReward;
                user.totalPoints += channel.pointsReward;
                user.monthlyPoints += channel.pointsReward;
                user.dailyPoints += channel.pointsReward;

                await user.save();

                res.json({
                    success: true,
                    subscribed: true,
                    pointsEarned: channel.pointsReward,
                    message: `Tabriklaymiz! Siz ${channel.pointsReward} ball qo'lga kiritdingiz`
                });
            } else {
                res.json({
                    success: true,
                    subscribed: true,
                    pointsEarned: 0,
                    message: 'Siz allaqachon ushbu kanalga obuna bo\'lgansiz'
                });
            }
        } else {
            res.json({
                success: true,
                subscribed: false,
                message: 'Siz hali ushbu kanalga obuna bo\'lmagansiz'
            });
        }
    } catch (error) {
        console.error('Subscription check error:', error);
        res.status(500).json({ error: 'Obunani tekshirishda xatolik' });
    }
});

// Foydalanuvchining barcha kanallardagi obuna holatini tekshirish
router.post('/check-all-subscriptions', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const channels = await TelegramChannel.find({ isActive: true });

        const subscriptionResults = [];
        let totalPointsEarned = 0;

        for (const channel of channels) {
            try {
                const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember`, {
                    params: {
                        chat_id: channel.channelId,
                        user_id: userId
                    }
                });

                const chatMember = response.data.result;
                const isSubscribed = ['member', 'administrator', 'creator'].includes(chatMember.status);

                subscriptionResults.push({
                    channelId: channel.channelId,
                    channelUsername: channel.channelUsername,
                    channelTitle: channel.channelTitle,
                    subscribed: isSubscribed,
                    pointsReward: channel.pointsReward,
                    requiredForQuiz: channel.requiredForQuiz
                });

                // Agar obuna bo'lsa va avval obuna bo'lmagan bo'lsa, ball beramiz
                if (isSubscribed) {
                    const user = await User.findById(req.user.id);
                    const alreadySubscribed = user.subscribedChannels.some(sub => sub.channelId === channel.channelId);

                    if (!alreadySubscribed) {
                        user.subscribedChannels.push({
                            channelId: channel.channelId,
                            channelUsername: channel.channelUsername,
                            subscribedAt: new Date(),
                            pointsEarned: channel.pointsReward
                        });

                        user.subscriptionPoints += channel.pointsReward;
                        user.totalPoints += channel.pointsReward;
                        user.monthlyPoints += channel.pointsReward;
                        user.dailyPoints += channel.pointsReward;
                        totalPointsEarned += channel.pointsReward;
                    }
                }
            } catch (error) {
                console.error(`Error checking channel ${channel.channelUsername}:`, error.message);
                subscriptionResults.push({
                    channelId: channel.channelId,
                    channelUsername: channel.channelUsername,
                    channelTitle: channel.channelTitle,
                    subscribed: false,
                    error: 'Tekshirishda xatolik'
                });
            }
        }

        // Foydalanuvchi ma'lumotlarini yangilash
        if (totalPointsEarned > 0) {
            const user = await User.findById(req.user.id);
            await user.save();
        }

        res.json({
            success: true,
            subscriptions: subscriptionResults,
            totalPointsEarned,
            message: totalPointsEarned > 0 ?
                `Tabriklaymiz! Siz ${totalPointsEarned} ball qo'lga kiritdingiz` :
                'Obuna holatlari tekshirildi'
        });
    } catch (error) {
        console.error('All subscriptions check error:', error);
        res.status(500).json({ error: 'Obunalarni tekshirishda xatolik' });
    }
});

// Faol kanallar ro'yxati
router.get('/channels', auth, async (req, res) => {
    try {
        const channels = await TelegramChannel.find({ isActive: true })
            .select('channelId channelUsername channelTitle description pointsReward requiredForQuiz memberCount')
            .sort({ pointsReward: -1 });

        res.json({
            success: true,
            channels
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;