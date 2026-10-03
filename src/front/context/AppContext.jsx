import React, { createContext, useContext, useState, useEffect } from "react";

const AppContext = createContext();

const DEFAULT_BRAND = "#635BFF";
const normalizeBrand = (value) => /^#[0-9a-f]{6}$/i.test(value || "")
    ? value.toUpperCase()
    : DEFAULT_BRAND;

const brandRgb = (value) => {
    const colour = normalizeBrand(value).slice(1);
    return [0, 2, 4].map((offset) => parseInt(colour.slice(offset, offset + 2), 16)).join(", ");
};

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
    const [brandColour, setBrandColourState] = useState(() =>
        normalizeBrand(localStorage.getItem("brand_colour"))
    );

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

    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty("--cf-brand", brandColour);
        root.style.setProperty("--cf-brand-rgb", brandRgb(brandColour));
        root.style.setProperty("--bs-primary", brandColour);
        root.style.setProperty("--bs-primary-rgb", brandRgb(brandColour));
        localStorage.setItem("brand_colour", brandColour);
    }, [brandColour]);

    const setBrandColour = (value) => setBrandColourState(normalizeBrand(value));

    const toggleTheme = () => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
    };

    // Sistema de notificaciones simple (Toast) si lo requiere tu proyecto
    const showToast = (message, type = "success") => {
        console.log(`[Toast ${type}]: ${message}`);
    };

    return (
        <AppContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme, density, setDensity, brandColour, setBrandColour, showToast }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => useContext(AppContext);
