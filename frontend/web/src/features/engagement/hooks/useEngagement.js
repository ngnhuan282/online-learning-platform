import { useContext } from 'react';
import { EngagementContext } from '../context/EngagementContext';
const empty = { summary: null, loading: false, error: null, refresh() {} };
export default function useEngagement() {
  return useContext(EngagementContext) || empty;
}
