const winston = require('winston');
const rtracer = require('cls-rtracer');

const customLevels = {
    levels: {
        fatal: 0,
        error: 1,
        warn: 2,
        info: 3,
        debug: 4,
        trace: 5
    },
    colors: {
        fatal: 'red',
        error: 'red',
        warn: 'yellow',
        info: 'green',
        debug: 'blue',
        trace: 'magenta'
    }
};

winston.addColors(customLevels.colors);

const redactSecrets = winston.format((info) => {
    const sensitiveKeys = ['password', 'token', 'authorization', 'secret'];
    const redact = (obj) => {
        for (let key in obj) {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                redact(obj[key]);
            } else if (sensitiveKeys.includes(key.toLowerCase())) {
                obj[key] = '[REDACTED]';
            }
        }
    };
    redact(info);
    return info;
});

const consoleFormat = winston.format.printf((info) => {
    const reqId = rtracer.id();
    const reqIdStr = reqId ? `[ReqID: ${reqId}] ` : '';
    const stackStr = info.stack ? `\n${info.stack}` : '';
    const metadata = {...info};
    delete metadata.level;
    delete metadata.message;
    delete metadata.timestamp;
    delete metadata.stack;
    const metaStr = Object.keys(metadata).length ? `\n${JSON.stringify(metadata, null, 2)}` : '';
    return `${info.timestamp} [${info.level}] ${reqIdStr}${info.message}${metaStr}${stackStr}`;
});

const logger = winston.createLogger({
    levels: customLevels.levels,
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        redactSecrets(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                consoleFormat
            )
        }),
        new winston.transports.File({ filename: 'logs/replica-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/replica-combined.log' })
    ]
});

module.exports = logger;
