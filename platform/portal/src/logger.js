import { v4 as uuidv4 } from 'uuid';

class FrontendLogger {
    constructor() {
        this.correlationId = uuidv4();
    }

    getCorrelationId() {
        return this.correlationId;
    }

    newCorrelationId() {
        this.correlationId = uuidv4();
    }

    log(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        if (level === 'ERROR' || level === 'FATAL') {
            console.error(`[${level}] ${timestamp} [ReqID: ${this.getCorrelationId()}] ${message}`, meta);
        } else if (level === 'WARN') {
            console.warn(`[${level}] ${timestamp} [ReqID: ${this.getCorrelationId()}] ${message}`, meta);
        } else if (level === 'DEBUG' || level === 'TRACE') {
            console.debug(`[${level}] ${timestamp} [ReqID: ${this.getCorrelationId()}] ${message}`, meta);
        } else {
            console.log(`[${level}] ${timestamp} [ReqID: ${this.getCorrelationId()}] ${message}`, meta);
        }
    }

    info(message, meta) { this.log('INFO', message, meta); }
    warn(message, meta) { this.log('WARN', message, meta); }
    error(message, meta) { this.log('ERROR', message, meta); }
    debug(message, meta) { this.log('DEBUG', message, meta); }
}

export const logger = new FrontendLogger();

export const apiFetch = async (url, options = {}) => {
    logger.newCorrelationId();
    const headers = { ...options.headers };
    if (!headers['X-Correlation-Id']) {
        headers['X-Correlation-Id'] = logger.getCorrelationId();
    }
    
    logger.debug(`API Request: ${options.method || 'GET'} ${url}`);
    
    try {
        const start = performance.now();
        const res = await fetch(url, { ...options, headers });
        const duration = Math.round(performance.now() - start);
        
        if (!res.ok) {
            let errorData;
            try {
                errorData = await res.json();
            } catch (e) {
                errorData = { error: res.statusText };
            }
            
            logger.error(`API Error: ${options.method || 'GET'} ${url} - ${res.status}`, {
                status: res.status,
                duration,
                response: errorData,
                requestId: errorData.requestId
            });
            
            const err = new Error(errorData.error || 'API Request Failed');
            err.status = res.status;
            err.requestId = errorData.requestId;
            err.details = errorData;
            throw err;
        }
        
        logger.info(`API Success: ${options.method || 'GET'} ${url} - ${res.status} (${duration}ms)`);
        return res;
    } catch (err) {
        if (!err.status) {
            logger.error(`Network Error: ${options.method || 'GET'} ${url}`, { error: err.message });
        }
        throw err;
    }
};
