// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    telegramId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        validate: {
            validator: function (v) {
                return /^\d+$/.test(v.toString());
            },
            message: 'Telegram ID faqat raqamlardan iborat bo\'lishi kerak'
        }
    },
    firstName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    lastName: {
        type: String,
        trim: true,
        maxlength: 100,
        default: ''
    },
    username: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 50,
        sparse: true
    },
    phone: {
        type: String,
        trim: true,
        validate: {
            validator: function (v) {
                if (!v) return true;
                return /^\+?[1-9]\d{1,14}$/.test(v);
            },
            message: 'Telefon raqami formati noto\'g\'ri'
        }
    },
    region: {
        type: String,
        enum: [
            'tashkent', 'tashkent_region', 'andijan', 'bukhara',
            'ferghana', 'jizzakh', 'namangan', 'navoiy',
            'qashqadaryo', 'karakalpakstan', 'samarkand',
            'surkhandarya', 'sirdaryo', 'khorezm'
        ]
    },
    birthDate: {
        type: Date,
        validate: {
            validator: function (v) {
                if (!v) return true;
                const age = new Date().getFullYear() - new Date(v).getFullYear();
                return age >= 13 && age <= 120;
            },
            message: 'Foydalanuvchi 13 va 120 yosh oralig\'ida bo\'lishi kerak'
        }
    },
    bio: {
        type: String,
        maxlength: 500,
        default: 'Quiz ishqibozi va bilim izlovchisi'
    },
    accountType: {
        type: String,
        enum: ['student', 'teacher', 'professional', 'enthusiast', 'personal'],
        default: 'personal'
    },
    experienceLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        default: 'beginner'
    },
    quizFrequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'occasionally'],
        default: 'occasionally'
    },
    interests: {
        type: [{ type: String, trim: true }],
        default: []
    },
    totalPoints: {
        type: Number,
        default: 0,
        min: 0
    },
    monthlyPoints: {
        type: Number,
        default: 0,
        min: 0
    },
    dailyPoints: {
        type: Number,
        default: 0,
        min: 0
    },
    weeklyPoints: {
        type: Number,
        default: 0,
        min: 0
    },
    quizzesCompleted: {
        type: Number,
        default: 0,
        min: 0
    },
    correctAnswers: {
        type: Number,
        default: 0,
        min: 0
    },
    totalQuestions: {
        type: Number,
        default: 0,
        min: 0
    },
    accuracy: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    currentStreak: {
        type: Number,
        default: 0,
        min: 0
    },
    longestStreak: {
        type: Number,
        default: 0,
        min: 0
    },
    rank: {
        type: Number,
        default: 9999
    },
    level: {
        type: Number,
        default: 1,
        min: 1,
        max: 100
    },
    experience: {
        type: Number,
        default: 0,
        min: 0
    },
    referralCode: {
        type: String,
        unique: true,
        sparse: true
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    totalReferrals: {
        type: Number,
        default: 0
    },
    referralPoints: {
        type: Number,
        default: 0
    },
    subscribedChannels: {
        type: [{
            channelId: String,
            channelUsername: String,
            channelTitle: String,
            subscribedAt: {
                type: Date,
                default: Date.now
            },
            pointsEarned: {
                type: Number,
                default: 0
            },
            isActive: {
                type: Boolean,
                default: true
            }
        }],
        default: []
    },
    subscriptionPoints: {
        type: Number,
        default: 0
    },
    lastSubscriptionCheck: {
        type: Date
    },
    rankHistory: {
        type: [{
            date: {
                type: Date,
                default: Date.now
            },
            rank: Number,
            points: Number,
            weeklyRank: Number,
            monthlyRank: Number
        }],
        default: []
    },
    achievements: {
        type: [{
            achievementId: String,
            name: String,
            description: String,
            earnedAt: {
                type: Date,
                default: Date.now
            },
            points: Number,
            icon: String
        }],
        default: []
    },
    preferences: {
        notifications: {
            type: Boolean,
            default: true
        },
        darkMode: {
            type: Boolean,
            default: false
        },
        language: {
            type: String,
            default: 'uzbek',
            enum: ['english', 'russian', 'uzbek']
        },
        soundEnabled: {
            type: Boolean,
            default: true
        },
        vibrationEnabled: {
            type: Boolean,
            default: true
        },
        showLeaderboard: {
            type: Boolean,
            default: true
        },
        emailNotifications: {
            type: Boolean,
            default: false
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    onboardingCompleted: {
        type: Boolean,
        default: false
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        sparse: true
    },
    avatar: {
        type: String,
        default: 'default'
    },
    ipAddress: {
        type: String,
        trim: true,
        default: ''
    },
    ipHistory: {
        type: [{
            ip: {
                type: String,
                trim: true
            },
            timestamp: {
                type: Date,
                default: Date.now
            }
        }],
        default: []
    }
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            ret.id = ret._id;
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    }
});

// Virtual maydonlar
userSchema.virtual('fullName').get(function () {
    return this.lastName ? `${this.firstName} ${this.lastName}` : this.firstName;
});

