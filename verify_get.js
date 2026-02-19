import http from 'http';

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/teacher-personnel/123456',
    method: 'GET',
};

console.log("Sending GET Request...");

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.end();
