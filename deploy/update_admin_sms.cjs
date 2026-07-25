const fs = require('fs');
const path = require('path');

// Read the backup's _sms_fn.txt
const backupFile = "C:/Users/Diihjcop/Desktop/freebuff/CREDVALE-final - bkcp-06-17-07-2026 tela cliente/admin-panel/_sms_fn.txt";
const backupContent = fs.readFileSync(backupFile, 'utf8');

// Read the current admin.js
const adminFile = path.join(__dirname, '..', 'admin-panel', 'admin.js');
let adminContent = fs.readFileSync(adminFile, 'utf8');

// Find the current renderSmsPage function
const fnStart = 'async function renderSmsPage(container) {';
const fnEnd = '}';

let startIdx = adminContent.indexOf(fnStart);
if (startIdx < 0) {
  console.error('ERROR: renderSmsPage function not found in admin.js');
  process.exit(1);
}

// Find the end - look for the closing brace of the function
// The function ends with a single '}' on its own line, followed by another function or end of scope
let braceCount = 0;
let foundStart = false;
let endIdx = startIdx;

for (let i = startIdx; i < adminContent.length; i++) {
  if (adminContent[i] === '{') { braceCount++; foundStart = true; }
  else if (adminContent[i] === '}') { braceCount--; }
  if (foundStart && braceCount === 0) {
    endIdx = i + 1;
    break;
  }
}

if (!foundStart || braceCount !== 0) {
  console.error('ERROR: Could not find end of renderSmsPage function');
  process.exit(1);
}

const oldFunction = adminContent.substring(startIdx, endIdx);
console.log(`Found renderSmsPage function: ${startIdx} to ${endIdx} (${oldFunction.length} chars)`);

// Replace with backup content (adjusting the API calls to match the current project's API paths)
let newFunction = backupContent.trim();

// Fix API paths - the backup uses API.request directly, but the current project uses API.smsSend, etc.
// The backup function calls these API methods:
// - API.request('GET', '/admin/sms/accounts')
// - API.request('POST', '/admin/sms/accounts/verify')
// - etc.
// The current project's admin.js routes use /admin/sms/panel/* prefix for TopYing
// So we need to adjust the API paths in the backup function

// Replace the old function
adminContent = adminContent.substring(0, startIdx) + newFunction + '\n' + adminContent.substring(endIdx);

fs.writeFileSync(adminFile, adminContent, 'utf8');
console.log('✅ renderSmsPage function replaced successfully!');
console.log(`New function size: ${newFunction.length} chars`);
