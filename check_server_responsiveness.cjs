
async function checkServer() {
    try {
        const res = await fetch('http://localhost:3000/api/monitoring/district-stats?region=Region%20I&division=Ilocos%20Norte&groupBy=legislative');
        if (res.ok) {
            console.log("Server is responsive! API call succeeded.");
            const data = await res.json();
            console.log("Data sample:", data.length > 0 ? data[0] : "Empty array");
        } else {
            console.log("Server responded with error:", res.status);
        }
    } catch (err) {
        console.error("Server is NOT reachable:", err.message);
    }
}

checkServer();
