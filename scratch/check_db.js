const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const res = await prisma.$queryRawUnsafe('SELECT id, migration_name, finished_at FROM _prisma_migrations ORDER BY started_at ASC');
    console.log(JSON.stringify(res, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
