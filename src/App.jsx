import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { getSession, onAuthStateChange } from './lib/auth';
import { loadSaveSlots } from './lib/persistence';
import { SCREEN, resolveScreen } from './state/screens';
import HomeScreen        from './components/screens/HomeScreen';
import TitleScreen       from './components/screens/TitleScreen';
import WorldScreen       from './components/screens/WorldScreen';
import SanctuaryScreen   from './components/screens/SanctuaryScreen';
import SanctuaryMapScreen from './components/screens/SanctuaryMapScreen';
import MissionScreen     from './components/screens/MissionScreen';
import SquadSelectionScreen from './components/screens/SquadSelectionScreen';
import GameOverScreen    from './components/screens/GameOverScreen';
import MissionResultsScreen from './components/screens/MissionResultsScreen';
import BestiaryScreen   from './components/screens/BestiaryScreen';
import ScreenErrorBoundary from './components/common/ScreenErrorBoundary';

export default function App() {
  const screen = useGameStore(s => s.screen);
  const activeSlot = useGameStore(s => s.activeSlot);
  const world = useGameStore(s => s.world);
  const worldPos = useGameStore(s => s.worldPos);
  const ms = useGameStore(s => s.ms);
  const missionResult = useGameStore(s => s.missionResult);
  const pendingSquad = useGameStore(s => s.pendingSquad);
  const setCurrentUser = useGameStore(s => s.setCurrentUser);
  const setSaveSlots = useGameStore(s => s.setSaveSlots);
  const setScreen = useGameStore(s => s.setScreen);
  const routedScreen = resolveScreen(screen, { activeSlot, world, worldPos, ms, missionResult, pendingSquad });

  useEffect(() => {
    let alive = true;

    async function hydrateSession(session) {
      if (!alive) return;

      if (!session) {
        setCurrentUser(null);
        setSaveSlots([]);
        return;
      }

      setCurrentUser(session.user);
      setSaveSlots(await loadSaveSlots(session.user.id));
    }

    getSession().then(hydrateSession);
    const unsub = onAuthStateChange(hydrateSession);

    return () => {
      alive = false;
      unsub();
    };
  }, [setCurrentUser, setSaveSlots]);

  useEffect(() => {
    if (routedScreen !== screen) setScreen(routedScreen);
  }, [routedScreen, screen, setScreen]);

  let rendered;
  switch (routedScreen) {
    case SCREEN.HOME:            rendered = <HomeScreen />; break;
    case SCREEN.TITLE:           rendered = <TitleScreen />; break;
    case SCREEN.WORLD:           rendered = <WorldScreen />; break;
    case SCREEN.SANCTUARY:       rendered = <SanctuaryScreen />; break;
    case SCREEN.SANCTUARY_MAP:   rendered = <SanctuaryMapScreen />; break;
    case SCREEN.SQUAD_SELECT:    rendered = <SquadSelectionScreen />; break;
    case SCREEN.MISSION:         rendered = <MissionScreen />; break;
    case SCREEN.MISSION_RESULTS: rendered = <MissionResultsScreen />; break;
    case SCREEN.GAME_OVER:       rendered = <GameOverScreen />; break;
    case SCREEN.BESTIARY:        rendered = <BestiaryScreen />; break;
    default:               rendered = <HomeScreen />;
  }

  return <ScreenErrorBoundary resetKey={routedScreen}>{rendered}</ScreenErrorBoundary>;
}
