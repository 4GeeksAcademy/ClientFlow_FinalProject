import React, { createContext, useContext, useState, useEffect } from "react";
import { translations } from "../i18n/translations";

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    // Recupera el idioma guardado o por defecto usa español ('es')
    const [locale, setLocale] = useState(() => {
        return localStorage.getItem("app_locale") || "es";
    });

    useEffect(() => {
        localStorage.setItem("app_locale", locale);
    }, [locale]);

    // Función traductora recursiva (ej: t('agenda.title'))
    const t = (path) => {
        const keys = path.split(".");
        let current = translations[locale];
        
        for (const key of keys) {
            if (current && current[key] !== undefined) {
                current = current[key];
            } else {
                // Fallback a inglés o la llave original si no existe
                let fallback = translations["en"];
                for (const fk of keys) {
                    if (fallback && fallback[fk] !== undefined) fallback = fallback[fk];
                    else return path;
                }
                return fallback;
            }
        }
        return current;
    };

    return (
        <LanguageContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);