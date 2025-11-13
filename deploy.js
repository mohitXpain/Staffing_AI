const fs = require('fs');
const path = require('path');

// Paths
const buildDir = path.join(__dirname, '..', 'build');
const deployDir = path.join(__dirname, '..', '..', 'build');

console.log('Deploying build to production folder...');
console.log('Source:', buildDir);
console.log('Destination:', deployDir);

// Check if build directory exists
try {
  fs.accessSync(buildDir, fs.constants.F_OK);
} catch (err) {
  console.error('Error: Build directory not found. Run "npm run build:dev" first.');
  process.exit(1);
}

// Function to copy directory recursively
function copyDir(src, dest) {
  try {
    fs.accessSync(dest, fs.constants.F_OK);
  } catch (err) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy build to deploy directory
try {
  // Remove existing deploy directory if it exists
  try {
    fs.accessSync(deployDir, fs.constants.F_OK);
    fs.rmSync(deployDir, { recursive: true, force: true });
  } catch (err) {
    // Directory doesn't exist, that's fine
  }
  
  // Copy build directory
  copyDir(buildDir, deployDir);
  
  console.log('✓ Build deployed successfully to ../build');
} catch (error) {
  console.error('Error deploying build:', error);
  process.exit(1);
}

