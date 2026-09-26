import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('Missing GEMINI_API_KEY in backend .env');
}

const ai = new GoogleGenAI({ apiKey });
const MODEL = process.env.ANALYSIS_MODEL || 'gemini-3.6-flash';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const VIDEO_ANALYSIS_PROMPT = `You are TRACY's video-evidence analysis engine, part of a digital trust investigation tool.

Watch and listen to this video and describe, in plain text, what happens in it. Follow these rules strictly:

1. Transcribe or paraphrase any speech you hear.
2. Describe visible on-screen content (text, graphics, people's actions) factually.
3. Do NOT attempt to determine whether the video is authentic, edited, or a deepfake — you have no capability to verify this, so do not comment on video authenticity at all.
4. Do NOT identify or speculate about the real-world identity of any person shown.
5. If the video contains recognized scam/fraud patterns (urgency, payment requests, impersonation claims, too-good-to-be-true offers), note them factually as observations, not conclusions.
6. Be concise — 3 to 6 sentences covering the key content.

Respond with plain text only, no formatting, no JSON.`;

export async function analyzeVideoEvidence({ fileBuffer, mimeType }) {
  const tempPath = join(tmpdir(), `tracy-video-${randomUUID()}`);
  let uploadedFileName = null;

  try {
    await writeFile(tempPath, fileBuffer);

    const uploaded = await ai.files.upload({
      file: tempPath,
      config: { mimeType },
    });
    uploadedFileName = uploaded.name;

    // Google processes the video server-side before it can be analyzed —
    // poll until it's ready.
    let file = uploaded;
    let attempts = 0;
    while (file.state && file.state.toString() === 'PROCESSING' && attempts < 12) {
      await sleep(5000);
      file = await ai.files.get({ name: uploadedFileName });
      attempts++;
    }

    if (file.state && file.state.toString() !== 'ACTIVE') {
      throw new Error(`Video file did not become ready in time (state: ${file.state})`);
    }

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        createUserContent([
          VIDEO_ANALYSIS_PROMPT,
          createPartFromUri(file.uri, file.mimeType),
        ]),
      ],
    });

    return response.text.trim();
  } finally {
    // Always clean up — both the local temp file and Google's copy —
    // regardless of success or failure.
    await unlink(tempPath).catch(() => {});
    if (uploadedFileName) {
      await ai.files.delete({ name: uploadedFileName }).catch((err) => {
        console.warn('Failed to delete remote video file (non-fatal):', err.message);
      });
    }
  }
}