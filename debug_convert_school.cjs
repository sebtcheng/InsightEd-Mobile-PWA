const fetch = require('node-fetch');

async function debugConvertSchool() {
    const schoolId = '100000'; // Example ID that should exist
    console.log(`Testing conversion for School ID: ${schoolId}`);

    try {
        const res = await fetch('http://localhost:3000/api/sdo/convert-school', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                school_id: schoolId,
                school_name: 'Debug School',
                submitted_by: 'debug_user'
            })
        });

        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Response:', text);
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

debugConvertSchool();
