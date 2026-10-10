const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');

const prisma = new PrismaClient({
    log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
    ],
});

prisma.$on('query', (e) => {
    // Only log very slow queries as WARN, or log all queries as DEBUG
    if (e.duration > 100) {
        logger.warn(`Slow Query [${e.duration}ms]: ${e.query}`, { component: 'prisma', duration: e.duration });
    } else {
        logger.debug(`Query [${e.duration}ms]: ${e.query}`, { component: 'prisma' });
    }
});

prisma.$on('info', (e) => {
    logger.info(`Prisma Info: ${e.message}`, { component: 'prisma' });
});

prisma.$on('warn', (e) => {
    logger.warn(`Prisma Warn: ${e.message}`, { component: 'prisma' });
});

prisma.$on('error', (e) => {
    logger.error(`Prisma Error: ${e.message}`, { component: 'prisma' });
});

module.exports = prisma;
