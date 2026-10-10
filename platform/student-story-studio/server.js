const express = require('express');
const path = require('path');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rtracer = require('cls-rtracer');
const { randomUUID } = require('crypto');
const logger = require('./utils/logger');
const { requestLogger, errorHandler } = require('./utils/middleware');

const app = express();
const PORT = 3001;

app.use(cors({
    exposedHeaders: ['X-Correlation-Id'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id']
}));

// Request tracing
app.use(rtracer.expressMiddleware({
    useHeader: true,
    headerName: 'X-Correlation-Id',
    requestIdFactory: (req) => req.headers['x-correlation-id'] || randomUUID()
}));

app.use(requestLogger);

// Proxy to the existing EduVision UI Engine
app.use('/api', createProxyMiddleware({ 
    target: 'http://localhost:3000/api', 
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
        const reqId = rtracer.id();
        if (reqId) proxyReq.setHeader('X-Correlation-Id', reqId);
        logger.debug(`Proxying request to ${proxyReq.path}`);
    },
    onError: (err, req, res) => {
        logger.error(`Proxy Error: ${err.message}`, { error: err.message, target: req.originalUrl });
        res.status(502).json({ error: 'Bad Gateway', requestId: rtracer.id() });
    }
}));

app.use('/uploads', createProxyMiddleware({ 
    target: 'http://localhost:3000/uploads', 
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
        const reqId = rtracer.id();
        if (reqId) proxyReq.setHeader('X-Correlation-Id', reqId);
    }
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use(errorHandler);

app.listen(PORT, () => {
    logger.info(`Student Story Studio replica running on port ${PORT}`, { component: 'replica', env: process.env.NODE_ENV });
});

process.on('uncaughtException', (err) => {
    logger.fatal(`Uncaught Exception: ${err.message}`, { error: err });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection: ${reason}`, { reason });
});
