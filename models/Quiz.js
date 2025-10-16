// models/Quiz.js
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true,
        trim: true
    },
    options: {
        type: [{
            text: {
                type: String,
                required: true
            },
            isCorrect: {
                type: Boolean,
                default: false
            }
        }],
        default: []
    },
    explanation: {
        type: String,
        trim: true
    },
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium'
    },
    category: {
        type: String
    },
    timeLimit: {
        type: Number,
        default: 30
    },
    points: {
        type: Number,
        default: 10
    }
});

const quizSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    questions: {
        type: [questionSchema],
        default: []
    },
    category: {
        type: String,
        required: true
    },
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium'
    },
    totalQuestions: {
        type: Number,
        default: 0
    },
    timeLimit: {
        type: Number,
        default: 300
    },
    totalPoints: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isDaily: {
        type: Boolean,
        default: false
    },
    competitionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Competition'
    },
    isCompetitionQuiz: {
        type: Boolean,
        default: false
    },
    attempts: {
        type: Number,
        default: 0
    },
    averageScore: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    tags: {
        type: [String],
        default: []
    }
}, {
    timestamps: true
});

// Pre-save hook
quizSchema.pre('save', function (next) {
    // To'g'rilangan: questions ni tekshirish va default array qilish
    this.questions = this.questions || [];

    this.totalQuestions = this.questions.length || 0;
    this.totalPoints = this.questions.reduce((sum, question) => sum + (question.points || 10), 0) || 0;

    if (this.competitionId) {
        this.isCompetitionQuiz = true;
    }

    next();
});

module.exports = mongoose.model('Quiz', quizSchema);