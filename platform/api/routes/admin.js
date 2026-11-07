const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticate } = require('../middleware/auth');
const prisma = require('../utils/prismaClient');
const { uniqueUsername } = require('../utils/assignmentAccess');

// Ensure only ADMIN can access these routes
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden. Admin privileges required.' });
    }
    next();
};

router.use(authenticate, isAdmin);

// 1. Dashboard Overview Stats
router.get('/overview', async (req, res, next) => {
    try {
        const [studentCount, parentCount, teacherCount, classCount] = await Promise.all([
            prisma.user.count({ where: { role: 'STUDENT' } }),
            prisma.user.count({ where: { role: 'PARENT' } }),
            prisma.user.count({ where: { role: 'TEACHER' } }),
            prisma.class.count()
        ]);
        res.json({ studentCount, parentCount, teacherCount, classCount });
    } catch(err) { next(err); }
});

// 2. Get All Students with Parents and Classes
router.get('/students', async (req, res, next) => {
    try {
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
                createdAt: true,
                parents: {
                    include: {
                        parent: {
                            select: { id: true, username: true, displayName: true }
                        }
                    }
                },
                memberships: {
                    where: { role: 'STUDENT' },
                    include: {
                        class: { select: { id: true, name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(students.map(s => ({
            id: s.id,
            username: s.username,
            displayName: s.displayName,
            avatar: s.avatar,
            createdAt: s.createdAt,
            parents: s.parents.map(p => p.parent),
            classes: s.memberships.map(m => m.class)
        })));
    } catch(err) { next(err); }
});

// 3. Delete Student (Full Cascade)
router.delete('/students/:id', async (req, res, next) => {
    try {
        const studentId = req.params.id;

        const student = await prisma.user.findUnique({
            where: { id: studentId }
        });
        if (!student || student.role !== 'STUDENT') {
            return res.status(404).json({ error: 'Student not found' });
        }

        await prisma.$transaction(async (tx) => {
            // Delete activity results
            await tx.activityResult.deleteMany({ where: { userId: studentId } });
            // Delete student stories
            await tx.studentStory.deleteMany({ where: { userId: studentId } });
            // Delete class memberships
            await tx.classMembership.deleteMany({ where: { userId: studentId } });
            // Delete parent-child links
            await tx.parentChild.deleteMany({ where: { childId: studentId } });
            // Personal assignments end with the student; clearing assignedToId
            // would turn them into whole-class work
            await tx.activityResult.deleteMany({ where: { assignment: { assignedToId: studentId } } });
            await tx.assignment.deleteMany({ where: { assignedToId: studentId } });
            // Delete the student user
            await tx.user.delete({ where: { id: studentId } });
        });

        res.json({ success: true, message: `Student "${student.displayName || student.username}" deleted successfully.` });
    } catch(err) { next(err); }
});

// 4. Get All Parents with Linked Children
router.get('/parents', async (req, res, next) => {
    try {
        const parents = await prisma.user.findMany({
            where: { role: 'PARENT' },
            select: {
                id: true,
                username: true,
                displayName: true,
                createdAt: true,
                children: {
                    include: {
                        child: {
                            select: { id: true, username: true, displayName: true, avatar: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(parents.map(p => ({
            id: p.id,
            username: p.username,
            displayName: p.displayName,
            createdAt: p.createdAt,
            children: p.children.map(c => c.child)
        })));
    } catch(err) { next(err); }
});

// 5. Delete Parent
router.delete('/parents/:id', async (req, res, next) => {
    try {
        const parentId = req.params.id;
        const parent = await prisma.user.findUnique({ where: { id: parentId } });
        if (!parent || parent.role !== 'PARENT') {
            return res.status(404).json({ error: 'Parent not found' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.parentChild.deleteMany({ where: { parentId } });
            await tx.user.delete({ where: { id: parentId } });
        });

        res.json({ success: true, message: `Parent "${parent.displayName || parent.username}" deleted.` });
    } catch(err) { next(err); }
});

// 6. Bulk Enroll Students & Parents (Zero-Burden for Admin)
router.post('/bulk-enroll', async (req, res, next) => {
    try {
        const { rows } = req.body; // array of { studentName, parentName, optionalClassId }
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ error: 'Provide a list of student records to enroll' });
        }

        const classIds = [...new Set(rows.map(r => r.classId).filter(Boolean))];
        const knownClasses = await prisma.class.count({ where: { id: { in: classIds } } });
        if (knownClasses !== classIds.length) {
            return res.status(400).json({ error: 'Selected class was not found. Nobody was enrolled.' });
        }

        const defaultPasswordHash = await bcrypt.hash('password123', 10);

        // All-or-nothing: one bad row must not leave half of a list enrolled
        const results = await prisma.$transaction(async (tx) => {
            const records = [];
            // Same parent name in one list means siblings. Names from earlier lists are
            // never matched, because two families can share a name.
            const parentsInThisList = new Map();

            for (const row of rows) {
                const rawStudentName = (row.studentName || '').trim();
                if (!rawStudentName) continue;

                const baseStudentUser = rawStudentName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'student';
                const studentUsername = await uniqueUsername(tx, `${baseStudentUser}_${Math.floor(Math.random() * 899 + 100)}`);
                const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(rawStudentName)}`;

                const rawParentName = (row.parentName || '').trim() || `Parent of ${rawStudentName}`;
                const parentKey = rawParentName.toLowerCase();
                let parentUser = parentsInThisList.get(parentKey);
                const parentCreated = !parentUser;

                if (!parentUser) {
                    const baseParentUser = rawParentName.toLowerCase().replace(/[^a-z0-9]/g, '') || baseStudentUser;
                    parentUser = await tx.user.create({
                        data: {
                            username: await uniqueUsername(tx, `parent_${baseParentUser}`),
                            passwordHash: defaultPasswordHash,
                            displayName: rawParentName,
                            role: 'PARENT'
                        }
                    });
                    parentsInThisList.set(parentKey, parentUser);
                }

                const student = await tx.user.create({
                    data: {
                        username: studentUsername,
                        passwordHash: defaultPasswordHash,
                        displayName: rawStudentName,
                        avatar,
                        role: 'STUDENT'
                    }
                });

                await tx.parentChild.create({
                    data: { parentId: parentUser.id, childId: student.id }
                });

                if (row.classId) {
                    await tx.classMembership.create({
                        data: { userId: student.id, classId: row.classId, role: 'STUDENT' }
                    });
                }

                records.push({
                    studentId: student.id,
                    studentName: student.displayName,
                    studentUsername: student.username,
                    studentPassword: 'password123',
                    parentId: parentUser.id,
                    parentName: parentUser.displayName,
                    parentUsername: parentUser.username,
                    parentPassword: 'password123',
                    parentWasNew: parentCreated
                });
            }
            return records;
        }, { timeout: 30000 });

        res.json({
            success: true,
            enrolledCount: results.length,
            records: results
        });
    } catch(err) { next(err); }
});

// 7. Link Parent & Child
router.post('/link-parent-child', async (req, res, next) => {
    try {
        const { parentId, childId } = req.body;
        if (!parentId || !childId) {
            return res.status(400).json({ error: 'parentId and childId are required' });
        }

        const link = await prisma.parentChild.upsert({
            where: { parentId_childId: { parentId, childId } },
            update: {},
            create: { parentId, childId }
        });

        res.json({ success: true, link });
    } catch(err) { next(err); }
});

// 8. Unlink Parent & Child
router.delete('/unlink-parent-child/:parentId/:childId', async (req, res, next) => {
    try {
        const { parentId, childId } = req.params;
        await prisma.parentChild.delete({
            where: { parentId_childId: { parentId, childId } }
        });
        res.json({ success: true });
    } catch(err) { next(err); }
});

// 9. Get All Classes (Admin View)
router.get('/classes', async (req, res, next) => {
    try {
        const classes = await prisma.class.findMany({
            include: {
                memberships: {
                    include: {
                        user: { select: { id: true, username: true, displayName: true, role: true } }
                    }
                },
                assignments: {
                    select: { id: true, title: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(classes.map(c => ({
            id: c.id,
            name: c.name,
            createdAt: c.createdAt,
            teachers: c.memberships.filter(m => m.role === 'TEACHER').map(m => m.user),
            studentCount: c.memberships.filter(m => m.role === 'STUDENT').length,
            assignmentCount: c.assignments.length
        })));
    } catch(err) { next(err); }
});

// 10. Delete Class (Admin full cascade)
router.delete('/classes/:id', async (req, res, next) => {
    try {
        const classId = req.params.id;
        const cls = await prisma.class.findUnique({ where: { id: classId } });
        if (!cls) return res.status(404).json({ error: 'Class not found' });

        await prisma.$transaction(async (tx) => {
            const assignments = await tx.assignment.findMany({ where: { classId }, select: { id: true } });
            const assignIds = assignments.map(a => a.id);
            if (assignIds.length > 0) {
                await tx.activityResult.deleteMany({ where: { assignmentId: { in: assignIds } } });
                await tx.assignment.deleteMany({ where: { classId } });
            }
            await tx.classMembership.deleteMany({ where: { classId } });
            await tx.class.delete({ where: { id: classId } });
        });

        res.json({ success: true, message: `Class "${cls.name}" deleted.` });
    } catch(err) { next(err); }
});

module.exports = router;

