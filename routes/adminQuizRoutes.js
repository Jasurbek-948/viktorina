const express = require('express');
const router = express.Router();
const Quiz = require('../models/Quiz');
const adminAuth = require('../middleware/adminAuth');

// ✅ Yangi quiz yaratish
router.post('/quizzes', adminAuth, async (req, res) => {
    try {
        const {
            title,
            description,
            questions,
            category,
            difficulty,
            timeLimit,
            tags,
            competitionId
        } = req.body;

        const quiz = new Quiz({
            title,
            description,
            questions,
            category,
            difficulty,
            timeLimit,
            tags,
            competitionId,
            createdBy: req.admin._id
        });

        await quiz.save();

        res.status(201).json({
            success: true,
            message: 'Quiz muvaffaqiyatli yaratildi',
            quiz
        });

    } catch (error) {
        console.error('Quiz yaratish xatosi:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ✅ Barcha quizlarni olish (admin uchun)
router.get('/quizzes', adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', category, competitionId } = req.query;

        const query = { createdBy: req.admin._id };

        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }

        if (category && category !== 'all') {
            query.category = category;
        }

        if (competitionId) {
            query.competitionId = competitionId;
        }

        const quizzes = await Quiz.find(query)
            .populate('competitionId', 'name')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Quiz.countDocuments(query);

        res.json({
            success: true,
            quizzes,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });

    } catch (error) {
        console.error('Quizzes olish xatosi:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ✅ Competition uchun bog'lanmagan quizlarni olish
router.get('/quizzes/unassigned', adminAuth, async (req, res) => {
    try {
        const quizzes = await Quiz.find({
            createdBy: req.admin._id,
            competitionId: null,
            isActive: true
        })
            .select('title description category difficulty totalQuestions')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            quizzes
        });

    } catch (error) {
        console.error('Bog\'lanmagan quizlarni olish xatosi:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;