const evidenceReviewService = require('../services/evidenceReviewService');

// UC02 route guard: runs after authMiddleware, which only attaches req.user when a valid token is sent.
const requireWildlifeOfficer = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required.' });
    }

    try {
        const isWildlifeOfficer = await evidenceReviewService.isWildlifeOfficer(req.user.id);
        if (!isWildlifeOfficer) {
            return res.status(403).json({ error: 'Access denied: only Wildlife Officers can review camera-trap evidence.' });
        }
        next();
    } catch (error) {
        console.error('Wildlife Officer Role Check Error:', error.message);
        res.status(500).json({ error: 'Unable to verify user role.' });
    }
};

module.exports = requireWildlifeOfficer;
