const logger = require('./logger');
const rtracer = require('cls-rtracer');

// HTTP Request Logger
const requestLogger = (req, res, next) => {
    const reqId = rtracer.id();
    if (reqId) res.setHeader('X-Correlation-Id', reqId);
    const start = process.hrtime();
    res.on('finish', () => {
        const diff = process.hrtime(start);
        const duration = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
        
        const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
        
        logger.log({
            level: logLevel,
            message: `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`,
            http: {
                method: req.method,
                url: req.originalUrl,
                status: res.statusCode,
                durationMs: parseFloat(duration),
                userAgent: req.get('user-agent'),
                ip: req.ip
            }
        });
    });
    next();
};

// Error Handler
const errorHandler = (err, req, res, next) => {
    const reqId = rtracer.id();
    logger.error(`Unhandled Exception: ${err.message}`, {
        error: {
            name: err.name,
            message: err.message,
            stack: err.stack,
            code: err.code
        },
        path: req.originalUrl,
        method: req.method
    });

    const statusCode = err.status || 500;
    const safeMessage = statusCode === 500 ? 'Internal Server Error' : err.message;

    res.status(statusCode).json({
        success: false,
        error: safeMessage,
        code: err.code || 'INTERNAL_ERROR',
        requestId: reqId
    });
};

module.exports = {
    requestLogger,
    errorHandler
};
