import { iconId } from '../../icons/library.js';
import { parseNoLargeIcon } from '../no-large-icon/no-large-icon.js';
import { parseSubheader } from '../subheader/subheader.js';
import { containerOptions } from '../../containers/dashed/style.js';

export const BUILTIN_TYPES=Object.freeze(['app','service','database','infrastructure','external','group']);
export const TYPE_LIMIT=100;
export const TYPE_STYLE_KEYS=Object.freeze(['color','background','icon','dashed','noLargeIcon','subheader']);
const reserved=new Set(['diagram','type','view','note','layout','start','end','connector','true','false','null']);

export function validTypeName(name) {
  return typeof name==='string' && name.length<=100 && /^[A-Za-z_][\w.-]*$/.test(name) && !reserved.has(name) && !['__proto__','prototype','constructor'].includes(name);
}

export function itemStyles(input) {
  const styles={};
  for (const key of TYPE_STYLE_KEYS) {

    if (!Object.hasOwn(input,key)) { continue; }

    const value=input[key];

    if (['color','background'].includes(key)) {

      if (typeof value!=='string' || !/^#[\da-f]{6}$/i.test(value)) { throw new Error(`${key} must be a six-digit hex color.`); }

      styles[key]=value;
    } else if (key==='icon') { styles.icon=iconId(value); }
    else if (key==='dashed') { styles.dashed=containerOptions(input).dashed; }
    else if (key==='noLargeIcon') { styles.noLargeIcon=parseNoLargeIcon(value); }
    else { styles.subheader=parseSubheader(value); }
  }
  return styles;
}

/** Definitions stay separate from item overrides so formatting preserves inheritance. */
export class ItemTypes {
  constructor(definitions=[]) {

    if (!Array.isArray(definitions) || definitions.length>TYPE_LIMIT) { throw new Error(`Types must be an array of at most ${TYPE_LIMIT} definitions.`); }

    this.byName=new Map();
    this.definitions=definitions.map(definition=>{

      if (!definition || typeof definition!=='object' || Array.isArray(definition) || !validTypeName(definition.name)) { throw new Error('Invalid item type name.'); }
      if (this.byName.has(definition.name)) { throw new Error(`Duplicate item type: ${definition.name}`); }
      if (Object.keys(definition).some(key=>key!=='name' && !TYPE_STYLE_KEYS.includes(key))) { throw new Error(`Unknown style for type: ${definition.name}`); }

      const parsed={name:definition.name,...itemStyles(definition)};
      this.byName.set(parsed.name,parsed);
      return parsed;
    });
  }
  has(name) { return BUILTIN_TYPES.includes(name) || this.byName.has(name); }
  preserveOverrides(input,normalized) {
    const defaults=this.byName.get(normalized.type);
    for (const key of TYPE_STYLE_KEYS) {

      if (defaults && Object.hasOwn(defaults,key) && !Object.hasOwn(input,key)) { delete normalized[key]; }

    }
    return normalized;
  }
  resolve(resource) {
    const {name,...defaults}=this.byName.get(resource.type) ?? {};
    return {...defaults,...resource};
  }
  palette(themePalette,neutral) {
    const colors={...themePalette};
    for (const definition of this.definitions) { colors[definition.name]=definition.color ?? (Object.hasOwn(colors,definition.name) ? colors[definition.name] : neutral); }
    return colors;
  }
}
