import { useGameStore } from './store/gameStore';
import TitleScreen     from './components/screens/TitleScreen';
import OverworldScreen from './components/screens/OverworldScreen';
import SanctuaryScreen from './components/screens/SanctuaryScreen';
import MissionScreen   from './components/screens/MissionScreen';
import GameOverScreen  from './components/screens/GameOverScreen';

export default function App() {
  const screen = useGameStore(s => s.screen);
  switch (screen) {
    case 'title':     return <TitleScreen />;
    case 'overworld': return <OverworldScreen />;
    case 'sanctuary': return <SanctuaryScreen />;
    case 'mission':   return <MissionScreen />;
    case 'gameover':  return <GameOverScreen />;
    default:          return <TitleScreen />;
  }
}
