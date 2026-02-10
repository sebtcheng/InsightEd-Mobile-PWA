
import http from 'http';

// Test with the School ID from the user's screenshot: 304922 (Tandag National Science High School)
const SCHOOL_ID = '304922';

const options = {
    hostname: 'localhost',
    port: 3000,
    path: `/api/schools/${SCHOOL_ID}/info`,
    method: 'GET',
};

const req = http.request(options, (res) => {
    let data = '';

    console.log(`STATUS: ${res.statusCode}`);

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const parsed = JSON.parse(data);
            console.log('Response Body:', JSON.stringify(parsed, null, 2));

            if (parsed.curricular_offering) {
                console.log(`\n✅ SUCCESS: Found curricular_offering: "${parsed.curricular_offering}"`);
            } else {
                console.log(`\n⚠️ WARNING: curricular_offering is missing or empty.`);
            }

        } catch (e) {
            console.error('Error parsing response:', e.message);
            console.log('Raw Data:', data);
        }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.end();
