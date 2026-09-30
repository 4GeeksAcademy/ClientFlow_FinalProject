import React, { createContext, useContext, useState, useEffect } from "react";

const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem("theme") || "system";
    });
    const [systemTheme, setSystemTheme] = useState(() =>
        window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    );
    const [density, setDensity] = useState(() => {
        const stored = localStorage.getItem("interface_density");
        return stored === "compact" ? "compact" : "comfortable";
    });

    const resolvedTheme = theme === "system" ? systemTheme : theme;

    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleSystemTheme = (event) => setSystemTheme(event.matches ? "dark" : "light");

        mediaQuery.addEventListener("change", handleSystemTheme);
        return () => mediaQuery.removeEventListener("change", handleSystemTheme);
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute("data-bs-theme", resolvedTheme);
        document.documentElement.style.colorScheme = resolvedTheme;
        localStorage.setItem("theme", theme);
    }, [resolvedTheme, theme]);

    useEffect(() => {
        document.documentElement.setAttribute("data-density", density);
        localStorage.setItem("interface_density", density);
    }, [density]);

    const toggleTheme = () => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
    };

    // Sistema de notificaciones simple (Toast) si lo requiere tu proyecto
    const showToast = (message, type = "success") => {
        console.log(`[Toast ${type}]: ${message}`);
    };

    return (
        <AppContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme, density, setDensity, showToast }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => useContext(AppContext);
