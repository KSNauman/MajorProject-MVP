

async function testLaunch() {
    try {
        // 1. Get student token (mock student_a login)
        const loginRes = await fetch('http://localhost:4000/api/auth/student-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: 'student_a', classId: 'class_1' })
        });
        const loginData = await loginRes.json();
        console.log('Login:', loginRes.status, loginData);
        
        if (!loginData.token) return;

        // 2. Fetch assignments to get assignmentId
        const assRes = await fetch('http://localhost:4000/api/portal/assignments', {
            headers: { 'Authorization': `Bearer ${loginData.token}` }
        });
        const assignments = await assRes.json();
        console.log('Assignments:', assRes.status, assignments);

        if (assignments.length === 0) return;
        const assignmentId = assignments[0].id;
        const appId = assignments[0].appId;

        // 3. Launch
        const launchRes = await fetch('http://localhost:4000/api/integrations/launch', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${loginData.token}` 
            },
            body: JSON.stringify({ appId, assignmentId })
        });
        const launchData = await launchRes.json();
        console.log('Launch Response:', launchRes.status, launchData);
    } catch (e) {
        console.error('Error:', e);
    }
}

testLaunch();
