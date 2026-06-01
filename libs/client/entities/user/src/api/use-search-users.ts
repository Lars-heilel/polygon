import { useEffect, useMemo, useRef, useState } from 'react';

import { useSearchUsersQuery } from './search.api';
import { debounce } from 'es-toolkit';

export function useSearchUsers() {
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const setDebounced = useMemo(() => debounce((v: string) => setDebouncedQuery(v), 300), []);

  const setDenouncedRef = useRef(setDebounced);
  setDenouncedRef.current = setDebounced;

  useEffect(() => () => setDenouncedRef.current.cancel(), []);

  function onChange(value: string) {
    setInputValue(value);
    setDenouncedRef.current(value);
  }

  const query = useSearchUsersQuery(debouncedQuery);

  return {
    inputValue,
    onChange,
    results: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
