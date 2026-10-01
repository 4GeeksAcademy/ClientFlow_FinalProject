import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { clientService } from "../services/clientService";
import { useLanguage } from "../context/LanguageContext";
import { translateLiteral } from "../i18n/literalTranslations.mjs";

const EMPTY_ADDRESS = {
    label: "Principal",
    line_1: "",
    line_2: "",
    city: "",
    postcode: "",
};

const nullable = (value) => value.trim() || null;

export const Clients = () => {
    const { locale, ui } = useLanguage();
    const [clients, setClients] = useState([]);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(0);
    const [reload, setReload] = useState(0);
    const [creating, setCreating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");
    const [options, setOptions] = useState(null);
    const [editingClient, setEditingClient] = useState(null);
    const [editingAddressId, setEditingAddressId] = useState(null);
    const [addressForm, setAddressForm] = useState({ ...EMPTY_ADDRESS });
    const [loadingAddress, setLoadingAddress] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    useEffect(() => {
        const controller = new AbortController();

        const loadClients = async () => {
            const token =
                localStorage.getItem("access_token") ||
                localStorage.getItem("token");

            try {
                setLoading(true);
                setError("");

                const base = (
                    import.meta.env.VITE_BACKEND_URL || ""
                ).replace(/\/$/, "");
                const response = await fetch(`${base}/api/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(ui.accountLoadError);
                }

                const account = await response.json();
                const current = account.companies?.[0];

                if (!current) {
                    throw new Error(ui.noCompany);
                }

                const requestOptions = {
                    token,
                    companyId: current.id,
                    signal: controller.signal,
                };

                setOptions({
                    token,
                    companyId: current.id,
                });

                const data = await clientService.list(
                    requestOptions,
                    page,
                    searchTerm,
                    statusFilter
                );

                if (controller.signal.aborted) return;

                setClients(data.items || []);
                setPages(data.pages || 0);
            } catch (loadError) {
                if (controller.signal.aborted) return;

                setError(
                    loadError.message ||
                    "No se pudieron cargar los clientes."
                );
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        loadClients();
        return () => controller.abort();
    }, [page, searchTerm, statusFilter, reload, ui.accountLoadError, ui.noCompany]);

    const closeForm = () => {
        setCreating(false);
        setEditingClient(null);
        setEditingAddressId(null);
        setAddressForm({ ...EMPTY_ADDRESS });
        setFormError("");
    };

    const openNewClient = () => {
        setEditingClient(null);
        setEditingAddressId(null);
        setAddressForm({ ...EMPTY_ADDRESS });
        setFormError("");
        setCreating(true);
    };

    const openEditClient = async (client) => {
        setEditingClient(client);
        setEditingAddressId(null);
        setAddressForm({ ...EMPTY_ADDRESS });
        setFormError("");
        setCreating(true);

        try {
            setLoadingAddress(true);
            const addresses = await clientService.getAddresses(
                options,
                client.id
            );
            const items = addresses.items || addresses || [];
            const primary =
                items.find((address) => address.is_primary) || items[0];

            if (primary) {
                setEditingAddressId(primary.id);
                setAddressForm({
                    label: primary.label || "Principal",
                    line_1: primary.line_1 || "",
                    line_2: primary.line_2 || "",
                    city: primary.city || "",
                    postcode: primary.postcode || "",
                });
            }
        } catch (addressError) {
            setFormError(
                addressError.message ||
                "No se pudo cargar la dirección del cliente."
            );
        } finally {
            setLoadingAddress(false);
        }
    };

    const saveClient = async (event) => {
        event.preventDefault();
        const fields = Object.fromEntries(
            new FormData(event.currentTarget)
        );
        const clientBody = {
            first_name: fields.first_name.trim(),
            last_name: nullable(fields.last_name),
            email: nullable(fields.email),
            phone: nullable(fields.phone),
            notes: nullable(fields.notes),
        };
        const addressBody = {
            label: nullable(addressForm.label),
            line_1: addressForm.line_1.trim(),
            line_2: nullable(addressForm.line_2),
            city: addressForm.city.trim(),
            postcode: addressForm.postcode.trim(),
            is_primary: true,
        };
        const hasAddress = Boolean(
            addressForm.line_1.trim() ||
            addressForm.line_2.trim() ||
            addressForm.city.trim() ||
            addressForm.postcode.trim()
        );

        if (
            hasAddress &&
            (!addressBody.line_1 || !addressBody.city || !addressBody.postcode)
        ) {
            setFormError(
                "Completa la dirección, la ciudad y el código postal."
            );
            return;
        }

        let savedClient = null;

        try {
            setSaving(true);
            setFormError("");

            savedClient = editingClient
                ? await clientService.update(
                    options,
                    editingClient.id,
                    clientBody
                )
                : await clientService.create(options, clientBody);

            if (hasAddress) {
                if (editingAddressId) {
                    await clientService.updateAddress(
                        options,
                        savedClient.id,
                        editingAddressId,
                        addressBody
                    );
                } else {
                    await clientService.createAddress(
                        options,
                        savedClient.id,
                        addressBody
                    );
                }
            }

            closeForm();
            setPage(1);
            setReload((value) => value + 1);
        } catch (saveError) {
            if (savedClient && !editingClient) {
                setEditingClient(savedClient);
                setReload((value) => value + 1);
            }

            setFormError(
                saveError.message ||
                "No se pudo guardar el cliente."
            );
        } finally {
            setSaving(false);
        }
    };

    const toggleClientStatus = async (client) => {
        const action = client.is_active
            ? translateLiteral("deactivate", locale)
            : translateLiteral("activate", locale);

        if (!window.confirm(translateLiteral("Do you want to {action} this client?", locale).replace("{action}", action))) {
            return;
        }

        try {
            await clientService.update(options, client.id, {
                is_active: !client.is_active,
            });
            setReload((value) => value + 1);
        } catch (statusError) {
            setError(
                statusError.message ||
                "No se pudo actualizar el estado del cliente."
            );
        }
    };

    const getStatusBadge = (isActive) => (
        <span
            className="badge px-2 py-1"
            style={{
                backgroundColor: isActive ? "#198754" : "#6c757d",
                color: "#ffffff",
            }}
        >
            {isActive ? ui.active : ui.inactive}
        </span>
    );

    return (
        <div className="container-fluid px-0">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                <div>
                    <span
                        className="text-uppercase fw-bold"
                        style={{ color: "#635bff", fontSize: "0.7rem", letterSpacing: "0.12em" }}
                    >
                        ClientFlow · Clientes
                    </span>
                    <h2 className="fw-bold text-dark mb-1 mt-1">
                        Gestión de Clientes
                    </h2>
                    <p className="text-secondary small mb-0">
                        Directorio de clientes, direcciones y actividad comercial.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={openNewClient}
                    disabled={!options}
                    className="btn btn-primary d-flex align-items-center gap-2 shadow-sm px-3 py-2"
                    style={{ backgroundColor: "#635bff", border: "none" }}
                >
                    <i className="fa-solid fa-user-plus"></i>
                    Nuevo cliente
                </button>
            </div>

            <div className="card border-0 shadow-sm mb-4 bg-white rounded-3">
                <div className="card-body d-flex flex-column flex-md-row gap-3 justify-content-between align-items-center">
                    <div className="input-group" style={{ maxWidth: "390px" }}>
                        <span className="input-group-text bg-light border-end-0 text-secondary">
                            <i className="fa-solid fa-magnifying-glass"></i>
                        </span>
                        <input
                            type="text"
                            className="form-control border-start-0 bg-light text-dark shadow-none"
                            placeholder="Buscar por nombre, email o teléfono..."
                            value={searchTerm}
                            onChange={(event) => {
                                setPage(1);
                                setSearchTerm(event.target.value);
                            }}
                        />
                    </div>

                    <select
                        className="form-select bg-light text-dark shadow-none"
                        style={{ maxWidth: "190px" }}
                        value={statusFilter}
                        onChange={(event) => {
                            setPage(1);
                            setStatusFilter(event.target.value);
                        }}
                    >
                        <option value="all">Todos los estados</option>
                        <option value="active">Activos</option>
                        <option value="inactive">Inactivos</option>
                    </select>
                </div>
            </div>

            {loading && <p role="status">Cargando clientes…</p>}
            {error && (
                <div className="alert alert-danger" role="alert">
                    {error}{" "}
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-danger ms-2"
                        onClick={() => setReload((value) => value + 1)}
                    >
                        Reintentar
                    </button>
                </div>
            )}
            {!loading && !error && clients.length === 0 && (
                <div className="card border-0 shadow-sm text-center p-5 text-secondary">
                    <i className="fa-regular fa-address-book fs-2 mb-3"></i>
                    No se encontraron clientes.
                </div>
            )}

            {!loading && !error && (
                <nav aria-label="Paginación" className="d-flex gap-3 mb-3 align-items-center">
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        disabled={page <= 1}
                        onClick={() => setPage((value) => value - 1)}
                    >
                        {ui.previous}
                    </button>
                    <span className="small text-secondary">
                        {ui.page} {page} {ui.of} {Math.max(1, pages)}
                    </span>
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        disabled={page >= pages}
                        onClick={() => setPage((value) => value + 1)}
                    >
                        {ui.next}
                    </button>
                </nav>
            )}

            <div className="row g-3" hidden={loading || Boolean(error)}>
                {clients.map((client) => {
                    const fullName = `${client.first_name || ""} ${client.last_name || ""}`.trim();

                    return (
                        <div className="col-12 col-xl-6" key={client.id}>
                            <div className="card border-0 shadow-sm h-100 bg-white rounded-3">
                                <div className="card-body d-flex flex-column justify-content-between p-4">
                                    <div>
                                        <div className="d-flex justify-content-between align-items-start mb-3">
                                            <div className="d-flex align-items-center gap-3">
                                                <span
                                                    aria-hidden="true"
                                                    className="rounded-circle text-white d-inline-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                                                    style={{
                                                        width: "50px",
                                                        height: "50px",
                                                        background: "linear-gradient(135deg, #635bff, #8b5cf6)",
                                                    }}
                                                >
                                                    {fullName
                                                        .split(/\s+/)
                                                        .filter(Boolean)
                                                        .slice(0, 2)
                                                        .map((part) => part[0])
                                                        .join("")
                                                        .toUpperCase() || "?"}
                                                </span>
                                                <div>
                                                    <h5 className="fw-bold text-dark mb-0">
                                                        {fullName}
                                                    </h5>
                                                    <span className="text-secondary small">
                                                        {translateLiteral("Cliente", locale)}
                                                    </span>
                                                </div>
                                            </div>
                                            {getStatusBadge(client.is_active)}
                                        </div>

                                        <div className="bg-light p-3 rounded-3 mb-3">
                                            <p className="text-secondary small mb-2">
                                                <i className="fa-solid fa-envelope me-2 text-primary"></i>
                                                {client.email || "Sin email"}
                                            </p>
                                            <p className="text-secondary small mb-0">
                                                <i className="fa-solid fa-phone me-2 text-success"></i>
                                                {client.phone || "Sin teléfono"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-3 border-top border-light">
                                        <Link
                                            to={`/clients/${client.id}`}
                                            className="btn btn-sm btn-outline-primary d-flex align-items-center gap-2"
                                        >
                                            Ver detalles
                                            <i className="fa-solid fa-arrow-right"></i>
                                        </Link>

                                        <div className="d-flex gap-2">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary"
                                                onClick={() => openEditClient(client)}
                                            >
                                                <i className="fa-solid fa-pen me-1"></i>
                                                Editar
                                            </button>
                                            <button
                                                type="button"
                                                className={`btn btn-sm ${client.is_active ? "btn-outline-danger" : "btn-outline-success"}`}
                                                onClick={() => toggleClientStatus(client)}
                                            >
                                                {client.is_active ? "Desactivar" : "Activar"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {creating && (
                <>
                    <div className="modal-backdrop fade show"></div>
                    <div
                        data-bs-theme="light"
                        className="modal fade show d-block"
                        tabIndex="-1"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="client-form-title"
                    >
                        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
                            <div
                                className="modal-content border-0 shadow-lg bg-white text-dark overflow-hidden"
                                style={{ borderRadius: "18px" }}
                            >
                                <div className="modal-header border-0 px-4 pt-4 pb-2 bg-white">
                                    <div className="d-flex align-items-center gap-3">
                                        <span
                                            className="rounded-3 text-white d-flex align-items-center justify-content-center"
                                            style={{
                                                width: "44px",
                                                height: "44px",
                                                background: "linear-gradient(135deg, #635bff, #8b5cf6)",
                                            }}
                                        >
                                            <i className={`fa-solid ${editingClient ? "fa-user-pen" : "fa-user-plus"}`}></i>
                                        </span>
                                        <div>
                                            <h5 id="client-form-title" className="modal-title fw-bold mb-1">
                                                {editingClient ? "Editar cliente" : "Nuevo cliente"}
                                            </h5>
                                            <p className="text-secondary small mb-0">
                                                Datos de contacto y dirección principal.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn-close shadow-none"
                                        aria-label="Cerrar"
                                        onClick={closeForm}
                                        disabled={saving}
                                    ></button>
                                </div>

                                <form
                                    key={editingClient?.id || "new"}
                                    onSubmit={saveClient}
                                >
                                    <div className="modal-body px-4 py-3 bg-white">
                                        <section className="mb-4">
                                            <div className="d-flex align-items-center gap-2 mb-3">
                                                <i className="fa-regular fa-user text-primary"></i>
                                                <h6 className="fw-bold mb-0">Datos del cliente</h6>
                                            </div>
                                            <div className="row g-3">
                                                {[
                                                    ["first_name", "Nombre", true, "text", 100],
                                                    ["last_name", "Apellidos", false, "text", 100],
                                                    ["email", "Email", false, "email", 255],
                                                    ["phone", "Teléfono", false, "tel", 40],
                                                ].map(([name, label, required, type, maxLength]) => (
                                                    <div className="col-12 col-md-6" key={name}>
                                                        <label className="form-label small fw-semibold text-secondary" htmlFor={`client-${name}`}>
                                                            {label}{required ? " *" : ""}
                                                        </label>
                                                        <input
                                                            id={`client-${name}`}
                                                            className="form-control bg-white text-dark"
                                                            name={name}
                                                            required={required}
                                                            type={type}
                                                            maxLength={maxLength}
                                                            defaultValue={editingClient?.[name] || ""}
                                                        />
                                                    </div>
                                                ))}

                                                <div className="col-12">
                                                    <label className="form-label small fw-semibold text-secondary" htmlFor="client-notes">
                                                        Notas
                                                    </label>
                                                    <textarea
                                                        id="client-notes"
                                                        className="form-control bg-white text-dark"
                                                        name="notes"
                                                        rows="2"
                                                        defaultValue={editingClient?.notes || ""}
                                                        placeholder="Preferencias, contexto o información útil del cliente"
                                                    ></textarea>
                                                </div>
                                            </div>
                                        </section>

                                        <section
                                            className="rounded-3 p-3 p-md-4"
                                            style={{ backgroundColor: "#f7f6ff", border: "1px solid #e8e5ff" }}
                                        >
                                            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                                                <div>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <i className="fa-solid fa-location-dot" style={{ color: "#635bff" }}></i>
                                                        <h6 className="fw-bold mb-0">Dirección principal</h6>
                                                    </div>
                                                    <p className="text-secondary small mb-0 mt-1">
                                                        Es opcional. Si empiezas a rellenarla, completa los campos obligatorios.
                                                    </p>
                                                </div>
                                                {loadingAddress && (
                                                    <span className="spinner-border spinner-border-sm text-primary" role="status" aria-label="Cargando dirección"></span>
                                                )}
                                            </div>

                                            <div className="row g-3">
                                                <div className="col-12 col-md-4">
                                                    <label className="form-label small fw-semibold text-secondary" htmlFor="address-label">
                                                        Etiqueta
                                                    </label>
                                                    <input
                                                        id="address-label"
                                                        className="form-control bg-white text-dark"
                                                        value={addressForm.label}
                                                        maxLength="60"
                                                        onChange={(event) => setAddressForm((current) => ({ ...current, label: event.target.value }))}
                                                        placeholder="Casa, oficina..."
                                                    />
                                                </div>
                                                <div className="col-12 col-md-8">
                                                    <label className="form-label small fw-semibold text-secondary" htmlFor="address-line-1">
                                                        Dirección
                                                    </label>
                                                    <input
                                                        id="address-line-1"
                                                        className="form-control bg-white text-dark"
                                                        value={addressForm.line_1}
                                                        maxLength="160"
                                                        onChange={(event) => setAddressForm((current) => ({ ...current, line_1: event.target.value }))}
                                                        placeholder="Calle, número y portal"
                                                    />
                                                </div>
                                                <div className="col-12">
                                                    <label className="form-label small fw-semibold text-secondary" htmlFor="address-line-2">
                                                        Piso, puerta u otra referencia
                                                    </label>
                                                    <input
                                                        id="address-line-2"
                                                        className="form-control bg-white text-dark"
                                                        value={addressForm.line_2}
                                                        maxLength="160"
                                                        onChange={(event) => setAddressForm((current) => ({ ...current, line_2: event.target.value }))}
                                                        placeholder="Opcional"
                                                    />
                                                </div>
                                                <div className="col-12 col-md-7">
                                                    <label className="form-label small fw-semibold text-secondary" htmlFor="address-city">
                                                        Ciudad
                                                    </label>
                                                    <input
                                                        id="address-city"
                                                        className="form-control bg-white text-dark"
                                                        value={addressForm.city}
                                                        maxLength="100"
                                                        onChange={(event) => setAddressForm((current) => ({ ...current, city: event.target.value }))}
                                                        placeholder="Sevilla"
                                                    />
                                                </div>
                                                <div className="col-12 col-md-5">
                                                    <label className="form-label small fw-semibold text-secondary" htmlFor="address-postcode">
                                                        Código postal
                                                    </label>
                                                    <input
                                                        id="address-postcode"
                                                        className="form-control bg-white text-dark"
                                                        value={addressForm.postcode}
                                                        maxLength="20"
                                                        onChange={(event) => setAddressForm((current) => ({ ...current, postcode: event.target.value }))}
                                                        placeholder="41001"
                                                    />
                                                </div>
                                            </div>
                                        </section>

                                        {formError && (
                                            <div className="alert alert-danger mt-3 mb-0" role="alert">
                                                {formError}
                                            </div>
                                        )}
                                    </div>

                                    <div className="modal-footer border-0 px-4 py-3 bg-light">
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary px-4"
                                            disabled={saving}
                                            onClick={closeForm}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn btn-primary px-4 fw-semibold"
                                            style={{ backgroundColor: "#635bff", border: "none" }}
                                            disabled={saving || loadingAddress}
                                        >
                                            {saving
                                                ? "Guardando..."
                                                : editingClient
                                                    ? "Guardar cambios"
                                                    : "Crear cliente"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Clients;
