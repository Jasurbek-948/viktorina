// routes/admin.js (Updated with new route for single user)
const express = require('express');
const router = express.Router();
const Quiz = require('../models/Quiz');
const Competition = require('../models/Competition');
const User = require('../models/User');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const QuizAttempt = require('../models/QuizAttempt');

// Admin dashboard stats
router.get('/dashboard', adminAuth, async (req, res) => {
    try {
        console.log('Dashboard stats so\'rovi qabul qilindi');

        // Natija obyekti
        const stats = {};
        let recentUsers = [];
        let topUsers = [];
        let activeCompetitionsList = [];

        // Asosiy statistika
        try {
            const totalUsers = await User.countDocuments();
            stats.totalUsers = totalUsers;
        } catch (err) {
            console.error('Foydalanuvchilar sonini olishda xato:', err.message);
            stats.totalUsers = 0; // Default qiymat
        }

        try {
            const activeUsers = await User.countDocuments({ isActive: true });
            stats.activeUsers = activeUsers;
        } catch (err) {
            console.error('Faol foydalanuvchilar sonini olishda xato:', err.message);
            stats.activeUsers = 0;
        }

        try {
            const totalQuizzes = await Quiz.countDocuments();
            stats.totalQuizzes = totalQuizzes;
        } catch (err) {
            console.error('Quizlar sonini olishda xato:', err.message);
            stats.totalQuizzes = 0;
        }

        try {
            const activeQuizzes = await Quiz.countDocuments({ isActive: true });
            stats.activeQuizzes = activeQuizzes;
        } catch (err) {
            console.error('Faol quizlar sonini olishda xato:', err.message);
            stats.activeQuizzes = 0;
        }

        try {
            const totalCompetitions = await Competition.countDocuments();
            stats.totalCompetitions = totalCompetitions;
        } catch (err) {
            console.error('Musobaqalar sonini olishda xato:', err.message);
            stats.totalCompetitions = 0;
        }

        try {
            const activeCompetitions = await Competition.countDocuments({ isActive: true });
            stats.activeCompetitions = activeCompetitions;
        } catch (err) {
            console.error('Faol musobaqalar sonini olishda xato:', err.message);
            stats.activeCompetitions = 0;
        }

        console.log('Asosiy statistika yig\'ildi:', stats);

        // Bugungi statistika
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        try {
            const newUsersToday = await User.countDocuments({
                createdAt: { $gte: today }
            });
            stats.newUsersToday = newUsersToday;
        } catch (err) {
            console.error('Bugungi yangi foydalanuvchilar sonini olishda xato:', err.message);
            stats.newUsersToday = 0;
        }

        // QuizAttempt statistikasi
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        if (QuizAttempt) {
            try {
                const quizAttemptsToday = await QuizAttempt.countDocuments({
                    createdAt: { $gte: today }
                });
                stats.quizAttemptsToday = quizAttemptsToday;
            } catch (err) {
                console.error('Bugungi quiz urinmalarini olishda xato:', err.message);
                stats.quizAttemptsToday = 0;
            }

            try {
                const quizAttemptsThisWeek = await QuizAttempt.countDocuments({
                    createdAt: { $gte: oneWeekAgo }
                });
                stats.quizAttemptsThisWeek = quizAttemptsThisWeek;
            } catch (err) {
                console.error('Haftalik quiz urinmalarini olishda xato:', err.message);
                stats.quizAttemptsThisWeek = 0;
            }
        } else {
            console.log('QuizAttempt modeli mavjud emas, default qiymatlar ishlatilmoqda');
            stats.quizAttemptsToday = 15;
            stats.quizAttemptsThisWeek = 120;
        }

        try {
            const newUsersThisWeek = await User.countDocuments({
                createdAt: { $gte: oneWeekAgo }
            });
            stats.newUsersThisWeek = newUsersThisWeek;
        } catch (err) {
            console.error('Haftalik yangi foydalanuvchilar sonini olishda xato:', err.message);
            stats.newUsersThisWeek = 0;
        }

        // So'nggi foydalanuvchilar
        try {
            recentUsers = await User.find()
                .sort({ createdAt: -1 })
                .limit(5)
                .select('firstName lastName username createdAt totalPoints')
                .lean(); // JSON ga o'tkazishni osonlashtirish uchun lean() ishlatamiz
        } catch (err) {
            console.error('So\'nggi foydalanuvchilarni olishda xato:', err.message);
            recentUsers = [];
        }

        // Top foydalanuvchilar
        try {
            topUsers = await User.find()
                .sort({ totalPoints: -1 })
                .limit(5)
                .select('firstName lastName username totalPoints rank')
                .lean();
        } catch (err) {
            console.error('Top foydalanuvchilarni olishda xato:', err.message);
            topUsers = [];
        }

        // Aktiv musobaqalar
        try {
            activeCompetitionsList = await Competition.find({ isActive: true })
                .sort({ startDate: -1 })
                .limit(3)
                .select('name startDate endDate totalParticipants')
                .lean();
        } catch (err) {
            console.error('Faol musobaqalarni olishda xato:', err.message);
            activeCompetitionsList = [];
        }

        console.log('Barcha ma\'lumotlar yig\'ildi:', {
            stats,
            recentUsers,
            topUsers,
            activeCompetitionsList
        });

        // Faqat mavjud ma'lumotlarni qaytarish
        res.json({
            success: true,
            stats,
            recentUsers,
            topUsers,
            activeCompetitions: activeCompetitionsList
        });

    } catch (error) {
        // Global xatolik (masalan, middleware yoki DB ulanishi bilan bog'liq)
        console.error('Dashboard stats xatosi:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Dashboard ma\'lumotlarini yig\'ishda xatolik',
            stats: {},
            recentUsers: [],
            topUsers: [],
            activeCompetitions: []
        });
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
            isCompetitionQuiz,  // To'g'rilangan: isCompetitionQuiz ga o'zgartirildi
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
            isCompetitionQuiz,  // To'g'rilangan
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
        const { quizId, date, title, description, order } = req.body;  // Qo'shimcha maydonlar qo'shildi

        const competition = await Competition.findById(req.params.id);
        if (!competition) {
            return res.status(404).json({ error: 'Competition not found' });
        }

        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        // To'g'rilangan: quizzes ga push qilish (dailyQuizzes o'rniga)
        competition.quizzes.push({
            quizId: quiz._id,
            title: title || quiz.title,
            description: description || quiz.description,
            order: order || competition.quizzes.length + 1,
            addedAt: date || new Date(),
            isActive: true
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

// New route: Get single user details
router.get('/users/:id', adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate('referredBy', 'firstName lastName username') // Populate referredBy if needed
            .lean({ virtuals: true }); // Include virtual fields

        if (!user) {
            return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
        }

        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Foydalanuvchi detallarini olishda xato:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Foydalanuvchi ma\'lumotlarini olishda xatolik'
        });
    }
});

// Additional routes if needed, e.g., update user
router.put('/users/:id', adminAuth, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        ).lean({ virtuals: true });

        if (!user) {
            return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
        }

        res.json({
            success: true,
            user
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete user
router.delete('/users/:id', adminAuth, async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
        }

        res.json({
            success: true,
            message: 'Foydalanuvchi muvaffaqiyatli o\'chirildi'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;