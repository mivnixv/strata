import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('dist/pages/', root);
await rm(output, { recursive: true, force: true });
await mkdir(new URL('dist/', output), { recursive: true });

// Keep module-relative imports intact; only the browser entry point moves.
await cp(new URL('src/', root), new URL('src/', output), { recursive: true });
await cp(new URL('icons/', root), new URL('assets/icons/', output), { recursive: true });
await mkdir(new URL('standalone/', output), { recursive: true });
await cp(new URL('standalone/offline-export.js', root), new URL('standalone/offline-export.js', output));
await cp(new URL('dist/example.js', root), new URL('dist/example.js', output));
await cp(new URL('dist/standalone.html', root), new URL('dist/standalone.html', output));

const html = await readFile(new URL('src/index.html', root), 'utf8');
await writeFile(new URL('index.html', output), html
  .replace('href="style.css"', 'href="src/style.css"')
  .replace('src="app.js"', 'src="src/app.js"'));
await writeFile(new URL('.nojekyll', output), '');
console.log('Built full browser builder in dist/pages/');
