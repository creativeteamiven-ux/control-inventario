import { useEffect, useState } from 'react';

/**
 * Devuelve el valor con retardo, para que al escribir en un buscador no se
 * lance una petición por cada tecla.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
