const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');
const prisma = require('../utils/prismaClient');

// Generate a short-lived launch token for an app
router.post('/launch', authenticate, async (req, res, next) => {
    const { appId, assignmentId } = req.body;
    if (!appId) return res.status(400).json({ error: 'appId is required' });

    try {
        const appInfo = await prisma.application.findUnique({ where: { id: appId } });
        if (!appInfo) return res.status(404).json({ error: 'Application not found' });

        let launchUrl = appInfo.launchUrl || 'http://localhost:5000/index.html';

        const tokenPayload = {
            userId: req.user.id,
            role: req.user.role,
            appId: appId,
            assignmentId: assignmentId || null
        };

        const appToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '1h' });
        const finalUrl = `${launchUrl}?token=${appToken}${assignmentId ? `&assignmentId=${assignmentId}` : ''}`;
        res.json({ launchUrl: finalUrl });
    } catch (err) {
        next(err);
    }
});

router.post('/results', async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid token' });
    }
    
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Ensure token is an app-specific token (contains appId)
        if (!decoded.appId) {
            return res.status(403).json({ error: 'Token is not authorized for app integrations' });
        }

        const { assignmentId, score, status, details } = req.body;
        
        // Fix assignment-forgery vulnerability
        if (!decoded.assignmentId) {
            return res.status(403).json({ error: 'Token not authorized to submit assignment results (missing assignment context)' });
        }
        if (assignmentId && assignmentId !== decoded.assignmentId) {
            return res.status(403).json({ error: 'Assignment ID mismatch: cannot forge results' });
        }
        
        const finalAssignmentId = decoded.assignmentId;
        
        // Write to PostgreSQL database
        await prisma.activityResult.create({
            data: {
                assignmentId: finalAssignmentId,
                userId: decoded.userId,
                score,
                status,
                details
            }
        });
        
        res.json({ success: true, message: 'Result recorded successfully' });
    } catch (err) {
        err.status = 401;
        next(err);
    }
});

module.exports = router;
