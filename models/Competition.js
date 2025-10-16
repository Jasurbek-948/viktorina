// models/Competition.js
const mongoose = require('mongoose');

const competitionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: false
    },
    isPublished: {
        type: Boolean,
        default: false
    },
    totalParticipants: {
        type: Number,
        default: 0
    },
    maxParticipants: {
        type: Number,
        default: 5000
    },
    entryFee: {
        type: Number,
        default: 0
    },
    prizePool: {
        type: Number,
        default: 0
    },
    winners: [{
        rank: Number,
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        prize: Number
    }],
    rules: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },
    categories: [String],
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium'
    },
    quizzes: [{
        quizId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Quiz'
        },
        title: String,
        description: String,
        order: Number, // Quiz tartibi
        isActive: {
            type: Boolean,
            default: true
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    leaderboard: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        points: {
            type: Number,
            default: 0
        },
        rank: Number,
        quizzesCompleted: Number,
        accuracy: Number
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    }
}, {
    timestamps: true
});

// Competition faolligini tekshirish
competitionSchema.methods.checkStatus = function () {
    const now = new Date();
    if (now >= this.startDate && now <= this.endDate) {
        this.isActive = true;
    } else {
        this.isActive = false;
    }
    return this.isActive;
};

// Leaderboardni yangilash
competitionSchema.methods.updateLeaderboard = async function () {
    const User = mongoose.model('User');

    const users = await User.find({ isActive: true })
        .sort({ monthlyPoints: -1, accuracy: -1 })
        .limit(1000);

    this.leaderboard = users.map((user, index) => ({
        userId: user._id,
        points: user.monthlyPoints,
        rank: index + 1,
        quizzesCompleted: user.quizzesCompleted,
        accuracy: user.accuracy
    }));

    await this.save();
};

// Competitionga quiz qo'shish
competitionSchema.methods.addQuiz = async function (quizId, title, description, order) {
    const quizExists = this.quizzes.some(q => q.quizId.toString() === quizId.toString());

    if (quizExists) {
        throw new Error('Bu quiz allaqachon competitionga qo\'shilgan');
    }

    this.quizzes.push({
        quizId,
        title,
        description,
        order: order || this.quizzes.length + 1,
        isActive: true
    });

    await this.save();
    return this;
};

module.exports = mongoose.model('Competition', competitionSchema);