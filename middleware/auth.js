// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        console.log('Auth middleware - Token received:', token ? 'Yes' : 'No'); // Debug

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'No token, authorization denied',
                code: 'NO_TOKEN'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        console.log('Decoded token:', decoded); // Debug

        // decoded.userId yoki decoded.id ni tekshiramiz
        const userId = decoded.userId || decoded.id;
        console.log('User ID from token:', userId); // Debug

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Invalid token structure',
                code: 'INVALID_TOKEN'
            });
        }

        const user = await User.findById(userId);
        console.log('User found:', user ? 'Yes' : 'No'); // Debug

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        if (user.isActive === false) {
            return res.status(401).json({
                success: false,
                error: 'Account is deactivated',
                code: 'ACCOUNT_DEACTIVATED'
            });
        }

        req.user = user;
        console.log('Authentication successful for user:', user.username); // Debug
        next();
    } catch (error) {
        console.error('Auth middleware error:', error.message);

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token',
                code: 'INVALID_TOKEN'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired',
                code: 'TOKEN_EXPIRED'
            });
        }

        res.status(401).json({
            success: false,
            error: 'Token is not valid',
            code: 'AUTH_FAILED'
        });
    }
};

module.exports = auth;