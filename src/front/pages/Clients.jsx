
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { clientService } from "../services/clientService";

export const Clients = () => {
    const [clients, setClients] = useState([]);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(0);
    const [reload, setReload] = useState(0);
    const [creating, setCreating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [createError, setCreateError] = useState("");
    const [options, setOptions] = useState(null);
    const createClient = async (event) => {
        event.preventDefault();
        setSaving(true);
        setCreateError("");
        try {
            const body = Object.fromEntries(new FormData(event.currentTarget));
            await clientService.create(options, body);
            setCreating(false);
            setPage(1);
            setReload(value => value + 1);
        } catch (error) { setCreateError(error.message); }
        finally { setSaving(false); }
    };
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    useEffect(() => {
        const controller = new AbortController();
        const loadClients = async () => {
            const token = localStorage.getItem("access_token");

            try {
                setLoading(true);
                setError("");

                const base = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

                const response = await fetch(`${base}/api/me`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (!response.ok) throw new Error("Unable to load your account.");
                const account = await response.json();
                const current = account.companies?.[0];

                if (!current) {
                    throw new Error("No se encontró una empresa activa.");
                }

                setOptions({ token, companyId: current.id });
                const data = await clientService.list(
                    {
                        token,
                        companyId: current.id,
                        signal: controller.signal,
                    },
                    page,
                    searchTerm,
                    statusFilter
                );

                if (controller.signal.aborted) return;
                setClients(data.items || []);
                setPages(data.pages || 0);
            } catch (err) {
                if (controller.signal.aborted) return;
                setError(err.message || "No se pudieron cargar los clientes.");
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        loadClients();
        return () => controller.abort();
    }, [page, searchTerm, statusFilter, reload]);

    const filteredClients = clients;

    const getStatusBadge = (status) => {
        switch (status) {
            case "active":
                return <span className="badge px-2 py-1" style={{ backgroundColor: "#198754", color: "#ffffff" }}>Activo</span>;
            case "lead":
                return <span className="badge px-2 py-1" style={{ backgroundColor: "#0d6efd", color: "#ffffff" }}>Lead</span>;
            default:
                return <span className="badge px-2 py-1" style={{ backgroundColor: "#6c757d", color: "#ffffff" }}>Inactivo</span>;
        }
    };

    return (
        <div className="container-fluid px-0">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                <div>
                    <h2 className="fw-bold text-dark mb-1">Gestión de Clientes</h2>
                    <p className="text-secondary small mb-0">Directorio de clientes, historial de encargos y próximas acciones.</p>
                </div>
                <div>
                    <button onClick={() => setCreating(true)} disabled={!options} className="btn btn-primary d-flex align-items-center gap-2 shadow-sm" style={{ backgroundColor: "#635bff", border: "none" }}>
                        <i className="fa-solid fa-user-plus"></i> Nuevo Cliente
                    </button>
                </div>
            </div>

            <div className="card border-0 shadow-sm mb-4 bg-white">
                <div className="card-body d-flex flex-column flex-md-row gap-3 justify-content-between align-items-center">
                    <div className="input-group" style={{ maxWidth: "350px" }}>
                        <span className="input-group-text bg-light border-end-0 text-secondary">
                            <i className="fa-solid fa-magnifying-glass"></i>
                        </span>
                        <input
                            type="text"
                            className="form-control border-start-0 bg-light text-dark shadow-none"
                            placeholder="Buscar por nombre, empresa..."
                            value={searchTerm}
                            onChange={(e) => { setPage(1); setSearchTerm(e.target.value); }}
                        />
                    </div>
                    <div>
                        <select
                            className="form-select bg-light text-dark shadow-none"
                            value={statusFilter}
                            onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
                        >
                            <option value="all">Todos los estados</option>
                            <option value="active">Activos</option>
                            <option value="inactive">Inactivos</option>
                        </select>
                    </div>
                </div>
            </div>

            {creating && <form onSubmit={createClient} className="card card-body mb-3">
                <h3>Nuevo cliente</h3>
                {[["first_name", "Nombre", true], ["last_name", "Apellidos", false], ["email", "Email", false], ["phone", "Teléfono", false]].map(([name, label, required]) => (
                    <label key={name}>{label}<input className="form-control mb-2" name={name} required={required} type={name === "email" ? "email" : "text"} maxLength={name === "email" ? 255 : name === "phone" ? 40 : 100} /></label>
                ))}
                {createError && <p role="alert">{createError}</p>}
                <button disabled={saving} className="btn btn-primary">Guardar</button>
                <button type="button" disabled={saving} onClick={() => setCreating(false)}>Cancelar</button>
            </form>}
            {loading && <p role="status">Cargando clientes…</p>}
            {error && <div role="alert">{error} <button onClick={() => setReload(value => value + 1)}>Reintentar</button></div>}
            {!loading && !error && clients.length === 0 && <p>No se encontraron clientes.</p>}
            {!loading && !error && <nav aria-label="Paginación" className="d-flex gap-3 mb-3">
                <button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Anterior</button>
                <span>Página {page} de {Math.max(1, pages)}</span>
                <button disabled={page >= pages} onClick={() => setPage(value => value + 1)}>Siguiente</button>
            </nav>}
            <div className="row g-3" hidden={loading || Boolean(error)}>
                {filteredClients.map(client => {
                    const fullName = `${client.first_name || ""} ${client.last_name || ""}`.trim();

                    return (
                        <div className="col-12 col-xl-6" key={client.id}>
                            <div className="card border-0 shadow-sm h-100 bg-white">
                                <div className="card-body d-flex flex-column justify-content-between p-4">
                                    <div>
                                        <div className="d-flex justify-content-between align-items-start mb-3">
                                            <div className="d-flex align-items-center gap-3">
                                                <img
                                                    src={client.avatar || "https://ui-avatars.com/api/?name=" + encodeURIComponent(fullName || "Cliente")}
                                                    alt={`Avatar de ${fullName || "Cliente"}`}
                                                    className="rounded-circle"
                                                    style={{ width: "50px", height: "50px", objectFit: "cover" }}
                                                />
                                                <div>
                                                    <h5 className="fw-bold text-dark mb-0">{fullName}</h5>
                                                    <span className="text-secondary small">{client.company}</span>
                                                </div>
                                            </div>
                                            {getStatusBadge(client.is_active ? "active" : "inactive")}
                                        </div>

                                        <div className="bg-light p-3 rounded-2 mb-3">
                                            <p className="text-secondary small mb-1">
                                                <i className="fa-solid fa-envelope me-2 text-primary"></i>{client.email}
                                            </p>
                                            <p className="text-secondary small mb-1">
                                                <i className="fa-solid fa-phone me-2 text-success"></i>{client.phone}
                                            </p>

                                        </div>
                                    </div>

                                    <div className="d-flex justify-content-between align-items-center pt-3 border-top border-light">

                                        <Link
                                            to={`/clients/${client.id}`}
                                            className="btn btn-sm btn-outline-primary d-flex align-items-center gap-2"
                                        >
                                            Ver Detalles <i className="fa-solid fa-arrow-right"></i>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Clients;