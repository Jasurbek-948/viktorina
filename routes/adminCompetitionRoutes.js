const express = require('express');
const router = express.Router();
const Competition = require('../models/Competition');
const authMiddleware = require('../middleware/authMiddleware');
const { check, validationResult } = require('express-validator');

// Middleware to check if user is admin
const isAdmin = authMiddleware.isAdmin;

// Validation rules for competition
const competitionValidation = [
    check('name')
        .trim()
        .notEmpty().withMessage('Competition nomi majburiy')
        .isLength({ max: 100 }).withMessage('Competition nomi 100 ta belgidan oshmasligi kerak'),
    check('startDate')
        .notEmpty().withMessage('Boshlanish sanasi majburiy')
        .isISO8601().toDate().withMessage('Yaroqli sana formati kiritilishi kerak'),
    check('endDate')
        .notEmpty().withMessage('Tugash sanasi majburiy')
        .isISO8601().toDate().withMessage('Yaroqli sana formati kiritilishi kerak'),
    check('prizePool')
        .optional()
        .isFloat({ min: 0 }).withMessage('Mukofot jamg\'armasi manfiy bo\'lmasligi kerak')
];

// Create new competition
router.post('/', isAdmin, competitionValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { name, description, startDate, endDate, prizePool, isPublished } = req.body;

        const competition = new Competition({
            name,
            description,
            startDate,
            endDate,
            prizePool,
            isPublished: isPublished || false,
            createdBy: req.user.id
        });

        await competition.save();

        res.status(201).json({
            success: true,
            message: 'Musobaqa muvaffaqiyatli yaratildi',
            competition
        });
    } catch (error) {
        console.error('Competition creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Server xatosi'
        });
    }
});

// Get all competitions
router.get('/', isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;

        const query = {};
        const now = new Date();

        if (status === 'upcoming') {
            query.startDate = { $gt: now };
        } else if (status === 'active') {
            query.startDate = { $lte: now };
            query.endDate = { $gte: now };
        } else if (status === 'ended') {
            query.endDate = { $lt: now };
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { createdAt: -1 },
            populate: { path: 'createdBy', select: 'username' }
        };

        const competitions = await Competition.paginate(query, options);

        res.json({
            success: true,
            competitions: competitions.docs,
            totalPages: competitions.totalPages,
            currentPage: competitions.page,
            totalItems: competitions.totalDocs
        });
    } catch (error) {
        console.error('Get competitions error:', error);
        res.status(500).json({
            success: false,
            message: 'Server xatosi'
        });
    }
});

// Get single competition
router.get('/:id', isAdmin, async (req, res) => {
    try {
        const competition = await Competition.findById(req.params.id)
            .populate('createdBy', 'username')
            .populate('quizzes.quizId');

        if (!competition) {
            return res.status(404).json({
                success: false,
                message: 'Musobaqa topilmadi'
            });
        }

        res.json({
            success: true,
            competition
        });
    } catch (error) {
        console.error('Get competition error:', error);
        res.status(500).json({
            success: false,
            message: 'Server xatosi'
        });
    }
});

// Update competition
router.put('/:id', isAdmin, competitionValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { name, description, startDate, endDate, prizePool, isPublished } = req.body;

        const competition = await Competition.findById(req.params.id);
        if (!competition) {
            return res.status(404).json({
                success: false,
                message: 'Musobaqa topilmadi'
            });
        }

        competition.name = name;
        competition.description = description;
        competition.startDate = startDate;
        competition.endDate = endDate;
        competition.prizePool = prizePool;
        competition.isPublished = isPublished;

        await competition.save();

        res.json({
            success: true,
            message: 'Musobaqa muvaffaqiyatli yangilandi',
            competition
        });
    } catch (error) {
        console.error('Update competition error:', error);
        res.status(500).json({
            success: false,
            message: 'Server xatosi'
        });
    }
});

// Delete competition
router.delete('/:id', isAdmin, async (req, res) => {
    try {
        const competition = await Competition.findById(req.params.id);
        if (!competition) {
            return res.status(404).json({
                success: false,
                message: 'Musobaqa topilmadi'
            });
        }

        await competition.remove();

        res.json({
            success: true,
            message: 'Musobaqa muvaffaqiyatli o\'chirildi'
        });
    } catch (error) {
        console.error('Delete competition error:', error);
        res.status(500).json({
            success: false,
            message: 'Server xatosi'
        });
    }
});

// Add quiz to competition
router.post('/:id/quizzes', isAdmin, [
    check('quizId')
        .notEmpty().withMessage('Quiz ID majburiy')
        .isMongoId().withMessage('Yaroqli Quiz ID kiritilishi kerak'),
    check('title')
        .trim()
        .notEmpty().withMessage('Quiz nomi majburiy'),
    check('order')
        .optional()
        .isInt({ min: 1 }).withMessage('Tartib raqami 1 dan kichik bo\'lmasligi kerak')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { quizId, title, order } = req.body;
        const competition = await Competition.findById(req.params.id);

        if (!competition) {
            return res.status(404).json({
                success: false,
                message: 'Musobaqa topilmadi'
            });
        }

        // Check if quiz already exists in competition
        const quizExists = competition.quizzes.some(q => q.quizId.toString() === quizId);
        if (quizExists) {
            return res.status(400).json({
                success: false,
                message: 'Bu quiz allaqachon musobaqada mavjud'
            });
        }

        competition.quizzes.push({
            quizId,
            title,
            order: order || competition.quizzes.length + 1
        });

        await competition.save();

        res.json({
            success: true,
            message: 'Quiz musobaqaga muvaffaqiyatli qo\'shildi',
            competition
        });
    } catch (error) {
        console.error('Add quiz to competition error:', error);
        res.status(500).json({
            success: false,
            message: 'Server xatosi'
        });
    }
});

// Remove quiz from competition
router.delete('/:id/quizzes/:quizId', isAdmin, async (req, res) => {
    try {
        const competition = await Competition.findById(req.params.id);
        if (!competition) {
            return res.status(404).json({
                success: false,
                message: 'Musobaqa topilmadi'
            });
        }

        const quizIndex = competition.quizzes.findIndex(q => q.quizId.toString() === req.params.quizId);
        if (quizIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Quiz musobaqada topilmadi'
            });
        }

        competition.quizzes.splice(quizIndex, 1);
        await competition.save();

        res.json({
            success: true,
            message: 'Quiz musobaqadan muvaffaqiyatli o\'chirildi',
            competition
        });
    } catch (error) {
        console.error('Remove quiz from competition error:', error);
        res.status(500).json({
            success: false,
            message: 'Server xatosi'
        });
    }
});

module.exports = router;