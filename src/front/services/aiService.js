const base = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');
export async function aiRequest(path, {token, companyId, signal}, body) {
    const response = await fetch(`${base}/api${path}`, {
        method: body === undefined ? 'GET' : 'POST', signal,
        headers: {Authorization: `Bearer ${token}`, 'X-Company-ID': String(companyId), 'Content-Type': 'application/json'},
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(response.status === 409
        ? 'La conversación o las fuentes cambiaron. Genera otro borrador.'
        : response.status === 403 ? 'No tienes permiso para esta operación.'
        : 'No se pudo completar la operación. Comprueba la configuración y el agente asignado.');
    return data;
}
