const { PrismaClient } = require('./platform/api/node_modules/@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
    const hash = await bcrypt.hash('password123', 10);
    
    // 1. Create Teacher
    const teacher = await prisma.user.upsert({
        where: { username: 'teacher99' },
        update: {},
        create: { username: 'teacher99', passwordHash: hash, displayName: 'Mr. T', role: 'TEACHER' }
    });

    // 2. Create Class and Teacher Membership
    const cls = await prisma.class.create({ data: { name: 'Math 101' } });
    await prisma.classMembership.create({ data: { userId: teacher.id, classId: cls.id, role: 'TEACHER' } });

    // 3. Create Student
    const student = await prisma.user.upsert({
        where: { username: 'student99' },
        update: {},
        create: { username: 'student99', passwordHash: hash, displayName: 'Timmy', role: 'STUDENT' }
    });

    // 4. Create Parent
    const parent = await prisma.user.upsert({
        where: { username: 'parent99' },
        update: {},
        create: { username: 'parent99', passwordHash: hash, displayName: 'Mrs. P', role: 'PARENT' }
    });

    console.log('Seed done.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
