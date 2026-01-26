const { execSync } = require("node:child_process");

// Look for actual conflict markers (7 chars exactly), not comment dividers
// <<<<<<<, =======, >>>>>>> - must be 7 characters, not more
const output = execSync(
  'git grep -nE "^(<{7}|={7}|>{7})( |$)" -- "*.ts" "*.tsx" "*.js" "*.jsx" "*.json" "*.md" "*.css" || true',
  { stdio: "pipe" }
).toString();

if (output.trim()) {
  console.error("❌ Merge conflict markers found:\n");
  console.error(output);
  process.exit(1);
}

console.log("✅ No merge conflict markers found.");
