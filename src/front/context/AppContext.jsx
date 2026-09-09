import React, { createContext, useContext, useState, useEffect } from "react";

const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [language, setLanguage] = useState(localStorage.getItem("lang") || "ES");
    const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
    const [toast, setToast] = useState({ show: false, message: "", type: "success" });

    useEffect(() => {
        localStorage.setItem("lang", language);
    }, [language]);

    useEffect(() => {
        localStorage.setItem("theme", theme);
        // Esto cambia dinámicamente el tema de Bootstrap en todo el documento
        document.documentElement.setAttribute("data-bs-theme", theme);
    }, [theme]);

    const showToast = (message, type = "success") => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: "", type: "success" }), 4000);
    };

    return (
        <AppContext.Provider value={{ language, setLanguage, theme, setTheme, showToast, toast }}>
            {children}
            {toast.show && (
                <div className="position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1100 }}>
                    <div className={`toast show align-items-center text-white bg-${toast.type === "success" ? "success" : "danger"} border-0`} role="alert">
                        <div className="d-flex">
                            <div className="toast-body">
                                {toast.message}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AppContext.Provider>
    );
};

export const useApp = () => useContext(AppContext);