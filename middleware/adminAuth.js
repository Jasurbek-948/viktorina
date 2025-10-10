// middleware/adminAuth.js
const auth = require('./auth');

const adminAuth = (req, res, next) => {
    auth(req, res, () => {
        // Check if user is admin (you can add admin field to User model)
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied. Admin rights required.' });
        }
        next();
    });
};

module.exports = adminAuth;