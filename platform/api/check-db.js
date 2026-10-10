const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDb() {
    const app = await prisma.application.findUnique({ where: { id: 'story-studio' } });
    console.log(app);
}

checkDb().catch(console.error).finally(() => prisma.$disconnect());
