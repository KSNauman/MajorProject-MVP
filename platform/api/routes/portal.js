const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticate } = require('../middleware/auth');
const prisma = require('../utils/prismaClient');

// Only TEACHER or ADMIN can access these routes
const isTeacher = (req, res, next) => {
    if (req.user.role !== 'TEACHER' && req.user.role !== 'ADMIN') {
        return res.status(403).json({error: 'Forbidden'});
    }
    next();
};

// Teacher creates a class
router.post('/classes', authenticate, isTeacher, async (req, res, next) => {
    try {
        const { name } = req.body;
        const newClass = await prisma.class.create({ data: { name } });
        await prisma.classMembership.create({ data: { userId: req.user.id, classId: newClass.id, role: 'TEACHER' }});
        res.json(newClass);
    } catch(err) { next(err); }
});

// Public endpoint: Get all classes (for student login selection)
router.get('/public/classes', async (req, res, next) => {
    try {
        const classes = await prisma.class.findMany({ select: { id: true, name: true } });
        res.json(classes);
    } catch(err) { next(err); }
});

// Public endpoint: Get students in a specific class (for student login selection)
router.get('/public/classes/:classId/students', async (req, res, next) => {
    try {
        const memberships = await prisma.classMembership.findMany({
            where: { classId: req.params.classId, role: 'STUDENT' },
            include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } }
        });
        res.json(memberships.map(m => m.user));
    } catch(err) { next(err); }
});

// Teacher creates a student
router.post('/students', authenticate, isTeacher, async (req, res, next) => {
    try {
        const { username, password, displayName, avatar, classId } = req.body;
        const hash = await bcrypt.hash(password || 'password123', 10); // default password if none
        const student = await prisma.user.create({ data: { username, passwordHash: hash, displayName, avatar, role: 'STUDENT' }});
        
        if (classId) {
            await prisma.classMembership.create({ data: { userId: student.id, classId: classId, role: 'STUDENT' } });
        }
        
        res.json({ id: student.id, username: student.username, displayName: student.displayName, avatar: student.avatar });
    } catch(err) { next(err); }
});

// Get all students
router.get('/students', authenticate, isTeacher, async (req, res, next) => {
    try {
        const students = await prisma.user.findMany({ where: { role: 'STUDENT' }, select: { id: true, username: true }});
        res.json(students);
    } catch(err) { next(err); }
});

// Get classes for user
router.get('/classes', authenticate, async (req, res, next) => {
    try {
        const classes = await prisma.class.findMany({
            where: { memberships: { some: { userId: req.user.id } } }
        });
        res.json(classes);
    } catch(err) { next(err); }
});

// Add student to class
router.post('/classes/:id/members', authenticate, isTeacher, async (req, res, next) => {
    try {
        const { studentId } = req.body;
        await prisma.classMembership.create({ data: { userId: studentId, classId: req.params.id, role: 'STUDENT' }});
        res.json({success: true});
    } catch(err) { next(err); }
});

// Create assignment
router.post('/assignments', authenticate, isTeacher, async (req, res, next) => {
    try {
        const { title, classId, appId, assignedToId } = req.body;
        const assign = await prisma.assignment.create({ data: { title, classId, appId, assignedToId: assignedToId || null }});
        res.json(assign);
    } catch(err) { next(err); }
});

// Get assignments for student
router.get('/assignments', authenticate, async (req, res, next) => {
    try {
        const assignments = await prisma.assignment.findMany({
            where: { 
                OR: [ 
                    { assignedToId: req.user.id }, 
                    { class: { memberships: { some: { userId: req.user.id, role: 'STUDENT' } } }, assignedToId: null } 
                ] 
            },
            include: { application: true, results: { where: { userId: req.user.id } } }
        });
        res.json(assignments);
    } catch(err) { next(err); }
});

// Get assignments created by teacher
router.get('/teacher/assignments', authenticate, isTeacher, async (req, res, next) => {
    try {
        const assignments = await prisma.assignment.findMany({
            where: { class: { memberships: { some: { userId: req.user.id, role: 'TEACHER' } } } },
            include: { application: true, class: true, results: { include: { user: { select: { username: true } } } } }
        });
        res.json(assignments);
    } catch(err) { next(err); }
});

// Get student history
router.get('/students/:id/history', authenticate, async (req, res, next) => {
    // Teacher or parent or the student themselves
    if (req.user.role === 'STUDENT' && req.user.id !== req.params.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    try {
        const results = await prisma.activityResult.findMany({
            where: { userId: req.params.id },
            include: { assignment: { include: { application: true } } }
        });
        const stories = await prisma.studentStory.findMany({
            where: { userId: req.params.id }
        });
        res.json({ results, stories });
    } catch(err) { next(err); }
});

// Save a story
router.post('/student/stories', authenticate, async (req, res, next) => {
    if (req.user.role !== 'STUDENT') return res.status(403).json({ error: 'Must be a student' });
    try {
        const { title, prompt, videoUrl, status } = req.body;
        const story = await prisma.studentStory.create({
            data: {
                userId: req.user.id || req.user.userId,
                title,
                prompt,
                videoUrl,
                status
            }
        });
        res.json(story);
    } catch(err) { next(err); }
});

// Get recent stories for logged in student
router.get('/student/stories', authenticate, async (req, res, next) => {
    if (req.user.role !== 'STUDENT') return res.status(403).json({ error: 'Must be a student' });
    try {
        const stories = await prisma.studentStory.findMany({
            where: { userId: req.user.id || req.user.userId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(stories);
    } catch(err) { next(err); }
});

module.exports = router;
