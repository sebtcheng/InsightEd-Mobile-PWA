import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
console.log("DEBUG: CWD:", process.cwd());
console.log("DEBUG: .env path:", envPath);

if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    console.log("DEBUG: .env first 50 chars:", content.substring(0, 50));
    console.log("DEBUG: .env length:", content.length);
} else {
    console.error("❌ .env file NOT FOUND!");
}

const { Pool } = pg;

// Robust .env parsing using Regex
let connectionString = process.env.DATABASE_URL;

if (!connectionString && fs.existsSync(envPath)) {
    console.log("⚠️ dotenv failed, trying UTF-16LE parsing...");
    // Try reading as UTF-16LE
    let content = fs.readFileSync(envPath, 'utf16le');

    // Regex for both encodings potentially
    let match = content.match(/DATABASE_URL=(.+)/);

    if (!match) {
        console.log("⚠️ UTF-16LE failed, checking UTF-8...");
        content = fs.readFileSync(envPath, 'utf8');
        match = content.match(/DATABASE_URL=(.+)/);
    }

    if (match) {
        connectionString = match[1].trim().replace(/^['"]|['"]$/g, '');
        console.log("DEBUG: Parsed connectionString:", connectionString.replace(/:[^:@]*@/, ':****@'));
        process.env.DATABASE_URL = connectionString;
    }
}

if (!connectionString) {
    console.error("❌ DATABASE_URL is undefined (Regex failed)! Dumping content for analysis...");
    if (fs.existsSync(envPath)) {
        console.log("-- BEGIN .ENV DUMP --");
        console.log(fs.readFileSync(envPath, 'utf8'));
        console.log("-- END .ENV DUMP --");
    }
    process.exit(1);
}

const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
console.log("DEBUG: isLocal:", isLocal);

const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000, // Increased timeout
});

pool.connect()
    .then(client => {
        console.log("✅ Connected successfully!");
        client.release();
        process.exit(0);
    })
    .catch(err => {
        console.error("❌ Connection failed:", err.message);
        console.error("❌ Error Code:", err.code);
        if (err.code === '28P01') {
            console.log("⚠️ Auth failed! Password verification needed.");
        }
        if (err.code === 'ECONNRESET') {
            console.error("🚨 ECONNRESET detected. This is usually a FIREWALL or NETWORK issue.");
        }
        process.exit(1);
    });
