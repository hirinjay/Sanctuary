import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { getSession, onAuthStateChange } from './lib/auth';
import { loadSaveSlots } from './lib/persistence';
import { isPlayableWorld } from './world/worldState';
import HomeScreen        from './components/screens/HomeScreen';
import TitleScreen       from './components/screens/TitleScreen';
import WorldScreen       from './components/screens/WorldScreen';
import SanctuaryScreen   from './components/screens/SanctuaryScreen';
import SanctuaryMapScreen from './components/screens/SanctuaryMapScreen';
import MissionScreen     from './components/screens/MissionScreen';
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
  const setCurrentUser = useGameStore(s => s.setCurrentUser);
  const setSaveSlots = useGameStore(s => s.setSaveSlots);
  const canShowWorld = isPlayableWorld(world, worldPos);

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

  if (screen === 'world' && !canShowWorld) {
    return activeSlot ? <TitleScreen /> : <HomeScreen />;
  }

  if (screen === 'mission' && !ms) {
    if (canShowWorld) return <WorldScreen />;
    return activeSlot ? <TitleScreen /> : <HomeScreen />;
  }

  if (!activeSlot && !['home', 'bestiary', 'gameover'].includes(screen)) {
    return <HomeScreen />;
  }
  let rendered;
  switch (screen) {
    case 'home':           rendered = <HomeScreen />; break;
    case 'title':          rendered = <TitleScreen />; break;
    case 'world':          rendered = <WorldScreen />; break;
    case 'sanctuary':      rendered = <SanctuaryScreen />; break;
    case 'sanctuarymap':   rendered = <SanctuaryMapScreen />; break;
    case 'mission':        rendered = <MissionScreen />; break;
    case 'missionResults': rendered = <MissionResultsScreen />; break;
    case 'gameover':       rendered = <GameOverScreen />; break;
    case 'bestiary':       rendered = <BestiaryScreen />; break;
    default:               rendered = <HomeScreen />;
  }

  return <ScreenErrorBoundary resetKey={screen}>{rendered}</ScreenErrorBoundary>;
}
