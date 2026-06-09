import { isPlayableWorld } from '../world/worldState';

export const SCREEN = Object.freeze({
  HOME: 'home',
  TITLE: 'title',
  WORLD: 'world',
  SANCTUARY: 'sanctuary',
  SANCTUARY_MAP: 'sanctuarymap',
  MISSION: 'mission',
  MISSION_RESULTS: 'missionResults',
  GAME_OVER: 'gameover',
  BESTIARY: 'bestiary',
});

const VALID_SCREENS = new Set(Object.values(SCREEN));
const ACCOUNT_SCREENS = new Set([SCREEN.HOME, SCREEN.BESTIARY, SCREEN.GAME_OVER]);

export function normalizeScreen(screen) {
  return VALID_SCREENS.has(screen) ? screen : SCREEN.HOME;
}

export function resolveScreen(screen, state) {
  const target = normalizeScreen(screen);
  const activeSlot = state?.activeSlot ?? null;
  const canShowWorld = isPlayableWorld(state?.world, state?.worldPos);

  if (!activeSlot && !ACCOUNT_SCREENS.has(target)) return SCREEN.HOME;

  if (target === SCREEN.WORLD && !canShowWorld) {
    return activeSlot ? SCREEN.TITLE : SCREEN.HOME;
  }

  if (target === SCREEN.MISSION && !state?.ms) {
    if (state?.missionResult) return SCREEN.MISSION_RESULTS;
    if (canShowWorld) return SCREEN.WORLD;
    return activeSlot ? SCREEN.TITLE : SCREEN.HOME;
  }

  if (target === SCREEN.MISSION_RESULTS && !state?.missionResult) {
    if (canShowWorld) return SCREEN.WORLD;
    return activeSlot ? SCREEN.TITLE : SCREEN.HOME;
  }

  if ((target === SCREEN.SANCTUARY || target === SCREEN.SANCTUARY_MAP) && !activeSlot) {
    return SCREEN.HOME;
  }

  return target;
}
