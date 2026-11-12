import { useCallback, useEffect, useState } from 'react';

// Carga datos de la API con estado de carga y error. reload() vuelve a pedirlos.
export function useApiData(loader, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, isLoading: enabled });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    loader()
      .then((data) => { if (active) setState({ data, error: null, isLoading: false }); })
      .catch((error) => { if (active) setState({ data: null, error, isLoading: false }); });
    return () => { active = false; };
  }, [loader, enabled, version]);

  const reload = useCallback(() => {
    setState((current) => ({ ...current, isLoading: true, error: null }));
    setVersion((value) => value + 1);
  }, []);

  return { ...state, reload };
}
