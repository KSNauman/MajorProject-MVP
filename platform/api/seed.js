const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
    console.log('--- Seeding EduVision Database (Clean Project Baseline) ---');

    // 1. Applications Registry (Story Studio & Core Engine Humanoid apps)
    const applications = [
        {
            id: 'story-studio',
            name: 'Story Studio',
            version: '1.0.0',
            launchUrl: 'http://localhost:3001/',
            isReady: true
        },
        {
            id: 'color-filling',
            name: 'Humanoid Color & Animate Studio',
            version: '1.0.0',
            launchUrl: 'http://localhost:5000/activities/color-filling.html',
            isReady: true
        },
        {
            id: 'color-matcher',
            name: 'Humanoid Color Matcher',
            version: '1.0.0',
            launchUrl: 'http://localhost:5000/activities/color-matcher.html',
            isReady: true
        },
        {
            id: 'shape-spotter',
            name: 'Humanoid Spotter Detective',
            version: '1.0.0',
            launchUrl: 'http://localhost:5000/activities/shape-spotter.html',
            isReady: true
        },
        {
            id: 'objects-counting',
            name: 'Humanoid Count & Play',
            version: '1.0.0',
            launchUrl: 'http://localhost:5000/activities/objects-counting.html',
            isReady: true
        },
        {
            id: 'puzzle-builder',
            name: 'Humanoid Jigsaw Puzzle',
            version: '1.0.0',
            launchUrl: 'http://localhost:5000/activities/puzzle-builder.html',
            isReady: true
        },
        {
            id: 'number-sequencing',
            name: 'Humanoid Train Builder',
            version: '1.0.0',
            launchUrl: 'http://localhost:5000/activities/number-sequencing.html',
            isReady: true
        }
    ];

    for (const app of applications) {
        await prisma.application.upsert({
            where: { id: app.id },
            update: {
                name: app.name,
                version: app.version,
                launchUrl: app.launchUrl,
                isReady: app.isReady
            },
            create: app
        });
    }
    console.log(`Registered ${applications.length} applications.`);

    // 2. Base Administrative / Teacher / Parent User Accounts
    const defaultPasswordHash = await bcrypt.hash('password123', 10);
    
    await prisma.user.upsert({
        where: { username: 'admin' },
        update: { passwordHash: defaultPasswordHash, role: 'ADMIN', displayName: 'Teacher Admin' },
        create: {
            username: 'admin',
            displayName: 'Teacher Admin',
            passwordHash: defaultPasswordHash,
            role: 'ADMIN'
        }
    });

    await prisma.user.upsert({
        where: { username: 'teacher1' },
        update: { passwordHash: defaultPasswordHash, role: 'TEACHER', displayName: 'Teacher Sarah' },
        create: {
            username: 'teacher1',
            displayName: 'Teacher Sarah',
            passwordHash: defaultPasswordHash,
            role: 'TEACHER'
        }
    });

    await prisma.user.upsert({
        where: { username: 'parent1' },
        update: { passwordHash: defaultPasswordHash, role: 'PARENT', displayName: 'Parent User' },
        create: {
            username: 'parent1',
            displayName: 'Parent User',
            passwordHash: defaultPasswordHash,
            role: 'PARENT'
        }
    });

    console.log('Seeded standard accounts: admin, teacher1, parent1 (password: password123)');
    console.log('Database initialized in clean state ready for classes and students!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
