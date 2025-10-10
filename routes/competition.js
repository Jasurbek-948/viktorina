// routes/competition.js
const express = require('express');
const router = express.Router();
const Competition = require('../models/Competition');
const Quiz = require('../models/Quiz');
const User = require('../models/User');
const QuizAttempt = require('../models/QuizAttempt');
const auth = require('../middleware/auth');

// Get active competitions
router.get('/active', auth, async (req, res) => {
    try {
        const now = new Date();

        const competitions = await Competition.find({
            isActive: true,
            startDate: { $lte: now },
            endDate: { $gte: now }
        })
            .select('name description startDate endDate totalParticipants maxParticipants prizePool categories difficulty')
            .sort({ startDate: 1 })
            .limit(10);

        res.json(competitions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get competition details
router.get('/:id', auth, async (req, res) => {
    try {
        const competition = await Competition.findById(req.params.id)
            .populate('dailyQuizzes.quizId', 'title description totalQuestions timeLimit totalPoints')
            .populate('leaderboard.userId', 'firstName lastName username');

        if (!competition) {
            return res.status(404).json({ error: 'Competition not found' });
        }

        // Check if user is participating
        const userParticipation = competition.leaderboard.find(
            entry => entry.userId._id.toString() === req.user.id
        );

        const competitionData = {
            _id: competition._id,
            name: competition.name,
            description: competition.description,
            startDate: competition.startDate,
            endDate: competition.endDate,
            isActive: competition.isActive,
            totalParticipants: competition.totalParticipants,
            maxParticipants: competition.maxParticipants,
            prizePool: competition.prizePool,
            categories: competition.categories,
            difficulty: competition.difficulty,
            userParticipating: !!userParticipation,
            userRank: userParticipation ? userParticipation.rank : null,
            userPoints: userParticipation ? userParticipation.points : 0,
            dailyQuizzes: competition.dailyQuizzes.filter(dq => dq.isActive),
            rules: competition.rules
        };

        res.json(competitionData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Join competition
router.post('/:id/join', auth, async (req, res) => {
    try {
        const competition = await Competition.findById(req.params.id);

        if (!competition) {
            return res.status(404).json({ error: 'Competition not found' });
        }

        if (!competition.isActive) {
            return res.status(400).json({ error: 'Competition is not active' });
        }

        // Check if competition has started
        const now = new Date();
        if (now < competition.startDate) {
            return res.status(400).json({ error: 'Competition has not started yet' });
        }

        if (now > competition.endDate) {
            return res.status(400).json({ error: 'Competition has ended' });
        }

        // Check if user already joined
        const alreadyJoined = competition.leaderboard.some(
            entry => entry.userId.toString() === req.user.id
        );

        if (alreadyJoined) {
            return res.status(400).json({ error: 'You have already joined this competition' });
        }

        // Check participant limit
        if (competition.totalParticipants >= competition.maxParticipants) {
            return res.status(400).json({ error: 'Competition is full' });
        }

        // Add user to leaderboard
        competition.leaderboard.push({
            userId: req.user.id,
            points: 0,
            rank: competition.totalParticipants + 1,
            quizzesCompleted: 0,
            accuracy: 0
        });

        competition.totalParticipants += 1;
        await competition.save();

        res.json({
            message: 'Successfully joined the competition',
            competition: {
                name: competition.name,
                startDate: competition.startDate,
                endDate: competition.endDate,
                totalParticipants: competition.totalParticipants
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get competition leaderboard
router.get('/:id/leaderboard', auth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const competition = await Competition.findById(req.params.id)
            .populate({
                path: 'leaderboard.userId',
                select: 'firstName lastName username totalPoints accuracy level'
            });

        if (!competition) {
            return res.status(404).json({ error: 'Competition not found' });
        }

        // Sort leaderboard by points (descending) and accuracy (descending)
        const sortedLeaderboard = competition.leaderboard
            .sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                return b.accuracy - a.accuracy;
            })
            .map((entry, index) => ({
                ...entry.toObject(),
                rank: index + 1
            }));

        // Paginate results
        const paginatedLeaderboard = sortedLeaderboard.slice(skip, skip + limit);

        // Find current user's position
        const userEntry = sortedLeaderboard.find(
            entry => entry.userId._id.toString() === req.user.id
        );

        res.json({
            leaderboard: paginatedLeaderboard,
            pagination: {
                page,
                limit,
                total: sortedLeaderboard.length,
                pages: Math.ceil(sortedLeaderboard.length / limit)
            },
            userStats: userEntry ? {
                rank: userEntry.rank,
                points: userEntry.points,
                quizzesCompleted: userEntry.quizzesCompleted,
                accuracy: userEntry.accuracy
            } : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get today's daily quiz for competition
router.get('/:id/daily-quiz', auth, async (req, res) => {
    try {
        const competition = await Competition.findById(req.params.id)
            .populate('dailyQuizzes.quizId');

        if (!competition) {
            return res.status(404).json({ error: 'Competition not found' });
        }

        // Check if user has joined the competition
        const userJoined = competition.leaderboard.some(
            entry => entry.userId.toString() === req.user.id
        );

        if (!userJoined) {
            return res.status(400).json({ error: 'You must join the competition first' });
        }

        // Get today's date (start of day)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find today's active daily quiz
        const dailyQuiz = competition.dailyQuizzes.find(dq => {
            const quizDate = new Date(dq.date);
            quizDate.setHours(0, 0, 0, 0);
            return quizDate.getTime() === today.getTime() && dq.isActive;
        });

        if (!dailyQuiz) {
            return res.status(404).json({ error: 'No daily quiz available for today' });
        }

        // Check if user already attempted today's quiz
        const existingAttempt = await QuizAttempt.findOne({
            userId: req.user.id,
            quizId: dailyQuiz.quizId._id,
            createdAt: { $gte: today },
            completed: true
        });

        if (existingAttempt) {
            return res.status(400).json({
                error: 'You have already completed today\'s quiz',
                attempt: {
                    score: existingAttempt.totalPoints,
                    accuracy: existingAttempt.accuracy,
                    completedAt: existingAttempt.completedAt
                }
            });
        }

        // Format quiz data without answers
        const quizData = {
            _id: dailyQuiz.quizId._id,
            title: dailyQuiz.quizId.title,
            description: dailyQuiz.quizId.description,
            category: dailyQuiz.quizId.category,
            difficulty: dailyQuiz.quizId.difficulty,
            timeLimit: dailyQuiz.quizId.timeLimit,
            totalQuestions: dailyQuiz.quizId.totalQuestions,
            totalPoints: dailyQuiz.quizId.totalPoints,
            questions: dailyQuiz.quizId.questions.map(q => ({
                _id: q._id,
                question: q.question,
                options: q.options.map(opt => ({ text: opt.text })),
                timeLimit: q.timeLimit,
                points: q.points,
                difficulty: q.difficulty
            }))
        };

        res.json({
            quiz: quizData,
            competition: {
                name: competition.name,
                day: Math.floor((today - competition.startDate) / (1000 * 60 * 60 * 24)) + 1
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Submit competition quiz attempt
router.post('/:id/submit-attempt', auth, async (req, res) => {
    try {
        const { attemptId } = req.body;

        const competition = await Competition.findById(req.params.id);

        if (!competition) {
            return res.status(404).json({ error: 'Competition not found' });
        }

        if (!competition.isActive) {
            return res.status(400).json({ error: 'Competition is not active' });
        }

        // Check if user has joined the competition
        const userEntry = competition.leaderboard.find(
            entry => entry.userId.toString() === req.user.id
        );

        if (!userEntry) {
            return res.status(400).json({ error: 'You must join the competition first' });
        }

        const attempt = await QuizAttempt.findById(attemptId)
            .populate('quizId');

        if (!attempt || attempt.userId.toString() !== req.user.id) {
            return res.status(404).json({ error: 'Attempt not found' });
        }

        if (!attempt.completed) {
            return res.status(400).json({ error: 'Attempt not completed' });
        }

        // Check if this quiz belongs to the competition
        if (attempt.quizId.competitionId?.toString() !== competition._id.toString()) {
            return res.status(400).json({ error: 'This quiz does not belong to the competition' });
        }

        // Update competition leaderboard
        userEntry.points += attempt.totalPoints;
        userEntry.quizzesCompleted += 1;

        // Recalculate accuracy
        const userAttempts = await QuizAttempt.find({
            userId: req.user.id,
            competitionId: competition._id,
            completed: true
        });

        const totalCorrect = userAttempts.reduce((sum, att) => sum + att.totalCorrect, 0);
        const totalAnswers = userAttempts.reduce((sum, att) => sum + att.answers.length, 0);

        userEntry.accuracy = totalAnswers > 0 ? (totalCorrect / totalAnswers) * 100 : 0;

        await competition.save();

        // Update global leaderboard ranking
        await competition.updateLeaderboard();

        res.json({
            message: 'Quiz results submitted to competition',
            pointsEarned: attempt.totalPoints,
            totalCompetitionPoints: userEntry.points,
            newRank: userEntry.rank,
            accuracy: userEntry.accuracy
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user's competition statistics
router.get('/:id/my-stats', auth, async (req, res) => {
    try {
        const competition = await Competition.findById(req.params.id);

        if (!competition) {
            return res.status(404).json({ error: 'Competition not found' });
        }

        const userEntry = competition.leaderboard.find(
            entry => entry.userId.toString() === req.user.id
        );

        if (!userEntry) {
            return res.status(400).json({ error: 'You are not participating in this competition' });
        }

        // Get user's quiz attempts for this competition
        const attempts = await QuizAttempt.find({
            userId: req.user.id,
            competitionId: competition._id,
            completed: true
        })
            .populate('quizId', 'title category difficulty')
            .sort({ completedAt: -1 })
            .limit(20);

        // Calculate additional statistics
        const totalTimeSpent = attempts.reduce((sum, attempt) => sum + attempt.totalTime, 0);
        const averageTimePerQuiz = attempts.length > 0 ? totalTimeSpent / attempts.length : 0;

        const dailyProgress = [];
        const startDate = new Date(competition.startDate);
        const today = new Date();

        for (let date = new Date(startDate); date <= today; date.setDate(date.getDate() + 1)) {
            const dayAttempts = attempts.filter(attempt => {
                const attemptDate = new Date(attempt.completedAt);
                return attemptDate.toDateString() === date.toDateString();
            });

            dailyProgress.push({
                date: new Date(date),
                quizzesCompleted: dayAttempts.length,
                pointsEarned: dayAttempts.reduce((sum, attempt) => sum + attempt.totalPoints, 0)
            });
        }

        res.json({
            competitionStats: {
                rank: userEntry.rank,
                totalPoints: userEntry.points,
                quizzesCompleted: userEntry.quizzesCompleted,
                accuracy: userEntry.accuracy,
                totalParticipants: competition.totalParticipants
            },
            performanceStats: {
                totalAttempts: attempts.length,
                averageScore: attempts.length > 0 ?
                    attempts.reduce((sum, attempt) => sum + attempt.accuracy, 0) / attempts.length : 0,
                averageTimePerQuiz: Math.round(averageTimePerQuiz),
                bestQuiz: attempts.length > 0 ?
                    attempts.reduce((best, attempt) => attempt.accuracy > best.accuracy ? attempt : best) : null
            },
            recentAttempts: attempts.slice(0, 5),
            dailyProgress
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get competition winners (after competition ends)
router.get('/:id/winners', auth, async (req, res) => {
    try {
        const competition = await Competition.findById(req.params.id)
            .populate('winners.userId', 'firstName lastName username')
            .populate('leaderboard.userId', 'firstName lastName username');

        if (!competition) {
            return res.status(404).json({ error: 'Competition not found' });
        }

        const now = new Date();
        if (now < competition.endDate) {
            return res.status(400).json({ error: 'Competition has not ended yet' });
        }

        // If winners are not calculated yet, calculate them
        if (competition.winners.length === 0) {
            const topParticipants = competition.leaderboard
                .sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points;
                    return b.accuracy - a.accuracy;
                })
                .slice(0, 10);

            competition.winners = topParticipants.map((participant, index) => ({
                rank: index + 1,
                userId: participant.userId,
                prize: calculatePrize(competition.prizePool, index + 1)
            }));

            await competition.save();
        }

        res.json({
            competition: {
                name: competition.name,
                endDate: competition.endDate,
                totalParticipants: competition.totalParticipants,
                prizePool: competition.prizePool
            },
            winners: competition.winners
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper function to calculate prizes
function calculatePrize(prizePool, rank) {
    const prizeDistribution = {
        1: 0.4,  // 40% for 1st place
        2: 0.25, // 25% for 2nd place
        3: 0.15, // 15% for 3rd place
        4: 0.08, // 8% for 4th place
        5: 0.05, // 5% for 5th place
        6: 0.03, // 3% for 6th place
        7: 0.02, // 2% for 7th place
        8: 0.01, // 1% for 8th place
        9: 0.005, // 0.5% for 9th place
        10: 0.005 // 0.5% for 10th place
    };

    const percentage = prizeDistribution[rank] || 0;
    return Math.round(prizePool * percentage);
}

module.exports = router;