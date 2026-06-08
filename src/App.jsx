import { useGameStore } from './store/gameStore';
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
