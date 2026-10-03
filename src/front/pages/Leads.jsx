import { useEffect, useRef, useState } from "react";
import { leadService } from "../services/leadService";
import "../styles/leads.css";
import { useLanguage } from "../context/LanguageContext";
import { translateLiteral } from "../i18n/literalTranslations.mjs";
import { readApiJson } from "../services/response.mjs";

const STATUS_LABELS = {
    new: "Nuevo",
    contacted: "Contactado",
    qualified: "Calificado",
    won: "Ganado",
    lost: "Perdido",
};

const EMPTY_LEAD_FORM = {
    name: "",
    email: "",
    phone: "",
    origin: "WhatsApp",
    service: "",
    serviceZone: "",
    priority: "Media",
    description: "",
    internalNotes: "",
    status: "new",
    assignedMembershipId: "",
    consentGiven: false,
};

const emptyActionForm = () => {
    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const local = new Date(dueAt.getTime() - dueAt.getTimezoneOffset() * 60000);

    return {
        title: "",
        description: "",
        dueAt: local.toISOString().slice(0, 16),
    };
};

const parseNotes = (notes = "") => {
    const parsed = {
        service: "",
        serviceZone: "",
        priority: "",
        description: [],
        internalNotes: "",
    };

    notes.split("\n").forEach((rawLine) => {
        const line = rawLine.trim();

        if (!line) return;
        if (line.startsWith("Requested service:")) {
            parsed.service = line.slice("Requested service:".length).trim();
        } else if (line.startsWith("Service area:")) {
            parsed.serviceZone = line.slice("Service area:".length).trim();
        } else if (line.startsWith("Priority:")) {
            parsed.priority = line.slice("Priority:".length).trim();
        } else if (line.startsWith("Internal notes:")) {
            parsed.internalNotes = line.slice("Internal notes:".length).trim();
        } else {
            parsed.description.push(line);
        }
    });

    return {
        ...parsed,
        description: parsed.description.join("\n"),
    };
};

const buildNotes = (form) => [
    `Requested service: ${form.service.trim()}`,
    form.serviceZone.trim()
        ? `Service area: ${form.serviceZone.trim()}`
        : "",
    form.priority ? `Priority: ${form.priority}` : "",
    form.description.trim(),
    form.internalNotes.trim()
        ? `Internal notes: ${form.internalNotes.trim()}`
        : "",
].filter(Boolean).join("\n");

const mapLead = (lead, locale) => {
    const notes = parseNotes(lead.notes || "");

    return {
        ...lead,
        name: [lead.first_name, lead.last_name].filter(Boolean).join(" "),
        origin: lead.source || translateLiteral("Sin origen", locale),
        service: notes.service || (
            lead.service_type_id
                ? `${translateLiteral("Servicio", locale)} #${lead.service_type_id}`
                : translateLiteral("No especificado", locale)
        ),
        serviceZone: notes.serviceZone,
        priority: notes.priority || translateLiteral("Sin prioridad", locale),
        description: notes.description,
        internalNotes: notes.internalNotes,
        assignedUser: lead.assigned_membership_id
            ? `${translateLiteral("Miembro", locale)} #${lead.assigned_membership_id}`
            : translateLiteral("Sin asignar", locale),
        statusCode: lead.status,
        status: translateLiteral(STATUS_LABELS[lead.status] || lead.status, locale),
    };
};

const formatDate = (value, locale) => value
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value))
    : translateLiteral("Sin fecha", locale);

const statusClass = (status) => {
    switch (status) {
        case "new":
            return "bg-info bg-opacity-10 text-info border border-info border-opacity-25";
        case "qualified":
            return "bg-success bg-opacity-10 text-success border border-success border-opacity-25";
        case "contacted":
            return "bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25";
        case "won":
            return "bg-success text-white";
        case "lost":
            return "bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25";
        default:
            return "bg-secondary bg-opacity-10 text-secondary";
    }
};

