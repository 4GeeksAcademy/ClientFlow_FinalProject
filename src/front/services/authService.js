// src/front/services/authService.js

const USE_REAL_API = false; 
const API_URL = import.meta.env.VITE_BACKEND_URL || "https://ideal-space-spoon-69xjqwgrx47pc5jgw-3001.app.github.dev/";

export const authService = {
  login: async (email, password) => {
    if (USE_REAL_API) {
      const response = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Error al iniciar sesión");
      return data;
    } else {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (email === "error@test.com") {
            reject(new Error("Credenciales inválidas (Simulado)"));
          } else {
            resolve({
              token: "mock_jwt_token_abc123",
              user: { email: email, name: "Usuario de Prueba" }
            });
          }
        }, 1000);
      });
    }
  },

  register: async (formData) => {
    if (USE_REAL_API) {
      const response = await fetch(`${API_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Error al registrar");
      return data;
    } else {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (!formData.code || formData.code.trim() === "") {
            reject(new Error("El código de acceso es obligatorio (Simulado)"));
          } else {
            resolve({ message: "Usuario registrado con éxito (Simulado)" });
          }
        }, 1000);
      });
    }
  },

  forgotPassword: async (email) => {
    if (USE_REAL_API) {
      const response = await fetch(`${API_URL}/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Error al enviar correo");
      return data;
    } else {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ message: "Correo de recuperación enviado (Simulado)" });
        }, 1000);
      });
    }
  },

  resetPassword: async (password) => {
    if (USE_REAL_API) {
      const response = await fetch(`${API_URL}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Error al actualizar contraseña");
      return data;
    } else {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ message: "Contraseña actualizada con éxito (Simulado)" });
        }, 1000);
      });
    }
  }
};