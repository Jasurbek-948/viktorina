const express = require('express');
const router = express.Router();
const Competition = require('../models/Competition');
const Quiz = require('../models/Quiz');
const { body, validationResult } = require('express-validator');
const adminAuth = require('../middleware/adminAuth');

// Enhanced logging middleware
const requestLogger = (req, res, next) => {
    console.log('=== NEW REQUEST ===');
    console.log('Time:', new Date().toISOString());
    console.log('Method:', req.method);
    console.log('URL:', req.originalUrl);
    console.log('Params:', req.params);
    console.log('Query:', req.query);
    console.log('Headers:', {
        authorization: req.headers.authorization ? 'Present' : 'Missing',
        'content-type': req.headers['content-type']
    });
    console.log('Body:', req.body);
    console.log('===================');
    next();
};

// Apply request logger to all routes
router.use(requestLogger);

// Enhanced validation error handler
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('❌ VALIDATION ERRORS:', errors.array());
        return res.status(400).json({
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    console.log('✅ Validation passed');
    next();
};

// Get all quizzes for a specific competition
router.get('/:competitionId/quizzes', adminAuth, async (req, res) => {
    try {
        console.log('🔍 GET Quizzes for Competition - START');
        const { competitionId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        console.log('Competition ID:', competitionId);
        console.log('Pagination - Page:', page, 'Limit:', limit, 'Skip:', skip);

        // Validate competitionId format
        if (!competitionId || competitionId.length !== 24) {
            console.log('❌ Invalid competition ID format:', competitionId);
            return res.status(400).json({
                message: 'Invalid competition ID format',
                receivedId: competitionId
            });
        }

        // Check if competition exists
        console.log('🔍 Checking competition existence...');
        const competition = await Competition.findById(competitionId);
        if (!competition) {
            console.log('❌ Competition not found with ID:', competitionId);
            return res.status(404).json({
                message: 'Competition not found',
                competitionId: competitionId
            });
        }
        console.log('✅ Competition found:', competition.name);

        // Fetch quizzes for this competition with pagination
        console.log('🔍 Fetching quizzes from database...');
        const quizzes = await Quiz.find({ competitionId })
            .select('-questions.options.isCorrect')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        console.log('✅ Quizzes found:', quizzes.length);

        // Get total count for pagination metadata
        const total = await Quiz.countDocuments({ competitionId });
        console.log('📊 Total quizzes:', total);

        res.status(200).json({
            message: 'Quizzes retrieved successfully',
            quizzes,
            competition: {
                _id: competition._id,
                name: competition.name,
                description: competition.description,
                maxParticipants: competition.maxParticipants,
                currentParticipants: competition.currentParticipants
            },
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
        console.log('✅ GET Quizzes - SUCCESS');

    } catch (error) {
        console.error('❌ GET Quizzes - ERROR:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            message: 'Server error while retrieving quizzes',
            error: error.message
        });
    }
});

// Enhanced quiz creation with better validation and logging
router.post(
    '/:competitionId/quizzes',
    adminAuth,
    [
        body('title')
            .isString()
            .withMessage('Title must be a string')
            .trim()
            .isLength({ min: 3, max: 200 })
            .withMessage('Quiz title must be between 3 and 200 characters'),
        body('description')
            .optional()
            .isString()
            .withMessage('Description must be a string')
            .trim()
            .isLength({ max: 500 })
            .withMessage('Description cannot exceed 500 characters'),
        body('category')
            .isString()
            .withMessage('Category must be a string')
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage('Category is required and must be between 1 and 100 characters'),
        body('difficulty')
            .isIn(['easy', 'medium', 'hard'])
            .withMessage('Difficulty must be easy, medium, or hard'),
        body('timeLimit')
            .optional()
            .isInt({ min: 30, max: 3600 })
            .withMessage('Time limit must be between 30 and 3600 seconds'),
        body('questions')
            .isArray({ min: 1 })
            .withMessage('At least one question is required'),
        body('questions.*.question')
            .isString()
            .withMessage('Question text must be a string')
            .trim()
            .isLength({ min: 5, max: 1000 })
            .withMessage('Question text must be between 5 and 1000 characters'),
        body('questions.*.options')
            .isArray({ min: 2, max: 6 })
            .withMessage('Each question must have between 2 and 6 options'),
        body('questions.*.options.*')
            .isString()
            .withMessage('Each option must be a string')
            .trim()
            .isLength({ min: 1, max: 500 })
            .withMessage('Option text must be between 1 and 500 characters'),
        body('questions.*.correctOption')
            .isInt({ min: 0 })
            .withMessage('Correct option index is required and must be a number'),
        body('questions.*.points')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Points must be between 1 and 100'),
        body('questions.*.timeLimit')
            .optional()
            .isInt({ min: 10, max: 300 })
            .withMessage('Question time limit must be between 10 and 300 seconds'),
    ],
    validateRequest,
    async (req, res) => {
        try {
            console.log('🔄 CREATE Quiz - START');
            const { competitionId } = req.params;
            const { title, description, category, difficulty, timeLimit, questions, tags } = req.body;

            console.log('Received data:', {
                competitionId,
                title,
                category,
                difficulty,
                timeLimit,
                questionsCount: questions ? questions.length : 0,
                tags
            });

            // Validate competitionId format
            if (!competitionId || competitionId.length !== 24) {
                console.log('❌ Invalid competition ID format:', competitionId);
                return res.status(400).json({
                    message: 'Invalid competition ID format',
                    receivedId: competitionId
                });
            }

            // Check if competition exists
            console.log('🔍 Checking competition existence...');
            const competition = await Competition.findById(competitionId);
            if (!competition) {
                console.log('❌ Competition not found with ID:', competitionId);
                return res.status(404).json({
                    message: 'Competition not found',
                    competitionId: competitionId
                });
            }
            console.log('✅ Competition found:', competition.name);

            // Enhanced questions validation and formatting
            console.log('🔍 Validating and formatting questions...');
            const formattedQuestions = questions.map((q, index) => {
                console.log(`Processing question ${index + 1}:`, {
                    question: q.question ? `"${q.question.substring(0, 50)}..."` : 'MISSING',
                    optionsCount: q.options ? q.options.length : 0,
                    correctOption: q.correctOption,
                    points: q.points
                });

                // Validate options array
                if (!q.options || !Array.isArray(q.options)) {
                    throw new Error(`Question ${index + 1}: Options must be an array`);
                }

                // Validate correctOption index
                if (q.correctOption === undefined || q.correctOption === null) {
                    throw new Error(`Question ${index + 1}: correctOption is required`);
                }

                if (q.correctOption < 0 || q.correctOption >= q.options.length) {
                    throw new Error(`Question ${index + 1}: correctOption index ${q.correctOption} is out of bounds for ${q.options.length} options`);
                }

                const options = q.options.map((option, optIndex) => {
                    if (typeof option !== 'string' || !option.trim()) {
                        throw new Error(`Question ${index + 1}, Option ${optIndex + 1}: Must be a non-empty string`);
                    }
                    return {
                        text: option.trim(),
                        isCorrect: optIndex === q.correctOption
                    };
                });

                return {
                    question: q.question.trim(),
                    options: options,
                    explanation: (q.explanation || '').trim(),
                    difficulty: q.difficulty || difficulty,
                    category: q.category || category,
                    timeLimit: q.timeLimit || 30,
                    points: q.points || 10
                };
            });

            console.log('✅ Questions formatted successfully');

            // Create quiz object
            const quizData = {
                title: title.trim(),
                description: (description || '').trim(),
                questions: formattedQuestions,
                category: category.trim(),
                difficulty: difficulty,
                timeLimit: timeLimit || 300,
                competitionId,
                isCompetitionQuiz: true,
                tags: tags || [],
                createdBy: req.admin.id
            };

            console.log('📝 Creating quiz with data:', {
                title: quizData.title,
                category: quizData.category,
                questionsCount: quizData.questions.length,
                timeLimit: quizData.timeLimit
            });

            const quiz = new Quiz(quizData);
            await quiz.save();

            console.log('✅ Quiz saved to database with ID:', quiz._id);

            // Populate the saved quiz for response
            const savedQuiz = await Quiz.findById(quiz._id)
                .select('-questions.options.isCorrect');

            res.status(201).json({
                message: 'Quiz created successfully for competition',
                quiz: savedQuiz
            });
            console.log('✅ CREATE Quiz - SUCCESS');

        } catch (error) {
            console.error('❌ CREATE Quiz - ERROR:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                body: req.body
            });

            // Handle specific MongoDB errors
            if (error.name === 'ValidationError') {
                const validationErrors = Object.values(error.errors).map(err => err.message);
                return res.status(400).json({
                    message: 'Quiz validation failed',
                    errors: validationErrors
                });
            }

            // Handle duplicate key errors
            if (error.code === 11000) {
                return res.status(400).json({
                    message: 'A quiz with this title already exists in the competition'
                });
            }

            res.status(500).json({
                message: 'Server error while creating quiz',
                error: error.message
            });
        }
    }
);

// Update a quiz in competition
router.put(
    '/:competitionId/quizzes/:quizId',
    adminAuth,
    [
        body('title')
            .optional()
            .isString()
            .withMessage('Title must be a string')
            .trim()
            .isLength({ min: 3, max: 200 })
            .withMessage('Quiz title must be between 3 and 200 characters'),
        body('description')
            .optional()
            .isString()
            .withMessage('Description must be a string')
            .trim()
            .isLength({ max: 500 })
            .withMessage('Description cannot exceed 500 characters'),
        body('category')
            .optional()
            .isString()
            .withMessage('Category must be a string')
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage('Category must be between 1 and 100 characters'),
        body('difficulty')
            .optional()
            .isIn(['easy', 'medium', 'hard'])
            .withMessage('Difficulty must be easy, medium, or hard'),
        body('timeLimit')
            .optional()
            .isInt({ min: 30, max: 3600 })
            .withMessage('Time limit must be between 30 and 3600 seconds'),
    ],
    validateRequest,
    async (req, res) => {
        try {
            console.log('🔄 UPDATE Quiz - START');
            const { competitionId, quizId } = req.params;
            const updates = req.body;

            console.log('Update data:', {
                competitionId,
                quizId,
                updates
            });

            // Validate IDs
            if (!competitionId || competitionId.length !== 24) {
                console.log('❌ Invalid competition ID format:', competitionId);
                return res.status(400).json({
                    message: 'Invalid competition ID format',
                    receivedId: competitionId
                });
            }

            if (!quizId || quizId.length !== 24) {
                console.log('❌ Invalid quiz ID format:', quizId);
                return res.status(400).json({
                    message: 'Invalid quiz ID format',
                    receivedId: quizId
                });
            }

            // Check if competition and quiz exist
            console.log('🔍 Checking competition and quiz existence...');
            const competition = await Competition.findById(competitionId);
            if (!competition) {
                console.log('❌ Competition not found with ID:', competitionId);
                return res.status(404).json({
                    message: 'Competition not found',
                    competitionId: competitionId
                });
            }

            const quiz = await Quiz.findOne({ _id: quizId, competitionId });
            if (!quiz) {
                console.log('❌ Quiz not found in this competition:', quizId);
                return res.status(404).json({
                    message: 'Quiz not found in this competition',
                    quizId: quizId,
                    competitionId: competitionId
                });
            }

            console.log('✅ Competition and quiz found, proceeding with update...');

            // Update quiz
            const updatedQuiz = await Quiz.findByIdAndUpdate(
                quizId,
                { ...updates, updatedAt: Date.now() },
                { new: true, runValidators: true }
            ).select('-questions.options.isCorrect');

            console.log('✅ Quiz updated successfully');

            res.status(200).json({
                message: 'Quiz updated successfully',
                quiz: updatedQuiz
            });
            console.log('✅ UPDATE Quiz - SUCCESS');

        } catch (error) {
            console.error('❌ UPDATE Quiz - ERROR:', error);
            console.error('Error stack:', error.stack);
            res.status(500).json({
                message: 'Server error while updating quiz',
                error: error.message
            });
        }
    }
);

// Delete a quiz from competition
router.delete('/:competitionId/quizzes/:quizId', adminAuth, async (req, res) => {
    try {
        console.log('🗑️ DELETE Quiz - START');
        const { competitionId, quizId } = req.params;

        console.log('Delete request:', { competitionId, quizId });

        // Validate IDs
        if (!competitionId || competitionId.length !== 24) {
            console.log('❌ Invalid competition ID format:', competitionId);
            return res.status(400).json({
                message: 'Invalid competition ID format',
                receivedId: competitionId
            });
        }

        if (!quizId || quizId.length !== 24) {
            console.log('❌ Invalid quiz ID format:', quizId);
            return res.status(400).json({
                message: 'Invalid quiz ID format',
                receivedId: quizId
            });
        }

        // Check if competition and quiz exist
        console.log('🔍 Checking competition and quiz existence...');
        const competition = await Competition.findById(competitionId);
        if (!competition) {
            console.log('❌ Competition not found with ID:', competitionId);
            return res.status(404).json({
                message: 'Competition not found',
                competitionId: competitionId
            });
        }

        const quiz = await Quiz.findOne({ _id: quizId, competitionId });
        if (!quiz) {
            console.log('❌ Quiz not found in this competition:', quizId);
            return res.status(404).json({
                message: 'Quiz not found in this competition',
                quizId: quizId,
                competitionId: competitionId
            });
        }

        console.log('✅ Competition and quiz found, proceeding with deletion...');

        await Quiz.findByIdAndDelete(quizId);
        console.log('✅ Quiz deleted successfully');

        res.status(200).json({
            message: 'Quiz deleted successfully from competition'
        });
        console.log('✅ DELETE Quiz - SUCCESS');

    } catch (error) {
        console.error('❌ DELETE Quiz - ERROR:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            message: 'Server error while deleting quiz',
            error: error.message
        });
    }
});

// Get single quiz details
router.get('/:competitionId/quizzes/:quizId', adminAuth, async (req, res) => {
    try {
        console.log('🔍 GET Single Quiz - START');
        const { competitionId, quizId } = req.params;

        console.log('Request details:', { competitionId, quizId });

        // Validate IDs
        if (!competitionId || competitionId.length !== 24) {
            console.log('❌ Invalid competition ID format:', competitionId);
            return res.status(400).json({
                message: 'Invalid competition ID format',
                receivedId: competitionId
            });
        }

        if (!quizId || quizId.length !== 24) {
            console.log('❌ Invalid quiz ID format:', quizId);
            return res.status(400).json({
                message: 'Invalid quiz ID format',
                receivedId: quizId
            });
        }

        // Check if competition exists
        console.log('🔍 Checking competition existence...');
        const competition = await Competition.findById(competitionId);
        if (!competition) {
            console.log('❌ Competition not found with ID:', competitionId);
            return res.status(404).json({
                message: 'Competition not found',
                competitionId: competitionId
            });
        }

        const quiz = await Quiz.findOne({ _id: quizId, competitionId });
        if (!quiz) {
            console.log('❌ Quiz not found in this competition:', quizId);
            return res.status(404).json({
                message: 'Quiz not found in this competition',
                quizId: quizId,
                competitionId: competitionId
            });
        }

        console.log('✅ Quiz found:', quiz.title);

        res.status(200).json({
            message: 'Quiz retrieved successfully',
            quiz
        });
        console.log('✅ GET Single Quiz - SUCCESS');

    } catch (error) {
        console.error('❌ GET Single Quiz - ERROR:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            message: 'Server error while retrieving quiz',
            error: error.message
        });
    }
});

// Health check endpoint for competitions
router.get('/:competitionId/health', adminAuth, async (req, res) => {
    try {
        const { competitionId } = req.params;
        console.log('🏥 HEALTH CHECK for competition:', competitionId);

        const competition = await Competition.findById(competitionId);
        const quizCount = await Quiz.countDocuments({ competitionId });

        res.status(200).json({
            competitionExists: !!competition,
            competition: competition ? {
                id: competition._id,
                name: competition.name,
                description: competition.description
            } : null,
            quizzesCount: quizCount,
            serverTime: new Date().toISOString()
        });

    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            message: 'Health check failed',
            error: error.message
        });
    }
});

module.exports = router;