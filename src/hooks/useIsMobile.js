import { useEffect, useState } from 'react';

export default function useIsMobile(maxWidth = 760) {
  const getMatch = () => typeof window !== 'undefined' && window.matchMedia('(max-width: ' + maxWidth + 'px)').matches;
  const [matches, setMatches] = useState(getMatch);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: ' + maxWidth + 'px)');
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [maxWidth]);

  return matches;
}
