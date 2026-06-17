const { execSync } = require('child_process');
const { version } = require('./package.json');

try {
  execSync(`git rev-parse ${version}`, { stdio: 'ignore' });
  console.error(`Error: git tag ${version} already exists`);
  process.exit(1);
} catch {
  // Tag does not exist, continue
}

try {
  execSync('npm whoami', { stdio: 'ignore' });
} catch {
  console.log('Not logged in to npm, logging in...');
  execSync('npm login', { stdio: 'inherit' });
}

execSync(`git tag ${version}`, { stdio: 'inherit' });
execSync(`git push origin ${version}`, { stdio: 'inherit' });

execSync('npm publish', { stdio: 'inherit' });

console.log(`Published ${version}`);
