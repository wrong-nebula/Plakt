import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('./', import.meta.url);
const out = new URL('../Sources/PosterCore/Resources/PrintPreview/', root);
await mkdir(out, { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL('src/app.js', root))],
  outfile: fileURLToPath(new URL('preview.js', out)),
  bundle: true, minify: true, format: 'iife', target: 'safari17', legalComments: 'eof',
});
const html=await readFile(new URL('src/index.html',root),'utf8');
await writeFile(new URL('index.html',out),html.replace('../../Sources/PosterCore/Resources/PrintPreview/preview.js','preview.js'));
await copyFile(new URL('src/preview.css',root),new URL('preview.css',out));
await copyFile(new URL('node_modules/three/LICENSE', root), new URL('three-LICENSE.txt', out));
console.log('Built offline renderer → Sources/PosterCore/Resources/PrintPreview');
