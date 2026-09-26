const { supabaseAdmin } = require('../supabaseClient');

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
            if (!error && user) {
                req.user = user;
            }
        }
    } catch (error) {
        console.error('Auth Middleware Error:', error.message);
    }
    // Proceed regardless. If a route strictly requires auth, it can check req.user.
    next();
};

module.exports = authMiddleware;
