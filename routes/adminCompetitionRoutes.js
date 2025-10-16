const express = require('express');
const router = express.Router();
const Competition = require('../models/Competition');
const Quiz = require('../models/Quiz');
const adminAuth = require('../middleware/adminAuth');

// ✅ Soddalashtirilgan validation middleware
const validateCompetition = (req, res, next) => {
    console.log('🔍 Validatsiya boshlandi. Body:', req.body);

    const { name, startDate, endDate, prizePool } = req.body;

    // Majburiy maydonlarni tekshirish
    if (!name || !startDate || !endDate) {
        console.log('❌ Validatsiya xatosi: Majburiy maydonlar yo\'q');
        return res.status(400).json({
            success: false,
            message: 'Musobaqa nomi, boshlanish va tugash sanalari majburiy'
        });
    }

    // Sana tekshirish
    if (new Date(startDate) >= new Date(endDate)) {
        console.log('❌ Validatsiya xatosi: Sanalar noto\'g\'ri');
        return res.status(400).json({
            success: false,
            message: 'Boshlanish sanasi tugash sanasidan oldin bo\'lishi kerak'
        });
    }

    // Prize pool tekshirish
    if (prizePool && (isNaN(prizePool) || prizePool < 0)) {
        console.log('❌ Validatsiya xatosi: Prize pool noto\'g\'ri');
        return res.status(400).json({
            success: false,
            message: 'Yutuq jamg\'armasi manfiy bo\'lmasligi kerak'
        });
    }

    console.log('✅ Validatsiya muvaffaqiyatli');
    next();
};

// ✅ Yangi competition yaratish (Debug qo'shilgan)
router.post('/', adminAuth, validateCompetition, async (req, res) => {
    try {
        console.log('🚀 POST /api/admin/competitions - Yangi musobaqa yaratish');
        console.log('📦 Request body:', req.body);
        console.log('👤 Admin ID:', req.admin._id);

        const { name, description, startDate, endDate, prizePool } = req.body;

        // Ma'lumotlarni tozalash va formatlash
        const competitionData = {
            name: name.trim(),
            description: description ? description.trim() : '',
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            prizePool: prizePool ? Number(prizePool) : 0,
            createdBy: req.admin._id
        };

        console.log('🧹 Tozalangan ma\'lumotlar:', competitionData);

        // Yangi competition yaratish
        const competition = new Competition(competitionData);
        console.log('📝 Yangi competition yaratildi:', competition);

        await competition.save();
        console.log('💾 Competition saqlandi');

        res.status(201).json({
            success: true,
            message: 'Musobaqa muvaffaqiyatli yaratildi',
            competition
        });

    } catch (error) {
        console.error('❌ Competition yaratish xatosi:', error);

        // MongoDB validation xatolari uchun batafsil xabar
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validatsiya xatosi: ' + errors.join(', ')
            });
        }

        // Boshqa server xatolari
        res.status(500).json({
            success: false,
            message: 'Server xatosi: ' + error.message
        });
    }
});

// ✅ Barcha competitions ni olish
router.get('/', adminAuth, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            status = ''
        } = req.query;

        const query = {};

        // Search filter
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        // Status filter
        if (status) {
            const now = new Date();
            switch (status) {
                case 'active':
                    query.startDate = { $lte: now };
                    query.endDate = { $gte: now };
                    break;
                case 'upcoming':
                    query.startDate = { $gt: now };
                    break;
                case 'ended':
                    query.endDate = { $lt: now };
                    break;
            }
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { createdAt: -1 },
            populate: [
                { path: 'createdBy', select: 'username' },
                { path: 'quizzes.quizId', select: 'title' }
            ]
        };

        const competitions = await Competition.paginate(query, options);

        res.json({
            success: true,
            competitions: competitions.docs,
            totalPages: competitions.totalPages,
            currentPage: competitions.page,
            total: competitions.totalDocs
        });

    } catch (error) {
        console.error('Competitions olish xatosi:', error);
        res.status(500).json({
            success: false,
            message: 'Server xatosi'
        });
    }
});


// ✅ Competition ma'lumotlarini olish
router.get('/:id', adminAuth, async (req, res) => {
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
            message: 'Server xatosi'
        });
    }
});

