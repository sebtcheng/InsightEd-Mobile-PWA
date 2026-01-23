import dotenv from 'dotenv';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
    console.error("❌ DATABASE_URL missing");
    process.exit(1);
}

const parsedUrl = new URL(dbUrl);
const hostname = parsedUrl.hostname;
const port = parsedUrl.port || 5432;

console.log(`\n🔍 Testing raw TCP connection to ${hostname}:${port}...`);

const socket = new net.Socket();
socket.setTimeout(5000);

socket.connect(port, hostname, () => {
    console.log('✅ TCP Connection established!');
    socket.destroy();
});

socket.on('data', (data) => {
    console.log('Received data:', data);
    socket.destroy();
});

socket.on('error', (err) => {
    console.error('❌ TCP Connection Error:', err.message);
    if (err.code) console.error('   Code:', err.code);
});

socket.on('timeout', () => {
    console.error('❌ TCP Connection Timeout');
    socket.destroy();
});

socket.on('close', () => {
    console.log('Connection closed');
});
