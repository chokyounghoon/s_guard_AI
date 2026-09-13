import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('sguard_theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
      }
    } catch {}
    return 'dark'; // Default to dark ops theme
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('sguard_theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const isLight = theme === 'light';

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isLight }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback if used outside provider
    const isDocLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
    return {
      theme: isDocLight ? 'light' : 'dark',
      setTheme: () => {},
      toggleTheme: () => {},
      isLight: isDocLight
    };
  }
  return context;
};

export default ThemeContext;
