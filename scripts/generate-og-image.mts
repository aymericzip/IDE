/* eslint-disable no-console */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateOgImage } from '../server/og/generateOgImage';

const root = fileURLToPath(new URL('..', import.meta.url));

const main = async () => {
  console.log('Generating OG image...');
  const buffer = await generateOgImage({
    title: 'Intlayer online IDE — In-Browser GitHub Code Editor',
    description:
      'Open any GitHub repository in your browser: browse the file tree and read code with syntax highlighting, no clone or install.',
  });

  const outPath = join(root, 'public', 'og-image.png');
  writeFileSync(outPath, Buffer.from(buffer));
  console.log(
    `Wrote OG image (${(buffer.byteLength / 1024).toFixed(1)} KB) to ${outPath}`
  );
};

main().catch((err) => {
  console.error('Failed to generate OG image:', err);
  process.exit(1);
});
