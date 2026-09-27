import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { LanguageProvider } from "./context/LanguageContext";
import { StoreProvider } from "./hooks/useGlobalReducer";
import "./index.css";
import { router } from "./routes";

const Main = () => (
    <React.StrictMode>
        <AppProvider>
            <LanguageProvider>
                <StoreProvider>
                    <RouterProvider router={router} />
                </StoreProvider>
            </LanguageProvider>
        </AppProvider>
    </React.StrictMode>
);

ReactDOM.createRoot(document.getElementById("root")).render(<Main />);
