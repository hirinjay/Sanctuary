export function isPlayableWorld(world, worldPos) {
  if (!world || !worldPos) return false;
  if (!Number.isFinite(world.width) || !Number.isFinite(world.height)) return false;
  if (!Array.isArray(world.tiles) || world.tiles.length === 0) return false;
  if (!Number.isInteger(worldPos.col) || !Number.isInteger(worldPos.row)) return false;
  if (worldPos.col < 0 || worldPos.row < 0) return false;
  if (worldPos.col >= world.width || worldPos.row >= world.height) return false;

  const tile = world.tiles[worldPos.row * world.width + worldPos.col];
  return Boolean(tile && tile.col === worldPos.col && tile.row === worldPos.row);
}
