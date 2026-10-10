const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
    logger.info(`EduVision Platform API listening on port ${PORT}`, { component: 'server', env: process.env.NODE_ENV });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.fatal(`Uncaught Exception: ${err.message}`, { error: err });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection: ${reason}`, { reason });
});