userSchema.virtual('age').get(function () {
    if (!this.birthDate) return null;
    const today = new Date();
    const birthDate = new Date(this.birthDate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
});

userSchema.virtual('totalAchievementPoints').get(function () {
    // achievements undefined bo'lsa, bo'sh array sifatida qaytaradi
    return (this.achievements || []).reduce((total, achievement) => total + (achievement.points || 0), 0);
});

userSchema.virtual('activeSubscriptions').get(function () {
    // subscribedChannels undefined bo'lsa, bo'sh array sifatida qaytaradi
    return (this.subscribedChannels || []).filter(sub => sub.isActive).length;
});

// Metodlar
userSchema.methods.calculateAccuracy = function () {
    if (this.totalQuestions === 0) return 0;
    const accuracy = (this.correctAnswers / this.totalQuestions) * 100;
    return Math.round(accuracy * 100) / 100; // 2 kasr aniqligi
};

userSchema.methods.updateLevel = function () {
    const basePoints = 1000;
    const growthFactor = 1.5;

    let level = 1;
    let requiredPoints = basePoints;
    let exp = this.totalPoints;

    while (exp >= requiredPoints && level < 100) {
        exp -= requiredPoints;
        level++;
        requiredPoints = Math.floor(basePoints * Math.pow(growthFactor, level - 1));
    }

    this.level = level;
    this.experience = exp;
    return { level, experience: exp, nextLevelPoints: requiredPoints };
};

userSchema.methods.updateRank = async function () {
    const User = this.constructor;
    const usersAbove = await User.countDocuments({
        totalPoints: { $gt: this.totalPoints },
        isActive: true
    });

    const oldRank = this.rank;
    this.rank = usersAbove + 1;

    if (oldRank !== this.rank) {
        this.rankHistory = this.rankHistory || [];
        this.rankHistory.push({
            date: new Date(),
            rank: this.rank,
            points: this.totalPoints
        });

        if (this.rankHistory.length > 30) {
            this.rankHistory = this.rankHistory.slice(-30);
        }
    }

    return this.rank;
};

userSchema.methods.addPoints = function (points, type = 'quiz') {
    this.totalPoints += points;
    this.monthlyPoints += points;
    this.dailyPoints += points;
    this.weeklyPoints += points;

    if (type === 'referral') {
        this.referralPoints += points;
    } else if (type === 'subscription') {
        this.subscriptionPoints += points;
    }

    this.updateLevel();
    return this.totalPoints;
};

userSchema.methods.updateStreak = function () {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (this.lastActive && this.lastActive.toDateString() === yesterday.toDateString()) {
        this.currentStreak += 1;
        if (this.currentStreak > this.longestStreak) {
            this.longestStreak = this.currentStreak;
        }
    } else if (this.lastActive && this.lastActive.toDateString() !== today.toDateString()) {
        this.currentStreak = 1;
    }

    this.lastActive = today;
    return this.currentStreak;
};

userSchema.methods.generateReferralCode = function () {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.referralCode = `REF${code}`;
    return this.referralCode;
};

userSchema.methods.addChannelSubscription = function (channelId, channelUsername, channelTitle, points) {
    this.subscribedChannels = this.subscribedChannels || [];
    const existingSubscription = this.subscribedChannels.find(
        sub => sub.channelId === channelId
    );

    if (!existingSubscription) {
        this.subscribedChannels.push({
            channelId,
            channelUsername,
            channelTitle,
            pointsEarned: points,
            subscribedAt: new Date(),
            isActive: true
        });

        this.addPoints(points, 'subscription');
        return true;
    }

    return false;
};

userSchema.statics.updateAllRanks = async function () {
    const users = await this.find({ isActive: true })
        .sort({ totalPoints: -1, accuracy: -1, quizzesCompleted: -1 })
        .select('_id totalPoints accuracy quizzesCompleted');

    const bulkOps = users.map((user, index) => ({
        updateOne: {
            filter: { _id: user._id },
            update: {
                $set: { rank: index + 1 },
                $push: {
                    rankHistory: {
                        $each: [{
                            date: new Date(),
                            rank: index + 1,
                            points: user.totalPoints
                        }],
                        $slice: -30
                    }
                }
            }
        }
    }));

    if (bulkOps.length > 0) {
        await this.bulkWrite(bulkOps);
    }

    return users.length;
};

userSchema.statics.resetDailyPoints = async function () {
    return await this.updateMany(
        { isActive: true },
        { $set: { dailyPoints: 0 } }
    );
};

userSchema.statics.resetWeeklyPoints = async function () {
    return await this.updateMany(
        { isActive: true },
        { $set: { weeklyPoints: 0 } }
    );
};

userSchema.statics.resetMonthlyPoints = async function () {
    return await this.updateMany(
        { isActive: true },
        { $set: { monthlyPoints: 0 } }
    );
};

// Pre-save hook
userSchema.pre('save', function (next) {
    if (this.isModified('correctAnswers') || this.isModified('totalQuestions')) {
        this.accuracy = this.calculateAccuracy();
    }

    if (this.isModified('totalPoints')) {
        this.updateLevel();
    }

    // achievements va subscribedChannels ni default [] sifatida ta'minlash
    this.achievements = this.achievements || [];
    this.subscribedChannels = this.subscribedChannels || [];
    this.rankHistory = this.rankHistory || [];
    this.interests = this.interests || [];
    this.ipHistory = this.ipHistory || [];

    next();
});

// Indekslar
userSchema.index({ totalPoints: -1 });
userSchema.index({ rank: 1 });
userSchema.index({ referralCode: 1 });
userSchema.index({ 'subscribedChannels.channelId': 1 });
userSchema.index({ lastActive: -1 });

module.exports = mongoose.model('User', userSchema);