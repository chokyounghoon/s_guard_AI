import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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
    setIsLoading(true);
    try {
      const savedUser = localStorage.getItem('sguard_user');
      const token = savedUser ? JSON.parse(savedUser).token : null;
      
      const response = await fetch(`${API_BASE}/sms/codebook`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
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
    const savedUser = localStorage.getItem('sguard_user');
    let token = localStorage.getItem('sguard_jwt');
    
    if (!token && savedUser) {
      try {
        const userObj = JSON.parse(savedUser);
        token = userObj.jwt || userObj.token;
      } catch (e) {}
    }
    
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
