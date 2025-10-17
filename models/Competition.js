const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const competitionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Competition nomi majburiy'],
        trim: true,
        maxlength: [100, 'Competition nomi 100 ta belgidan oshmasligi kerak']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Tavsif 500 ta belgidan oshmasligi kerak']
    },
    startDate: {
        type: Date,
        default: () => new Date()
    },
    endDate: {
        type: Date,
        default: () => {
            const date = new Date();
            date.setDate(date.getDate() + 10);
            return date;
        }
    },
    prizePool: {
        type: Number,
        default: 0,
        min: [0, 'Mukofot jamg\'armasi manfiy bo\'lmasligi kerak']
    },
    isActive: {
        type: Boolean,
        default: false
    },
    isPublished: {
        type: Boolean,
        default: false
    },
    totalParticipants: {
        type: Number,
        default: 0
    },
    quizzes: [{
        quizId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Quiz'
        },
        title: String,
        order: {
            type: Number,
            default: 1
        }
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: false,
        default: 'uzwebcoder'
    }
}, {
    timestamps: true
});

// Pagination plugin
competitionSchema.plugin(mongoosePaginate);

// Indexes
competitionSchema.index({ startDate: 1, endDate: 1 });
competitionSchema.index({ isPublished: 1 });

// Virtual for competition status
competitionSchema.virtual('status').get(function () {
    const now = new Date();
    if (now < this.startDate) return 'upcoming';
    if (now > this.endDate) return 'ended';
    return 'active';
});

// Pre-save middleware for auto-updating isActive
competitionSchema.pre('save', function (next) {
    const now = new Date();
    this.isActive = (now >= this.startDate && now <= this.endDate);
    next();
});

module.exports = mongoose.model('Competition', competitionSchema);