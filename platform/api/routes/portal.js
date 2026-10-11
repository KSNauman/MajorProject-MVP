const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
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
        const students = await prisma.user.findMany({ where: { role: 'STUDENT' }, select: { id: true, username: true, displayName: true, avatar: true }});
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
        // Verify teacher manages this class
        const membership = await prisma.classMembership.findUnique({
            where: { userId_classId: { userId: req.user.id, classId: req.params.id } }
        });
        if (!membership || membership.role !== 'TEACHER') {
            return res.status(403).json({ error: 'You do not manage this class' });
        }

        await prisma.classMembership.create({ data: { userId: studentId, classId: req.params.id, role: 'STUDENT' }});
        res.json({success: true});
    } catch(err) { next(err); }
});

// Remove student from class
router.delete('/classes/:id/members/:studentId', authenticate, isTeacher, async (req, res, next) => {
    try {
        const { studentId } = req.params;
        // Verify teacher manages this class
        const membership = await prisma.classMembership.findUnique({
            where: { userId_classId: { userId: req.user.id, classId: req.params.id } }
        });
        if (!membership || membership.role !== 'TEACHER') {
            return res.status(403).json({ error: 'You do not manage this class' });
        }

        await prisma.classMembership.delete({ 
            where: { userId_classId: { userId: studentId, classId: req.params.id } }
        });
        res.json({success: true});
    } catch(err) { next(err); }
});

// Get class roster (for teacher)
router.get('/classes/:id/roster', authenticate, isTeacher, async (req, res, next) => {
    try {
        // Verify teacher manages this class
        const membership = await prisma.classMembership.findUnique({
            where: { userId_classId: { userId: req.user.id, classId: req.params.id } }
        });
        if (!membership || membership.role !== 'TEACHER') {
            return res.status(403).json({ error: 'You do not manage this class' });
        }

        const memberships = await prisma.classMembership.findMany({
            where: { classId: req.params.id, role: 'STUDENT' },
            include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } }
        });
        res.json(memberships.map(m => m.user));
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
    // Student can only access their own data
    if (req.user.role === 'STUDENT' && req.user.id !== req.params.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    // Parent can only access their linked child
    if (req.user.role === 'PARENT') {
        const link = await prisma.parentChild.findUnique({
            where: { parentId_childId: { parentId: req.user.id, childId: req.params.id } }
        });
        if (!link) {
            return res.status(403).json({ error: 'Unauthorized: not linked to this child' });
        }
    }
    try {
        const results = await prisma.activityResult.findMany({
            where: { userId: req.params.id },
            include: { assignment: { include: { application: true } } }
        });
        const stories = await prisma.studentStory.findMany({
            where: { userId: req.params.id }
        });
        const sanitizedStories = stories.map(s => ({ ...s, videoUrl: `/api/files?storyId=${s.id}` }));
        res.json({ results, stories: sanitizedStories });
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
        res.json({ ...story, videoUrl: `/api/files?storyId=${story.id}` });
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
        const sanitizedStories = stories.map(s => ({ ...s, videoUrl: `/api/files?storyId=${s.id}` }));
        res.json(sanitizedStories);
    } catch(err) { next(err); }
});

// PARENT ROUTES

// Only PARENT can access
const isParent = (req, res, next) => {
    if (req.user.role !== 'PARENT') {
        return res.status(403).json({error: 'Forbidden. Must be a parent.'});
    }
    next();
};

// Get linked children
router.get('/parent/children', authenticate, isParent, async (req, res, next) => {
    try {
        const links = await prisma.parentChild.findMany({
            where: { parentId: req.user.id },
            include: { child: { select: { id: true, username: true, displayName: true, avatar: true } } }
        });
        res.json(links.map(l => l.child));
    } catch(err) { next(err); }
});

