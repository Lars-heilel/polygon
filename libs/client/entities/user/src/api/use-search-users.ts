import { useEffect, useMemo, useRef, useState } from 'react';

import { debounce } from 'es-toolkit';

import { useMeQuery } from './user.api';
import { useSearchUsersQuery } from './search.api';

export function useSearchUsers() {
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const { data: me } = useMeQuery();

  const setDebounced = useMemo(() => debounce((v: string) => setDebouncedQuery(v), 300), []);

  const setDenouncedRef = useRef(setDebounced);
  setDenouncedRef.current = setDebounced;

  useEffect(() => () => setDenouncedRef.current.cancel(), []);

  function onChange(value: string) {
    setInputValue(value);
    setDenouncedRef.current(value);
  }

  const query = useSearchUsersQuery(debouncedQuery);
  const results = useMemo(
    () => (query.data ?? []).filter((user) => user.id !== me?.id),
    [me?.id, query.data],
  );

  return {
    inputValue,
    onChange,
    results,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
