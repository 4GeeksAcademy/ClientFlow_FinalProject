import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; 
import { RouterProvider } from "react-router-dom"; 
import { router } from "./routes"; 
import { StoreProvider } from './hooks/useGlobalReducer'; 
import { BackendURL } from './components/BackendURL';
import { AppProvider } from './context/AppContext'; // 1. Importar el proveedor

const Main = () => {
    if(!import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_BACKEND_URL == "") return (
        <React.StrictMode>
            <BackendURL />
        </React.StrictMode>
    );
    return (
        <React.StrictMode>
            {/* 2. Envolver la aplicación con AppProvider */}
            <AppProvider>
                <StoreProvider>
                    <RouterProvider router={router}>
                    </RouterProvider>
                </StoreProvider>
            </AppProvider>
        </React.StrictMode>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Main />)