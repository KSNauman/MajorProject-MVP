// Tests create and delete rows, so they must never run against the real database.
require('dotenv').config();
const url = new URL(process.env.DATABASE_URL);
url.pathname = '/eduvision_test';
process.env.DATABASE_URL = url.toString();
