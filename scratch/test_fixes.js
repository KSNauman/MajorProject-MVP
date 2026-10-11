const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:4000/api';

async function runTests() {
    console.log('=== STARTING AUTOMATED VERIFICATION SUITE ===\n');
    let passed = 0;
    let failed = 0;

    function assert(cond, name) {
        if (cond) {
            console.log(`[PASS] ${name}`);
            passed++;
        } else {
            console.error(`[FAIL] ${name}`);
            failed++;
        }
    }

    // 1. Parent login
    console.log('--- Test 1: Parent Authentication ---');
    const pLoginRes = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'parent1', password: 'password123' })
    });
    assert(pLoginRes.status === 200, 'Parent login returns 200');
    const pLoginData = await pLoginRes.json();
    const parentToken = pLoginData.token;
    assert(!!parentToken, 'Parent token received');

    // 2. Parent Children endpoint
    console.log('\n--- Test 2: Parent Children List ---');
    const pChildrenRes = await fetch(`${API_BASE}/portal/parent/children`, {
        headers: { 'Authorization': `Bearer ${parentToken}` }
    });
    assert(pChildrenRes.status === 200, 'GET /parent/children returns 200');
    const children = await pChildrenRes.json();
    assert(Array.isArray(children) && children.length > 0, `Parent has ${children.length} linked children`);
    const nauman = children.find(c => c.displayName === 'Nauman');
    assert(!!nauman, 'Nauman found among linked children');

    // 3. Child Dashboard endpoint (Authorized)
    console.log('\n--- Test 3: Authorized Child Dashboard & Saved Stories ---');
    const dashRes = await fetch(`${API_BASE}/portal/parent/children/${nauman.id}/dashboard`, {
        headers: { 'Authorization': `Bearer ${parentToken}` }
    });
    assert(dashRes.status === 200, 'GET /parent/children/:id/dashboard returns 200');
    const dashData = await dashRes.json();
    assert(Array.isArray(dashData.stories) && dashData.stories.length > 0, `Nauman has ${dashData.stories.length} saved stories`);
    const story1 = dashData.stories[0];
    assert(story1.fileExists === true, `Story "${story1.title}" fileExists flag is true`);
    assert(story1.videoUrl.startsWith('/api/files?storyId='), `videoUrl correctly starts with /api/files?storyId=: ${story1.videoUrl}`);

    // 4. Video Streaming on port 4000 (HTTP 200 and HTTP 206 Range)
    console.log('\n--- Test 4: Video Serving on Platform API (Port 4000) ---');
    // 4a. Unauthenticated video request is rejected with 401
    const unauthVidRes = await fetch(`http://localhost:4000${story1.videoUrl}`);
    assert(unauthVidRes.status === 401, `Unauthenticated video request returns 401 (${unauthVidRes.status})`);

    // 4b. Authorized parent video request via query token succeeds
    const fullVideoUrl = `http://localhost:4000${story1.videoUrl}&token=${parentToken}`;
    const vidHeadRes = await fetch(fullVideoUrl);
    assert(vidHeadRes.status === 200, `GET video returns 200 OK (${vidHeadRes.status})`);
    assert(vidHeadRes.headers.get('content-type') === 'video/mp4', `Content-Type is video/mp4 (${vidHeadRes.headers.get('content-type')})`);
    assert(vidHeadRes.headers.get('accept-ranges') === 'bytes', `Accept-Ranges is bytes`);
    const contentLength = parseInt(vidHeadRes.headers.get('content-length'), 10);
    assert(contentLength > 1000000, `Content-Length is valid media size: ${contentLength} bytes`);

    // Byte-range request (critical for browser seeking and video playback)
    const rangeRes = await fetch(fullVideoUrl, {
        headers: { 'Range': 'bytes=0-1023' }
    });
    assert(rangeRes.status === 206, `Range request returns 206 Partial Content (${rangeRes.status})`);
    assert(rangeRes.headers.get('content-range').startsWith('bytes 0-1023/'), `Content-Range header is correct: ${rangeRes.headers.get('content-range')}`);

    // 5. Security & Path Traversal Protection
    console.log('\n--- Test 5: Path Traversal & Security Sandbox ---');
    const badPathRes = await fetch(`http://localhost:4000/api/files?path=c:/Windows/System32/drivers/etc/hosts`);
    assert(badPathRes.status === 403, `Access to system directory is blocked with 403 (${badPathRes.status})`);
    const badRelativeRes = await fetch(`http://localhost:4000/api/files?path=../../package.json`);
    assert(badRelativeRes.status === 403, `Access via relative traversal is blocked with 403 (${badRelativeRes.status})`);

    // 6. Missing File returns 404
    console.log('\n--- Test 6: Missing Video File Handling ---');
    const missingRes = await fetch(`http://localhost:4000/api/files?path=c:/Major%20Project%20-%20MVP2/Major%20Project%20-%20MVP/story_engine/output/non_existent_story_9999.mp4&token=${parentToken}`);
    assert(missingRes.status === 404, `Missing video file returns 404 Not Found (${missingRes.status})`);

    // 7. Security: Unauthorized Parent Access to Unlinked Child
    console.log('\n--- Test 7: Unauthorized Child Access Protection ---');
    // Create a temporary dummy user to test unauthorized access
    const fakeChildId = '00000000-0000-0000-0000-000000000000';
    const unauthRes = await fetch(`${API_BASE}/portal/parent/children/${fakeChildId}/dashboard`, {
        headers: { 'Authorization': `Bearer ${parentToken}` }
    });
    assert(unauthRes.status === 403, `Unlinked child access is rejected with 403 Forbidden (${unauthRes.status})`);

    // 8. Launch integration endpoint with returnUrl
    console.log('\n--- Test 8: Integration Launch with returnUrl ---');
    const sLoginRes = await fetch(`${API_BASE}/auth/student-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: nauman.id, classId: dashData.classes[0]?.id || '' })
    });
    const sLoginData = await sLoginRes.json();
    const studentToken = sLoginData.token;

    const launchRes = await fetch(`${API_BASE}/integrations/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` },
        body: JSON.stringify({ 
            appId: 'story-studio', 
            assignmentId: dashData.assignments[0]?.id,
            returnUrl: 'http://localhost:5173/student'
        })
    });
    assert(launchRes.status === 200, 'Launch app endpoint returns 200');
    const launchData = await launchRes.json();
    assert(launchData.launchUrl.includes('returnUrl='), `Launch URL contains returnUrl parameter: ${launchData.launchUrl}`);
    assert(launchData.launchUrl.includes('token='), `Launch URL contains launch token`);

    console.log(`\n=== TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED ===`);
}

runTests().catch(console.error);
