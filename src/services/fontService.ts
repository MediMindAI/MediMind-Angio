/**
 * Font registration service for @react-pdf/renderer.
 *
 * Registers the NotoSansGeorgian family (Regular + Bold) so PDF reports
 * can render Georgian-script text (U+10A0..U+10FF). @react-pdf requires
 * fonts to be pre-registered before the first render; this module
 * provides an idempotent async registration hook that the PDFGenerator
 * invokes on click.
 *
 * Why async + dynamic import?
 *   - @react-pdf/renderer is ~250 KB minified and pulls in pdfkit. We do
 *     NOT want that in the main bundle. The dynamic import keeps it in
 *     its own Vite chunk (configured in vite.config.ts manualChunks).
 *   - The fonts live under `/public/fonts/` so Vite serves them as static
 *     assets. The `src` path in Font.register is relative to the site
 *     origin — same path in dev and prod.
 *
 * Idempotency: `registerFontsAsync` uses a module-level flag so repeated
 * calls (React strict-mode double-invoke, retry-on-error, etc.) register
 * exactly once.
 */

let fontsRegistered = false;

/**
 * Register Noto Sans Georgian for @react-pdf/renderer.
 * Safe to call multiple times; subsequent calls are a no-op.
 *
 * Throws only if the dynamic import itself fails; font-registration
 * errors (wrong path, 404) surface later when the PDF actually renders.
 */
export async function registerFontsAsync(): Promise<void> {
  if (fontsRegistered) {
    return;
  }

  const { Font } = await import('@react-pdf/renderer');

  Font.register({
    family: 'NotoSansGeorgian',
    fonts: [
      { src: '/fonts/NotoSansGeorgian-Regular.ttf', fontWeight: 'normal' },
      { src: '/fonts/NotoSansGeorgian-Bold.ttf', fontWeight: 'bold' },
      // Defensive italic aliases — Noto Sans Georgian doesn't ship italic
      // cuts, but @react-pdf throws hard if any style requests italic and
      // no italic variant is registered. Map italic requests back onto the
      // upright TTFs so the renderer gets a usable glyph source regardless.
      {
        src: '/fonts/NotoSansGeorgian-Regular.ttf',
        fontWeight: 'normal',
        fontStyle: 'italic',
      },
      {
        src: '/fonts/NotoSansGeorgian-Bold.ttf',
        fontWeight: 'bold',
        fontStyle: 'italic',
      },
    ],
  });

  // ----- Hyphenation callback ----------------------------------------
  //
  // @react-pdf/renderer breaks lines only at break-points returned by
  // this callback. Default behavior splits at spaces and hyphens, which
  // is fine for Latin/Cyrillic text — but Georgian compound words like
  // "ანტეგრადული" (antegrade), "სამფაზური" (triphasic), or
  // "ჰიპოეჰოგენური" (hypoechogenic) have NO internal break points and
  // are wider than a 240-pt half-page table column at 9 pt.
  //
  // Without break-points the word renders at its intrinsic width and
  // either overflows into the neighbor cell (pre-fix) or gets clipped
  // by `overflow: hidden` (current state — visible truncation).
  //
  // We supply a callback that, for any *single* word containing Georgian
  // glyphs (U+10A0..U+10FF) and longer than 7 characters, returns 5-char
  // chunks as soft break-points. Yoga can then break inside the word,
  // wrapping to a second line within the cell instead of clipping.
  //
  // Latin/Cyrillic words and short Georgian words pass through unchanged
  // (return the word as a single-element array → keep default behavior).
  Font.registerHyphenationCallback((word: string): string[] => {
    if (!word) return [word];
    // Detect at least one Georgian-script codepoint.
    if (!/[Ⴀ-ჿⴀ-⴯]/.test(word)) return [word];
    // Short words fit fine — let the layout breathe.
    if (word.length <= 7) return [word];
    // Chunk every 5 chars so a 10-char word becomes ["ანტეგრ", "ადული"]
    // and Yoga can break between the chunks.
    const chunks: string[] = [];
    const CHUNK = 5;
    for (let i = 0; i < word.length; i += CHUNK) {
      chunks.push(word.slice(i, i + CHUNK));
    }
    return chunks;
  });

  fontsRegistered = true;
}

/**
 * Reset the registration flag. Only useful for tests — no production
 * caller should invoke this.
 * @internal
 */
export function __resetFontRegistration(): void {
  fontsRegistered = false;
}

/** Current registration state — useful for debugging. */
export function isFontRegistered(): boolean {
  return fontsRegistered;
}
