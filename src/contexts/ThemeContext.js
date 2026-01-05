import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('app-theme') || 'modern-blue';
    });

    useEffect(() => {
        localStorage.setItem('app-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    const themeOptions = [
        { id: 'modern-blue', name: 'Modern Blue', color: '#1f3c88', type: 'light' },
        { id: 'ocean-light', name: 'Ocean Breeze', color: '#0ea5e9', type: 'light' },
        
    ];

    const toggleTheme = (newTheme) => {
        setTheme(newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme: toggleTheme, themeOptions }}>
            {children}
        </ThemeContext.Provider>
    );
};
