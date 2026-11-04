export function resolvePersistedPlaceIds(placeIds: string[], persistedIds: ReadonlyMap<string, string>) {
  const resolvedIds = placeIds.map((placeId) => persistedIds.get(placeId) ?? placeId);
  if (resolvedIds.some((placeId) => placeId.startsWith("local-"))) {
    throw new Error("This place is still being saved. Try moving it again.");
  }
  return resolvedIds;
}
