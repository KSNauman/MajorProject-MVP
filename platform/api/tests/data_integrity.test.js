const request = require('supertest');
jest.mock('cls-rtracer', () => ({
    expressMiddleware: jest.fn(() => (req, res, next) => next()),
    id: jest.fn(() => 'trace-1234')
}));
const app = require('../app');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PREFIX = 'integrity_';
const sign = (user) => jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
const api = (method, url, token) => request(app)[method](url).set('Authorization', `Bearer ${token}`);

const cleanUp = async () => {
    const users = await prisma.user.findMany({
        where: { OR: [
            { username: { startsWith: PREFIX } },
            { displayName: { startsWith: 'Integrity ' } }
        ] },
        select: { id: true }
    });
    const ids = users.map(u => u.id);
    const classes = await prisma.class.findMany({ where: { name: { startsWith: 'Integrity ' } }, select: { id: true } });
    const classIds = classes.map(c => c.id);
    await prisma.activityResult.deleteMany({ where: { OR: [{ userId: { in: ids } }, { assignment: { classId: { in: classIds } } }] } });
    await prisma.assignment.deleteMany({ where: { classId: { in: classIds } } });
    await prisma.classMembership.deleteMany({ where: { OR: [{ userId: { in: ids } }, { classId: { in: classIds } }] } });
    await prisma.parentChild.deleteMany({ where: { OR: [{ parentId: { in: ids } }, { childId: { in: ids } }] } });
    await prisma.studentStory.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.class.deleteMany({ where: { id: { in: classIds } } });
    await prisma.application.deleteMany({ where: { name: `${PREFIX}app` } });
};

