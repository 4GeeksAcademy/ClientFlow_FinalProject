// src/services/appointmentService.js

// ✅ Forma correcta en Vite
const apiUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

// Helper para obtener los headers con autenticación Bearer
const getAuthHeaders = (token) => ({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${token}`
});

/**
 * Obtiene la lista de citas (opcionalmente filtradas por rango de fechas)
 */
export const getAppointments = async (token, startDate = "", endDate = "") => {
  let url = `${API_URL}/api/appointments`;
  
  // Agregar parámetros de fecha si están presentes
  if (startDate && endDate) {
    url += `?start_date=${startDate}&end_date=${endDate}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: getAuthHeaders(token)
  });

  if (!response.ok) {
    throw new Error("Error al obtener las citas");
  }

  return await response.json();
};

/**
 * Crea una nueva cita (maneja conflicto 409 si el horario está ocupado)
 */
export const createAppointment = async (token, appointmentData) => {
  const response = await fetch(`${API_URL}/api/appointments`, {
    method: "POST",
    headers: getAuthHeaders(token),
    body: JSON.stringify(appointmentData)
  });

  const data = await response.json();

  if (!response.ok) {
    // Lanzamos el error incluyendo el mensaje del backend (ej. conflicto de horario 409)
    throw { status: response.status, message: data.error || "Error al crear la cita" };
  }

  return data;
};

/**
 * Actualiza una cita existente
 */
export const updateAppointment = async (token, id, appointmentData) => {
  const response = await fetch(`${API_URL}/api/appointments/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(token),
    body: JSON.stringify(appointmentData)
  });

  const data = await response.json();

  if (!response.ok) {
    throw { status: response.status, message: data.error || "Error al actualizar la cita" };
  }

  return data;
};

/**
 * Cancela (soft-delete) una cita
 */
export const cancelAppointment = async (token, id) => {
  const response = await fetch(`${API_URL}/api/appointments/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(token)
  });

  const data = await response.json();

  if (!response.ok) {
    throw { status: response.status, message: data.error || "Error al cancelar la cita" };
  }

  return data;
};