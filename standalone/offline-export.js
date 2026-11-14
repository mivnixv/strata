import { parseStrata } from '../src/language.js';
const bootstrapPattern = /(<script id="strata-bootstrap" type="application\/json">)[\s\S]*?(<\/script>)/;
/** Export data is escaped for HTML's script raw-text context, not just JSON. */
export function createOfflineHtml(template, source, presentation = {}, icons = {}) {
  parseStrata(source);

  if (!bootstrapPattern.test(template)) { throw new Error('The offline HTML template is unavailable.'); }

  const data = JSON.stringify({source,presentation,icons}).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
  return template.replace(/<html\b(?![^>]*data-offline-view)/i,'<html data-offline-view="true"')
    .replace(bootstrapPattern,(_,open,close) => open + data + close);
}
