import { useContext } from 'react';
import { ProContext } from '../context/ProContext';
const empty = { membership: null, loading: false, error: null, refresh() {} };
export default function usePro() {
  return useContext(ProContext) || empty;
}
