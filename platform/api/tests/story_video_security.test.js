const request = require('supertest');
const app = require('../app');
const prisma = require('../utils/prismaClient');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

describe('Story Video Security and Authorization Suite', () => {
    let parent1User, parent1Token;
    let parent2User, parent2Token;
    let studentUser, studentToken;
    let otherStudentUser, otherStudentToken;
    let teacherUser, teacherToken;
    let testStory;
    let testVideoPath;

    beforeAll(async () => {
        const hash = await bcrypt.hash('password123', 10);
        const jwtSecret = process.env.JWT_SECRET || 'eduvision-secret-dev-key';

        // 1. Create Parent 1 (authorized)
        parent1User = await prisma.user.upsert({
            where: { username: 'test_sec_parent_1' },
            update: {},
            create: { username: 'test_sec_parent_1', passwordHash: hash, displayName: 'Parent 1', role: 'PARENT' }
        });
        parent1Token = jwt.sign({ id: parent1User.id, username: parent1User.username, role: 'PARENT' }, jwtSecret, { expiresIn: '1h' });

        // 2. Create Parent 2 (unauthorized)
        parent2User = await prisma.user.upsert({
            where: { username: 'test_sec_parent_2' },
            update: {},
            create: { username: 'test_sec_parent_2', passwordHash: hash, displayName: 'Parent 2', role: 'PARENT' }
        });
        parent2Token = jwt.sign({ id: parent2User.id, username: parent2User.username, role: 'PARENT' }, jwtSecret, { expiresIn: '1h' });

        // 3. Create Student (owner of story)
        studentUser = await prisma.user.upsert({
            where: { username: 'test_sec_student_1' },
            update: {},
            create: { username: 'test_sec_student_1', passwordHash: hash, displayName: 'Student 1', role: 'STUDENT' }
        });
        studentToken = jwt.sign({ id: studentUser.id, username: studentUser.username, role: 'STUDENT' }, jwtSecret, { expiresIn: '1h' });

        // 4. Create Other Student
        otherStudentUser = await prisma.user.upsert({
            where: { username: 'test_sec_student_2' },
            update: {},
            create: { username: 'test_sec_student_2', passwordHash: hash, displayName: 'Student 2', role: 'STUDENT' }
        });
        otherStudentToken = jwt.sign({ id: otherStudentUser.id, username: otherStudentUser.username, role: 'STUDENT' }, jwtSecret, { expiresIn: '1h' });

        // 5. Create Teacher
        teacherUser = await prisma.user.upsert({
            where: { username: 'test_sec_teacher' },
            update: {},
            create: { username: 'test_sec_teacher', passwordHash: hash, displayName: 'Teacher', role: 'TEACHER' }
        });
        teacherToken = jwt.sign({ id: teacherUser.id, username: teacherUser.username, role: 'TEACHER' }, jwtSecret, { expiresIn: '1h' });

        // 6. Link Parent 1 to Student 1
        await prisma.parentChild.upsert({
            where: { parentId_childId: { parentId: parent1User.id, childId: studentUser.id } },
            update: {},
            create: { parentId: parent1User.id, childId: studentUser.id }
        });

        // 7. Ensure test video file exists on disk in story_engine/output
        const outputDir = path.resolve(__dirname, '../../../story_engine/output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        testVideoPath = path.join(outputDir, 'test_security_story_fixture.mp4');
        if (!fs.existsSync(testVideoPath)) {
            // Write a dummy 4KB buffer simulating MP4 payload
            const dummyBuf = Buffer.alloc(4096, 'a');
            fs.writeFileSync(testVideoPath, dummyBuf);
        }

        // 8. Create StudentStory record
        testStory = await prisma.studentStory.create({
            data: {
                userId: studentUser.id,
                title: 'Security Test Story',
                prompt: 'Security verification prompt',
                videoUrl: `/api/files?path=${testVideoPath.replace(/\\/g, '/')}`,
                status: 'COMPLETED'
            }
        });
    });

    afterAll(async () => {
        // Cleanup created story
        if (testStory) {
            await prisma.studentStory.delete({ where: { id: testStory.id } }).catch(() => {});
        }
        // Cleanup ParentChild link
        if (parent1User && studentUser) {
            await prisma.parentChild.deleteMany({ where: { parentId: parent1User.id } }).catch(() => {});
        }
        // Cleanup users
        await prisma.user.deleteMany({
            where: { id: { in: [parent1User.id, parent2User.id, studentUser.id, otherStudentUser.id, teacherUser.id] } }
        }).catch(() => {});
        // Remove test video fixture
        if (testVideoPath && fs.existsSync(testVideoPath)) {
            try { fs.unlinkSync(testVideoPath); } catch (e) {}
        }
        await prisma.$disconnect();
    });

    test('1. Unauthenticated request without token is rejected with 401', async () => {
        const res = await request(app)
            .get(`/api/files?storyId=${testStory.id}`);

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/Unauthorized/i);
    });

    test('2. Request with invalid token is rejected with 401', async () => {
        const res = await request(app)
            .get(`/api/files?storyId=${testStory.id}&token=invalid.jwt.token`);

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/Unauthorized/i);
    });

    test('3. System directory traversal attempts are blocked with 403', async () => {
        const res = await request(app)
            .get('/api/files?path=c:/Windows/System32/drivers/etc/hosts');

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/Forbidden/i);
    });

    test('4. Relative traversal outside sandbox is blocked with 403', async () => {
        const res = await request(app)
            .get('/api/files?path=../../package.json');

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/Forbidden/i);
    });

    test('5. Non-existent story ID returns 404 for authenticated user', async () => {
        const res = await request(app)
            .get('/api/files?storyId=00000000-0000-0000-0000-000000000000')
            .set('Authorization', `Bearer ${parent1Token}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/Not Found/i);
    });

    test('6. Authorized parent can stream linked child story (HTTP 200)', async () => {
        const res = await request(app)
            .get(`/api/files?storyId=${testStory.id}`)
            .set('Authorization', `Bearer ${parent1Token}`);

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/video\/mp4/);
        expect(res.headers['accept-ranges']).toBe('bytes');
        expect(parseInt(res.headers['content-length'])).toBeGreaterThan(0);
    });

    test('7. Authorized parent can stream via URL query token (HTML5 video playback)', async () => {
        const res = await request(app)
            .get(`/api/files?storyId=${testStory.id}&token=${parent1Token}`);

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/video\/mp4/);
        expect(res.headers['accept-ranges']).toBe('bytes');
    });

    test('8. Authorized parent can perform byte-range requests for seeking (HTTP 206)', async () => {
        const res = await request(app)
            .get(`/api/files?storyId=${testStory.id}`)
            .set('Authorization', `Bearer ${parent1Token}`)
            .set('Range', 'bytes=0-1023');

        expect(res.status).toBe(206);
        expect(res.headers['content-range']).toMatch(/^bytes 0-1023\//);
        expect(res.headers['content-length']).toBe('1024');
    });

    test('9. Unauthorized parent (not linked) CANNOT access child story (HTTP 403)', async () => {
        const res = await request(app)
            .get(`/api/files?storyId=${testStory.id}`)
            .set('Authorization', `Bearer ${parent2Token}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/Forbidden/i);
    });

    test('10. Unauthorized parent CANNOT bypass authorization using byte-range requests (HTTP 403)', async () => {
        const res = await request(app)
            .get(`/api/files?storyId=${testStory.id}`)
            .set('Authorization', `Bearer ${parent2Token}`)
            .set('Range', 'bytes=0-1023');

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/Forbidden/i);
    });

    test('11. Unauthorized parent CANNOT access video via path parameter (HTTP 403)', async () => {
        const res = await request(app)
            .get(`/api/files?path=${encodeURIComponent(testVideoPath)}`)
            .set('Authorization', `Bearer ${parent2Token}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/Forbidden/i);
    });

    test('12. Student owner can stream their own story (HTTP 200)', async () => {
        const res = await request(app)
            .get(`/api/files?storyId=${testStory.id}`)
            .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).toBe(200);
    });

    test('13. Other student CANNOT access classmate story (HTTP 403)', async () => {
        const res = await request(app)
            .get(`/api/files?storyId=${testStory.id}`)
            .set('Authorization', `Bearer ${otherStudentToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/Forbidden/i);
    });

    test('14. Teacher can stream student story (HTTP 200)', async () => {
        const res = await request(app)
            .get(`/api/files?storyId=${testStory.id}`)
            .set('Authorization', `Bearer ${teacherToken}`);

        expect(res.status).toBe(200);
    });

    test('15. Parent dashboard endpoint serializes sanitized videoUrl without filesystem path', async () => {
        const res = await request(app)
            .get(`/api/portal/parent/children/${studentUser.id}/dashboard`)
            .set('Authorization', `Bearer ${parent1Token}`);

        expect(res.status).toBe(200);
        expect(res.body.stories).toBeDefined();
        const found = res.body.stories.find(s => s.id === testStory.id);
        expect(found).toBeDefined();
        // Crucial: videoUrl must be opaque and not expose filesystem paths
        expect(found.videoUrl).toBe(`/api/files?storyId=${testStory.id}`);
        expect(found.videoUrl).not.toMatch(/c:\//i);
        expect(found.videoUrl).not.toMatch(/story_engine/i);
        expect(found.fileExists).toBe(true);
    });
});
