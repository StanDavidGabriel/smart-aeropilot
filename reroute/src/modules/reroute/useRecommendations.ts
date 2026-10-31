import { useQueries } from '@tanstack/react-query';
import { recommendationOptions } from './recommendations.query';
import type { SimulationState } from './simulation';

export function useRecommendations(state: SimulationState) {
  const flights = Object.values(state.flights).filter(f => f.cancelled);
  const excluded = flights.map(f => f.aircraft.id);
  const results = useQueries({ queries: flights.map(f => recommendationOptions(f.aircraft, excluded)) });
  return new Map(flights.map((f, i) => [f.aircraft.id, results[i]]));
}