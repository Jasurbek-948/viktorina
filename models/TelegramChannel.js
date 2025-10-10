// models/TelegramChannel.js
const mongoose = require('mongoose');

const telegramChannelSchema = new mongoose.Schema({
    channelId: {
        type: String,
        required: true,
        unique: true
    },
    channelUsername: {
        type: String,
        required: true
    },
    channelTitle: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    memberCount: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    pointsReward: {
        type: Number,
        default: 100 // Obuna bo'lish uchun beriladigan ball
    },
    requiredForQuiz: {
        type: Boolean,
        default: false // Ba'zi quizlar uchun majburiy obuna
    },
    botIsAdmin: {
        type: Boolean,
        default: false // Bot kanalda adminmi
    },
    lastChecked: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('TelegramChannel', telegramChannelSchema);