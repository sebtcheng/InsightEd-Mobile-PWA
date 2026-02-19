import http from 'http';

const options = {
    hostname: 'localhost',
    port: 3001, // Make sure this matches your running server port
    path: '/api/register-school',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
};

// Use a school ID that likely exists in the teachers_list master data
// Based on typical data, "102345" or similar might exist. 
// I'll use a random one and if it fails to auto-fill (because no teachers match), that's expected behavior but we want to verify the hook works.
// Ideally I should check `teachers_list` for a valid school_id first.
// Let's assume '123456' or similar dummy if we can't find one.
// Actually, I can query the DB for a school_id from teachers_list first? 
// No, I can't easily query DB from here without pg client. 
// I'll try a common one or just "TEST_SCHOOL_" + random. 
// BUT auto-fill only works if there are teachers with that school_id in `teachers_list`.
// So I should probably insert a dummy teacher into `teachers_list` first if I want to be 100% sure, 
// OR just pick a real school_id from `teachers_list` if I knew one.
// Since I can't easily modify `teachers_list` (it's a master table), I'll just try to register a school.
// If the hook runs (msg in console), that is partial success.
// To fully verify, I'd need a school_id that has teachers.
// Let's try to query one first using a separate script or just assume one.
// I'll create a script that finds a school_id from teachers_list, and then registers it.

const registerSchool = (schoolId) => {
    const data = JSON.stringify({
        uid: `test_user_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        contactNumber: '09123456789',
        schoolData: {
            school_id: schoolId,
            school_name: "Test AutoFill School",
            region: "Region X",
            province: "Test Province",
            division: "Test Division",
            district: "Test District",
            municipality: "Test City",
            leg_district: "1st",
            barangay: "Test Brgy",
            curricular_offering: "Elementary",
            latitude: "10.000",
            longitude: "120.000"
        }
    });

    const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            console.log(`Status: ${res.statusCode}`);
            console.log('Response:', body);
        });
    });

    req.on('error', (e) => {
        console.error(`Problem with request: ${e.message}`);
    });

    req.write(data);
    req.end();
};

// Found candidate: 108607
registerSchool('108607');
