import { useEffect, useState } from 'react';
import { dictationApi } from '../api/dictationApi';

export function useDictationQuery(path, params = {}, options = {}) {
  const { enabled = true, scope = '' } = options;
  const key = JSON.stringify(params);
  const [state, setState] = useState({ loading: Boolean(path), data: null, error: null });
  const [retry, setRetry] = useState(0);
  const queryKey = JSON.stringify([path, key, scope, retry]);
  useEffect(() => {
    if (!path || !enabled) return undefined;
    const controller = new AbortController();
    let active = true;
    Promise.resolve()
      .then(() => {
        if (active) setState({ loading: true, data: null, error: null, queryKey });
        return dictationApi.query(path, JSON.parse(key), controller.signal);
      })
      .then(response => {
        if (active) setState({ loading: false, data: response.data, error: null, queryKey });
      })
      .catch(error => {
        if (active) setState({ loading: false, data: null, error, queryKey });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [path, key, retry, queryKey, enabled]);
  const current =
    enabled && state.queryKey === queryKey ? state : { loading: Boolean(path), data: null, error: null };
  return { ...current, reload: () => setRetry(value => value + 1) };
}

export function useDictationAudio(id, admin = false) {
  const [state, setState] = useState({ src: '', error: null, loading: true });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true,
      url;
    const controller = new AbortController();
    Promise.resolve()
      .then(async () => {
        if (!id) {
          if (active) setState({ src: '', error: null, loading: false });
          return;
        }
        if (active) setState({ src: '', error: null, loading: true });
        const blob = await (admin
          ? dictationApi.adminAudio(id, controller.signal)
          : dictationApi.audio(id, controller.signal));
        if (!active) return;
        url = URL.createObjectURL(blob);
        setState({ src: url, error: null, loading: false });
      })
      .catch(error => {
        if (active) setState({ src: '', error, loading: false });
      });
    return () => {
      active = false;
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, admin, retry]);
  return { ...state, reload: () => setRetry(value => value + 1) };
}
