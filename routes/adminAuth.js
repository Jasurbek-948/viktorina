const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const router = express.Router();

// Admin login
router.post('/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username va password kiritilishi shart'
            });
        }

        // Adminni topish
        const admin = await Admin.findOne({ username: username.toLowerCase() });
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Username yoki password xato'
            });
        }

        // Password ni tekshirish
        const isPasswordValid = await admin.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Username yoki password xato'
            });
        }

        // Admin faol emas
        if (!admin.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Admin hisobi bloklangan'
            });
        }

        // Token yaratish
        const token = jwt.sign(
            {
                id: admin._id,
                username: admin.username,
                role: admin.role
            },
            process.env.JWT_SECRET || 'admin_secret_key',
            { expiresIn: '24h' }
        );

        // Login tarixini yangilash
        admin.lastLogin = new Date();
        await admin.save();

        res.json({
            success: true,
            message: 'Login muvaffaqiyatli',
            token,
            admin: {
                id: admin._id,
                username: admin.username,
                role: admin.role,
                lastLogin: admin.lastLogin
            }
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server xatosi'
        });
    }
});

module.exports = router;