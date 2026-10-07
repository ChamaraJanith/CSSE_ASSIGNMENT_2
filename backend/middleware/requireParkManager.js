const monitoringRuleService = require('../services/monitoringRuleService');

// UC04 route guard: runs after authMiddleware, which only attaches req.user when a valid token is sent.
const requireParkManager = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required.' });
    }

    try {
        const isParkManager = await monitoringRuleService.isParkManager(req.user.id);
        if (!isParkManager) {
            return res.status(403).json({ error: 'Access denied: only Park Managers can configure monitoring rules.' });
        }
        next();
    } catch (error) {
        console.error('Park Manager Role Check Error:', error.message);
        res.status(500).json({ error: 'Unable to verify user role.' });
    }
};

module.exports = requireParkManager;
