const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const adminAuth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token topilmadi. Admin autentifikatsiyasi talab qilinadi.'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await Admin.findById(decoded.id).select('-password');

        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Admin topilmadi'
            });
        }

        if (!admin.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Admin hisobi bloklangan'
            });
        }

        req.admin = admin;
        next();
    } catch (error) {
        console.error('Admin auth xatosi:', error);
        res.status(401).json({
            success: false,
            message: 'Token yaroqsiz'
        });
    }
};

module.exports = adminAuth;