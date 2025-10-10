// models/QuizAttempt.js
const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    quizId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz',
        required: true
    },
    competitionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Competition'
    },
    answers: [{
        questionIndex: Number,
        selectedOption: Number,
        isCorrect: Boolean,
        timeSpent: Number, // seconds
        pointsEarned: Number
    }],
    totalCorrect: {
        type: Number,
        default: 0
    },
    totalPoints: {
        type: Number,
        default: 0
    },
    totalTime: {
        type: Number, // seconds
        default: 0
    },
    accuracy: {
        type: Number,
        default: 0
    },
    completed: {
        type: Boolean,
        default: false
    },
    startedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    }
}, {
    timestamps: true
});

// Attemptni yakunlash
attemptSchema.methods.completeAttempt = function () {
    this.completed = true;
    this.completedAt = new Date();
    this.totalTime = Math.floor((this.completedAt - this.startedAt) / 1000);

    const correctAnswers = this.answers.filter(answer => answer.isCorrect);
    this.totalCorrect = correctAnswers.length;
    this.totalPoints = correctAnswers.reduce((sum, answer) => sum + answer.pointsEarned, 0);
    this.accuracy = this.answers.length > 0 ? (this.totalCorrect / this.answers.length) * 100 : 0;
};

module.exports = mongoose.model('QuizAttempt', attemptSchema);