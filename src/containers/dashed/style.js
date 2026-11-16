export function containerOptions(resource) {
  const dashed=resource.dashed===undefined ? false : resource.dashed;

  if (typeof dashed!=='boolean') { throw new Error('Resource dashed must be a boolean.'); }

  return {dashed};
}

export function containerStroke(resource) {
  return resource.dashed ? {'stroke-dasharray':'8 6'} : {};
}
