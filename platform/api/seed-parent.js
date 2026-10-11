const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
    const hash = await bcrypt.hash('password123', 10);
    
    // Write: Create Parent user
    const parent = await prisma.user.upsert({
        where: { username: 'parent1' },
        update: {},
        create: {
            username: 'parent1',
            passwordHash: hash,
            displayName: 'Mr. Parent',
            role: 'PARENT'
        }
    });
    console.log('Created Parent:', parent);

    const student1 = await prisma.user.findUnique({ where: { username: 'student1' } });
    const student2 = await prisma.user.findUnique({ where: { username: 'student2' } });

    if (student1) {
        await prisma.parentChild.upsert({
            where: { parentId_childId: { parentId: parent.id, childId: student1.id } },
            update: {},
            create: { parentId: parent.id, childId: student1.id }
        });
        console.log('Linked parent to student1');
    }
    
    if (student2) {
        await prisma.parentChild.upsert({
            where: { parentId_childId: { parentId: parent.id, childId: student2.id } },
            update: {},
            create: { parentId: parent.id, childId: student2.id }
        });
        console.log('Linked parent to student2');
    }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
