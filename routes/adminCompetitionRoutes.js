const express = require('express');
const router = express.Router();
const Competition = require('../models/Competition');
const Quiz = require('../models/Quiz');
const adminAuth = require('../middleware/adminAuth');

// ✅ Validation middleware
const validateCompetition = (req, res, next) => {
    const {
        name,
        startDate,
        endDate,
        maxParticipants,
        entryFee,
        prizePool
    } = req.body;

    if (!name || !startDate || !endDate) {
        return res.status(400).json({
            success: false,
            message: 'Name, startDate va endDate majburiy maydonlar'
        });
    }

    if (new Date(startDate) >= new Date(endDate)) {
        return res.status(400).json({
            success: false,
            message: 'Boshlanish sanasi tugash sanasidan oldin bo\'lishi kerak'
        });
    }

    if (maxParticipants && maxParticipants < 1) {
        return res.status(400).json({
            success: false,
            message: 'Maksimal ishtirokchilar soni 1 dan katta bo\'lishi kerak'
        });
    }

    if (entryFee && entryFee < 0) {
        return res.status(400).json({
            success: false,
            message: 'Kirish to\'lovi manfiy bo\'lmasligi kerak'
        });
    }

    if (prizePool && prizePool < 0) {
        return res.status(400).json({
            success: false,
            message: 'Mukofot jamg\'armasi manfiy bo\'lmasligi kerak'
        });
    }

    next();
};

// ✅ Yangi competition yaratish
router.post('/', adminAuth, validateCompetition, async (req, res) => {
    try {
        const competitionData = {
            ...req.body,
            createdBy: req.admin._id
        };

        const competition = new Competition(competitionData);
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
            status = '',
            difficulty = '',
            category = ''
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

        // Difficulty filter
        if (difficulty) {
            query.difficulty = difficulty;
        }

        // Category filter
        if (category) {
            query.categories = { $in: [category] };
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { createdAt: -1 },
            populate: [
                { path: 'createdBy', select: 'username' },
                { path: 'quizzes.quizId', select: 'title totalQuestions' }
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
            .populate('createdBy', 'username')
            .populate('winners.userId', 'username email')
            .populate('leaderboard.userId', 'username email');

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
        const competition = await Competition.findById(req.params.id);

        if (!competition) {
            return res.status(404).json({
                success: false,
                message: 'Competition topilmadi'
            });
        }

        // Competition boshlangan bo'lsa, ba'zi maydonlarni yangilashni cheklash
        if (competition.isActive) {
            const allowedUpdates = ['description', 'rules', 'isPublished'];
            const attemptedUpdates = Object.keys(req.body);

            const invalidUpdates = attemptedUpdates.filter(
                field => !allowedUpdates.includes(field)
            );

            if (invalidUpdates.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Active competitionda faqat quyidagi maydonlarni yangilash mumkin: ${allowedUpdates.join(', ')}`
                });
            }
        }

        Object.assign(competition, req.body);
        await competition.save();

        res.json({
            success: true,
            message: 'Competition yangilandi',
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

        // Competition boshlangan bo'lsa, o'chirishni cheklash
        if (competition.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Active competitionni o\'chirib bo\'lmaydi'
            });
        }

        await Competition.findByIdAndDelete(req.params.id);

        // Quizlarni competitiondan ajratish (o'chirmaslik)
        await Quiz.updateMany(
            { competitionId: req.params.id },
            {
                competitionId: null,
                isCompetitionQuiz: false
            }
        );

        res.json({
            success: true,
            message: 'Competition muvaffaqiyatli o\'chirildi'
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
                q => q.quizId.toString() === quiz._id.toString()
            );

            if (!alreadyAdded) {
                // Quizni competitionga bog'lash
                quiz.competitionId = competition._id;
                quiz.isCompetitionQuiz = true;
                await quiz.save();

                // Competitionga quiz qo'shish
                competition.quizzes.push({
                    quizId: quiz._id,
                    title: quiz.title,
                    description: quiz.description,
                    order: competition.quizzes.length + 1
                });

                addedQuizzes.push({
                    id: quiz._id,
                    title: quiz.title
                });
            }
        }

        await competition.save();
        const updatedCompetition = await Competition.findById(req.params.id).populate('quizzes.quizId');

        res.json({
            success: true,
            message: `${addedQuizzes.length} ta quiz competitionga qo'shildi`,
            addedQuizzes,
            competition: updatedCompetition
        });

    } catch (error) {
        console.error('Quiz qo\'shish xatosi:', error);
        res.status(500).json({
            success: false,
            message: 'Server xatosi'
        });
    }
});

// ✅ Competitiondan quiz olib tashlash
router.delete('/:id/quizzes/:quizId', adminAuth, async (req, res) => {
    try {
        const competition = await Competition.findById(req.params.id);
        if (!competition) {
            return res.status(404).json({
                success: false,
                message: 'Competition topilmadi'
            });
        }

        // Quizni competition ro'yxatidan olib tashlash
        const initialLength = competition.quizzes.length;
        competition.quizzes = competition.quizzes.filter(
            q => q.quizId.toString() !== req.params.quizId
        );

        if (competition.quizzes.length === initialLength) {
            return res.status(404).json({
                success: false,
                message: 'Quiz competitionda topilmadi'
            });
        }

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

        // Nashr qilishdan oldin tekshirishlar
        if (isPublished) {
            if (competition.quizzes.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Competitionda hech qanday quiz yo\'q'
                });
            }

            if (new Date() > competition.endDate) {
                return res.status(400).json({
                    success: false,
                    message: 'Muddati o\'tgan competitionni nashr qilib bo\'lmaydi'
                });
            }
        }

        competition.isPublished = isPublished;
        await competition.save();

        res.json({
            success: true,
            message: isPublished ? 'Competition nashr qilindi' : 'Competition nashrdan olindi',
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

// ✅ Competition statistikasini olish
router.get('/:id/stats', adminAuth, async (req, res) => {
    try {
        const competition = await Competition.findById(req.params.id)
            .populate('leaderboard.userId', 'username email')
            .populate('winners.userId', 'username email');

        if (!competition) {
            return res.status(404).json({
                success: false,
                message: 'Competition topilmadi'
            });
        }

        const stats = {
            totalParticipants: competition.totalParticipants,
            maxParticipants: competition.maxParticipants,
            participationRate: ((competition.totalParticipants / competition.maxParticipants) * 100).toFixed(2),
            totalQuizzes: competition.quizzes.length,
            activeQuizzes: competition.quizzes.filter(q => q.isActive).length,
            prizePool: competition.prizePool,
            entryFee: competition.entryFee,
            status: competition.isActive ? 'Active' : competition.isPublished ? 'Published' : 'Draft',
            daysRemaining: Math.max(0, Math.ceil((competition.endDate - new Date()) / (1000 * 60 * 60 * 24)))
        };

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('Statistika olish xatosi:', error);
        res.status(500).json({
            success: false,
            message: 'Server xatosi'
        });
    }
});

module.exports = router;