const request = require('supertest');
jest.mock('cls-rtracer', () => ({
    expressMiddleware: jest.fn(() => (req, res, next) => next()),
    id: jest.fn(() => 'trace-1234')
}));
const app = require('../app');
const logger = require('../utils/logger');
const rtracer = require('cls-rtracer');

// Mock logger to inspect what gets logged
jest.mock('../utils/logger', () => ({
    log: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    fatal: jest.fn()
}));

describe('Logging & Correlation Scenarios', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('1 & 13. Successful API request with Request ID', async () => {
        const res = await request(app)
            .get('/api/portal/public/classes')
            .set('X-Correlation-Id', 'trace-1234');
        
        expect(res.status).toBe(200);
        // The logger should have recorded the request and duration
        expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
            level: 'info',
            http: expect.objectContaining({
                method: 'GET',
                status: 200,
                url: '/api/portal/public/classes'
            })
        }));
    });

    test('2. Invalid login and unauthorized access', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'fake', password: 'wrong' });
            
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid credentials');
        expect(res.headers['x-correlation-id']).toBeDefined(); // Request ID should be returned to client
        
        expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
            level: 'warn',
            http: expect.objectContaining({ status: 401 })
        }));
    });

    test('3. Nonexistent resource returns 404 with standard format', async () => {
        const res = await request(app).get('/api/invalid-endpoint-abc');
        expect(res.status).toBe(404);
        
        expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
            level: 'warn',
            http: expect.objectContaining({ status: 404 })
        }));
    });

    test('9 & 10. Unexpected exception produces stack trace and safe error', async () => {
        const prisma = require('../utils/prismaClient');
        jest.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(new Error("Simulated Database Crash"));
        
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'fake', password: 'wrong' });
            
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Internal Server Error'); 
        expect(res.body.requestId).toBeDefined(); // Useful request ID
        
        // Assert logger captured the stack trace
        expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Unhandled Exception: Simulated Database Crash'),
            expect.objectContaining({
                error: expect.objectContaining({ stack: expect.any(String) })
            })
        );
    });
});
