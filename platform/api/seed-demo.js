// Replaces all classroom data with a clean set of sample data for demonstrations.
// Applications are kept. Refuses to run against anything but a local database.
// Usage: node seed-demo.js   (all staff/parent passwords: password123)
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const STORY_VIDEO = path.resolve(__dirname, '../../story_engine/output/rahims_story_1793201600.mp4');
const STORY_TITLE = "Rahim's Family";
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);
const avatarFor = (name) => `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;
const usernameFor = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

// parent: [display name, username]; siblings share one parent.
const FAMILIES = {
    sharma: ['Priya Sharma', 'parent1'],
    patel: ['Deepak Patel', 'parent_deepakpatel'],
    reddy: ['Lakshmi Reddy', 'parent_lakshmireddy'],
    nair: ['Suresh Nair', 'parent_sureshnair'],
    khan: ['Imran Khan', 'parent_imrankhan'],
    joshi: ['Neha Joshi', 'parent_nehajoshi'],
    gowda: ['Manoj Gowda', 'parent_manojgowda'],
    iyer: ['Kavya Iyer', 'parent_kavyaiyer'],
    das: ['Amit Das', 'parent_amitdas'],
    ahmed: ['Farah Ahmed', 'parent_farahahmed'],
    hegde: ['Ganesh Hegde', 'parent_ganeshhegde'],
};

// Scores line up with the class's assignments below; null = not done yet, left open for a live demo.
const CLASSES = [
    {
        name: 'Kindergarten Sunflower',
        teacher: ['Mrs. Anita Rao', 'teacher1'],
        assignments: [
            ['Colour and Animate Your Friend', 'color-filling', 12],
            ['Match the Colours', 'color-matcher', 9],
            ['Count the Friends', 'objects-counting', 6],
            ["Make Rahim's Family Story", 'story-studio', 4],
            ['Build the Number Train', 'number-sequencing', 2],
        ],
        students: [
            ['Aarav Sharma', 'sharma', [100, 90, 100, 100, null]],
            ['Ananya Patel', 'patel', [100, 100, 80, 100, null]],
            ['Vihaan Reddy', 'reddy', [90, 80, 90, null, null]],
            ['Ishita Nair', 'nair', [100, 90, null, null, null]],
            ['Kabir Khan', 'khan', [80, 100, 70, null, null]],
            ['Meera Joshi', 'joshi', [90, null, null, null, null]],
        ],
    },
    {
        name: 'Kindergarten Rainbow',
        teacher: ['Mr. Karthik Menon', 'teacher2'],
        assignments: [
            ['Find the Hidden Friend', 'shape-spotter', 11],
            ['Jigsaw Puzzle Time', 'puzzle-builder', 8],
            ['Count the Friends', 'objects-counting', 5],
            ["Make Rahim's Family Story", 'story-studio', 3],
            ['Match the Colours', 'color-matcher', 1],
        ],
        students: [
            ['Diya Sharma', 'sharma', [90, 100, 90, 100, null]],
            ['Arjun Gowda', 'gowda', [100, 80, 100, 100, null]],
            ['Saanvi Iyer', 'iyer', [100, 100, 90, null, null]],
            ['Rohan Das', 'das', [70, 90, null, null, null]],
            ['Zoya Ahmed', 'ahmed', [90, 90, 80, null, null]],
            ['Tara Hegde', 'hegde', [80, null, null, null, null]],
        ],
    },
];

async function main() {
    const { hostname } = new URL(process.env.DATABASE_URL);
    if (!['localhost', '127.0.0.1'].includes(hostname)) {
        throw new Error(`Refusing to replace data on non-local database host: ${hostname}`);
    }
    if (!fs.existsSync(STORY_VIDEO)) {
        throw new Error(`Sample story video not found: ${STORY_VIDEO}`);
    }

    const passwordHash = await bcrypt.hash('password123', 10);
    const videoUrl = `/api/files?path=${STORY_VIDEO.replace(/\\/g, '/')}`;

    await prisma.$transaction(async (tx) => {
        await tx.activityResult.deleteMany();
        await tx.assignment.deleteMany();
        await tx.studentStory.deleteMany();
        await tx.classMembership.deleteMany();
        await tx.class.deleteMany();
        await tx.parentChild.deleteMany();
        await tx.user.deleteMany();

        await tx.user.create({
            data: { username: 'admin', displayName: 'School Admin', passwordHash, role: 'ADMIN' },
        });

        const parents = {};
        for (const [key, [displayName, username]] of Object.entries(FAMILIES)) {
            parents[key] = await tx.user.create({ data: { username, displayName, passwordHash, role: 'PARENT' } });
        }

        for (const cls of CLASSES) {
            const classRow = await tx.class.create({ data: { name: cls.name, createdAt: daysAgo(21) } });
            const [teacherName, teacherUsername] = cls.teacher;
            const teacher = await tx.user.create({
                data: { username: teacherUsername, displayName: teacherName, passwordHash, role: 'TEACHER' },
            });
            await tx.classMembership.create({ data: { userId: teacher.id, classId: classRow.id, role: 'TEACHER' } });

            const assignments = [];
            for (const [title, appId, ageDays] of cls.assignments) {
                assignments.push(await tx.assignment.create({
                    data: {
                        title,
                        appId,
                        classId: classRow.id,
                        createdAt: daysAgo(ageDays),
                        dueDate: new Date(Date.now() + (7 - ageDays) * DAY),
                    },
                }));
            }

            for (const [displayName, family, scores] of cls.students) {
                const student = await tx.user.create({
                    data: {
                        username: usernameFor(displayName),
                        displayName,
                        avatar: avatarFor(displayName),
                        passwordHash,
                        role: 'STUDENT',
                    },
                });
                await tx.classMembership.create({ data: { userId: student.id, classId: classRow.id, role: 'STUDENT' } });
                await tx.parentChild.create({ data: { parentId: parents[family].id, childId: student.id } });

                for (let i = 0; i < scores.length; i++) {
                    if (scores[i] === null) continue;
                    const assignment = assignments[i];
                    const doneAt = new Date(assignment.createdAt.getTime() + DAY);
                    const isStory = assignment.appId === 'story-studio';
                    await tx.activityResult.create({
                        data: {
                            assignmentId: assignment.id,
                            userId: student.id,
                            score: scores[i],
                            status: 'COMPLETED',
                            details: isStory ? { videoUrl, storyTitle: STORY_TITLE } : {},
                            createdAt: doneAt,
                        },
                    });
                    if (isStory) {
                        await tx.studentStory.create({
                            data: {
                                userId: student.id,
                                title: STORY_TITLE,
                                prompt: "Rahim's family story",
                                videoUrl,
                                status: 'COMPLETED',
                                createdAt: doneAt,
                            },
                        });
                    }
                }
            }
        }
    }, { timeout: 60000 });

    for (const model of ['user', 'class', 'classMembership', 'parentChild', 'application', 'assignment', 'activityResult', 'studentStory']) {
        console.log(`${model}: ${await prisma[model].count()}`);
    }
    console.log('Logins: admin, teacher1, teacher2, parent1 (password: password123)');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
