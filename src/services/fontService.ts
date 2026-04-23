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
