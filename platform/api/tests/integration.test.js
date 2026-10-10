const request = require('supertest');
jest.mock('cls-rtracer', () => ({
    expressMiddleware: jest.fn(() => (req, res, next) => next()),
    id: jest.fn(() => 'trace-1234')
}));
const app = require('../app');
const jwt = require('jsonwebtoken');

describe('EduVision Integration Contract Tests', () => {
    
    let userToken;
    let appToken;
    let prisma;

    beforeAll(async () => {
        const { PrismaClient } = require('@prisma/client');
        prisma = new PrismaClient();

        // Seed data for tests
        await prisma.user.upsert({
            where: { id: 'user123' },
            update: {},
            create: { id: 'user123', username: 'testuser123', passwordHash: 'hash' }
        });
        await prisma.application.upsert({
            where: { id: 'test-app' },
            update: {},
            create: { id: 'test-app', name: 'Test App', version: '1.0' }
        });
        await prisma.class.upsert({
            where: { id: 'class-1' },
            update: {},
            create: { id: 'class-1', name: 'Test Class' }
        });
        await prisma.assignment.upsert({
            where: { id: 'assign-1' },
            update: {},
            create: { id: 'assign-1', title: 'Test Assignment', classId: 'class-1', appId: 'test-app' }
        });

        // Mock a user token for the launch request
        userToken = jwt.sign({ id: 'user123', role: 'STUDENT' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
        
        // Mock an app-specific token for reporting results
        appToken = jwt.sign({ userId: 'user123', role: 'STUDENT', appId: 'test-app', assignmentId: 'assign-1' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
    });

    afterAll(async () => {
        // Clean up all seeded records
        await prisma.activityResult.deleteMany({ where: { assignmentId: 'assign-1' } });
        await prisma.assignment.delete({ where: { id: 'assign-1' } }).catch(() => {});
        await prisma.class.delete({ where: { id: 'class-1' } }).catch(() => {});
        await prisma.application.delete({ where: { id: 'test-app' } }).catch(() => {});
        await prisma.user.delete({ where: { id: 'user123' } }).catch(() => {});
        await prisma.$disconnect();
    });

    test('POST /api/integrations/launch generates valid app launch URL', async () => {
        const response = await request(app)
            .post('/api/integrations/launch')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ appId: 'test-app', assignmentId: 'assign-1' });
        
        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('launchUrl');
        expect(response.body.launchUrl).toContain('token=');
        expect(response.body.launchUrl).toContain('assignmentId=assign-1');
    });

    test('POST /api/integrations/launch rejects unknown apps', async () => {
        const response = await request(app)
            .post('/api/integrations/launch')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ appId: 'fake-app-123', assignmentId: 'assign-1' });
        
        expect(response.statusCode).toBe(404);
        expect(response.body.error).toContain('not found');
    });

    test('POST /api/integrations/results accepts valid app token and persists to DB', async () => {
        const response = await request(app)
            .post('/api/integrations/results')
            .set('Authorization', `Bearer ${appToken}`)
            .send({ assignmentId: 'assign-1', score: 95, status: 'COMPLETED' });
        
        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);

        // Verify it was actually written to the DB
        const result = await prisma.activityResult.findFirst({
            where: { assignmentId: 'assign-1', userId: 'user123' }
        });
        expect(result).not.toBeNull();
        expect(result.score).toBe(95);
        expect(result.status).toBe('COMPLETED');
    });

    test('POST /api/integrations/results rejects normal user token (missing appId)', async () => {
        const response = await request(app)
            .post('/api/integrations/results')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ assignmentId: 'assign-1', score: 95, status: 'COMPLETED' });
        
        expect(response.statusCode).toBe(403);
    });

    test('POST /api/integrations/results rejects mismatched assignmentId (forgery attempt)', async () => {
        const response = await request(app)
            .post('/api/integrations/results')
            .set('Authorization', `Bearer ${appToken}`)
            .send({ assignmentId: 'assign-2-hacked', score: 100, status: 'COMPLETED' });
        
        expect(response.statusCode).toBe(403);
        expect(response.body.error).toContain('mismatch');
    });

    test('POST /api/integrations/results rejects submissions if token lacks assignment context', async () => {
        const noAssignmentToken = jwt.sign({ userId: 'user123', role: 'STUDENT', appId: 'test-app', assignmentId: null }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
        const response = await request(app)
            .post('/api/integrations/results')
            .set('Authorization', `Bearer ${noAssignmentToken}`)
            .send({ assignmentId: 'assign-1', score: 100, status: 'COMPLETED' });
        
        expect(response.statusCode).toBe(403);
        expect(response.body.error).toContain('missing assignment context');
    });
});
