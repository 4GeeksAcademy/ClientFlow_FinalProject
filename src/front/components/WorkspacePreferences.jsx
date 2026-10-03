import { useApp } from "../context/AppContext";
import { useLanguage } from "../context/LanguageContext";

const localeLabels = {
    es: "ES",
    en: "EN",
    pt: "PT",
};

export const WorkspacePreferences = ({ compact = false }) => {
    const { resolvedTheme, toggleTheme } = useApp();
    const { locale, setLocale, supportedLocales, t } = useLanguage();
    const darkMode = resolvedTheme === "dark";

    return (
        <div className={`workspace-preferences ${compact ? "workspace-preferences-compact" : ""}`}>
            <label className="language-control" title={t("preferences.language")}>
                <i className="fa-solid fa-language" aria-hidden="true"></i>
                <span className="visually-hidden">{t("preferences.language")}</span>
                <select
                    value={locale}
                    onChange={(event) => setLocale(event.target.value)}
                    aria-label={t("preferences.language")}
                >
                    {supportedLocales.map((language) => (
                        <option key={language} value={language}>
                            {localeLabels[language]}
                        </option>
                    ))}
                </select>
            </label>

            <button
                type="button"
                className="theme-control"
                onClick={toggleTheme}
                aria-label={darkMode ? t("preferences.useLight") : t("preferences.useDark")}
                title={darkMode ? t("preferences.useLight") : t("preferences.useDark")}
                aria-pressed={darkMode}
            >
                <i className={`fa-solid ${darkMode ? "fa-sun" : "fa-moon"}`} aria-hidden="true"></i>
                {!compact && (
                    <span>{darkMode ? t("preferences.light") : t("preferences.dark")}</span>
                )}
            </button>
        </div>
    );
};

export default WorkspacePreferences;
