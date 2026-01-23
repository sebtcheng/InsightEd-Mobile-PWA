// Native fetch is used

const API_URL = 'http://localhost:3000/api/monitoring/regions';

async function verifyEndpoint() {
    try {
        console.log(`Testing endpoint: ${API_URL}`);
        const response = await fetch(API_URL);

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Endpoint is working!');
            console.log('Received data sample:', JSON.stringify(data).slice(0, 200) + '...');
            if (Array.isArray(data) && data.length > 0) {
                console.log(`Received ${data.length} regions.`);
            } else {
                console.log('⚠️ Received empty array or invalid format.');
            }
        } else {
            console.error(`❌ Failed with status: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error('Response body:', text);
        }
    } catch (error) {
        console.error('❌ Error fetching data:', error);
    }
}

verifyEndpoint();
