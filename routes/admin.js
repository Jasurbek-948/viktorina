// routes/admin.js
const express = require('express');
const router = express.Router();
const Quiz = require('../models/Quiz');
const Competition = require('../models/Competition');
const User = require('../models/User');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Admin dashboard stats
router.get('/dashboard', adminAuth, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        const totalQuizzes = await Quiz.countDocuments();
        const activeCompetitions = await Competition.countDocuments({ isActive: true });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const newUsersToday = await User.countDocuments({
            createdAt: { $gte: today }
        });

        const quizAttemptsToday = await QuizAttempt.countDocuments({
            createdAt: { $gte: today }
        });

        res.json({
            totalUsers,
            activeUsers,
            totalQuizzes,
            activeCompetitions,
            newUsersToday,
            quizAttemptsToday
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new quiz
router.post('/quizzes', adminAuth, async (req, res) => {
    try {
        const {
            title,
            description,
            questions,
            category,
            difficulty,
            timeLimit,
            isDaily,
            isCompetition,
            competitionId
        } = req.body;

        const quiz = new Quiz({
            title,
            description,
            questions,
            category,
            difficulty,
            timeLimit,
            isDaily,
            isCompetition,
            competitionId,
            createdBy: req.user.id
        });

        await quiz.save();
        res.status(201).json(quiz);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update quiz
router.put('/quizzes/:id', adminAuth, async (req, res) => {
    try {
        const quiz = await Quiz.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        res.json(quiz);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Create competition
router.post('/competitions', adminAuth, async (req, res) => {
    try {
        const competition = new Competition(req.body);
        await competition.save();

        res.status(201).json(competition);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Toggle competition status
router.patch('/competitions/:id/toggle', adminAuth, async (req, res) => {
    try {
        const competition = await Competition.findById(req.params.id);

        if (!competition) {
            return res.status(404).json({ error: 'Competition not found' });
        }

        competition.isActive = !competition.isActive;
        await competition.save();

        res.json({
            message: `Competition ${competition.isActive ? 'activated' : 'deactivated'}`,
            competition
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Add daily quiz to competition
router.post('/competitions/:id/daily-quiz', adminAuth, async (req, res) => {
    try {
        const { quizId, date } = req.body;

        const competition = await Competition.findById(req.params.id);
        if (!competition) {
            return res.status(404).json({ error: 'Competition not found' });
        }

        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        competition.dailyQuizzes.push({
            date: date || new Date(),
            quizId: quiz._id
        });

        await competition.save();
        res.json(competition);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all users with pagination
router.get('/users', adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const users = await User.find()
            .sort({ totalPoints: -1 })
            .skip(skip)
            .limit(limit)
            .select('-__v');

        const total = await User.countDocuments();

        res.json({
            users,
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

module.exports = router;