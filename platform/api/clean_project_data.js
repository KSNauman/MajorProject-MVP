const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function cleanData() {
    console.log('=== Cleaning EduVision Project Data for Clean Handover ===');

    // 1. Delete all activity results
    const results = await prisma.activityResult.deleteMany();
    console.log(`Deleted ${results.count} activity results.`);

    // 2. Delete all assignments
    const assignments = await prisma.assignment.deleteMany();
    console.log(`Deleted ${assignments.count} assignments.`);

    // 3. Delete all student stories
    const stories = await prisma.studentStory.deleteMany();
    console.log(`Deleted ${stories.count} student stories.`);

    // 4. Delete all class memberships
    const memberships = await prisma.classMembership.deleteMany();
    console.log(`Deleted ${memberships.count} class memberships.`);

    // 5. Delete all classes
    const classes = await prisma.class.deleteMany();
    console.log(`Deleted ${classes.count} classes.`);

    // 6. Delete all parent-child links
    const parentChild = await prisma.parentChild.deleteMany();
    console.log(`Deleted ${parentChild.count} parent-child links.`);

    // 7. Delete all students and test users
    const students = await prisma.user.deleteMany({
        where: {
            OR: [
                { role: 'STUDENT' },
                { username: { in: ['test_parent_ux', 'test_teacher_ux'] } }
            ]
        }
    });
    console.log(`Deleted ${students.count} test / student user accounts.`);

    // 8. Delete obsolete applications that were removed
    const obsoleteApps = [
        'alphabet-sequencing',
        'animal-sorting',
        'color-sorting',
        'missing-number',
        'math-blaster-sample',
        'vegetables-matching',
        'fruits-matching'
    ];
    const deletedApps = await prisma.application.deleteMany({
        where: { id: { in: obsoleteApps } }
    });
    console.log(`Removed ${deletedApps.count} obsolete application entries.`);

    // 9. Ensure the 8 core active applications exist with proper names and URLs
    const coreApps = [
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

    for (const app of coreApps) {
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
    console.log(`Verified ${coreApps.length} core applications.`);

    // 10. Ensure default clean administrative accounts exist with known passwords
    const defaultPasswordHash = await bcrypt.hash('password123', 10);
    
    await prisma.user.upsert({
        where: { username: 'admin' },
        update: { passwordHash: defaultPasswordHash, role: 'ADMIN', displayName: 'Teacher Admin' },
        create: { username: 'admin', passwordHash: defaultPasswordHash, role: 'ADMIN', displayName: 'Teacher Admin' }
    });

    await prisma.user.upsert({
        where: { username: 'teacher1' },
        update: { passwordHash: defaultPasswordHash, role: 'TEACHER', displayName: 'Teacher Sarah' },
        create: { username: 'teacher1', passwordHash: defaultPasswordHash, role: 'TEACHER', displayName: 'Teacher Sarah' }
    });

    await prisma.user.upsert({
        where: { username: 'parent1' },
        update: { passwordHash: defaultPasswordHash, role: 'PARENT', displayName: 'Parent User' },
        create: { username: 'parent1', passwordHash: defaultPasswordHash, role: 'PARENT', displayName: 'Parent User' }
    });

    console.log('Verified default system accounts (admin, teacher1, parent1 - password: password123).');
    console.log('=== Database cleaning completed successfully! ===');
}

cleanData()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
