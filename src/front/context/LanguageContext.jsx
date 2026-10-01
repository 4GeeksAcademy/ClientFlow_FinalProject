import React, { createContext, useContext, useState, useEffect } from "react";
import { translations } from "../i18n/translations";
import { interfaceText, validateInterfaceMessages } from "../i18n/messages.mjs";
import { literalMessage, translateLiteral, validateLiteralTranslations } from "../i18n/literalTranslations.mjs";

const LanguageContext = createContext();
const supportedLocales = ["es", "en", "pt"];
const literalOrigins = new WeakMap();

export const LanguageProvider = ({ children }) => {
    // Recupera el idioma guardado o por defecto usa español ('es')
    const [locale, setLocale] = useState(() => {
        const storedLocale = localStorage.getItem("app_locale");
        return supportedLocales.includes(storedLocale) ? storedLocale : "es";
    });

    useEffect(() => {
        localStorage.setItem("app_locale", locale);
        document.documentElement.lang = locale;
    }, [locale]);

    useEffect(() => {
        if (!import.meta.env.DEV) return;
        const missing = [...validateInterfaceMessages(), ...validateLiteralTranslations()];
        if (missing.length) console.warn(`Missing translations: ${missing.join(", ")}`);
    }, []);

    useEffect(() => {
        if (typeof document === "undefined" || typeof MutationObserver === "undefined") return undefined;
        const attributes = ["placeholder", "aria-label", "title"];
        const translateNode = (root) => {
            if (root.nodeType === Node.TEXT_NODE) {
                const match = root.nodeValue.match(/^(\s*)(.*?)(\s*)$/s);
                if (!match?.[2]) return;
                let translations = literalOrigins.get(root);
                if (!translations || !Object.values(translations).includes(match[2])) {
                    translations = literalMessage(match[2]);
                    if (translations) literalOrigins.set(root, translations);
                }
                const translated = translations?.[locale] || match[2];
                if (translated !== match[2]) root.nodeValue = `${match[1]}${translated}${match[3]}`;
                return;
            }
            if (root.nodeType !== Node.ELEMENT_NODE) return;
            for (const attribute of attributes) {
                if (root.hasAttribute(attribute)) {
                    const value = root.getAttribute(attribute);
                    const translated = translateLiteral(value, locale);
                    if (translated !== value) root.setAttribute(attribute, translated);
                }
            }
            root.childNodes.forEach(translateNode);
        };
        translateNode(document.body);
        const observer = new MutationObserver((records) => records.forEach((record) => {
            if (record.type === "characterData") translateNode(record.target);
            record.addedNodes.forEach(translateNode);
        }));
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        return () => observer.disconnect();
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
        <LanguageContext.Provider value={{ locale, setLocale, supportedLocales, t, ui: interfaceText(locale) }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