// Get a specific child's dashboard (assignments + results + stories)
router.get('/parent/children/:childId/dashboard', authenticate, isParent, async (req, res, next) => {
    try {
        const childId = req.params.childId;
        
        // Verify relationship
        const link = await prisma.parentChild.findUnique({
            where: { parentId_childId: { parentId: req.user.id, childId: childId } }
        });
        
        if (!link) {
            return res.status(403).json({ error: 'Not authorized to view this child' });
        }

        const assignments = await prisma.assignment.findMany({
            where: { 
                OR: [ 
                    { assignedToId: childId }, 
                    { class: { memberships: { some: { userId: childId, role: 'STUDENT' } } }, assignedToId: null } 
                ] 
            },
            include: { application: true, class: true, results: { where: { userId: childId } } }
        });

        const stories = await prisma.studentStory.findMany({
            where: { userId: childId },
            orderBy: { createdAt: 'desc' }
        });

        const storiesWithStatus = stories.map(s => {
            let fileExists = true;
            if (s.videoUrl) {
                try {
                    const url = new URL(s.videoUrl, 'http://localhost');
                    const filePath = url.searchParams.get('path') || s.videoUrl;
                    if (filePath) {
                        fileExists = fs.existsSync(path.resolve(filePath));
                    }
                } catch (e) {
                    fileExists = false;
                }
            } else {
                fileExists = false;
            }
            return {
                ...s,
                videoUrl: `/api/files?storyId=${s.id}`,
                fileExists
            };
        });

        const memberships = await prisma.classMembership.findMany({
            where: { userId: childId, role: 'STUDENT' },
            include: { class: true }
        });
        const classes = memberships.map(m => m.class);

        res.json({ assignments, stories: storiesWithStatus, classes });
    } catch(err) { next(err); }
});

// Link a child to the parent
router.post('/parent/link-child', authenticate, isParent, async (req, res, next) => {
    try {
        const { username, password } = req.body;
        
        // Find the student
        const student = await prisma.user.findUnique({ where: { username } });
        if (!student || student.role !== 'STUDENT') {
            return res.status(400).json({ error: 'Invalid student credentials' });
        }

        // Verify password
        const valid = await bcrypt.compare(password, student.passwordHash);
        if (!valid) {
            return res.status(400).json({ error: 'Invalid student credentials' });
        }

        // Create link
        await prisma.parentChild.upsert({
            where: { parentId_childId: { parentId: req.user.id, childId: student.id } },
            update: {},
            create: { parentId: req.user.id, childId: student.id }
        });

        res.json({ success: true, child: { id: student.id, username: student.username, displayName: student.displayName, avatar: student.avatar } });
    } catch(err) { next(err); }
});

// Parent creates a new child (auto-generates hidden credentials)
router.post('/parent/create-child', authenticate, isParent, async (req, res, next) => {
    try {
        const { displayName, avatar } = req.body;
        if (!displayName || !displayName.trim()) {
            return res.status(400).json({ error: 'Child name is required' });
        }

        // Auto-generate a unique username and a strong random password
        const uniqueSuffix = crypto.randomBytes(4).toString('hex');
        const username = `child_${uniqueSuffix}`;
        const randomPassword = crypto.randomBytes(16).toString('base64url');
        const passwordHash = await bcrypt.hash(randomPassword, 10);

        // Create student and link to parent in a single transaction
        const result = await prisma.$transaction(async (tx) => {
            const student = await tx.user.create({
                data: {
                    username,
                    passwordHash,
                    displayName: displayName.trim(),
                    avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(displayName.trim())}`,
                    role: 'STUDENT'
                }
            });

            await tx.parentChild.create({
                data: { parentId: req.user.id, childId: student.id }
            });

            return student;
        });

        // Return child info only — never expose generated credentials
        res.json({
            success: true,
            child: {
                id: result.id,
                displayName: result.displayName,
                avatar: result.avatar
            }
        });
    } catch(err) { next(err); }
});

module.exports = router;
