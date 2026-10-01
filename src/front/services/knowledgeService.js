const base = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");
import { readApiJson } from "./response.mjs";

async function request(path, { token, companyId, signal, method = "GET", body }) {
    const response = await fetch(`${base}/api/knowledge/documents${path}`, {
        method, signal, body,
        headers: { Authorization: `Bearer ${token}`, "X-Company-ID": String(companyId) },
    });
    if (!response.ok) {
        const messages = {
            401: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
            403: "No tienes permisos para esta operación.",
            404: "El documento ya no está disponible.",
            409: "El documento se está procesando. Espera y actualiza la lista.",
            413: "El archivo supera el límite de 10 MB.",
            422: "No se pudo procesar el documento. Comprueba el archivo y el servicio de IA.",
            503: "El servicio no está disponible. Inténtalo de nuevo.",
        };
        try {
            return await readApiJson(response, messages[response.status]);
        } catch {
            throw new Error(messages[response.status] || "No se pudo completar la operación. Comprueba el formato y el tamaño del archivo.");
        }
    }
    return readApiJson(response, "El servidor devolvió una respuesta no válida.");
}

export const knowledgeService = {
    list: (options, page) => request(`?page=${page}&per_page=20`, options),
    upload: (options, body) => request("", { ...options, method: "POST", body }),
    process: (options, id) => request(`/${id}/process`, { ...options, method: "POST" }),
    remove: (options, id) => request(`/${id}`, { ...options, method: "DELETE" }),
    chunks: (options, id, page) => request(`/${id}/chunks?page=${page}`, options),
};
