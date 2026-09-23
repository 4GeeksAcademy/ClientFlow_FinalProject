const API_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:3001").replace(/\/$/, "");

async function request(path, { token, companyId, signal }, method = "GET", body) {
    const response = await fetch(`${API_URL}/api${path}`, {
        method, signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`,
            ...(companyId ? { "X-Company-ID": String(companyId) } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    if (!response.ok) {
        const messages = { 400: "Comprueba las fechas, el cliente, el trabajo y el responsable.",
            401: "Vuelve a iniciar sesión.", 403: "No tienes acceso a esta empresa.",
            404: "La cita ya no está disponible.", 409: "El responsable ya tiene una cita en ese horario.",
            503: "El servicio no está disponible. Inténtalo de nuevo." };
        const error = new Error(messages[response.status] || "No se pudo completar la operación.");
        error.status = response.status;
        throw error;
    }
    return data;
}
export const getAppointmentContext = (token, signal) => request('/me', { token, signal });
export const getAppointmentOptions = (options) => request('/appointments/options', options);
export const getAppointments = (options, startDate = '', endDate = '') => {
    const query = new URLSearchParams();
    if (startDate) query.set('start_date', startDate);
    if (endDate) query.set('end_date', endDate);
    return request(`/appointments?${query}`, options);
};
export const createAppointment = (options, data) => request('/appointments', options, 'POST', data);
export const updateAppointment = (options, id, data) => request(`/appointments/${id}`, options, 'PUT', data);
export const cancelAppointment = (options, id) => request(`/appointments/${id}`, options, 'DELETE');
