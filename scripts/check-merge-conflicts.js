const { execSync } = require("node:child_process");

// Match actual git conflict markers: <<<<<<<, =======, >>>>>>>
// These markers appear at the start of a line (possibly with leading whitespace)
// and are followed by a space or end of line
let output = "";
try {
  output = execSync(
    'git grep -nE "^\\s*(<{7}|={7}|>{7})(\\s|$)" -- "*.ts" "*.tsx" "*.js" "*.jsx" "*.json" "*.md"',
    { stdio: "pipe", encoding: "utf8" }
  );
} catch (err) {
  // git grep exits with 1 when no matches found - that's the success case
  if (err.status === 1 && !err.stdout) {
    console.log("✅ No merge conflict markers found.");
    process.exit(0);
  }
  // If there was output, it found markers
  output = err.stdout || "";
}

if (output.trim()) {
  console.error("❌ Merge conflict markers found:\n" + output);
  process.exit(1);
}

console.log("✅ No merge conflict markers found.");
