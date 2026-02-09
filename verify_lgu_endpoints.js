import fetch from 'node-fetch'; // You might need to install this or use built-in fetch if node version allows
// Node 18+ has built-in fetch.

const BASE_URL = 'http://localhost:3000'; // Assuming port 3000, check env if fails

const run = async () => {
    console.log('--- Verifying LGU Endpoints ---');

    // 1. Test SAVE PROJECT
    const projectData = {
        projectName: "LGU Test Project " + Date.now(),
        schoolName: "Test School LGU",
        schoolId: "123456",
        status: "Ongoing",
        accomplishmentPercentage: 25,
        uid: "test-lgu-uid",
        submittedBy: "Test LGU User",
        images: [
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" // 1x1 red pixel
        ]
    };

    try {
        console.log('Sending POST to /api/lgu/save-project...');
        const res = await fetch(`${BASE_URL}/api/lgu/save-project`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectData)
        });

        if (res.status === 404) {
            console.error('❌ Endpoint not found (404). Server might need restart.');
            return;
        }

        const data = await res.json();
        console.log('Response:', res.status, data);

        if (res.ok) {
            console.log('✅ Save Project Passed');
            console.log('IPC:', data.ipc);

            // 2. Verify Upload Image
            if (data.project && data.project.project_id) {
                console.log('Sending POST to /api/lgu/upload-image...');
                const imgRes = await fetch(`${BASE_URL}/api/lgu/upload-image`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectId: data.project.project_id,
                        imageData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                        uploadedBy: "test-lgu-uid"
                    })
                });
                const imgData = await imgRes.json();
                console.log('Image Upload Response:', imgRes.status, imgData);
                if (imgRes.ok) console.log('✅ Upload Image Passed');
                else console.error('❌ Upload Image Failed');
            }

        } else {
            console.error('❌ Save Project Failed');
        }

    } catch (err) {
        console.error('❌ Request Failed:', err.message);
        console.log('Is the server running on port 3000?');
    }
};

run();
