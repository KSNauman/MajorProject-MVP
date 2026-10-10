const express = require('express');
const cors = require('cors');
require('dotenv').config();
const rtracer = require('cls-rtracer');
const { randomUUID } = require('crypto');
const { requestLogger, errorHandler } = require('./utils/middleware');
const logger = require('./utils/logger');

const authRoutes = require('./routes/auth');
const appRoutes = require('./routes/apps');
const healthRoutes = require('./routes/health');
const integrationRoutes = require('./routes/integration');
const portalRoutes = require('./routes/portal');

const app = express();
app.use(cors({
    exposedHeaders: ['X-Correlation-Id'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id']
}));
app.use(express.json());

// Request tracing (Correlation ID)
app.use(rtracer.expressMiddleware({
    useHeader: true,
    headerName: 'X-Correlation-Id',
    requestIdFactory: (req) => req.headers['x-correlation-id'] || randomUUID()
}));

app.use(requestLogger);

app.use('/api/auth', authRoutes);
app.use('/api/apps', appRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/portal', portalRoutes);

app.use(errorHandler);

module.exports = app;
