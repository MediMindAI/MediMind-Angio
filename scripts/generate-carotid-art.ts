/**
 * One-off generator: produce a clean, UNLABELED extracranial carotid/vertebral
 * line-art illustration via the Gemini image API, to be used as a backdrop for
 * the `neck-carotid` AnatomyView (mirrors the le-reference.png pattern used by
 * the venous lower-extremity view).
 *
 * Why unlabeled: the AnatomyView "coloring book" engine adds segment labels and
 * click-to-color at runtime, and image models garble small text. So we ask only
 * for an anatomically-accurate vessel drawing; the app supplies the labels.
 *
 * Key handling (local only, never committed):
 *   - reads env var GEMINI_API_KEY, OR
 *   - reads scripts/.gemini-key (gitignored)
 *
 * Usage:
 *   GEMINI_API_KEY=... npx tsx scripts/generate-carotid-art.ts
 *   # or write the key to scripts/.gemini-key then:
 *   npx tsx scripts/generate-carotid-art.ts
 *
 * Output: scripts/.raw/carotid-candidate-<n>.png  (review, then promote the
 * best one to public/anatomy/neck-carotid-reference.png)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Best image models enabled on this key (gemini-3-pro-image "Nano Banana Pro"
// is NOT available, so we use the next-best two). Imagen uses a :predict
// endpoint; Gemini multimodal uses :generateContent — the script branches on
// the model id prefix.
const MODEL_ID = process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-image';
const IS_IMAGEN = MODEL_ID.startsWith('imagen');
const METHOD = IS_IMAGEN ? 'predict' : 'generateContent';
// v1beta: image-output fields (responseModalities / imageConfig) live here.
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:${METHOD}`;

// How many candidate variations to request (each is a separate call).
const CANDIDATES = Number(process.env.GEMINI_CANDIDATES ?? 3);

/**
 * Anatomically-precise prompt. Encodes the SRU/ESVS carotid duplex relationships:
 * bilateral anterior view, right CCA from brachiocephalic + left CCA from arch,
 * bifurcation at the bulb, ICA posterolateral & larger (no neck branches),
 * ECA anteromedial & smaller (with branches), vertebrals from subclavians lying
 * lateral/posterior. Style mirrors a clean medical-textbook line illustration.
 */
const PROMPT = [
  'A clean, professional medical textbook illustration of the human extracranial arterial system,',
  'anterior (front-facing) view, bilateral and symmetric, centered.',
  'Flat vector line-art style with soft, subtle shading — like a modern clinical atlas figure.',
  'Pure white background. NO text, NO labels, NO letters, NO numbers, NO arrows anywhere in the image.',
  '',
  'Show a softly outlined, semi-transparent neck and head silhouette (jaw, neck, and upper chest/shoulders) in pale grey,',
  'with the arteries drawn boldly on top in arterial red.',
  '',
  'Anatomy to depict accurately on BOTH sides:',
  '- The aortic arch at the bottom center.',
  '- On the RIGHT side of the body: a brachiocephalic (innominate) trunk rising from the arch, splitting into the right common carotid artery and the right subclavian artery.',
  '- On the LEFT side: the left common carotid artery arising directly from the aortic arch, and the left subclavian artery arising separately from the arch.',
  '- Each common carotid artery ascends vertically in the neck and dilates into a carotid bulb, then bifurcates at the level of the upper thyroid cartilage (about the jaw angle).',
  '- The internal carotid artery: larger caliber, positioned posterior and lateral, ascending smoothly toward the skull base with NO branches in the neck.',
  '- The external carotid artery: smaller caliber, positioned anterior and medial, giving off several small branches.',
  '- The vertebral arteries: arising from the subclavian arteries, lying lateral and posterior to the carotids, ascending vertically (through the cervical spine region).',
  '',
  'Vessels should be smooth, tapered, and anatomically continuous, clearly separated so each segment is distinguishable.',
  'Symmetric, tidy, uncluttered, suitable as a labeled diagram backdrop.',
].join('\n');

function loadKey(): string {
  const fromEnv = process.env.GEMINI_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  const keyFile = resolve(process.cwd(), 'scripts/.gemini-key');
  if (existsSync(keyFile)) {
    const k = readFileSync(keyFile, 'utf8').trim();
    if (k) return k;
  }
  throw new Error(
    'No API key. Set GEMINI_API_KEY env var or write the key to scripts/.gemini-key (gitignored).',
  );
}

/** Pull the first base64 image + mime out of either response shape. */
function extractImage(json: unknown): { data: string; mimeType: string } | null {
  const j = json as {
    // Imagen :predict shape
    predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
    // Gemini :generateContent shape
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>;
  };
  const pred = j.predictions?.find((p) => p.bytesBase64Encoded);
  if (pred?.bytesBase64Encoded) {
    return { data: pred.bytesBase64Encoded, mimeType: pred.mimeType ?? 'image/png' };
  }
  const parts = j.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((p) => p.inlineData?.data)?.inlineData;
  if (inline?.data) return { data: inline.data, mimeType: inline.mimeType ?? 'image/png' };
  return null;
}

async function generateOne(key: string, index: number, outDir: string): Promise<boolean> {
  const body = IS_IMAGEN
    ? {
        instances: [{ prompt: PROMPT }],
        // Imagen 4: 3:4 portrait fits head→chest framing.
        parameters: { sampleCount: 1, aspectRatio: '3:4' },
      }
    : {
        contents: [{ role: 'user', parts: [{ text: PROMPT }] }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          // 4:5 portrait fits head→chest framing.
          imageConfig: { aspectRatio: '4:5' },
        },
      };

  console.log(`[gen] candidate ${index} → ${MODEL_ID}`);
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(`[gen] candidate ${index}: HTTP ${res.status} ${res.statusText}\n${txt}`);
    return false;
  }

  const img = extractImage(await res.json());
  if (!img) {
    console.error(`[gen] candidate ${index}: no image in response`);
    return false;
  }
  const ext = img.mimeType.split('/')[1] ?? 'png';
  const tag = MODEL_ID.replace(/[^a-z0-9]+/gi, '-');
  const outPath = resolve(outDir, `carotid-${tag}-${index}.${ext}`);
  writeFileSync(outPath, Buffer.from(img.data, 'base64'));
  console.log(`[gen] wrote ${outPath}`);
  return true;
}

async function main(): Promise<void> {
  const key = loadKey();
  const outDir = resolve(process.cwd(), 'scripts/.raw');
  mkdirSync(outDir, { recursive: true });

  let ok = 0;
  for (let i = 1; i <= CANDIDATES; i++) {
    // Sequential (not Promise.all) to stay friendly to rate limits.
    // eslint-disable-next-line no-await-in-loop
    if (await generateOne(key, i, outDir)) ok++;
  }
  console.log(`[gen] complete: ${ok}/${CANDIDATES} candidates generated in scripts/.raw/`);
  if (ok === 0) process.exit(1);
}

main().catch((err) => {
  console.error('[gen] fatal:', err);
  process.exit(1);
});
