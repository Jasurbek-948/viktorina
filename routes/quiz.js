// routes/quiz.js
const express = require('express');
const router = express.Router();
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const User = require('../models/User');
const Competition = require('../models/Competition');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');


router.get('/available', auth, async (req, res) => {
    try {
        const { category, difficulty, type, search } = req.query;
        const query = { isActive: true };

        if (category && category !== 'all') query.category = category;
        if (difficulty) query.difficulty = difficulty;
        if (type === 'daily') query.isDaily = true;
        if (type === 'competition') query.isCompetition = true;

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        const activeQuizzesCount = await Quiz.countDocuments({ isActive: true });

        // Asosiy so'rov
        const quizzes = await Quiz.find(query)
            .select('title description category difficulty totalQuestions timeLimit totalPoints attempts averageScore createdAt createdBy tags isDaily isCompetition')
            .populate('createdBy', 'username firstName lastName')
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();


        const formattedQuizzes = quizzes.map(quiz => {
            const totalQuestions = quiz.totalQuestions > 0 ? quiz.totalQuestions : (quiz.questions?.length || 0);
            const totalPoints = quiz.totalPoints > 0 ? quiz.totalPoints : (quiz.questions?.reduce((sum, q) => sum + (q.points || 10), 0) || 0);

            return {
                _id: quiz._id,
                title: quiz.title,
                description: quiz.description,
                category: quiz.category,
                difficulty: quiz.difficulty,
                totalQuestions: totalQuestions,
                timeLimit: quiz.timeLimit,
                totalPoints: totalPoints,
                attempts: quiz.attempts || 0,
                averageScore: quiz.averageScore || 0,
                createdAt: quiz.createdAt,
                createdBy: quiz.createdBy,
                tags: quiz.tags || [],
                isDaily: quiz.isDaily || false,
                isCompetition: quiz.isCompetition || false
            };
        });

        if (formattedQuizzes.length > 0) {
            console.log('📋 First quiz sample:', {
                title: formattedQuizzes[0].title,
                category: formattedQuizzes[0].category,
                totalQuestions: formattedQuizzes[0].totalQuestions,
                totalPoints: formattedQuizzes[0].totalPoints,
                isActive: true
            });
        }

        res.json({
            success: true,
            count: formattedQuizzes.length,
            totalActive: activeQuizzesCount,
            quizzes: formattedQuizzes
        });

    } catch (error) {
        console.error('❌ Error in /available endpoint:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


router.get('/:id', auth, async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        if (!quiz.isActive) {
            return res.status(400).json({ error: 'Quiz is not active' });
        }

        const quizData = {
            _id: quiz._id,
            title: quiz.title,
            description: quiz.description,
            category: quiz.category,
            difficulty: quiz.difficulty,
            timeLimit: quiz.timeLimit,
            totalQuestions: quiz.totalQuestions,
            totalPoints: quiz.totalPoints,
            questions: quiz.questions.map(q => ({
                _id: q._id,
                question: q.question,
                options: q.options.map(opt => ({ text: opt.text })),
                timeLimit: q.timeLimit,
                points: q.points,
                difficulty: q.difficulty
            }))
        };

        res.json(quizData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/:id/start', auth, async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);

        if (!quiz || !quiz.isActive) {
            return res.status(404).json({ error: 'Quiz not available' });
        }


        const existingCompletedAttempt = await QuizAttempt.findOne({
            userId: req.user.id,
            quizId: quiz._id,
            completed: true
        });

        if (existingCompletedAttempt) {
            return res.status(400).json({
                error: 'Siz bu quizni allaqachon yakunlagansiz. Quizni qayta o\'tish mumkin emas.',
                attemptId: existingCompletedAttempt._id,
                completed: true
            });
        }

        if (quiz.isDaily) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const existingDailyAttempt = await QuizAttempt.findOne({
                userId: req.user.id,
                quizId: quiz._id,
                createdAt: { $gte: today },
                completed: true
            });

            if (existingDailyAttempt) {
                return res.status(400).json({
                    error: 'Siz bugun bu kundalik quizni allaqachon yakunlagansiz. Ertaga qayta urinib ko\'ring.',
                    attemptId: existingDailyAttempt._id,
                    completed: true
                });
            }
        }

        const attempt = new QuizAttempt({
            userId: req.user.id,
            quizId: quiz._id,
            competitionId: quiz.competitionId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        await attempt.save();

        res.json({
            success: true,
            attemptId: attempt._id,
            quiz: {
                title: quiz.title,
                totalQuestions: quiz.totalQuestions,
                timeLimit: quiz.timeLimit,
                totalPoints: quiz.totalPoints
            },
            startedAt: attempt.startedAt
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

router.post('/attempt/:attemptId/answer', auth, async (req, res) => {
    try {
        const { questionIndex, selectedOption, timeSpent } = req.body;

        const attempt = await QuizAttempt.findById(req.params.attemptId);

        if (!attempt || attempt.userId.toString() !== req.user.id) {
            return res.status(404).json({ error: 'Attempt not found' });
        }

        if (attempt.completed) {
            return res.status(400).json({ error: 'Attempt already completed' });
        }

        const quiz = await Quiz.findById(attempt.quizId);
        const question = quiz.questions[questionIndex];

        if (!question) {
            return res.status(400).json({ error: 'Invalid question index' });
        }

        const isCorrect = question.options[selectedOption]?.isCorrect || false;
        const pointsEarned = isCorrect ? question.points : 0;

        const existingAnswer = attempt.answers.find(a => a.questionIndex === questionIndex);

        if (existingAnswer) {

            existingAnswer.selectedOption = selectedOption;
            existingAnswer.isCorrect = isCorrect;
            existingAnswer.timeSpent = timeSpent;
            existingAnswer.pointsEarned = pointsEarned;
        } else {

            attempt.answers.push({
                questionIndex,
                selectedOption,
                isCorrect,
                timeSpent,
                pointsEarned
            });
        }

        await attempt.save();

        res.json({
            isCorrect,
            pointsEarned,
            correctAnswer: question.options.findIndex(opt => opt.isCorrect),
            explanation: question.explanation
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/attempt/:attemptId/complete', auth, async (req, res) => {
    try {
        const attempt = await QuizAttempt.findById(req.params.attemptId);

        if (!attempt || attempt.userId.toString() !== req.user.id) {
            return res.status(404).json({ error: 'Attempt not found' });
        }

        if (attempt.completed) {
            return res.status(400).json({ error: 'Attempt already completed' });
        }

        attempt.completeAttempt();
        await attempt.save();

        const user = await User.findById(req.user.id);
        user.quizzesCompleted += 1;
        user.correctAnswers += attempt.totalCorrect;
        user.totalAnswers += attempt.answers.length;
        user.totalPoints += attempt.totalPoints;
        user.monthlyPoints += attempt.totalPoints;
        user.dailyPoints += attempt.totalPoints;

        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (user.lastActive && user.lastActive.toDateString() === yesterday.toDateString()) {
            user.currentStreak += 1;
            if (user.currentStreak > user.longestStreak) {
                user.longestStreak = user.currentStreak;
            }
        } else if (user.lastActive && user.lastActive.toDateString() !== today.toDateString()) {
            user.currentStreak = 1;
        }

        user.lastActive = today;
        user.updateLevel();
        await user.save();


        const quiz = await Quiz.findById(attempt.quizId);
        quiz.attempts += 1;
        quiz.averageScore = ((quiz.averageScore * (quiz.attempts - 1)) + attempt.accuracy) / quiz.attempts;
        await quiz.save();

        if (attempt.competitionId) {
            const competition = await Competition.findById(attempt.competitionId);
            if (competition && competition.isActive) {
                await competition.updateLeaderboard();
            }
        }

        res.json({
            attempt,
            userStats: {
                totalPoints: user.totalPoints,
                monthlyPoints: user.monthlyPoints,
                dailyPoints: user.dailyPoints,
                accuracy: user.accuracy,
                currentStreak: user.currentStreak
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id/completion-status', auth, async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        const completedAttempt = await QuizAttempt.findOne({
            userId: req.user.id,
            quizId: quiz._id,
            completed: true
        });

        res.json({
            success: true,
            completed: !!completedAttempt,
            attempt: completedAttempt ? {
                _id: completedAttempt._id,
                totalCorrect: completedAttempt.totalCorrect,
                totalPoints: completedAttempt.totalPoints,
                accuracy: completedAttempt.accuracy,
                completedAt: completedAttempt.completedAt
            } : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;