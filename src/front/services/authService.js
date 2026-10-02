const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== "false";
const API_URL = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");
import { readApiJson } from "./response.mjs";

export const authService = {
  login: async (email, password) => {
    if (!USE_MOCK_API) {
      const response = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      return readApiJson(response, "Error al iniciar sesión");
    } else {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (email === "error@test.com") {
            reject(new Error("Credenciales inválidas (Simulado)"));
          } else {
            resolve({
              token: "mock-access-token-xyz",
              user: { email: email, name: "Usuario de Prueba" },
            });
          }
        }, 1000);
      });
    }
  },

  register: async (formData) => {
    if (!USE_MOCK_API) {
      const response = await fetch(`${API_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      return readApiJson(response, "Error al registrar");
    } else {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (!formData.email || !formData.password || !formData.firstName) {
            reject(new Error("Faltan campos obligatorios (Simulado)"));
          } else {
            resolve({
              token: "mock-access-token-xyz",
              message: "Usuario registrado con éxito (Simulado)"
            });
          }
        }, 1000);
      });
    }
  },

  forgotPassword: async (email) => {
    if (!USE_MOCK_API) {
      const response = await fetch(`${API_URL}/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      return readApiJson(response, "Error al enviar correo");
    } else {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ message: "Correo de recuperación enviado (Simulado)" });
        }, 1000);
      });
    }
  },

  resetPassword: async ({ token, password, password_confirmation }) => {
    if (!USE_MOCK_API) {
      const response = await fetch(`${API_URL}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, password_confirmation }),
      });
      return readApiJson(response, "Error al actualizar contraseña");
    } else {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (!token) {
            reject(new Error("Token inválido o faltante (Simulado)"));
          } else {
            resolve({ message: "Contraseña actualizada con éxito (Simulado)" });
          }
        }, 1000);
      });
    }
  },
};
