
const fs = require('fs');

async function verifyGrouping() {
    const baseUrl = 'http://localhost:3000';
    // Use a division known to have data
    const region = 'Region I'; // Ilocos Region
    const division = 'Ilocos Norte';

    async function fetchStats(type) {
        const params = new URLSearchParams({
            region,
            division,
            ...(type !== 'school_district' ? { groupBy: type } : {})
        });
        console.log(`Fetching stats for ${type}...`);
        const res = await fetch(`${baseUrl}/api/monitoring/district-stats?${params.toString()}`);
        if (!res.ok) throw new Error(`Failed to fetch ${type}: ${res.statusText}`);
        return await res.json();
    }

    try {
        const districtData = await fetchStats('school_district');
        const legislativeData = await fetchStats('legislative');
        const municipalityData = await fetchStats('municipality');

        console.log(`\nResults for ${division}, ${region}:`);
        console.log(`School District Count: ${districtData.length}`);
        console.log(`Legislative District Count: ${legislativeData.length}`);
        console.log(`Municipality Count: ${municipalityData.length}`);

        console.log('\nSample School District:', districtData[0]?.district);
        console.log('Sample Legislative:', legislativeData[0]?.district);
        console.log('Sample Municipality:', municipalityData[0]?.district);

        // Log distinct values to verify they are actually different
        const distinctDistricts = [...new Set(districtData.map(d => d.district))];
        const distinctLegislative = [...new Set(legislativeData.map(d => d.district))];
        const distinctMunicipalities = [...new Set(municipalityData.map(d => d.district))];

        console.log('\nDistinct Districts:', distinctDistricts.slice(0, 5));
        console.log('Distinct Legislative:', distinctLegislative.slice(0, 5));
        console.log('Distinct Municipalities:', distinctMunicipalities.slice(0, 5));

        if (districtData.length === legislativeData.length && districtData.length === municipalityData.length &&
            JSON.stringify(distinctDistricts) === JSON.stringify(distinctLegislative)) {
            console.error('\nERROR: Data appears identical across groupings! Backend logic might be failing.');
        } else {
            console.log('\nSUCCESS: Data groupings appear distinct.');
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

verifyGrouping();
