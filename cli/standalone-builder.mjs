import { readFile } from 'node:fs/promises';
import { parseStrata } from '../src/language.js';
import { createOfflineHtml } from '../standalone/offline-export.js';

/** Shared by the CLI and the bundled example build. No generated files needed. */
export class StandaloneBuilder {
  constructor({read=readFile}={}) {
    this.read=read;
  }

  async collectIcons(model) {
    const icons={};
    for (const id of new Set(model.resources.map(resource=>resource.icon).filter(Boolean))) {
      let bytes;
      try { bytes=await this.read(new URL('../icons/'+id,import.meta.url)); }
      catch { throw new Error('Cannot read icon: '+id); }
      const extension=id.split('.').at(-1);
      const mime=extension==='svg' ? 'image/svg+xml' : extension==='jpg' ? 'image/jpeg' : 'image/'+extension;
      icons[id]=`data:${mime};base64,${bytes.toString('base64')}`;
    }
    return icons;
  }

  async build(source,presentation={},icons=null) {
    const example=parseStrata(source);
    const root=new URL('../src/',import.meta.url);
    const read=name=>this.read(new URL(name,root),'utf8');
    const names = ['themes/themes.js','typography/fit.js','icons/tint.js','icons/library.js','connections/endpoints/geometry.js','connections/dashed/style.js','connections/overlap.js','connections/hover.js','icons/tile-icon.js','zoom/pan.js','zoom/wheel.js','tiling/options.js','tiling/semantic.js','tiling/allocation.js','tiling/packing.js','motion.js','routing.js','tiling/engine.js','framework.js','language.js','example.js','offline-export.js','app.js'];
    const modules = await Promise.all(names.map(name => {

      if (name === 'example.js') { return 'export const example = '+JSON.stringify(example)+';\n'; }
      if (name === 'offline-export.js') { return this.read(new URL('../standalone/'+name,import.meta.url),'utf8'); }

      return read(name);
    }));
    // Modules have explicit named exports and one-line static imports only.
    const script = modules.map(source => source.replace(/^import .*;\n/gm,'').replace(/^export /gm,'')).join('\n');
    const css = await read('style.css');
    let html = await read('index.html');
    html = html.replace('<link rel="stylesheet" href="style.css">',() => `<style>${css}</style>`);
    html = html.replace('<script type="module" src="app.js"></script>',() => '<script id="strata-bootstrap" type="application/json">{}</script>\n<script>\n(() => {\n' + script.replace(/<\/script/gi,'<\\/script') + '\n})();\n</script>');
    html = html.replace('href="./"','href="#"');
    return createOfflineHtml(html,source,presentation,icons ?? await this.collectIcons(example));
  }
}
