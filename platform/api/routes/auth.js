const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prismaClient');

router.post('/login', async (req, res, next) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

    try {
        const cleanInput = username.trim();

        // 1. Try finding by exact username
        let user = await prisma.user.findUnique({ where: { username: cleanInput } });

        // 2. If not found, try finding by case-insensitive username, displayName, or parent_ prefix
        if (!user) {
            const stripped = cleanInput.toLowerCase().replace(/[^a-z0-9_]/g, '');
            user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { username: { equals: cleanInput, mode: 'insensitive' } },
                        { displayName: { equals: cleanInput, mode: 'insensitive' } },
                        { username: { equals: stripped, mode: 'insensitive' } },
                        { username: { equals: `parent_${stripped}`, mode: 'insensitive' } }
                    ]
                }
            });
        }

        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '1d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar,
                role: user.role
            }
        });
    } catch (err) {
        next(err);
    }
});

router.post('/student-login', async (req, res, next) => {
    const { studentId, classId } = req.body;
    if (!studentId || !classId) return res.status(400).json({ error: 'Missing student or class' });

    try {
        // Validate student exists and is in the class
        const membership = await prisma.classMembership.findUnique({
            where: { userId_classId: { userId: studentId, classId: classId } },
            include: { user: true }
        });

        if (!membership || membership.user.role !== 'STUDENT') {
            return res.status(403).json({ error: 'Invalid student or class membership' });
        }

        const user = membership.user;
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, classId: classId },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '1d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar,
                role: user.role
            }
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
