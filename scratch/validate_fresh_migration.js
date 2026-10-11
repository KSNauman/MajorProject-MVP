const { Client } = require('../platform/api/node_modules/pg');
const { execSync } = require('child_process');

async function main() {
    const adminUrl = 'postgresql://postgres:nauman123@localhost:5432/postgres';
    const disposableDbName = 'eduvision_disposable_test';
    const testDbUrl = `postgresql://postgres:nauman123@localhost:5432/${disposableDbName}?schema=public`;

    console.log('--- Step 1: Creating disposable test database ---');
    const adminClient = new Client({ connectionString: adminUrl });
    await adminClient.connect();
    
    // Terminate existing connections to test db if any and drop it
    await adminClient.query(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '${disposableDbName}'
          AND pid <> pg_backend_pid();
    `).catch(() => {});
    await adminClient.query(`DROP DATABASE IF EXISTS ${disposableDbName};`);
    await adminClient.query(`CREATE DATABASE ${disposableDbName};`);
    await adminClient.end();
    console.log(`[PASS] Created fresh empty database: ${disposableDbName}`);

    try {
        console.log('\n--- Step 2: Running prisma migrate deploy on disposable database ---');
        const migrateOutput = execSync('npx.cmd prisma migrate deploy', {
            cwd: 'c:\\Major Project - MVP2\\Major Project - MVP\\platform\\api',
            env: { ...process.env, DATABASE_URL: testDbUrl },
            encoding: 'utf8'
        });
        console.log(migrateOutput);

        console.log('\n--- Step 3: Verifying tables and constraints in disposable database ---');
        const testClient = new Client({ connectionString: testDbUrl });
        await testClient.connect();

        const tablesRes = await testClient.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        `);
        const tables = tablesRes.rows.map(r => r.table_name);
        console.log('Created tables:', tables);

        if (!tables.includes('ParentChild')) {
            throw new Error('ParentChild table was NOT created!');
        }

        const colsRes = await testClient.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'ParentChild'
            ORDER BY ordinal_position;
        `);
        console.log('ParentChild columns:', colsRes.rows);

        const fkRes = await testClient.query(`
            SELECT
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='ParentChild';
        `);
        console.log('ParentChild foreign keys:', fkRes.rows);

        const migrationsRes = await testClient.query(`
            SELECT migration_name, finished_at
            FROM _prisma_migrations
            ORDER BY started_at ASC;
        `);
        console.log('Applied migrations:', migrationsRes.rows);

        await testClient.end();
        console.log('\n[SUCCESS] Fresh migration deployment verified successfully!');
    } finally {
        console.log('\n--- Step 4: Cleaning up disposable test database ---');
        const cleanupClient = new Client({ connectionString: adminUrl });
        await cleanupClient.connect();
        await cleanupClient.query(`
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = '${disposableDbName}'
              AND pid <> pg_backend_pid();
        `).catch(() => {});
        await cleanupClient.query(`DROP DATABASE IF EXISTS ${disposableDbName};`);
        await cleanupClient.end();
        console.log(`[PASS] Dropped disposable test database: ${disposableDbName}`);
    }
}

main().catch(err => {
    console.error('Migration validation failed:', err);
    process.exit(1);
});
