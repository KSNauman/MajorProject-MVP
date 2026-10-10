const logger = require('./logger');
const rtracer = require('cls-rtracer');

const requestLogger = (req, res, next) => {
    const start = process.hrtime();
    res.on('finish', () => {
        const diff = process.hrtime(start);
        const duration = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
        const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
        
        logger.log({
            level: logLevel,
            message: `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`,
            http: { method: req.method, url: req.originalUrl, status: res.statusCode, durationMs: parseFloat(duration) }
        });
    });
    next();
};

const errorHandler = (err, req, res, next) => {
    const reqId = rtracer.id();
    logger.error(`Unhandled Exception: ${err.message}`, { error: err });
    res.status(500).json({ error: 'Internal Server Error', requestId: reqId });
};

module.exports = { requestLogger, errorHandler };
