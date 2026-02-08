import http from 'http';

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/users?page=1&limit=5',
    method: 'GET',
};

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const parsedData = JSON.parse(data);
            console.log('Response Status:', res.statusCode);

            if (res.statusCode !== 200) {
                console.error('Stack:', JSON.stringify(parsedData, null, 2));
                process.exit(1);
            }

            console.log('Keys:', Object.keys(parsedData));

            if (!Array.isArray(parsedData.data)) {
                console.error('❌ Data is not an array');
                process.exit(1);
            }

            if (typeof parsedData.total !== 'number') {
                console.error('❌ Total is not a number');
                process.exit(1);
            }

            if (parsedData.page !== 1) {
                console.error('❌ Page mismatch');
                process.exit(1);
            }

            console.log(`✅ Verification Successful! returned ${parsedData.data.length} users (Total: ${parsedData.total})`);
            process.exit(0);

        } catch (e) {
            console.error('❌ Failed to parse response:', e.message);
            console.log('Raw Data:', data);
            process.exit(1);
        }
    });
});

req.on('error', (e) => {
    console.error(`❌ Request error: ${e.message}`);
    process.exit(1);
});

req.end();
