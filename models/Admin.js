const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username majburiy'],
        unique: true,
        trim: true,
        minlength: [3, 'Username kamida 3 ta belgidan iborat bo\'lishi kerak']
    },
    password: {
        type: String,
        required: [true, 'Password majburiy'],
        minlength: [6, 'Password kamida 6 ta belgidan iborat bo\'lishi kerak']
    },
    role: {
        type: String,
        default: 'admin'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    }
}, {
    timestamps: true
});

// Password ni hash qilish
adminSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Password ni solishtirish metod
adminSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// JSON ga o'tkazganda password ni olib tashlash
adminSchema.methods.toJSON = function () {
    const admin = this.toObject();
    delete admin.password;
    return admin;
};

module.exports = mongoose.model('Admin', adminSchema);