const request = require('supertest');
const app = require('../app');
const prisma = require('../utils/prismaClient');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('Onboarding Simplification & Relationship Flow', () => {
    let parentToken;
    let parentUser;
    let teacherToken;
    let teacherUser;
    let testClass;
    let createdChildId;

    beforeAll(async () => {
        // Ensure test parent exists
        const hash = await bcrypt.hash('password123', 10);
        parentUser = await prisma.user.upsert({
            where: { username: 'test_parent_ux' },
            update: {},
            create: {
                username: 'test_parent_ux',
                passwordHash: hash,
                displayName: 'Test Parent UX',
                role: 'PARENT'
            }
        });
        parentToken = jwt.sign(
            { id: parentUser.id, username: parentUser.username, role: parentUser.role },
            process.env.JWT_SECRET || 'eduvision-secret-dev-key',
            { expiresIn: '1h' }
        );

        // Ensure test teacher exists
        teacherUser = await prisma.user.upsert({
            where: { username: 'test_teacher_ux' },
            update: {},
            create: {
                username: 'test_teacher_ux',
                passwordHash: hash,
                displayName: 'Test Teacher UX',
                role: 'TEACHER'
            }
        });
        teacherToken = jwt.sign(
            { id: teacherUser.id, username: teacherUser.username, role: teacherUser.role },
            process.env.JWT_SECRET || 'eduvision-secret-dev-key',
            { expiresIn: '1h' }
        );

        // Ensure teacher owns a test class
        testClass = await prisma.class.create({
            data: { name: 'UX Test Kindergarten' }
        });
        await prisma.classMembership.create({
            data: { userId: teacherUser.id, classId: testClass.id, role: 'TEACHER' }
        });
    });

    afterAll(async () => {
        // Clean up test data
        if (createdChildId) {
            await prisma.parentChild.deleteMany({ where: { childId: createdChildId } });
            await prisma.classMembership.deleteMany({ where: { userId: createdChildId } });
            await prisma.user.delete({ where: { id: createdChildId } }).catch(() => {});
        }
        if (testClass) {
            await prisma.classMembership.deleteMany({ where: { classId: testClass.id } });
            await prisma.class.delete({ where: { id: testClass.id } }).catch(() => {});
        }
        await prisma.user.delete({ where: { id: parentUser.id } }).catch(() => {});
        await prisma.user.delete({ where: { id: teacherUser.id } }).catch(() => {});
        await prisma.$disconnect();
    });

    test('1. Parent creates a child with only name and avatar (no manual credentials)', async () => {
        const res = await request(app)
            .post('/api/portal/parent/create-child')
            .set('Authorization', `Bearer ${parentToken}`)
            .send({
                displayName: 'Maya UX Test',
                avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Maya'
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.child).toBeDefined();
        expect(res.body.child.displayName).toBe('Maya UX Test');
        expect(res.body.child.avatar).toBe('https://api.dicebear.com/7.x/bottts/svg?seed=Maya');
        // Critical: Credentials MUST NOT be exposed
        expect(res.body.child.password).toBeUndefined();
        expect(res.body.child.passwordHash).toBeUndefined();

        createdChildId = res.body.child.id;

        // Verify database state: Student role and ParentChild link
        const dbChild = await prisma.user.findUnique({ where: { id: createdChildId } });
        expect(dbChild).toBeDefined();
        expect(dbChild.role).toBe('STUDENT');
        expect(dbChild.username.startsWith('child_')).toBe(true);

        const link = await prisma.parentChild.findUnique({
            where: { parentId_childId: { parentId: parentUser.id, childId: createdChildId } }
        });
        expect(link).toBeDefined();
    });

    test('2. Parent views their linked children', async () => {
        const res = await request(app)
            .get('/api/portal/parent/children')
            .set('Authorization', `Bearer ${parentToken}`);

        expect(res.status).toBe(200);
        const children = res.body;
        expect(children.some(c => c.id === createdChildId && c.displayName === 'Maya UX Test')).toBe(true);
    });

    test('3. Parent accesses the specific child dashboard', async () => {
        const res = await request(app)
            .get(`/api/portal/parent/children/${createdChildId}/dashboard`)
            .set('Authorization', `Bearer ${parentToken}`);

        expect(res.status).toBe(200);
        expect(res.body.assignments).toBeDefined();
        expect(res.body.stories).toBeDefined();
        expect(res.body.classes).toBeDefined();
    });

    test('4. Security: Another parent cannot view unlinked child dashboard', async () => {
        const anotherToken = jwt.sign(
            { id: 'random-parent-uuid', username: 'other_parent', role: 'PARENT' },
            process.env.JWT_SECRET || 'eduvision-secret-dev-key',
            { expiresIn: '1h' }
        );

        const res = await request(app)
            .get(`/api/portal/parent/children/${createdChildId}/dashboard`)
            .set('Authorization', `Bearer ${anotherToken}`);

        expect(res.status).toBe(403);
    });

    test('5. Teacher views available students and enrolls child in class', async () => {
        // Teacher lists all students
        const listRes = await request(app)
            .get('/api/portal/students')
            .set('Authorization', `Bearer ${teacherToken}`);

        expect(listRes.status).toBe(200);
        const childInList = listRes.body.find(s => s.id === createdChildId);
        expect(childInList).toBeDefined();
        expect(childInList.displayName).toBe('Maya UX Test');

        // Teacher enrolls student in class
        const enrollRes = await request(app)
            .post(`/api/portal/classes/${testClass.id}/members`)
            .set('Authorization', `Bearer ${teacherToken}`)
            .send({ studentId: createdChildId });

        expect(enrollRes.status).toBe(200);
        expect(enrollRes.body.success).toBe(true);

        // Verify roster
        const rosterRes = await request(app)
            .get(`/api/portal/classes/${testClass.id}/roster`)
            .set('Authorization', `Bearer ${teacherToken}`);

        expect(rosterRes.status).toBe(200);
        expect(rosterRes.body.some(s => s.id === createdChildId)).toBe(true);

        // Attempting to enroll student into a second class must be rejected (400)
        const secondClass = await prisma.class.create({
            data: {
                name: 'Second Class Test',
                memberships: { create: { userId: teacherUser.id, role: 'TEACHER' } }
            }
        });

        const duplicateEnrollRes = await request(app)
            .post(`/api/portal/classes/${secondClass.id}/members`)
            .set('Authorization', `Bearer ${teacherToken}`)
            .send({ studentId: createdChildId });

        expect(duplicateEnrollRes.status).toBe(400);
        expect(duplicateEnrollRes.body.error).toContain('already enrolled');

        await prisma.classMembership.deleteMany({ where: { classId: secondClass.id } });
        await prisma.class.delete({ where: { id: secondClass.id } });
    });

    test('6. Student logs in passwordlessly using class and avatar selection', async () => {
        // Public endpoint lists students in class for avatar select
        const publicRes = await request(app)
            .get(`/api/portal/public/classes/${testClass.id}/students`);

        expect(publicRes.status).toBe(200);
        expect(publicRes.body.some(s => s.id === createdChildId && s.displayName === 'Maya UX Test')).toBe(true);

        // Passwordless student login
        const loginRes = await request(app)
            .post('/api/auth/student-login')
            .send({ studentId: createdChildId, classId: testClass.id });

        expect(loginRes.status).toBe(200);
        expect(loginRes.body.token).toBeDefined();
        expect(loginRes.body.user.id).toBe(createdChildId);
        expect(loginRes.body.user.role).toBe('STUDENT');
    });

    test('7. Parent views child enrolled classes and learning activity after enrollment', async () => {
        const res = await request(app)
            .get(`/api/portal/parent/children/${createdChildId}/dashboard`)
            .set('Authorization', `Bearer ${parentToken}`);

        expect(res.status).toBe(200);
        expect(res.body.classes.some(c => c.id === testClass.id)).toBe(true);
    });
});
