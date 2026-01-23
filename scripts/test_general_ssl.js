// Test general HTTPS connectivity to rule out global Node.js SSL issues
const testUrls = [
    'https://www.google.com',
    'https://github.com',
    'https://neon.tech' // The database provider's website
];

async function testUrl(url) {
    try {
        console.log(`Testing ${url}...`);
        const start = Date.now();
        const res = await fetch(url);
        console.log(`✅ ${url} - Status: ${res.status} (${Date.now() - start}ms)`);
    } catch (err) {
        console.error(`❌ ${url} - Failed:`, err.message);
        if (err.cause) console.error('   Cause:', err.cause);
    }
}

async function run() {
    console.log(`Node Version: ${process.version}`);
    for (const url of testUrls) {
        await testUrl(url);
    }
}

run();