describe('Class scoping and data integrity', () => {
    let teacherA, teacherB, admin, student, classmate, classA, classB, appRow, assignA, assignB;
    let teacherAToken, teacherBToken, adminToken;

    const newUser = (name, role) => prisma.user.create({ data: { username: `${PREFIX}${name}`, passwordHash: 'x', role } });

    beforeAll(async () => {
        await cleanUp();
        teacherA = await newUser('teachera', 'TEACHER');
        teacherB = await newUser('teacherb', 'TEACHER');
        admin = await newUser('admin', 'ADMIN');
        student = await newUser('student', 'STUDENT');
        classmate = await newUser('classmate', 'STUDENT');
        classA = await prisma.class.create({ data: { name: 'Integrity A' } });
        classB = await prisma.class.create({ data: { name: 'Integrity B' } });
        await prisma.classMembership.createMany({ data: [
            { userId: teacherA.id, classId: classA.id, role: 'TEACHER' },
            { userId: teacherB.id, classId: classB.id, role: 'TEACHER' },
            { userId: student.id, classId: classA.id, role: 'STUDENT' },
            { userId: student.id, classId: classB.id, role: 'STUDENT' },
            { userId: classmate.id, classId: classA.id, role: 'STUDENT' }
        ] });
        appRow = await prisma.application.create({ data: { name: `${PREFIX}app`, version: '1', launchUrl: 'http://localhost:5000/x.html' } });
        assignA = await prisma.assignment.create({ data: { title: 'Work A', classId: classA.id, appId: appRow.id } });
        assignB = await prisma.assignment.create({ data: { title: 'Work B', classId: classB.id, appId: appRow.id } });
        teacherAToken = sign(teacherA);
        teacherBToken = sign(teacherB);
        adminToken = sign(admin);
    });

    afterAll(async () => {
        await cleanUp();
        await prisma.$disconnect();
    });

    const studentTokenFor = async (classId, who = student) => {
        const res = await request(app).post('/api/auth/student-login').send({ studentId: who.id, classId });
        expect(res.status).toBe(200);
        return res.body.token;
    };

    test('a student in two classes sees only the class they logged in through', async () => {
        const fromA = await api('get', '/api/portal/assignments', await studentTokenFor(classA.id));
        expect(fromA.body.map(a => a.title)).toEqual(['Work A']);
        expect(fromA.body[0].class.name).toBe('Integrity A');

        const fromB = await api('get', '/api/portal/assignments', await studentTokenFor(classB.id));
        expect(fromB.body.map(a => a.title)).toEqual(['Work B']);
    });

    test('launch is refused for another class, another student or the wrong app', async () => {
        const tokenA = await studentTokenFor(classA.id);
        const launch = (assignmentId, appId, token) => api('post', '/api/integrations/launch', token).send({ appId, assignmentId });

        expect((await launch(assignA.id, appRow.id, tokenA)).status).toBe(200);
        expect((await launch(assignB.id, appRow.id, tokenA)).status).toBe(403);

        const outsider = await studentTokenFor(classA.id, classmate);
        expect((await launch(assignB.id, appRow.id, outsider)).status).toBe(403);

        const other = await prisma.application.findFirst({ where: { id: { not: appRow.id } } })
            || await prisma.application.create({ data: { name: `${PREFIX}app2`, version: '1' } });
        expect((await launch(assignA.id, other.id, tokenA)).status).toBe(403);
        if (other.name === `${PREFIX}app2`) await prisma.application.delete({ where: { id: other.id } });
    });

    test('free play launch without an assignment still works', async () => {
        const res = await api('post', '/api/integrations/launch', await studentTokenFor(classA.id)).send({ appId: appRow.id });
        expect(res.status).toBe(200);
    });

    test('a teacher cannot assign work to another teacher\'s class', async () => {
        const body = { title: 'Sneaky', classId: classB.id, appId: appRow.id };
        expect((await api('post', '/api/portal/assignments', teacherAToken).send(body)).status).toBe(403);
    });

    test('a personal assignment must be for a student in that class', async () => {
        const body = { title: 'Personal', classId: classB.id, appId: appRow.id, assignedToId: classmate.id };
        expect((await api('post', '/api/portal/assignments', teacherBToken).send(body)).status).toBe(400);
    });

    test('assignments can be deleted, only by their class teacher or an admin', async () => {
        const made = await api('post', '/api/portal/assignments', teacherAToken)
            .send({ title: 'To delete', classId: classA.id, appId: appRow.id });
        expect(made.status).toBe(200);
        await prisma.activityResult.create({ data: { assignmentId: made.body.id, userId: student.id, score: 1, status: 'COMPLETED' } });

        expect((await api('delete', `/api/portal/assignments/${made.body.id}`, teacherBToken)).status).toBe(403);
        expect((await api('delete', `/api/portal/assignments/${made.body.id}`, teacherAToken)).status).toBe(200);
        expect(await prisma.assignment.findUnique({ where: { id: made.body.id } })).toBeNull();
        expect(await prisma.activityResult.count({ where: { assignmentId: made.body.id } })).toBe(0);
        expect((await api('delete', `/api/portal/assignments/${made.body.id}`, adminToken)).status).toBe(404);
    });

    test('deleting a student does not turn their personal work into class work', async () => {
        const leaving = await newUser('leaving', 'STUDENT');
        await prisma.classMembership.create({ data: { userId: leaving.id, classId: classA.id, role: 'STUDENT' } });
        const personal = await prisma.assignment.create({
            data: { title: 'Only for leaving', classId: classA.id, appId: appRow.id, assignedToId: leaving.id }
        });

        expect((await api('delete', `/api/admin/students/${leaving.id}`, adminToken)).status).toBe(200);
        expect(await prisma.assignment.findUnique({ where: { id: personal.id } })).toBeNull();
        const seen = await api('get', '/api/portal/assignments', await studentTokenFor(classA.id, classmate));
        expect(seen.body.map(a => a.title)).not.toContain('Only for leaving');
    });

    test('a student removed from a class stops seeing their personal work there', async () => {
        const mover = await newUser('mover', 'STUDENT');
        await prisma.classMembership.create({ data: { userId: mover.id, classId: classA.id, role: 'STUDENT' } });
        await prisma.assignment.create({ data: { title: 'Personal mover', classId: classA.id, appId: appRow.id, assignedToId: mover.id } });
        await prisma.classMembership.delete({ where: { userId_classId: { userId: mover.id, classId: classA.id } } });

        const res = await api('get', '/api/portal/assignments', sign(mover));
        expect(res.body.map(a => a.title)).not.toContain('Personal mover');
    });

    test('same parent name in separate lists makes separate accounts', async () => {
        const row = { studentName: 'Integrity Kid One', parentName: 'Integrity Same Parent' };
        const first = await api('post', '/api/admin/bulk-enroll', adminToken).send({ rows: [row] });
        const second = await api('post', '/api/admin/bulk-enroll', adminToken)
            .send({ rows: [{ ...row, studentName: 'Integrity Kid Two' }] });

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(first.body.records[0].parentId).not.toBe(second.body.records[0].parentId);
    });

    test('same parent name inside one list stays one family', async () => {
        const res = await api('post', '/api/admin/bulk-enroll', adminToken).send({ rows: [
            { studentName: 'Integrity Sib One', parentName: 'Integrity Sibling Parent' },
            { studentName: 'Integrity Sib Two', parentName: 'Integrity Sibling Parent' }
        ] });
        expect(res.status).toBe(200);
        expect(res.body.records[0].parentId).toBe(res.body.records[1].parentId);
        expect(res.body.records[1].parentWasNew).toBe(false);
    });

    test('bulk enrolment with a bad class creates nothing', async () => {
        const res = await api('post', '/api/admin/bulk-enroll', adminToken)
            .send({ rows: [{ studentName: 'Integrity Ghost', parentName: 'Integrity Ghost Parent', classId: 'no-such-class' }] });
        expect(res.status).toBe(400);
        expect(await prisma.user.count({ where: { displayName: { contains: 'Integrity Ghost' } } })).toBe(0);
    });

    test('logging in by a name shared by two accounts is refused', async () => {
        const hash = await require('bcryptjs').hash('password123', 4);
        await prisma.user.createMany({ data: [
            { username: `${PREFIX}twin1`, passwordHash: hash, displayName: 'Integrity Twin', role: 'PARENT' },
            { username: `${PREFIX}twin2`, passwordHash: hash, displayName: 'Integrity Twin', role: 'PARENT' }
        ] });

        const byName = await request(app).post('/api/auth/login').send({ username: 'Integrity Twin', password: 'password123' });
        expect(byName.status).toBe(401);
        expect(byName.body.error).toContain('username');

        const byUsername = await request(app).post('/api/auth/login').send({ username: `${PREFIX}twin1`, password: 'password123' });
        expect(byUsername.status).toBe(200);
    });
});
