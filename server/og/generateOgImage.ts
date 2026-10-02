import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import satori, { type Font } from 'satori';
import {
  FONT_GEIST_BOLD_BASE64,
  FONT_GEIST_REGULAR_BASE64,
  THUMBNAIL_JPEG_BASE64,
} from './ogAssets';
import {
  detectOgLanguage,
  getOgLanguageFromLocale,
  loadOgFallbackFonts,
} from './ogFallbackFonts';

export const DEFAULT_OG_TITLE =
  'Intlayer online IDE — In-Browser GitHub Code Editor';

export const DEFAULT_OG_DESCRIPTION =
  'Open any GitHub repository in your browser: browse the file tree and read code with syntax highlighting, no clone or install.';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

let cachedFonts: Font[] | null = null;
let cachedBackgroundSrc: string | null = null;

const toArrayBuffer = (base64: string): ArrayBuffer => {
  const buf = Buffer.from(base64, 'base64');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
};

const getFonts = (): Font[] => {
  if (!cachedFonts) {
    cachedFonts = [
      {
        name: 'Geist',
        data: toArrayBuffer(FONT_GEIST_REGULAR_BASE64),
        weight: 400,
        style: 'normal',
      },
      {
        name: 'Geist',
        data: toArrayBuffer(FONT_GEIST_BOLD_BASE64),
        weight: 800,
        style: 'normal',
      },
    ];
  }
  return cachedFonts;
};

const getBackgroundSrc = () => {
  if (!cachedBackgroundSrc) {
    cachedBackgroundSrc = `data:image/jpeg;base64,${THUMBNAIL_JPEG_BASE64}`;
  }
  return cachedBackgroundSrc;
};

let resvgReady: Promise<void> | null = null;

const ensureResvg = (): Promise<void> => {
  if (!resvgReady) {
    resvgReady = (async () => {
      const require = createRequire(import.meta.url);
      const wasmPath = require.resolve('@resvg/resvg-wasm/index_bg.wasm');
      await initWasm(await readFile(wasmPath));
    })().catch((error: unknown) => {
      resvgReady = null;
      throw error;
    });
  }
  return resvgReady;
};

const FULL_WIDTH_CHARACTER_PATTERN =
  /[\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{scx=Hangul}\uFF00-\uFFEF]/u;

const getVisualLength = (text: string): number =>
  Array.from(text).reduce(
    (length, character) =>
      length + (FULL_WIDTH_CHARACTER_PATTERN.test(character) ? 2 : 1),
    0
  );

export type GenerateOgImageOptions = {
  /** Small line above the title, such as a repository owner. */
  eyebrow?: string;
  title?: string;
  description?: string;
  locale?: string;
};

/** Renders the Open Graph card to a PNG buffer. */
export const generateOgImage = async ({
  eyebrow,
  title = DEFAULT_OG_TITLE,
  description = DEFAULT_OG_DESCRIPTION,
  locale,
}: GenerateOgImageOptions = {}): Promise<ArrayBuffer> => {
  const fonts = getFonts();
  const bgSrc = getBackgroundSrc();

  // Strip trailing " | Intlayer" or " - Intlayer" since Intlayer logo & brand
  // are already part of the thumbnail.jpeg background
  const cleanTitle = title.replace(/\s*[|–-]\s*Intlayer\s*$/i, '').trim();

  const titleLength = getVisualLength(cleanTitle);
  let titleFontSize = 64;
  if (titleLength > 105) {
    titleFontSize = 40;
  } else if (titleLength > 65) {
    titleFontSize = 46;
  } else if (titleLength > 38) {
    titleFontSize = 56;
  }

  const renderedText = [eyebrow, cleanTitle, description]
    .filter(Boolean)
    .join(' ');
  const language =
    getOgLanguageFromLocale(locale) ?? detectOgLanguage(renderedText);
  const fallbackFonts = await loadOgFallbackFonts(renderedText, language);

  const element: any = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        width: '100%',
        height: '100%',
        position: 'relative',
        fontFamily: 'Geist',
      },
      lang: language,
      children: [
        {
          type: 'img',
          props: {
            src: bgSrc,
            alt: '',
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: '80px',
              left: '90px',
              width: '560px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            },
            children: [
              eyebrow
                ? {
                    type: 'span',
                    props: {
                      style: {
                        fontSize: '28px',
                        fontWeight: 400,
                        color: '#71717a',
                        marginBottom: '-8px',
                      },
                      children: eyebrow,
                    },
                  }
                : null,
              {
                type: 'span',
                props: {
                  style: {
                    fontSize: `${titleFontSize}px`,
                    fontWeight: 800,
                    lineHeight: 1.15,
                    letterSpacing: '-0.035em',
                    color: '#09090b',
                  },
                  children: cleanTitle,
                },
              },
              description
                ? {
                    type: 'span',
                    props: {
                      style: {
                        fontSize: '20px',
                        fontWeight: 400,
                        lineHeight: 1.4,
                        color: '#71717a',
                      },
                      children: description,
                    },
                  }
                : null,
            ].filter(Boolean),
          },
        },
      ],
    },
  };

  const svg = await satori(element, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: [...fonts, ...fallbackFonts],
  });

  await ensureResvg();
  const renderer = new Resvg(svg, {
    fitTo: { mode: 'width', value: OG_WIDTH },
  });
  try {
    const png = renderer.render();
    try {
      const bytes = png.asPng();
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer;
    } finally {
      png.free();
    }
  } finally {
    renderer.free();
  }
};
