import http from 'http';

const postData = JSON.stringify({
    schoolId: '123456',
    teachers: [
        {
            iern: 'PERSON001',
            control_num: 'CN-001',
            full_name: 'Teacher One',
            position: 'Teacher I',
            position_group: 'T1-T3',
            specialization: 'Math',
            teaching_load: 6.0
        }
    ]
});

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/save-teacher-personnel',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

console.log("Sending Request...");

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
        console.log('No more data in response.');
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

// Write data to request body
req.write(postData);
req.end();
