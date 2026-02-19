const { exec } = require('child_process');

const PORT = 3000;

console.log(`Attempting to kill process occupying port ${PORT}...`);

if (process.platform === 'win32') {
    // Windows approach
    exec(`netstat -ano | findstr :${PORT}`, (err, stdout, stderr) => {
        if (err || !stdout) {
            console.log(`No process found listening on port ${PORT}.`);
            return;
        }

        const lines = stdout.trim().split('\n');
        const pids = new Set();

        lines.forEach(line => {
            // Line format: TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       12345
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];

            // Check if it is a valid PID (numeric) and distinct
            if (pid && !isNaN(pid) && parseInt(pid) > 0) {
                pids.add(pid);
            }
        });

        if (pids.size === 0) {
            console.log(`Could not identify a valid PID for port ${PORT}.`);
            return;
        }

        pids.forEach(pid => {
            console.log(`Found process with PID: ${pid}. Killing it...`);
            exec(`taskkill /PID ${pid} /F`, (killErr, killStdout, killStderr) => {
                if (killErr) {
                    console.error(`Failed to kill process ${pid}: ${killErr.message}`);
                } else {
                    console.log(`Successfully killed process ${pid}.`);
                }
            });
        });
    });
} else {
    // Unix/Linux/Mac approach
    exec(`lsof -i :${PORT} -t | xargs kill -9`, (err, stdout, stderr) => {
        if (err) {
            console.log(`Error or no process found on port ${PORT}: ${err.message}`);
        } else {
            console.log(`Port ${PORT} cleared.`);
        }
    });
}
