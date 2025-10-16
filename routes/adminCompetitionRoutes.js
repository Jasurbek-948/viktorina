const express = require('express');
const router = express.Router();
const Competition = require('../models/Competition');
const Quiz = require('../models/Quiz');
const adminAuth = require('../middleware/adminAuth');

// ✅ Yangi competition yaratish
router.post('/competitions', adminAuth, async (req, res) => {
    try {
        const {
            name,
            description,
            startDate,
            endDate,
            maxParticipants,
            entryFee,
            prizePool,
            categories,
            difficulty,
            rules
        } = req.body;

        // Sana tekshirish
        if (new Date(startDate) >= new Date(endDate)) {
            return res.status(400).json({
                success: false,
                message: 'Boshlanish sanasi tugash sanasidan oldin bo\'lishi kerak'
            });
        }

        const competition = new Competition({
            name,
            description,
            startDate,
            endDate,
            maxParticipants,
            entryFee,
            prizePool,
            categories,
            difficulty,
            rules,
            createdBy: req.admin._id
        });

        await competition.save();

        res.status(201).json({
            success: true,
            message: 'Competition muvaffaqiyatli yaratildi',
            competition
        });

    } catch (error) {
        console.error('Competition yaratish xatosi:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ✅ Barcha competitions ni olish (admin uchun)
router.get('/competitions', adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;

        const query = {};
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const competitions = await Competition.find(query)
            .populate('createdBy', 'username')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Competition.countDocuments(query);

        res.json({
            success: true,
            competitions,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });

    } catch (error) {
        console.error('Competitions olish xatosi:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ✅ Competition ma'lumotlarini olish
router.get('/competitions/:id', adminAuth, async (req, res) => {
    try {
        const competition = await Competition.findById(req.params.id)
            .populate('quizzes.quizId')
            .populate('createdBy', 'username');

        if (!competition) {
            return res.status(404).json({
                success: false,
                message: 'Competition topilmadi'
            });
        }

        res.json({
            success: true,
            competition
        });

    } catch (error) {
        console.error('Competition olish xatosi:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ✅ Competitionni yangilash
router.put('/competitions/:id', adminAuth, async (req, res) => {
    try {
        const competition = await Competition.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!competition) {
            return res.status(404).json({
                success: false,
                message: 'Competition topilmadi'
            });
        }

        res.json({
            success: true,
            message: 'Competition yangilandi',
            competition
        });

    } catch (error) {
        console.error('Competition yangilash xatosi:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ✅ Competitionni o'chirish
router.delete('/competitions/:id', adminAuth, async (req, res) => {
    try {
        const competition = await Competition.findByIdAndDelete(req.params.id);

        if (!competition) {
            return res.status(404).json({
                success: false,
                message: 'Competition topilmadi'
            });
        }

        // Competitionga bog'langan quizlarni o'chirish
        await Quiz.deleteMany({ competitionId: req.params.id });

        res.json({
            success: true,
            message: 'Competition va unga bog\'langan quizlar o\'chirildi'
        });

    } catch (error) {
        console.error('Competition o\'chirish xatosi:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ✅ Competitionga quiz qo'shish
router.post('/competitions/:id/quizzes', adminAuth, async (req, res) => {
    try {
        const { quizId, title, description, order } = req.body;

        const competition = await Competition.findById(req.params.id);
        if (!competition) {
            return res.status(404).json({
                success: false,
                message: 'Competition topilmadi'
            });
        }

        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz topilmadi'
            });
        }

        // Quizni competitionga bog'lash
        quiz.competitionId = competition._id;
        quiz.isCompetitionQuiz = true;
        await quiz.save();

        // Competitionga quiz qo'shish
        await competition.addQuiz(quizId, title || quiz.title, description || quiz.description, order);

        const updatedCompetition = await Competition.findById(req.params.id).populate('quizzes.quizId');

        res.json({
            success: true,
            message: 'Quiz competitionga muvaffaqiyatli qo\'shildi',
            competition: updatedCompetition
        });

    } catch (error) {
        console.error('Quiz qo\'shish xatosi:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ✅ Competitiondan quiz olib tashlash
router.delete('/competitions/:id/quizzes/:quizId', adminAuth, async (req, res) => {
    try {
        const competition = await Competition.findById(req.params.id);
        if (!competition) {
            return res.status(404).json({
                success: false,
                message: 'Competition topilmadi'
            });
        }

        // Quizni competition ro'yxatidan olib tashlash
        competition.quizzes = competition.quizzes.filter(q => q.quizId.toString() !== req.params.quizId);
        await competition.save();

        // Quizdan competitionId ni olib tashlash
        await Quiz.findByIdAndUpdate(req.params.quizId, {
            competitionId: null,
            isCompetitionQuiz: false
        });

        res.json({
            success: true,
            message: 'Quiz competitiondan olib tashlandi'
        });

    } catch (error) {
        console.error('Quiz olib tashlash xatosi:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ✅ Competitionni nashr qilish/o'chirish
router.patch('/competitions/:id/publish', adminAuth, async (req, res) => {
    try {
        const { isPublished } = req.body;

        const competition = await Competition.findByIdAndUpdate(
            req.params.id,
            { isPublished },
            { new: true }
        );

        if (!competition) {
            return res.status(404).json({
                success: false,
                message: 'Competition topilmadi'
            });
        }

        res.json({
            success: true,
            message: isPublished ? 'Competition nashr qilindi' : 'Competition nashrdan olindi',
            competition
        });

    } catch (error) {
        console.error('Competition nashr qilish xatosi:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;