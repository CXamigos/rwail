const { spawn } = require('child_process');
const path = require('path');

const scripts = ['ws.js', 'lcl.js', 'bl.js'];
const children = [];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startScript(script) {
  const child = spawn(process.execPath, [path.join(__dirname, script)], {
    cwd: __dirname,
    stdio: 'inherit',
    windowsHide: false,
  });

  children.push(child);
  console.log(`Started ${script} with PID ${child.pid}`);

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.log(`${script} exited with ${reason}`);
  });
}

function stopAll() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

let shuttingDown = false;

async function main() {
  for (const script of scripts) {
    startScript(script);
    await wait(1000);
  }

  console.log('All scripts started. Press Ctrl+C to stop them.');
}

process.on('SIGINT', () => {
  shuttingDown = true;
  console.log('\nStopping scripts...');
  stopAll();
  process.exit(0);
});

process.on('SIGTERM', () => {
  shuttingDown = true;
  stopAll();
  process.exit(0);
});

main().catch((error) => {
  console.error(error);
  stopAll();
  process.exit(1);
});
