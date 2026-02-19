import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api'; // Adjust port if needed
const SCHOOL_ID = '123456';

const testTeachersInitial = [
    {
        iern: 'PERSON001',
        control_num: 'CN-001',
        full_name: 'Teacher One',
        position: 'Teacher I',
        position_group: 'T1-T3',
        specialization: 'Math',
        teaching_load: 6.0
    },
    {
        iern: 'PERSON002',
        control_num: 'CN-002',
        full_name: 'Teacher Two',
        position: 'Teacher II',
        position_group: 'T1-T3',
        specialization: 'Science',
        teaching_load: 5.5
    }
];

const testTeachersUpdate = [
    {
        iern: 'PERSON001',
        control_num: 'CN-001', // Keeps existing
        full_name: 'Teacher One',
        position: 'Teacher I',
        position_group: 'T1-T3',
        specialization: 'Advanced Math', // UPDATED
        teaching_load: 6.0
    },
    {
        iern: 'PERSON003',
        control_num: 'CN-003', // NEW
        full_name: 'Teacher Three',
        position: 'Master Teacher I',
        position_group: 'MT1-MT4',
        specialization: 'English',
        teaching_load: 4.0
    }
    // Teacher Two (CN-002) is OMITTED -> Should be DELETED
];

const verifyApi = async () => {
    try {
        console.log("🚀 Starting API Verification...");

        // 1. Initial Save
        console.log("\n1️⃣ Saving Initial Data...");
        const res1 = await fetch(`${BASE_URL}/save-teacher-personnel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Wrap in object with `teachers` key? YES.
            body: JSON.stringify({ schoolId: SCHOOL_ID, teachers: testTeachersInitial })
        });

        if (!res1.ok) {
            const text = await res1.text();
            throw new Error(`Save Failed: ${res1.status} ${res1.statusText} - ${text}`);
        }

        const json1 = await res1.json();
        console.log("Save Result:", json1);

        // 2. Verify Initial Fetch
        console.log("\n2️⃣ Fetching Initial Data...");
        const res2 = await fetch(`${BASE_URL}/teacher-personnel/${SCHOOL_ID}`);
        const teachers2 = await res2.json();
        console.log(`Fetched ${teachers2.length} teachers.`);

        if (teachers2.length !== 2) throw new Error("Expected 2 teachers");
        if (teachers2.find(t => t.control_num === 'CN-001').specialization !== 'Math') throw new Error("Verify 1 Failed");

        // 3. Update Save (Mod + Add + Delete)
        console.log("\n3️⃣ Saving Updated Data (Upsert/Delete)...");
        const res3 = await fetch(`${BASE_URL}/save-teacher-personnel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schoolId: SCHOOL_ID, teachers: testTeachersUpdate })
        });
        const json3 = await res3.json();
        console.log("Update Result:", json3);

        // 4. Verify Update Fetch
        console.log("\n4️⃣ Fetching Updated Data...");
        const res4 = await fetch(`${BASE_URL}/teacher-personnel/${SCHOOL_ID}`);
        const teachers4 = await res4.json();
        console.log(`Fetched ${teachers4.length} teachers.`);

        if (teachers4.length !== 2) throw new Error("Expected 2 teachers (1 kept, 1 added, 1 deleted)");

        const t1 = teachers4.find(t => t.control_num === 'CN-001');
        if (t1.specialization !== 'Advanced Math') throw new Error("Update Logic Failed (Specialization not updated)");

        const t3 = teachers4.find(t => t.control_num === 'CN-003');
        if (!t3) throw new Error("Insert Logic Failed (New teacher not found)");

        const t2 = teachers4.find(t => t.control_num === 'CN-002');
        if (t2) throw new Error("Delete Logic Failed (Old teacher still exists)");

        console.log("\n✅ ALL TESTS PASSED!");

    } catch (err) {
        console.error("\n❌ Test Failed:", err);
    }
};

verifyApi();
