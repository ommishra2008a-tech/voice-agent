const { execSync } = require("child_process");
const path = require("path");

const testMediaDir = path.join(__dirname, "..", "tests", "fixtures");
const ffmpeg = "C:\\ffmpeg\\ffmpeg.exe";

console.log("Generating benchmark audio files (10s, 30s, 60s)...");

const b10 = path.join(testMediaDir, "benchmark_10s.wav");
execSync(`"${ffmpeg}" -y -f lavfi -i "sine=frequency=440:duration=10" -ar 24000 -ac 1 "${b10}"`);
console.log("Created 10s benchmark audio:", b10);

const b30 = path.join(testMediaDir, "benchmark_30s.wav");
execSync(`"${ffmpeg}" -y -f lavfi -i "sine=frequency=440:duration=30" -ar 24000 -ac 1 "${b30}"`);
console.log("Created 30s benchmark audio:", b30);

const b60 = path.join(testMediaDir, "benchmark_60s.wav");
execSync(`"${ffmpeg}" -y -f lavfi -i "sine=frequency=440:duration=60" -ar 24000 -ac 1 "${b60}"`);
console.log("Created 60s benchmark audio:", b60);

console.log("All benchmark audio files generated successfully!");
