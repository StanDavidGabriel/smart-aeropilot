import { useEffect, useState } from 'react';
import { emptySimulation, readSimulation, subscribeSimulation } from './simulation';

export function useSimulation() {
  const [state, setState] = useState(emptySimulation);
  useEffect(() => {
    const update = () => setState(readSimulation());
    const unsubscribe = subscribeSimulation(update);
    update();
    return unsubscribe;
  }, []);
  return state;
}