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
        { id: 'midnight-navy', name: 'Midnight Navy', color: '#0f172a', type: 'dark' },
        { id: 'nordic-slate', name: 'Nordic Slate', color: '#334155', type: 'dark' },
        { id: 'royal-purple', name: 'Royal Purple', color: '#6d28d9', type: 'dark' },
        { id: 'emerald-green', name: 'Emerald Night', color: '#059669', type: 'dark' },
        { id: 'forest-pro', name: 'Forest Pro', color: '#14532d', type: 'dark' },
        { id: 'burgundy-classic', name: 'Burgundy Classic', color: '#7f1d1d', type: 'dark' },
        { id: 'sunset-rose', name: 'Sunset Rose', color: '#e11d48', type: 'dark' },
        { id: 'golden-dark', name: 'Golden Black', color: '#d4af37', type: 'dark' },
        { id: 'steel-grey', name: 'Steel Grey', color: '#27272a', type: 'dark' },
        { id: 'corporate-teal', name: 'Corporate Teal', color: '#0d9488', type: 'dark' },
        { id: 'cyberpunk', name: 'Cyberpunk', color: '#ff00ff', type: 'dark' },
        { id: 'luxury-obsidian', name: 'Luxury Obsidian', color: '#000000', type: 'dark' },
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
