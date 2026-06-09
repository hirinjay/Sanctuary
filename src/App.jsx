import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { getSession, onAuthStateChange } from './lib/auth';
import { loadSaveSlots } from './lib/persistence';
import HomeScreen        from './components/screens/HomeScreen';
import TitleScreen       from './components/screens/TitleScreen';
import WorldScreen       from './components/screens/WorldScreen';
import SanctuaryScreen   from './components/screens/SanctuaryScreen';
import SanctuaryMapScreen from './components/screens/SanctuaryMapScreen';
import MissionScreen     from './components/screens/MissionScreen';
import GameOverScreen    from './components/screens/GameOverScreen';
import BestiaryScreen   from './components/screens/BestiaryScreen';

export default function App() {
  const screen = useGameStore(s => s.screen);
  const activeSlot = useGameStore(s => s.activeSlot);
  const world = useGameStore(s => s.world);
  const worldPos = useGameStore(s => s.worldPos);
  const setScreen = useGameStore(s => s.setScreen);
  const setCurrentUser = useGameStore(s => s.setCurrentUser);
  const setSaveSlots = useGameStore(s => s.setSaveSlots);

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
    if (!activeSlot && !['home', 'bestiary', 'gameover'].includes(screen)) {
      setScreen('home');
      return;
    }

    if (activeSlot && screen === 'world' && (!world || !worldPos)) {
      setScreen('title');
    }
  }, [activeSlot, screen, setScreen, world, worldPos]);

  if (!activeSlot && !['home', 'bestiary', 'gameover'].includes(screen)) {
    return <HomeScreen />;
  }

  if (activeSlot && screen === 'world' && (!world || !worldPos)) {
    return <TitleScreen />;
  }
  switch (screen) {
    case 'home':         return <HomeScreen />;
    case 'title':        return <TitleScreen />;
    case 'world':        return <WorldScreen />;
    case 'sanctuary':    return <SanctuaryScreen />;
    case 'sanctuarymap': return <SanctuaryMapScreen />;
    case 'mission':      return <MissionScreen />;
    case 'gameover':     return <GameOverScreen />;
    case 'bestiary':     return <BestiaryScreen />;
    default:             return <HomeScreen />;
  }
}
