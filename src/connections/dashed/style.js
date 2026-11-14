export const CONNECTION_DASH_PATTERN = '8 6';

export function connectionOptions(relation) {
  const dashed=relation.dashed===undefined ? false : relation.dashed;

  if (typeof dashed!=='boolean') { throw new Error('Connection dashed must be a boolean.'); }

  return {dashed};
}

export function connectionStroke(relation) {
  return relation.dashed ? {'stroke-dasharray':CONNECTION_DASH_PATTERN} : {};
}
