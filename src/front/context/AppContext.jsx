import React, { createContext, useContext, useState, useEffect } from "react";

const AppContext = createContext();

export const AppProvider = ({ children }) => {
    // Estado del tema: 'light', 'dark' o 'system'
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem("theme") || "system";
    });

    // Función para obtener la preferencia nativa del sistema operativo
    const getSystemTheme = () => 
        window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

    useEffect(() => {
        const root = document.documentElement;
        const currentTheme = theme === "system" ? getSystemTheme() : theme;

        // Aplicar el atributo data-bs-theme para Bootstrap o clases nativas
        root.setAttribute("data-bs-theme", currentTheme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    // Sistema de notificaciones simple (Toast) si lo requiere tu proyecto
    const showToast = (message, type = "success") => {
        console.log(`[Toast ${type}]: ${message}`);
    };

    return (
        <AppContext.Provider value={{ theme, setTheme, showToast }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => useContext(AppContext);