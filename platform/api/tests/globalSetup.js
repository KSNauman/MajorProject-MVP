const { execSync } = require('child_process');
const path = require('path');

module.exports = async () => {
    require('./useTestDatabase');
    execSync('npx prisma migrate deploy', {
        cwd: path.resolve(__dirname, '..'),
        env: process.env,
        stdio: 'ignore'
    });
};
