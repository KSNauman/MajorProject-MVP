const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
    // Write: Create Story Studio
    const app = await prisma.application.upsert({
        where: { id: 'story-studio' },
        update: {},
        create: {
            id: 'story-studio',
            name: 'Story Studio',
            version: '1.0.0',
            launchUrl: 'http://localhost:3001/'
        }
    });
    console.log('Created App:', app);

    // Write: Create Math Blaster Sample
    const mathApp = await prisma.application.upsert({
        where: { id: 'math-blaster-sample' },
        update: {},
        create: {
            id: 'math-blaster-sample',
            name: 'Math Blaster Sample',
            version: '1.0.0',
            launchUrl: 'http://localhost:5000/index.html',
            isReady: false
        }
    });
    console.log('Created App:', mathApp);

    // Write: Create a user
    const hash = await bcrypt.hash('password123', 10);
    const user = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            passwordHash: hash,
            role: 'ADMIN'
        }
    });
    console.log('Created User:', user);

    const student = await prisma.user.upsert({
        where: { username: 'student1' },
        update: {
            displayName: 'Alice',
            avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alice'
        },
        create: {
            username: 'student1',
            passwordHash: hash,
            displayName: 'Alice',
            avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alice',
            role: 'STUDENT'
        }
    });
    console.log('Created Student:', student);

    const student2 = await prisma.user.upsert({
        where: { username: 'student2' },
        update: {
            displayName: 'Bobby',
            avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bobby'
        },
        create: {
            username: 'student2',
            passwordHash: hash,
            displayName: 'Bobby',
            avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bobby',
            role: 'STUDENT'
        }
    });

    const testClass = await prisma.class.create({
        data: {
            name: 'Kindergarten Yellow'
        }
    });

    await prisma.classMembership.createMany({
        data: [
            { userId: user.id, classId: testClass.id, role: 'TEACHER' },
            { userId: student.id, classId: testClass.id, role: 'STUDENT' },
            { userId: student2.id, classId: testClass.id, role: 'STUDENT' }
        ]
    });
    console.log('Created Class and Memberships:', testClass);

    // Read: Fetch all apps
    const allApps = await prisma.application.findMany();
    console.log('All Apps:', allApps);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
