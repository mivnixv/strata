import { ENDPOINT_TYPES } from '../connections/endpoints/options.js';
export const DSL_IDENTIFIER=/^[A-Za-z_][\w.-]*$/;
export const ITEM_PROPERTIES=Object.freeze({
  color:['color','string'], background:['background','string'],
  icon:['icon','nullable-string'], line:['dashed','line'], 'large-icon':['noLargeIcon','boolean'], subheader:['subheader','string']
});
export const DSL_PROPERTIES=Object.freeze({
  type:ITEM_PROPERTIES,
  item:{...ITEM_PROPERTIES,description:['description','string']},
  view:{description:['description','string'],include:['resources','ids'],relations:['inheritGlobalRelations','relations'],detail:['detail','number']},
  relation:{label:['label','string'],line:['dashed','line']},
  endpoint:{shape:['Type','shape'],label:['Label','string']},
  note:{on:['resource','id'],position:['position','id'],'font-size':['fontSize','number']},
  connector:{label:['label','string'],line:['dashed','line']},
  layout:{sizes:['sizes','sizes'],compactness:['compactness','number']}
});
export const DSL_ENUMS=Object.freeze({line:['solid','dashed'],relations:['inherit','local'],shape:ENDPOINT_TYPES,sizes:['auto','uniform','proportional']});
export function decodeDslValue(key,value) {

  if (key==='line') { return value==='dashed'; }
  if (key==='large-icon') { return !value; }
  if (key==='relations') { return value==='inherit'; }

  return value;
}
export function encodeDslValue(key,value) {

  if (key==='line') { return value ? 'dashed' : 'solid'; }
  if (key==='large-icon') { return !value; }
  if (key==='relations') { return value ? 'inherit' : 'local'; }

  return value;
}
