const API_URL = 'http://localhost:3000/api/monitoring/schools?region=Region%20I';

async function reproduceError() {
    try {
        console.log(`Testing endpoint: ${API_URL}`);
        const response = await fetch(API_URL);

        if (response.ok) {
            console.log('✅ Endpoint is working unexpectedly!');
            const data = await response.json();
            console.log('Data sample:', JSON.stringify(data).slice(0, 100));
        } else {
            console.log(`❌ Failed with status: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.log('Response body:', text);
        }
    } catch (error) {
        console.error('❌ Error fetching data:', error);
    }
}

reproduceError();
