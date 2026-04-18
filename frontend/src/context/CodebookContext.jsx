import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAccessToken } from '../lib/authStore';

const CodebookContext = createContext();

export const useCodebook = () => {
  const context = useContext(CodebookContext);
  if (!context) {
    throw new Error('useCodebook must be used within a CodebookProvider');
  }
  return context;
};

export const CodebookProvider = ({ children }) => {
  const [codes, setCodes] = useState({});
  const [allCodes, setAllCodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_BASE = 'https://sguardai.khcho0421.workers.dev';

  const fetchCodes = useCallback(async () => {
    const token = getAccessToken();
    // 🚫 Don't fetch without auth — prevents 401 on codebook endpoint
    if (!token) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/sms/codebook`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch codebook');
      
      const data = await response.json();
      const rawCodes = data.codes || [];
      setAllCodes(rawCodes);
      
      // Group by category
      const grouped = rawCodes.reduce((acc, code) => {
        if (!acc[code.category]) {
          acc[code.category] = [];
        }
        acc[code.category].push(code);
        return acc;
      }, {});
      
      setCodes(grouped);
      setError(null);
    } catch (err) {
      console.error('Codebook fetch error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    
    if (token) {
      fetchCodes();
    } else {
      setIsLoading(false);
    }
  }, [fetchCodes]);

  const getCodesByCategory = (category) => {
    return codes[category] || [];
  };

  const value = {
    codes,
    allCodes,
    isLoading,
    error,
    getCodesByCategory,
    refreshCodes: fetchCodes
  };

  return (
    <CodebookContext.Provider value={value}>
      {children}
    </CodebookContext.Provider>
  );
};
