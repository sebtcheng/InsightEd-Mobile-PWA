
import http from 'http';

const data = JSON.stringify({
    projectName: "Debug Log Project",
    schoolName: "Test School Debug",
    schoolId: "DEBUG-999",
    uid: "test-debugger",
    modifiedBy: "Debugger",
    status: "Not Yet Started"
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/save-project',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log("Response:", body);
    });
});

req.on('error', (e) => {
    console.error("Problem with request:", e.message);
});

req.write(data);
req.end();
