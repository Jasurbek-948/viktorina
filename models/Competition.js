const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const competitionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Competition nomi majburiy'],
        trim: true,
        maxlength: [100, 'Competition nomi 100 ta belgidan oshmasligi kerak']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'Tavsif 1000 ta belgidan oshmasligi kerak']
    },
    startDate: {
        type: Date,
        required: [true, 'Boshlanish sanasi majburiy']
    },
    endDate: {
        type: Date,
        required: [true, 'Tugash sanasi majburiy']
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
        default: 0,
        min: [0, 'Ishtirokchilar soni manfiy bo\'lmasligi kerak']
    },
    maxParticipants: {
        type: Number,
        default: 5000,
        min: [1, 'Maksimal ishtirokchilar soni 1 dan katta bo\'lishi kerak']
    },
    entryFee: {
        type: Number,
        default: 0,
        min: [0, 'Kirish to\'lovi manfiy bo\'lmasligi kerak']
    },
    prizePool: {
        type: Number,
        default: 0,
        min: [0, 'Mukofot jamg\'armasi manfiy bo\'lmasligi kerak']
    },
    winners: [{
        rank: {
            type: Number,
            required: true,
            min: 1
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        prize: {
            type: Number,
            required: true,
            min: 0
        },
        awardedAt: {
            type: Date,
            default: Date.now
        }
    }],
    rules: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },
    categories: [{
        type: String,
        trim: true
    }],
    difficulty: {
        type: String,
        enum: {
            values: ['easy', 'medium', 'hard'],
            message: 'Qiyinlik darajasi: easy, medium yoki hard bo\'lishi kerak'
        },
        default: 'medium'
    },
    quizzes: [{
        quizId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Quiz',
            required: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        description: String,
        order: {
            type: Number,
            min: 1,
            default: 1
        },
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
            ref: 'User',
            required: true
        },
        points: {
            type: Number,
            default: 0,
            min: 0
        },
        rank: {
            type: Number,
            min: 1
        },
        quizzesCompleted: {
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
        lastActivity: {
            type: Date,
            default: Date.now
        }
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    settings: {
        allowRetakes: {
            type: Boolean,
            default: false
        },
        showLeaderboard: {
            type: Boolean,
            default: true
        },
        requireRegistration: {
            type: Boolean,
            default: true
        },
        maxAttempts: {
            type: Number,
            default: 1,
            min: 1
        }
    }
}, {
    timestamps: true
});

// Pagination plugin
competitionSchema.plugin(mongoosePaginate);

// Indexes for better performance
competitionSchema.index({ startDate: 1, endDate: 1 });
competitionSchema.index({ isPublished: 1, isActive: 1 });
competitionSchema.index({ categories: 1 });
competitionSchema.index({ difficulty: 1 });
competitionSchema.index({ createdBy: 1 });

// Virtual for competition status
competitionSchema.virtual('status').get(function () {
    const now = new Date();
    if (now < this.startDate) return 'upcoming';
    if (now > this.endDate) return 'ended';
    return 'active';
});

// Pre-save middleware for auto-updating isActive
competitionSchema.pre('save', function (next) {
    const now = new Date();
    this.isActive = (now >= this.startDate && now <= this.endDate);
    next();
});

// Competition faolligini tekshirish
competitionSchema.methods.checkStatus = function () {
    const now = new Date();
    this.isActive = (now >= this.startDate && now <= this.endDate);
    return this.isActive;
};

// Leaderboardni yangilash
competitionSchema.methods.updateLeaderboard = async function () {
    const User = mongoose.model('User');

    try {
        const users = await User.find({ isActive: true })
            .sort({ monthlyPoints: -1, accuracy: -1 })
            .limit(1000);

        this.leaderboard = users.map((user, index) => ({
            userId: user._id,
            points: user.monthlyPoints,
            rank: index + 1,
            quizzesCompleted: user.quizzesCompleted,
            accuracy: user.accuracy,
            lastActivity: new Date()
        }));

        await this.save();
        return this.leaderboard;
    } catch (error) {
        console.error('Leaderboard yangilash xatosi:', error);
        throw error;
    }
};

// Competitionga quiz qo'shish
competitionSchema.methods.addQuiz = async function (quizId, title, description, order) {
    const Quiz = mongoose.model('Quiz');

    const quizExists = this.quizzes.some(q => q.quizId.toString() === quizId.toString());

    if (quizExists) {
        throw new Error('Bu quiz allaqachon competitionga qo\'shilgan');
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
        throw new Error('Quiz topilmadi');
    }

    this.quizzes.push({
        quizId,
        title: title || quiz.title,
        description: description || quiz.description,
        order: order || this.quizzes.length + 1,
        isActive: true
    });

    await this.save();
    return this;
};

// Competitiondan quiz olib tashlash
competitionSchema.methods.removeQuiz = async function (quizId) {
    const initialLength = this.quizzes.length;
    this.quizzes = this.quizzes.filter(q => q.quizId.toString() !== quizId.toString());

    if (this.quizzes.length === initialLength) {
        throw new Error('Quiz competitionda topilmadi');
    }

    await this.save();
    return this;
};

// Static method for active competitions
competitionSchema.statics.getActiveCompetitions = function () {
    const now = new Date();
    return this.find({
        startDate: { $lte: now },
        endDate: { $gte: now },
        isPublished: true
    });
};

// Static method for upcoming competitions
competitionSchema.statics.getUpcomingCompetitions = function () {
    const now = new Date();
    return this.find({
        startDate: { $gt: now },
        isPublished: true
    });
};

module.exports = mongoose.model('Competition', competitionSchema);