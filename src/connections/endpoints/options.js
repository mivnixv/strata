export const ENDPOINT_TYPES=Object.freeze(['dot','circle','arrow','asterisk','square','none']);

export function endpointOptions(relation) {
  const result={};
  for (const end of ['start','end']) {
    const type=relation[end+'Type']===undefined ? (end==='start' ? 'none' : 'arrow') : relation[end+'Type'];
    const label=relation[end+'Label']===undefined ? '' : relation[end+'Label'];

    if (!ENDPOINT_TYPES.includes(type)) { throw new Error(`Connection ${end}Type must be one of: ${ENDPOINT_TYPES.join(', ')}.`); }
    if (typeof label!=='string' || label.length>500) { throw new Error(`Connection ${end}Label must be a string of at most 500 characters.`); }

    result[end+'Type']=type; result[end+'Label']=label;
  }
  return result;
}

/** Include decorations in every deduplication, bundling, and animation identity. */
export function endpointIdentity(relation) {
  return [relation.startType,relation.endType,relation.startLabel,relation.endLabel];
}
