const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../utils/prismaClient');

// List all registered apps (requires authentication)
router.get('/', authenticate, async (req, res, next) => {
    try {
        const apps = await prisma.application.findMany();
        res.json({ apps });
    } catch(err) {
        next(err);
    }
});

// Register a new app (Admin only)
router.post('/', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    const { name, version, launchUrl } = req.body;
    try {
        const app = await prisma.application.create({
            data: { name, version, launchUrl }
        });
        res.status(201).json({ app });
    } catch (err) {
        err.status = 400;
        next(err);
    }
});

module.exports = router;
