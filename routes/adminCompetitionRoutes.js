const express = require('express');
const router = express.Router();
const Competition = require('../models/Competition');
const { body, validationResult } = require('express-validator');
const adminAuth = require('../middleware/adminAuth'); // Assuming adminAuth middleware is provided
// Middleware to handle validation errors
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Create a new competition
router.post(
    '/',
    adminAuth,
    [
        body('name')
            .isString()
            .trim()
            .isLength({ min: 3, max: 100 })
            .withMessage('Competition name must be between 3 and 100 characters'),
        body('description')
            .isString()
            .trim()
            .isLength({ min: 10, max: 1000 })
            .withMessage('Description must be between 10 and 1000 characters'),
        body('maxParticipants')
            .isInt({ min: 1 })
            .withMessage('Maximum participants must be at least 1'),
    ],
    validateRequest,
    async (req, res) => {
        try {
            const { name, description, maxParticipants } = req.body;

            // Check if competition with the same name already exists
            const existingCompetition = await Competition.findOne({ name });
            if (existingCompetition) {
                return res.status(400).json({ message: 'Competition with this name already exists' });
            }

            const competition = new Competition({
                name,
                description,
                maxParticipants,
            });

            await competition.save();
            res.status(201).json({ message: 'Competition created successfully', competition });
        } catch (error) {
            console.error('Error creating competition:', error);
            res.status(500).json({ message: 'Server error while creating competition' });
        }
    }
);

// Update an existing competition
router.put(
    '/:id',
    adminAuth,
    [
        body('name')
            .optional()
            .isString()
            .trim()
            .isLength({ min: 3, max: 100 })
            .withMessage('Competition name must be between 3 and 100 characters'),
        body('description')
            .optional()
            .isString()
            .trim()
            .isLength({ min: 10, max: 1000 })
            .withMessage('Description must be between 10 and 1000 characters'),
        body('maxParticipants')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Maximum participants must be at least 1'),
    ],
    validateRequest,
    async (req, res) => {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Check if competition exists
            const competition = await Competition.findById(id);
            if (!competition) {
                return res.status(404).json({ message: 'Competition not found' });
            }

            // Prevent increasing currentParticipants beyond maxParticipants
            if (updates.maxParticipants && updates.maxParticipants < competition.currentParticipants) {
                return res.status(400).json({
                    message: 'Maximum participants cannot be less than current participants',
                });
            }

            // Update competition
            const updatedCompetition = await Competition.findByIdAndUpdate(id, updates, {
                new: true,
                runValidators: true,
            });

            res.status(200).json({ message: 'Competition updated successfully', competition: updatedCompetition });
        } catch (error) {
            console.error('Error updating competition:', error);
            res.status(500).json({ message: 'Server error while updating competition' });
        }
    }
);

// Delete a competition
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if competition exists
        const competition = await Competition.findById(id);
        if (!competition) {
            return res.status(404).json({ message: 'Competition not found' });
        }

        await Competition.findByIdAndDelete(id);
        res.status(200).json({ message: 'Competition deleted successfully' });
    } catch (error) {
        console.error('Error deleting competition:', error);
        res.status(500).json({ message: 'Server error while deleting competition' });
    }
});

module.exports = router;