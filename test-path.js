const path = require('path');
const __dirname_fake = 'c:\\Major Project - MVP2\\Major Project - MVP\\eduvision_ui';
const req_path = 'c:/Major Project - MVP2/Major Project - MVP/story_engine/output/rahims_story_1791652618.mp4';
const filePath = path.resolve(req_path);
const allowedPrefix = path.resolve(__dirname_fake, '../story_engine');
console.log('filePath:', filePath);
console.log('allowedPrefix:', allowedPrefix);
console.log('startsWith:', filePath.startsWith(allowedPrefix));
