import { useEffect, useRef, useState } from 'react';
import { getSessionVersion } from '../../../shared/utils/tokenUtils';

export default function useWorkspaceMutation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function run(operation, onSuccess) {
    if (pending.current) return;
    pending.current = true;
    const session = getSessionVersion();
    setBusy(true);
    setError(null);
    try {
      const response = await operation();
      if (mounted.current && session === getSessionVersion()) onSuccess?.(response);
    } catch (failure) {
      if (mounted.current && session === getSessionVersion()) setError(failure);
    } finally {
      pending.current = false;
      if (mounted.current && session === getSessionVersion()) setBusy(false);
    }
  }
  return { busy, error, run };
}