// ✅ Competitionni yangilash
router.put('/:id', adminAuth, validateCompetition, async (req, res) => {
    try {
        const { name, description, startDate, endDate, prizePool } = req.body;

        const competition = await Competition.findById(req.params.id);

        if (!competition) {
            return res.status(404).json({
                success: false,
                message: 'Competition topilmadi'
            });
        }

        // Faqat asosiy maydonlarni yangilash
        competition.name = name;
        competition.description = description || '';
        competition.startDate = startDate;
        competition.endDate = endDate;
        competition.prizePool = prizePool || 0;

        await competition.save();

        res.json({
            success: true,
            message: 'Musobaqa yangilandi',
            competition
        });

    } catch (error) {
        console.error('Competition yangilash xatosi:', error);
        res.status(500).json({
            success: false,
            message: 'Server xatosi'
        });
    }
});

// ✅ Competitionni o'chirish
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        const competition = await Competition.findById(req.params.id);

        if (!competition) {
            return res.status(404).json({
                success: false,
                message: 'Competition topilmadi'
            });
        }

        await Competition.findByIdAndDelete(req.params.id);

        // Quizlarni competitiondan ajratish
        await Quiz.updateMany(
            { competitionId: req.params.id },
            { competitionId: null }
        );

        res.json({
            success: true,
            message: 'Musobaqa muvaffaqiyatli o\'chirildi'
        });

    } catch (error) {
        console.error('Competition o\'chirish xatosi:', error);
        res.status(500).json({
            success: false,
            message: 'Server xatosi'
        });
    }
});

// ✅ Competitionga quiz qo'shish
router.post('/:id/quizzes', adminAuth, async (req, res) => {
    try {
        const { quizIds } = req.body;

        if (!quizIds || !Array.isArray(quizIds) || quizIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Quiz ID lar massivi kerak'
            });
        }

        const competition = await Competition.findById(req.params.id);
        if (!competition) {
            return res.status(404).json({
                success: false,
                message: 'Competition topilmadi'
            });
        }

        // Quizlarni tekshirish
        const quizzes = await Quiz.find({ _id: { $in: quizIds } });
        if (quizzes.length !== quizIds.length) {
            return res.status(404).json({
                success: false,
                message: 'Ba\'zi quizlar topilmadi'
            });
        }

        // Yangi quizlarni qo'shish
        const addedQuizzes = [];
        for (const quiz of quizzes) {
            const alreadyAdded = competition.quizzes.some(
                q => q.quizId && q.quizId.toString() === quiz._id.toString()
            );

            if (!alreadyAdded) {
                // Quizni competitionga bog'lash
                quiz.competitionId = competition._id;
                await quiz.save();

                // Competitionga quiz qo'shish
                competition.quizzes.push({
                    quizId: quiz._id,
                    title: quiz.title,
                    order: competition.quizzes.length + 1
                });

                addedQuizzes.push(quiz.title);
            }
        }

        await competition.save();

        res.json({
            success: true,
            message: `${addedQuizzes.length} ta quiz musobaqaga qo'shildi`,
            addedQuizzes
        });

    } catch (error) {
        console.error('Quiz qo\'shish xatosi:', error);
        res.status(500).json({
            success: false,
            message: 'Server xatosi'
        });
    }
});

// ✅ Competitionni nashr qilish/o'chirish
router.patch('/:id/publish', adminAuth, async (req, res) => {
    try {
        const { isPublished } = req.body;

        if (typeof isPublished !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'isPublished boolean qiymat bo\'lishi kerak'
            });
        }

        const competition = await Competition.findById(req.params.id);
        if (!competition) {
            return res.status(404).json({
                success: false,
                message: 'Competition topilmadi'
            });
        }

        competition.isPublished = isPublished;
        await competition.save();

        res.json({
            success: true,
            message: isPublished ? 'Musobaqa nashr qilindi' : 'Musobaqa nashrdan olindi',
            competition
        });

    } catch (error) {
        console.error('Competition nashr qilish xatosi:', error);
        res.status(500).json({
            success: false,
            message: 'Server xatosi'
        });
    }
});

module.exports = router;