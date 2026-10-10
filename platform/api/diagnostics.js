const http = require('http');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

console.log("=== EduVision Platform Diagnostics ===");

const checkPort = (port, name) => {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}`, (res) => {
            console.log(`[PASS] ${name} is responding on port ${port} (Status: ${res.statusCode})`);
            resolve(true);
        });
        req.on('error', (err) => {
            console.log(`[FAIL] ${name} on port ${port} is NOT reachable: ${err.message}`);
            resolve(false);
        });
        req.setTimeout(2000, () => {
            console.log(`[FAIL] ${name} on port ${port} TIMED OUT`);
            req.destroy();
            resolve(false);
        });
    });
};

const checkDatabase = async () => {
    try {
        console.log("Checking database connection...");
        const prisma = new PrismaClient();
        await prisma.$connect();
        const appCount = await prisma.application.count();
        console.log(`[PASS] Database connected. Found ${appCount} applications.`);
        await prisma.$disconnect();
    } catch (err) {
        console.log(`[FAIL] Database connection failed: ${err.message}`);
    }
};

const checkEnvFiles = () => {
    const paths = [
        '../api/.env',
        '../../eduvision_ui/.env'
    ];
    paths.forEach(p => {
        if (fs.existsSync(p)) {
            console.log(`[PASS] Found environment file at ${p}`);
        } else {
            console.log(`[WARN] Missing environment file at ${p}`);
        }
    });
};

const run = async () => {
    checkEnvFiles();
    await checkDatabase();
    await checkPort(4000, "Platform API");
    await checkPort(3001, "Story Studio Replica");
    await checkPort(3000, "EduVision Engine API");
    await checkPort(5173, "React Portal");
    console.log("=== Diagnostics Complete ===");
};

run();
