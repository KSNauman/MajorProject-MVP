const test = require('node:test');
const assert = require('node:assert');

test('E2E: Engine Generation and Video Serving', async (t) => {
    // This is a REAL end-to-end test calling the actual engine and verifying the resource
    // is successfully generated and physically served by the HTTP server.
    
    // 1. Start generation
    const res = await fetch('http://localhost:3000/api/story/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId: 'rahims_story', characters: {} })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200, 'Generate API should return 200 OK');
    assert.ok(data.jobId, 'Generate API should return a jobId');

    const jobId = data.jobId;
    let finalVideoUrl = null;

    // 2. Poll until completion
    for (let i = 0; i < 40; i++) {
        const jobRes = await fetch(`http://localhost:3000/api/jobs/${jobId}`);
        const jobData = await jobRes.json();
        
        if (jobData.status === 'COMPLETED') {
            finalVideoUrl = jobData.finalVideoUrl;
            break;
        } else if (jobData.status === 'FAILED') {
            assert.fail('Job failed: ' + jobData.error);
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    assert.ok(finalVideoUrl, 'finalVideoUrl must exist in the completed job payload');

    // 3. Verify the playback resource is actually served
    // Use the direct engine URL (3000) so this test can run independent of the replica proxy
    const videoUrlStr = `http://localhost:3000${finalVideoUrl}`;
    const vidRes = await fetch(videoUrlStr, { method: 'HEAD' });
    
    assert.strictEqual(vidRes.status, 200, 'Video file should be served with 200 OK');
    assert.strictEqual(vidRes.headers.get('content-type'), 'video/mp4', 'Content-Type should be video/mp4');
});
