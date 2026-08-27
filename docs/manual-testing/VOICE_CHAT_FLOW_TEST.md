# Manual Voice Chat Flow Test Guide

## 1. End-to-End Consumer Workflow Verification

Follow these manual testing steps to verify the user experience:

### Step 1: Open Application
1. Navigate to `http://localhost:3000`.
2. Observe landing page with Deep Navy / Electric Cyan branding.
3. Click **LAUNCH STUDIO** / **ENTER VOICE STUDIO**.
4. (If unauthenticated, sign in with `researcher@voiceai.lab` / `password123`).

### Step 2: Floating Chat Interface over 3D Voice Room
1. Verify the 3D Cyber AI Character is positioned as a depth layer behind the floating chat card.
2. Move the mouse across the screen: verify the smooth **Rainbow / Spectrum glowing cursor trail** following the cursor.
3. Click anywhere: observe the expanding **cyan/purple holographic click ripple**.

### Step 3: '+' Action Menu Attachment
1. Click the **`+` button** on the left of the chat composer.
2. Test the 5 tabs:
   - **Add Audio**: Click "Analyze Voice" -> Verify "Voice ready" banner -> Click "Save & Use Voice".
   - **Record Voice**: Click "Start Recording" -> Speak into mic -> Click "Stop & Preview" -> Play back -> Click "Use Recording".
   - **Add Video**: Enter video path -> Click "Extract Speech & Detect Speakers" -> Select "Speaker 2" -> Click "Save Selected Speaker Voice".
   - **Add Script**: Edit text -> Click "Use this as Script in Composer" -> Verify script appears in chat composer.
   - **Saved Voices**: Click any voice to set as active.

### Step 4: Voice Speech Generation
1. In the chat composer, type: `"Testing real-time zero-shot voice cloning in the AI Voice Chat Studio."`
2. Click **Generate Voice** (or press `Enter`).
3. Verify status changes to `"Generating voice..."` with loading spinner.
4. Verify the AI Voice Response card appears with the animated waveform, duration, language, and **Download WAV** button.

### Step 5: Audio Playback & 3D Lip-Sync
1. Click the **Play (▶)** button on the response card.
2. Listen to the audible speech stream.
3. Observe the 3D AI character in the background reacting with real-time **mouth viseme lip-sync** and energy visualizer.