export const Leads = () => {
    const { locale, ui } = useLanguage();
    const statusLabels = Object.fromEntries(Object.entries(STATUS_LABELS).map(([key, value]) => [key, translateLiteral(value, locale)]));
    const [leads, setLeads] = useState([]);
    const [options, setOptions] = useState(null);
    const [companyName, setCompanyName] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reload, setReload] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(0);
    const [total, setTotal] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterOrigin, setFilterOrigin] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [showFilters, setShowFilters] = useState(false);

    const [showLeadForm, setShowLeadForm] = useState(false);
    const [leadForm, setLeadForm] = useState({ ...EMPTY_LEAD_FORM });
    const [editingLeadId, setEditingLeadId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");

    const [selectedLead, setSelectedLead] = useState(null);
    const [activities, setActivities] = useState([]);
    const [nextActions, setNextActions] = useState([]);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState("");
    const [converting, setConverting] = useState(false);
    const detailRequest = useRef(0);

    const [showActionForm, setShowActionForm] = useState(false);
    const [actionForm, setActionForm] = useState(emptyActionForm);
    const [savingAction, setSavingAction] = useState(false);
    const [actionError, setActionError] = useState("");

    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            const token = localStorage.getItem("access_token") || localStorage.getItem("token");

            try {
                setLoading(true);
                setError("");

                if (!token) throw new Error("Debes iniciar sesión.");

                const base = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");
                const accountResponse = await fetch(`${base}/api/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: controller.signal,
                });

                const account = await readApiJson(
                    accountResponse,
                    translateLiteral("Unable to verify your account.", locale)
                );
                const currentCompany = account.companies?.[0];

                if (!currentCompany) {
                    throw new Error("No se encontró una empresa activa.");
                }

                const requestOptions = {
                    token,
                    companyId: currentCompany.id,
                    membershipId: currentCompany.membership_id,
                };

                setOptions(requestOptions);
                setCompanyName(currentCompany.name || "Empresa");

                const data = await leadService.list(
                    { ...requestOptions, signal: controller.signal },
                    {
                        page,
                        search: searchTerm,
                        status: filterStatus,
                        source: filterOrigin,
                    }
                );

                if (controller.signal.aborted) return;

                setLeads((data.items || []).map((lead) => mapLead(lead, locale)));
                setPages(data.pagination?.pages || 0);
                setTotal(data.pagination?.total || 0);
            } catch (loadError) {
                if (!controller.signal.aborted) {
                    setError(loadError.message || "No se pudieron cargar los leads.");
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, 200);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [page, searchTerm, filterOrigin, filterStatus, reload, locale]);

    const closeDetails = () => {
        detailRequest.current += 1;
        setSelectedLead(null);
        setActivities([]);
        setNextActions([]);
        setDetailsError("");
        setShowActionForm(false);
        setActionError("");
    };

    const loadDetails = async (lead) => {
        if (!options) return;

        const requestId = detailRequest.current + 1;
        detailRequest.current = requestId;
        setSelectedLead(lead);
        setActivities([]);
        setNextActions([]);
        setDetailsLoading(true);
        setDetailsError("");
        setActionError("");
        setShowActionForm(false);

        try {
            const [freshLead, leadActivities, leadActions] = await Promise.all([
                leadService.get(options, lead.id),
                leadService.getActivities(options, lead.id),
                leadService.getNextActions(options, lead.id),
            ]);

            if (detailRequest.current !== requestId) return;

            setSelectedLead(mapLead(freshLead, locale));
            setActivities(leadActivities || []);
            setNextActions(leadActions || []);
        } catch (loadError) {
            if (detailRequest.current === requestId) {
                setDetailsError(
                    loadError.message || "No se pudieron cargar los detalles del lead."
                );
            }
        } finally {
            if (detailRequest.current === requestId) setDetailsLoading(false);
        }
    };

    const openNewLead = () => {
        setEditingLeadId(null);
        setFormError("");
        setLeadForm({
            ...EMPTY_LEAD_FORM,
            assignedMembershipId: options?.membershipId
                ? String(options.membershipId)
                : "",
        });
        setShowLeadForm(true);
    };

    const openEditLead = (lead) => {
        setEditingLeadId(lead.id);
        setFormError("");
        setLeadForm({
            name: lead.name || "",
            email: lead.email || "",
            phone: lead.phone || "",
            origin: lead.origin === "Sin origen" ? "" : lead.origin,
            service: lead.service === "No especificado" ? "" : lead.service,
            serviceZone: lead.serviceZone || "",
            priority: lead.priority === "Sin prioridad" ? "Media" : lead.priority,
            description: lead.description || "",
            internalNotes: lead.internalNotes || "",
            status: lead.statusCode || "new",
            assignedMembershipId: lead.assigned_membership_id
                ? String(lead.assigned_membership_id)
                : "",
            consentGiven: Boolean(lead.consent_given),
        });
        setShowLeadForm(true);
    };

    const updateLeadForm = (event) => {
        const { name, type, checked, value } = event.target;
        setLeadForm((current) => ({
            ...current,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    const saveLead = async (event) => {
        event.preventDefault();

        const normalizedName = leadForm.name.trim();

        if (!normalizedName || !leadForm.service.trim()) {
            setFormError("Introduce al menos el nombre y el servicio.");
            return;
        }

        const [firstName, ...lastNameParts] = normalizedName.split(/\s+/);
        const assignedMembershipId = leadForm.assignedMembershipId
            ? Number(leadForm.assignedMembershipId)
            : null;

        const payload = {
            first_name: firstName,
            last_name: lastNameParts.join(" ") || null,
            email: leadForm.email.trim() || null,
            phone: leadForm.phone.trim() || null,
            source: leadForm.origin || null,
            status: leadForm.status || "new",
            notes: buildNotes(leadForm),
            assigned_membership_id: assignedMembershipId,
            consent_given: leadForm.consentGiven,
        };

        try {
            setSaving(true);
            setFormError("");

            if (editingLeadId) {
                await leadService.update(options, editingLeadId, payload);
            } else {
                await leadService.create(options, payload);
            }

            setShowLeadForm(false);
            setEditingLeadId(null);
            setPage(1);
            setReload((value) => value + 1);
        } catch (saveError) {
            setFormError(saveError.message || "No se pudo guardar el lead.");
        } finally {
            setSaving(false);
        }
    };

    const contactLead = async () => {
        if (!selectedLead) return;

        const destination = selectedLead.phone
            ? `tel:${selectedLead.phone}`
            : selectedLead.email
                ? `mailto:${selectedLead.email}`
                : "";

        if (!destination) {
            setDetailsError("Este lead no tiene teléfono ni email.");
            return;
        }

        try {
            setDetailsError("");

            if (selectedLead.statusCode === "new") {
                const updated = await leadService.update(options, selectedLead.id, {
                    status: "contacted",
                });
                setSelectedLead(mapLead(updated, locale));
                setReload((value) => value + 1);
            }

            window.location.href = destination;
        } catch (contactError) {
            setDetailsError(
                contactError.message || "No se pudo actualizar el lead."
            );
        }
    };

    const convertLead = async () => {
        if (!selectedLead || !options) return;

        if (!window.confirm(`¿Convertir a ${selectedLead.name} en cliente?`)) {
            return;
        }

        try {
            setConverting(true);
            setDetailsError("");
            await leadService.convert(options, selectedLead.id);
            closeDetails();
            setReload((value) => value + 1);
        } catch (convertError) {
            setDetailsError(convertError.message || "No se pudo convertir el lead.");
        } finally {
            setConverting(false);
        }
    };

    const createNextAction = async (event) => {
        event.preventDefault();

        if (!options?.membershipId) {
            setActionError("No se pudo identificar al responsable actual.");
            return;
        }

        try {
            setSavingAction(true);
            setActionError("");
            await leadService.createNextAction(options, selectedLead.id, {
                title: actionForm.title.trim(),
                description: actionForm.description.trim() || null,
                due_at: new Date(actionForm.dueAt).toISOString(),
                assigned_membership_id: options.membershipId,
            });
            setActionForm(emptyActionForm());
            setShowActionForm(false);
            await loadDetails(selectedLead);
        } catch (saveError) {
            setActionError(
                saveError.message || "No se pudo crear la próxima acción."
            );
        } finally {
            setSavingAction(false);
        }
    };

    const completeNextAction = async (action) => {
        try {
            setActionError("");
            await leadService.updateNextAction(options, action.id, {
                status: "completed",
            });
            await loadDetails(selectedLead);
        } catch (updateError) {
            setActionError(
                updateError.message || "No se pudo completar la acción."
            );
        }
    };

    const clearFilters = () => {
        setPage(1);
        setSearchTerm("");
        setFilterOrigin("");
        setFilterStatus("");
    };

    return (
        <div
            className="container-fluid px-4 py-4"
            style={{ backgroundColor: "var(--cf-workspace-bg)", minHeight: "100vh", color: "var(--cf-text)" }}
        >
            <div className="container px-0">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <span
                            className="text-uppercase fw-bold"
                            style={{ color: "var(--cf-brand)", fontSize: "0.65rem", letterSpacing: "0.08em" }}
                        >
                            CLIENTFLOW {companyName ? `· ${companyName.toUpperCase()}` : ""}
                        </span>
                        <h2 className="fw-bold text-dark mb-1">Leads</h2>
                        <p className="text-secondary small mb-0">
                            Gestiona y convierte nuevas oportunidades.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="btn btn-primary px-3 py-2 fw-semibold shadow-sm d-flex align-items-center gap-2"
                        style={{ backgroundColor: "var(--cf-brand)", border: "none" }}
                        onClick={openNewLead}
                        disabled={!options || loading}
                    >
                        <i className="fa-solid fa-plus"></i>
                        Crear nuevo
                    </button>
                </div>

                <div className="card border-0 shadow-sm p-2 mb-3 bg-white rounded-3">
                    <div className="input-group align-items-center">
                        <span
                            className="input-group-text bg-transparent border-0 text-muted d-flex align-items-center justify-content-center p-0"
                            style={{ width: "2.75rem", minWidth: "2.75rem", fontSize: "1rem" }}
                        >
                            <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                        </span>
                        <input
                            type="search"
                            className="form-control border-0 shadow-none bg-white text-dark"
                            placeholder="Buscar por nombre, email o teléfono..."
                            value={searchTerm}
                            onChange={(event) => {
                                setPage(1);
                                setSearchTerm(event.target.value);
                            }}
                        />
                        <button
                            className={`btn border-0 d-flex align-items-center gap-1 px-3 py-2 rounded-2 ${showFilters ? "bg-light fw-bold text-primary" : "bg-transparent text-secondary"}`}
                            type="button"
                            onClick={() => setShowFilters((value) => !value)}
                        >
                            <i className="fa-solid fa-filter"></i>
                            Filtros {showFilters ? "▲" : "▼"}
                        </button>
                    </div>
                </div>

                {showFilters && (
                    <div className="card border-0 shadow-sm p-3 mb-3 bg-white rounded-3">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6 className="fw-bold text-dark mb-0">Filtros</h6>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary px-3"
                                onClick={clearFilters}
                            >
                                <i className="fa-solid fa-rotate-left me-1"></i>
                                Limpiar
                            </button>
                        </div>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label className="form-label small fw-semibold text-secondary">Origen</label>
                                <select
                                    className="form-select form-select-sm bg-white text-dark"
                                    value={filterOrigin}
                                    onChange={(event) => {
                                        setPage(1);
                                        setFilterOrigin(event.target.value);
                                    }}
                                >
                                    <option value="">Todos los orígenes</option>
                                    <option value="WhatsApp">WhatsApp</option>
                                    <option value="Instagram">Instagram</option>
                                    <option value="Web">Web</option>
                                    <option value="Llamada">Llamada</option>
                                    <option value="Referido">Referido</option>
                                </select>
                            </div>
                            <div className="col-md-6">
                                <label className="form-label small fw-semibold text-secondary">Estado</label>
                                <select
                                    className="form-select form-select-sm bg-white text-dark"
                                    value={filterStatus}
                                    onChange={(event) => {
                                        setPage(1);
                                        setFilterStatus(event.target.value);
                                    }}
                                >
                                    <option value="">Todos los estados</option>
                                    {Object.entries(statusLabels).map(([value, label]) => (
                                        <option value={value} key={value}>{label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {loading && <div className="alert alert-light border shadow-sm">Cargando leads...</div>}
                {error && (
                    <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
                        <span>{error}</span>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => setReload((value) => value + 1)}
                        >
                            Reintentar
                        </button>
                    </div>
                )}

                <div className="card border-0 shadow-sm bg-white rounded-3 overflow-hidden">
                    <div className="table-responsive">
                        <table className="table align-middle mb-0">
                            <thead className="table-light text-secondary text-uppercase leads-table-header" style={{ fontSize: "0.72rem", letterSpacing: "0.5px" }}>
                                <tr>
                                    <th className="py-3 px-4">Nombre</th>
                                    <th className="py-3">Origen</th>
                                    <th className="py-3">Servicio</th>
                                    <th className="py-3">Estado</th>
                                    <th className="py-3 text-end px-4">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!loading && !error && leads.length > 0 ? leads.map((lead) => (
                                    <tr
                                        key={lead.id}
                                        onClick={() => loadDetails(lead)}
                                        style={{ cursor: "pointer" }}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="d-flex align-items-center gap-3">
                                                <div
                                                    className="rounded-circle bg-primary bg-opacity-10 text-primary fw-bold d-flex align-items-center justify-content-center"
                                                    style={{ width: "36px", height: "36px", fontSize: "0.85rem" }}
                                                >
                                                    {lead.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="fw-semibold text-dark">{lead.name}</div>
                                                    <div className="text-muted small">{lead.email || "Sin email"}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td><span className="text-secondary small">{lead.origin}</span></td>
                                        <td><span className="text-secondary small">{lead.service}</span></td>
                                        <td>
                                            <span className={`badge rounded-pill px-3 py-1 fw-normal ${statusClass(lead.statusCode)}`}>
                                                {lead.status}
                                            </span>
                                        </td>
                                        <td className="text-end px-4">
                                            <button
                                                type="button"
                                                aria-label={`Abrir ${lead.name}`}
                                                className="btn btn-sm text-secondary border-0 bg-transparent"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    loadDetails(lead);
                                                }}
                                            >
                                                <i className="fa-solid fa-ellipsis-vertical"></i>
                                            </button>
                                        </td>
                                    </tr>
                                )) : !loading && !error && (
                                    <tr>
                                        <td colSpan="5" className="text-center py-5 text-muted">
                                            No se encontraron leads.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="card-footer bg-white py-3 px-4 text-muted small d-flex justify-content-between align-items-center">
                        <span>{total} {ui.results}</span>
                        <div className="d-flex align-items-center gap-2">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                disabled={page <= 1 || loading}
                                onClick={() => setPage((value) => value - 1)}
                            >
                                {ui.previous}
                            </button>
                            <span>{ui.page} {page} {ui.of} {Math.max(1, pages)}</span>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                disabled={page >= pages || loading}
                                onClick={() => setPage((value) => value + 1)}
                            >
                                {ui.next}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {showLeadForm && (
                <>
                    <div className="modal-backdrop fade show"></div>
                    <div className="modal fade show d-block lead-form-modal" tabIndex="-1" role="dialog" aria-modal="true">
                        <div className="modal-dialog modal-dialog-centered modal-lg lead-form-dialog">
                            <div className="modal-content border-0 shadow-lg bg-white text-dark lead-form-content" style={{ borderRadius: "18px" }}>
                                <div className="modal-header border-0 px-4 pt-4 pb-2">
                                    <div>
                                        <h5 className="modal-title fw-bold">
                                            {editingLeadId ? "Editar lead" : "Registrar nuevo lead"}
                                        </h5>
                                        <p className="text-secondary small mb-0">Datos reales de la oportunidad comercial.</p>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn-close"
                                        aria-label="Cerrar"
                                        disabled={saving}
                                        onClick={() => setShowLeadForm(false)}
                                    ></button>
                                </div>
                                <form className="lead-form-shell" onSubmit={saveLead}>
                                    <div className="modal-body px-4 py-3 lead-form-body">
                                        <div className="row g-3">
                                            <div className="col-md-6">
                                                <label className="form-label small fw-semibold">Nombre *</label>
                                                <input className="form-control" name="name" value={leadForm.name} onChange={updateLeadForm} maxLength="200" required />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label small fw-semibold">Email</label>
                                                <input className="form-control" name="email" type="email" value={leadForm.email} onChange={updateLeadForm} maxLength="255" />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label small fw-semibold">Teléfono</label>
                                                <input className="form-control" name="phone" type="tel" value={leadForm.phone} onChange={updateLeadForm} maxLength="40" />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label small fw-semibold">Origen</label>
                                                <select className="form-select" name="origin" value={leadForm.origin} onChange={updateLeadForm}>
                                                    <option value="">Sin origen</option>
                                                    <option value="WhatsApp">WhatsApp</option>
                                                    <option value="Instagram">Instagram</option>
                                                    <option value="Web">Web</option>
                                                    <option value="Llamada">Llamada</option>
                                                    <option value="Referido">Referido</option>
                                                </select>
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label small fw-semibold">Servicio solicitado *</label>
                                                <input className="form-control" name="service" value={leadForm.service} onChange={updateLeadForm} maxLength="180" required />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label small fw-semibold">Zona de servicio</label>
                                                <input className="form-control" name="serviceZone" value={leadForm.serviceZone} onChange={updateLeadForm} maxLength="160" />
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label small fw-semibold">Prioridad</label>
                                                <select className="form-select" name="priority" value={leadForm.priority} onChange={updateLeadForm}>
                                                    <option value="Baja">Baja</option>
                                                    <option value="Media">Media</option>
                                                    <option value="Alta">Alta</option>
                                                </select>
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label small fw-semibold">Estado</label>
                                                <select className="form-select" name="status" value={leadForm.status} onChange={updateLeadForm}>
                                                    {Object.entries(statusLabels).map(([value, label]) => (
                                                        <option value={value} key={value}>{label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label small fw-semibold">Responsable</label>
                                                <select className="form-select" name="assignedMembershipId" value={leadForm.assignedMembershipId} onChange={updateLeadForm}>
                                                    <option value="">Sin asignar</option>
                                                    {leadForm.assignedMembershipId && Number(leadForm.assignedMembershipId) !== options?.membershipId && (
                                                        <option value={leadForm.assignedMembershipId}>{translateLiteral("Miembro", locale)} #{leadForm.assignedMembershipId}</option>
                                                    )}
                                                    {options?.membershipId && (
                                                        <option value={options.membershipId}>Asignarme a mí</option>
                                                    )}
                                                </select>
                                            </div>
                                            <div className="col-12">
                                                <label className="form-label small fw-semibold">Descripción</label>
                                                <textarea className="form-control" name="description" rows="3" value={leadForm.description} onChange={updateLeadForm}></textarea>
                                            </div>
                                            <div className="col-12">
                                                <label className="form-label small fw-semibold">Notas internas</label>
                                                <textarea className="form-control" name="internalNotes" rows="2" value={leadForm.internalNotes} onChange={updateLeadForm}></textarea>
                                            </div>
                                            <div className="col-12">
                                                <div className="form-check rounded-3 p-3 ps-5" style={{ backgroundColor: "#f7f6ff" }}>
                                                    <input className="form-check-input" type="checkbox" id="lead-consent" name="consentGiven" checked={leadForm.consentGiven} onChange={updateLeadForm} />
                                                    <label className="form-check-label" htmlFor="lead-consent">
                                                        El contacto autorizó el tratamiento de sus datos.
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                        {formError && <div className="alert alert-danger mt-3 mb-0">{formError}</div>}
                                    </div>
                                    <div className="modal-footer border-0 bg-light px-4 py-3 lead-form-footer">
                                        <button type="button" className="btn btn-outline-secondary px-4" disabled={saving} onClick={() => setShowLeadForm(false)}>Cancelar</button>
                                        <button type="submit" className="btn btn-primary px-4 fw-semibold" style={{ backgroundColor: "var(--cf-brand)", border: "none" }} disabled={saving}>
                                            {saving ? "Guardando..." : editingLeadId ? "Guardar cambios" : "Guardar lead"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {selectedLead && <div className="offcanvas-backdrop fade show" onClick={closeDetails}></div>}
            <div
                className={`offcanvas offcanvas-end bg-white text-dark ${selectedLead ? "show" : ""}`}
                tabIndex="-1"
                style={{ visibility: selectedLead ? "visible" : "hidden", width: "min(520px, 100vw)" }}
            >
                {selectedLead && (
                    <>
                        <div className="offcanvas-header border-bottom px-4 py-3">
                            <div>
                                <h5 className="offcanvas-title fw-bold mb-0">{selectedLead.name}</h5>
                                <span className="text-muted small">Lead #{selectedLead.id} · {selectedLead.status}</span>
                            </div>
                            <button type="button" className="btn-close" aria-label="Cerrar" onClick={closeDetails}></button>
                        </div>
                        <div className="offcanvas-body p-4 overflow-y-auto">
                            <div className="d-flex gap-2 mb-4">
                                <button type="button" className="btn btn-sm btn-primary flex-fill fw-semibold py-2" style={{ backgroundColor: "var(--cf-brand)", border: "none" }} onClick={contactLead}>
                                    <i className="fa-solid fa-phone me-1"></i> Contactar
                                </button>
                                <button type="button" className="btn btn-sm btn-outline-secondary flex-fill fw-semibold py-2" onClick={() => { openEditLead(selectedLead); closeDetails(); }}>
                                    <i className="fa-solid fa-pen me-1"></i> Editar
                                </button>
                                <button type="button" className="btn btn-sm btn-outline-success flex-fill fw-semibold py-2" onClick={convertLead} disabled={converting || Boolean(selectedLead.converted_client_id)}>
                                    <i className="fa-solid fa-arrow-right-arrow-left me-1"></i>
                                    {selectedLead.converted_client_id ? "Convertido" : converting ? "Convirtiendo..." : "Convertir"}
                                </button>
                            </div>

                            {detailsError && <div className="alert alert-danger py-2 small">{detailsError}</div>}
                            {detailsLoading && <div className="text-center py-4"><span className="spinner-border text-primary" role="status"></span></div>}

                            {!detailsLoading && (
                                <>
                                    <section className="mb-4">
                                        <h6 className="text-uppercase text-muted fw-bold mb-3" style={{ fontSize: "0.7rem", letterSpacing: "0.5px" }}>Contacto</h6>
                                        <div className="bg-light p-3 rounded-3 small vstack gap-2">
                                            <div className="d-flex justify-content-between gap-3"><span className="text-secondary">Email</span><span className="fw-semibold text-end">{selectedLead.email || "No especificado"}</span></div>
                                            <div className="d-flex justify-content-between gap-3"><span className="text-secondary">Teléfono</span><span className="fw-semibold text-end">{selectedLead.phone || "No especificado"}</span></div>
                                            <div className="d-flex justify-content-between gap-3"><span className="text-secondary">Origen</span><span className="fw-semibold text-end">{selectedLead.origin}</span></div>
                                            <div className="d-flex justify-content-between gap-3"><span className="text-secondary">Consentimiento</span><span className="fw-semibold text-end">{selectedLead.consent_given ? "Autorizado" : "No registrado"}</span></div>
                                        </div>
                                    </section>

                                    <section className="mb-4">
                                        <h6 className="text-uppercase text-muted fw-bold mb-3" style={{ fontSize: "0.7rem", letterSpacing: "0.5px" }}>Oportunidad</h6>
                                        <div className="bg-light p-3 rounded-3 small vstack gap-2">
                                            <div className="d-flex justify-content-between gap-3"><span className="text-secondary">Servicio</span><span className="fw-semibold text-end">{selectedLead.service}</span></div>
                                            <div className="d-flex justify-content-between gap-3"><span className="text-secondary">Zona</span><span className="fw-semibold text-end">{selectedLead.serviceZone || "No especificada"}</span></div>
                                            <div className="d-flex justify-content-between gap-3"><span className="text-secondary">Prioridad</span><span className="fw-semibold text-end">{selectedLead.priority}</span></div>
                                            <div className="d-flex justify-content-between gap-3"><span className="text-secondary">Responsable</span><span className="fw-semibold text-end">{selectedLead.assignedUser}</span></div>
                                        </div>
                                        {selectedLead.description && <p className="text-secondary small mt-3 mb-0">{selectedLead.description}</p>}
                                        {selectedLead.internalNotes && <div className="p-2 mt-2 bg-warning bg-opacity-10 border-start border-warning border-3 rounded small"><strong>Nota interna:</strong> {selectedLead.internalNotes}</div>}
                                    </section>

                                    <section className="mb-4">
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <h6 className="text-uppercase text-muted fw-bold mb-0" style={{ fontSize: "0.7rem", letterSpacing: "0.5px" }}>Próximas acciones</h6>
                                            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => { setActionError(""); setShowActionForm((value) => !value); }}>
                                                <i className="fa-solid fa-plus me-1"></i> Añadir
                                            </button>
                                        </div>

                                        {showActionForm && (
                                            <form className="border rounded-3 p-3 mb-3 bg-light" onSubmit={createNextAction}>
                                                <div className="mb-2">
                                                    <label className="form-label small fw-semibold">Título *</label>
                                                    <input className="form-control form-control-sm" value={actionForm.title} onChange={(event) => setActionForm((current) => ({ ...current, title: event.target.value }))} required maxLength="180" />
                                                </div>
                                                <div className="mb-2">
                                                    <label className="form-label small fw-semibold">Fecha y hora *</label>
                                                    <input type="datetime-local" className="form-control form-control-sm" value={actionForm.dueAt} onChange={(event) => setActionForm((current) => ({ ...current, dueAt: event.target.value }))} required />
                                                </div>
                                                <div className="mb-3">
                                                    <label className="form-label small fw-semibold">Descripción</label>
                                                    <textarea className="form-control form-control-sm" rows="2" value={actionForm.description} onChange={(event) => setActionForm((current) => ({ ...current, description: event.target.value }))}></textarea>
                                                </div>
                                                <div className="d-flex justify-content-end gap-2">
                                                    <button type="button" className="btn btn-sm btn-outline-secondary" disabled={savingAction} onClick={() => setShowActionForm(false)}>Cancelar</button>
                                                    <button type="submit" className="btn btn-sm btn-primary" disabled={savingAction}>{savingAction ? "Guardando..." : "Guardar"}</button>
                                                </div>
                                            </form>
                                        )}

                                        {actionError && <div className="alert alert-danger py-2 small">{actionError}</div>}
                                        <div className="vstack gap-2">
                                            {nextActions.length > 0 ? nextActions.map((action) => (
                                                <div className="p-3 border rounded-3 bg-white shadow-sm small" key={action.id}>
                                                    <div className="d-flex justify-content-between gap-2">
                                                        <div>
                                                            <div className="fw-bold text-dark">{action.title}</div>
                                                            <div className="text-muted">{formatDate(action.due_at, locale)}</div>
                                                        </div>
                                                        <span className={`badge align-self-start ${action.status === "completed" ? "bg-success" : "bg-primary"}`}>
                                                            {action.status === "completed" ? "Completada" : "Pendiente"}
                                                        </span>
                                                    </div>
                                                    {action.description && <div className="text-secondary mt-2">{action.description}</div>}
                                                    {action.status !== "completed" && (
                                                        <button type="button" className="btn btn-sm btn-link text-success px-0 mt-2" onClick={() => completeNextAction(action)}>
                                                            <i className="fa-solid fa-check me-1"></i> Marcar como completada
                                                        </button>
                                                    )}
                                                </div>
                                            )) : <div className="p-3 border rounded-3 bg-light text-muted small">No hay próximas acciones registradas.</div>}
                                        </div>
                                    </section>

                                    <section>
                                        <h6 className="text-uppercase text-muted fw-bold mb-3" style={{ fontSize: "0.7rem", letterSpacing: "0.5px" }}>Historial de actividad</h6>
                                        <div className="vstack gap-2">
                                            {activities.length > 0 ? activities.map((activity) => (
                                                <div className="p-2 border-bottom small" key={activity.id}>
                                                    <div className="d-flex justify-content-between text-muted" style={{ fontSize: "0.75rem" }}>
                                                        <span>{activity.event_type.replaceAll("_", " ")}</span>
                                                        <span>{formatDate(activity.created_at, locale)}</span>
                                                    </div>
                                                    <div className="text-dark mt-1">{activity.description}</div>
                                                </div>
                                            )) : <div className="text-muted small">No hay actividad registrada.</div>}
                                        </div>
                                    </section>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Leads;
