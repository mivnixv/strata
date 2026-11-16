export function parseNoLargeIcon(value=false) {

  if (typeof value!=='boolean') { throw new Error('Item noLargeIcon must be a boolean.'); }

  return value;
}
