export function tileOptions(value,defaults={sizes:'auto',compactness:.6}) {
  const sizes=value.sizes ?? defaults.sizes, compactness=value.compactness ?? defaults.compactness;

  if (!['auto','uniform','proportional'].includes(sizes)) { throw new Error('sizes must be auto, uniform, or proportional.'); }
  if (!Number.isFinite(compactness) || compactness<.1 || compactness>1) { throw new Error('compactness must be between 0.1 and 1.'); }

  return {sizes,compactness};
}
export function detailValue(value) {

  if (!Number.isFinite(value) || value<0 || value>1) { throw new Error('detail must be between 0 and 1.'); }

  return value;
}
