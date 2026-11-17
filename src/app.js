import { ItemTypes } from './items/types/types.js';
import { themes, resolveTheme, applyTheme } from './themes/themes.js';
import { IconLibrary } from './icons/library.js';
import { ViewportPan } from './zoom/pan.js';
import { WheelZoom } from './zoom/wheel.js';
import { createOfflineHtml } from '../standalone/offline-export.js';
import { StrataDiagram, parseModel, LIMITS } from './framework.js';
import { parseStrata, formatStrata } from './language.js';
import { example } from '../dist/example.js';
const $ = id => document.getElementById(id);
const bootstrapElement = document.getElementById('strata-bootstrap');
const bootstrap = bootstrapElement ? JSON.parse(bootstrapElement.textContent) : null;
// Resolve deployment assets from the entry module, including repository subpaths.
const entryUrl=document.querySelector('script[type="module"][src$="app.js"]')?.src ?? document.baseURI;
const iconLibrary=new IconLibrary({embedded:bootstrap ? (bootstrap.icons ?? {}) : null,basePath:new URL('../assets/icons/',entryUrl).href});
let theme=resolveTheme(bootstrap?.presentation?.theme).id;
if (!bootstrap) {
  try { theme=resolveTheme(localStorage.getItem('strata.theme')).id; } catch {}
}
applyTheme(document.documentElement,theme);
for (const choice of themes) {
  const option=document.createElement('option');option.value=choice.id;option.textContent=choice.name;$('theme-select').append(option);
}
$('theme-select').value=theme;
$('theme-select').onchange=()=>{
  theme=applyTheme(document.documentElement,$('theme-select').value);
  try { localStorage.setItem('strata.theme',theme); } catch {}
  render();
};
const key = 'strata.source.v2';
const starter = "diagram \"My architecture\"\n\napp web \"Web app\"\n\nservice backend \"Backend\" {\n  service api \"API service\"\n  database db \"Database\"\n}\n\nweb -> api \"HTTPS\"\napi -> db \"SQL\"\n";
let model = example, perspective = 'orders', selected = null, selectedNote = null, collapsed = new Set(), zoom = 1;
let parseTimer, toastTimer;
let popupDismissed=false;
let detail = null;
function text(tag,value,className) {
  const e = document.createElement(tag); e.textContent = value;

  if (className) { e.className = className; }

  return e;
}
function notify(message) {
  $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; },3500);
}
const renderer = new StrataDiagram($('diagram'),{
  resolveIcon:id=>iconLibrary.resolve(id),
  onSelect(id) { selected = id; selectedNote=null; popupDismissed=false; render(); },
  onSelectNote(number) { selected=null; selectedNote=number; $('notes').checked=true; popupDismissed=false; render(); },
  onCollapse(id,isCollapsed) {
    selectedNote=null;
    if (isCollapsed) {
      collapsed.delete(id); detail=1;
    } else { collapsed.add(id); }
    render();
  }
});
function render() {
  document.title = `${model.title} — Strata`;
  const themeColors=resolveTheme(theme), types=new ItemTypes(model.types);
  const palette=types.palette(themeColors.palette,themeColors.muted);
  const legend=document.querySelector('.legend'); legend.replaceChildren();
  for (const [name,color] of Object.entries(palette)) {
    const entry=text('span',name), dot=document.createElement('i');
    dot.style.background=color; entry.prepend(dot); legend.append(entry);
  }
  const view = model.perspectives.find(p => p.id === perspective);
  const perspectives = $('perspective-select'); perspectives.replaceChildren();
  for (const view of model.perspectives) {
    const option = text('option',view.name); option.value = view.id; perspectives.append(option);
  }
  perspectives.value = perspective;
  const level=detail ?? view.detail; $('detail').value=String(level);
  const layout = renderer.render(model,{theme,perspective,collapsed,selected,selectedNote,detail:level,viewportWidth:Math.max(1,$('canvas').clientWidth),zoom,showNotes:$('notes').checked,showLabels:$('labels').checked});
  $('diagram').style.width = `${zoom*100}%`; $('zoom-value').textContent = `${Math.round(zoom*100)}%`;
  $('empty').hidden = layout.nodes.length > 0 || layout.notes.length > 0;
  const resources = $('resource-select'); resources.replaceChildren();
  const placeholder = text('option','Select resource…'); placeholder.value = ''; resources.append(placeholder);
  for (const node of layout.nodes) {
    const option = text('option',`${'— '.repeat(node.depth)}${node.resource.name}`);
    option.value = node.resource.id; resources.append(option);
  }
  resources.value = layout.nodes.some(node => node.resource.id === selected) ? selected : '';
  const panel = $('inspector'); panel.replaceChildren();
  const r = model.resources.find(r => r.id === selected); panel.hidden = !r || popupDismissed || !$('descriptions').checked;

  if (r) {
    const close = text('button','✕','close'); close.onclick = () => { popupDismissed=true; panel.hidden=true; };
    close.setAttribute('aria-label','Close description');
    panel.append(close,text('h3',r.name),text('p',r.description || 'No description.'));
  }
}
function applySource() {
  clearTimeout(parseTimer);
  $('line-count').textContent = `${$('source').value.split('\n').length} lines`;
  try {
    const next = parseStrata($('source').value); model = next;

    if (!model.perspectives.some(p => p.id === perspective)) { perspective = model.perspectives[0].id; }

    $('source-error').textContent = ''; $('editor-state').textContent = '● Valid model'; $('editor-state').className = 'valid';
    try { localStorage.setItem(key,$('source').value); $('save-status').textContent = 'Source saved in this browser'; }
    catch { $('save-status').textContent = 'Export source to save your work'; }
    render();
  } catch(error) {
    $('source-error').textContent = error.message; $('editor-state').textContent = '● Check source'; $('editor-state').className = 'invalid';

    if (!renderer.svg) {
      render();
      $('save-status').textContent = 'Saved source is invalid — showing the example preview';
      notify('Saved source could not be parsed. Edit it or use New to start over; your source is preserved.');
    } else {
      $('save-status').textContent = 'Preview shows the last valid model';
    }

  }
}
function loadSource(source) { $('source').value = source; collapsed.clear(); selected = null; selectedNote=null; popupDismissed=false; applySource(); }
$('source').oninput = () => { clearTimeout(parseTimer); $('editor-state').textContent = 'Updating…'; parseTimer = setTimeout(applySource,300); };
$('source').onkeydown = e => {

  if (e.key === 'Tab') {
    e.preventDefault(); const input = e.currentTarget;
    input.setRangeText('  ',input.selectionStart,input.selectionEnd,'end'); input.dispatchEvent(new Event('input'));
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); applySource(); }

};
$('format-source').onclick = () => {
  try { const next = parseStrata($('source').value); $('source').value = formatStrata(next); applySource(); }
  catch(error) { notify(error.message); }
};
$('new-diagram').onclick = () => {
  download('previous-diagram.strata',$('source').value,'text/plain'); loadSource(starter);
  notify('Starter loaded. Previous source downloaded as a backup.');
};
$('perspective-select').onchange = e => { perspective = e.target.value; selected = null; selectedNote=null; detail=null; render(); };
$('resource-select').onchange = e => { selected = e.target.value || null; selectedNote=null; popupDismissed=false; render(); };
$('detail').oninput = e => { detail=Number(e.target.value);render(); };
$('labels').onchange = render;
$('notes').onchange = () => { selectedNote=null; render(); };
$('descriptions').onchange = () => { popupDismissed=false; render(); };
$('collapse-all').onclick = () => { collapsed = new Set(model.resources.map(r => r.id)); render(); };
$('expand-all').onclick = () => { collapsed.clear(); detail=1; $('detail').value='1'; render(); };
const pan=new ViewportPan($('canvas'),$('diagram'));
$('canvas').addEventListener('click',()=>renderer.clearSelection());
new WheelZoom($('canvas'),{pan,getZoom:()=>zoom,setZoom:value=>{zoom=value;render();},settle:()=>renderer.finishAnimations()});
$('zoom-in').onclick = () => { zoom = Math.min(3,zoom+.2); render(); };
$('zoom-out').onclick = () => { zoom = Math.max(.4,zoom-.2); render(); };
$('fit').onclick = () => {
  zoom = 1; pan.reset(); render();
  $('canvas').scrollTo({left:0,top:0,behavior:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
};
function download(name,content,type) {
  const url = URL.createObjectURL(new Blob([content],{type})); const a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
$('export-html').onclick = async () => {
  try {
    parseStrata($('source').value);
    renderer.finishAnimations();
    let template;

    if (bootstrapElement) { template = '<!doctype html>\n' + document.documentElement.outerHTML; }
    else {
      const response = await fetch(new URL('../dist/standalone.html',entryUrl));

      if (!response.ok) { throw new Error('Offline template missing. Run npm run build.'); }

      template = await response.text();
    }

    const exportModel=parseStrata($('source').value), types=new ItemTypes(exportModel.types);
    const icons=await iconLibrary.collect(exportModel.resources.map(resource=>types.resolve(resource)));
    const html = createOfflineHtml(template,$('source').value,{theme,perspective,collapsed:[...collapsed],detail,zoom,showNotes:$('notes').checked,showLabels:$('labels').checked,showDescriptions:$('descriptions').checked},icons);
    download('architecture.html',html,'text/html');
    notify('Offline HTML exported — open it directly in any modern browser.');
  } catch(error) { notify(error.message); }
};
$('export').onclick = () => download('architecture.strata',$('source').value,'text/plain');
$('export-svg').onclick = () => download('architecture.svg',renderer.exportSvg(),'image/svg+xml');
$('import').onclick = () => { $('file').value = ''; $('file').click(); };
$('file').onchange = async e => {
  const file = e.target.files[0];

  if (!file) { return; }
  if (file.size > LIMITS.bytes) { notify('Choose a source file under 1 MB.'); return; }

  try {
    const content = await file.text();
    const source = file.name.endsWith('.json') ? formatStrata(parseModel(content)) : content;
    parseStrata(source); loadSource(source); notify('Source imported');
  } catch(error) { notify(error.message); }
};
$('help').onclick = () => $('guide').showModal(); $('guide-close').onclick = () => $('guide').close();
$('toggle-sidebar').onclick = () => {
  const hidden=!$('sidebar').hidden;
  $('sidebar').hidden=hidden;
  $('studio').classList.toggle('sidebar-collapsed',hidden);
  const button=$('toggle-sidebar');
  const label=hidden ? 'Expand sidebar' : 'Collapse sidebar';
  button.title=label;
  button.setAttribute('aria-label',label);
  button.setAttribute('aria-expanded',String(!hidden));
  button.textContent=hidden ? '◨' : '◧';
};
$('toggle-editor').onclick = () => { $('editor-pane').hidden = !$('editor-pane').hidden; render(); };
let resizeFrame;
new ResizeObserver(() => { cancelAnimationFrame(resizeFrame); resizeFrame=requestAnimationFrame(render); }).observe($('canvas'));
document.addEventListener('keydown',e => {

  if (e.key === 'Escape') { renderer.clearSelection(); }

});
if (bootstrap) {
  $('sidebar').hidden=true;
  $('studio').classList.add('sidebar-collapsed');
  $('toggle-sidebar').hidden=true;
  const perspectiveControl=$('perspective-select').parentElement;
  document.querySelector('.diagram-toolbar').prepend(perspectiveControl);
  loadSource(bootstrap.source);
  const presentation = bootstrap.presentation ?? {};

  if (model.perspectives.some(p => p.id === presentation.perspective)) { perspective = presentation.perspective; }
  if (Array.isArray(presentation.collapsed)) { collapsed = new Set(presentation.collapsed.filter(id => model.resources.some(r => r.id === id))); }
  if (Number.isFinite(presentation.detail) && presentation.detail>=0 && presentation.detail<=1) { detail=presentation.detail; $('detail').value=String(detail); }
  if (Number.isFinite(presentation.zoom)) { zoom = Math.min(3,Math.max(.4,presentation.zoom)); }
  $('descriptions').checked=presentation.showDescriptions===true;
  if (typeof presentation.showNotes === 'boolean') { $('notes').checked=presentation.showNotes; }
  if (typeof presentation.showLabels === 'boolean') { $('labels').checked = presentation.showLabels; }

  render();
} else {
  try { loadSource(localStorage.getItem(key) ?? formatStrata(example)); }
  catch { loadSource(formatStrata(example)); }
}
