const request = require('supertest');
jest.mock('cls-rtracer', () => ({
    expressMiddleware: jest.fn(() => (req, res, next) => next()),
    id: jest.fn(() => 'trace-1234')
}));
const app = require('../app');

describe('EduVision Platform API Tests', () => {
    test('GET /api/health returns 200 OK', async () => {
        const response = await request(app).get('/api/health');
        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('status', 'ok');
    });

    test('GET /api/apps without auth returns 401 Unauthorized', async () => {
        const response = await request(app).get('/api/apps');
        expect(response.statusCode).toBe(401);
    });

    test('GET /api/apps with auth returns apps from DB', async () => {
        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ id: 'user123', role: 'STUDENT' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
        const response = await request(app)
            .get('/api/apps')
            .set('Authorization', `Bearer ${token}`);
        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('apps');
        expect(Array.isArray(response.body.apps)).toBe(true);
    });

    test('Portal API - Teacher creates a class', async () => {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        await prisma.user.upsert({
            where: { id: 'teacher123' },
            update: {},
            create: { id: 'teacher123', username: 'teacher123', passwordHash: 'hash', role: 'TEACHER' }
        });

        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ id: 'teacher123', role: 'TEACHER' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
        const response = await request(app)
            .post('/api/portal/classes')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Science 101' });
        expect(response.statusCode).toBe(200);
        expect(response.body.name).toBe('Science 101');
        expect(response.body.id).toBeDefined();

        await prisma.classMembership.deleteMany({ where: { userId: 'teacher123' } });
        await prisma.class.deleteMany({ where: { name: 'Science 101' } });
        await prisma.user.delete({ where: { id: 'teacher123' } });
        await prisma.$disconnect();
    });

    test('Portal API - Student views assignments', async () => {
        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ id: 'student123', role: 'STUDENT' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
        const response = await request(app)
            .get('/api/portal/assignments')
            .set('Authorization', `Bearer ${token}`);
        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    test('Auth API - Student Passwordless Login', async () => {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        const cls = await prisma.class.create({ data: { name: 'Test Class Login' } });
        const student = await prisma.user.create({ data: { username: 'teststudent_login', passwordHash: 'hash', role: 'STUDENT' } });
        await prisma.classMembership.create({ data: { userId: student.id, classId: cls.id, role: 'STUDENT' } });

        const response = await request(app)
            .post('/api/auth/student-login')
            .send({ studentId: student.id, classId: cls.id });

        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('token');
        expect(response.body.user.role).toBe('STUDENT');

        await prisma.classMembership.deleteMany({ where: { userId: student.id } });
        await prisma.class.deleteMany({ where: { id: cls.id } });
        await prisma.user.delete({ where: { id: student.id } });
        await prisma.$disconnect();
    });

    test('Portal API - Student Story and History Boundaries', async () => {
        const jwt = require('jsonwebtoken');
        const tokenStudent1 = jwt.sign({ id: 'student_a', role: 'STUDENT' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
        
        // 1. Student1 accesses their own history
        let res = await request(app).get('/api/portal/students/student_a/history').set('Authorization', `Bearer ${tokenStudent1}`);
        expect(res.statusCode).toBe(200);

        // 2. Cross-student access denial
        res = await request(app).get('/api/portal/students/student_b/history').set('Authorization', `Bearer ${tokenStudent1}`);
        expect(res.statusCode).toBe(403);

        // 3. Teacher can access anyone's history
        const tokenTeacher = jwt.sign({ id: 'teacher1', role: 'TEACHER' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
        res = await request(app).get('/api/portal/students/student_b/history').set('Authorization', `Bearer ${tokenTeacher}`);
        expect(res.statusCode).toBe(200);
    });
});
