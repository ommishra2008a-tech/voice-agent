const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const testMediaDir = path.join(__dirname, "..", "tests", "fixtures");
if (!fs.existsSync(testMediaDir)) {
  fs.mkdirSync(testMediaDir, { recursive: true });
}

const ffmpeg = "C:\\ffmpeg\\ffmpeg.exe";

console.log("Generating synthetic test media fixtures...");

// 1. Generate 2-second Sine Wave Audio (WAV)
const wavPath = path.join(testMediaDir, "sample_speech.wav");
execSync(`"${ffmpeg}" -y -f lavfi -i "sine=frequency=440:duration=2" -ar 44100 -ac 2 "${wavPath}"`);
console.log("Created:", wavPath);

// 2. Generate MP3
const mp3Path = path.join(testMediaDir, "sample_podcast.mp3");
execSync(`"${ffmpeg}" -y -i "${wavPath}" -c:a libmp3lame -b:a 192k "${mp3Path}"`);
console.log("Created:", mp3Path);

// 3. Generate FLAC
const flacPath = path.join(testMediaDir, "sample_lossless.flac");
execSync(`"${ffmpeg}" -y -i "${wavPath}" -c:a flac "${flacPath}"`);
console.log("Created:", flacPath);

// 4. Generate OGG (Vorbis)
const oggPath = path.join(testMediaDir, "sample_voice.ogg");
execSync(`"${ffmpeg}" -y -i "${wavPath}" -c:a libvorbis -q:a 4 "${oggPath}"`);
console.log("Created:", oggPath);

// 5. Generate M4A (AAC)
const m4aPath = path.join(testMediaDir, "sample_audiobook.m4a");
execSync(`"${ffmpeg}" -y -i "${wavPath}" -c:a aac -b:a 128k "${m4aPath}"`);
console.log("Created:", m4aPath);

// 6. Generate MP4 Video with Audio (Test Pattern + Sine Audio)
const mp4Path = path.join(testMediaDir, "sample_interview.mp4");
execSync(`"${ffmpeg}" -y -f lavfi -i "testsrc=size=320x240:rate=25" -f lavfi -i "sine=frequency=880:duration=2" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "${mp4Path}"`);
console.log("Created:", mp4Path);

// 7. Generate Corrupted / Malformed file
const corruptPath = path.join(testMediaDir, "corrupted_media.wav");
fs.writeFileSync(corruptPath, Buffer.from("RIFF\x00\x00\x00\x00NOT_A_VALID_AUDIO_CONTAINER_HEADER_DATA_1234567890"));
console.log("Created:", corruptPath);

// 8. Generate Empty file
const emptyPath = path.join(testMediaDir, "empty_file.wav");
fs.writeFileSync(emptyPath, Buffer.alloc(0));
console.log("Created:", emptyPath);

console.log("All test media fixtures generated successfully!");
