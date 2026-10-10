

async function runTest() {
    try {
        const res = await fetch('http://localhost:3000/api/story/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storyId: 'rahims_story', characters: {} })
        });
        const data = await res.json();
        console.log('Generate Response:', data);

        if (data.jobId) {
            const jobId = data.jobId;
            const interval = setInterval(async () => {
                const jobRes = await fetch(`http://localhost:3000/api/jobs/${jobId}`);
                const jobData = await jobRes.json();
                console.log('Job Data:', JSON.stringify(jobData, null, 2));
                if (jobData.status === 'COMPLETED' || jobData.status === 'FAILED') {
                    clearInterval(interval);
                }
            }, 5000);
        }
    } catch (e) {
        console.error(e);
    }
}

runTest();
