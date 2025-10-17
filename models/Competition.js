const mongoose = require('mongoose');

// Define the Competition schema
const competitionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Competition name is required'],
        trim: true,
        minlength: [3, 'Competition name must be at least 3 characters long'],
        maxlength: [100, 'Competition name cannot exceed 100 characters'],
    },
    description: {
        type: String,
        required: [true, 'Competition description is required'],
        trim: true,
        minlength: [10, 'Description must be at least 10 characters long'],
        maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    maxParticipants: {
        type: Number,
        required: [true, 'Maximum number of participants is required'],
        min: [1, 'Maximum participants must be at least 1'],
    },
    currentParticipants: {
        type: Number,
        default: 0,
        min: [0, 'Current participants cannot be negative'],
        validate: {
            validator: function (value) {
                return value <= this.maxParticipants;
            },
            message: 'Current participants cannot exceed maximum participants',
        },
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Update `updatedAt` timestamp on save
competitionSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Create the Competition model
const Competition = mongoose.model('Competition', competitionSchema);

module.exports = Competition;