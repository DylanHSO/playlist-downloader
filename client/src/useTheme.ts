import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function currentTheme(): Theme {
  return (document.documentElement.getAttribute('data-theme') as Theme) || 'light';
}

// Het initiële thema wordt al vóór de paint gezet door het inline-script in
// index.html (voorkomt flikkeren); deze hook synchroniseert + togglet.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggle };
}
