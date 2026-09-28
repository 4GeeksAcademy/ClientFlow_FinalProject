import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { kpiTranslations } from "../../i18n/dashboard";
import { getDashboardMetrics } from "../../services/dashboardService";

const metricChange = (value) => {
    const number = Number(value || 0);
    return `${number > 0 ? "+" : ""}${number.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
};

const changeClass = (value) => {
    if (value > 0) return "text-success";
    if (value < 0) return "text-danger";
    return "text-muted";
};

export const KPICards = ({ token, companyId, currentLang = "es" }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reload, setReload] = useState(0);
    const [showSalesModal, setShowSalesModal] = useState(false);
    const modalCloseButtonRef = useRef(null);
    const navigate = useNavigate();
    const t = kpiTranslations[currentLang] || kpiTranslations.es;

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError("");

        getDashboardMetrics({ token, companyId, signal: controller.signal })
            .then(setData)
            .catch((requestError) => {
                if (requestError.name !== "AbortError") {
                    setError(requestError.message || t.errorMessage);
                }
            })
            .finally(() => setLoading(false));

        return () => controller.abort();
    }, [companyId, reload, t.errorMessage, token]);

    useEffect(() => {
        if (showSalesModal) modalCloseButtonRef.current?.focus();
    }, [showSalesModal]);

    if (loading) {
        return (
            <div className="row g-3 mb-4 row-cols-1 row-cols-md-5" aria-label="Loading dashboard metrics">
                {[1, 2, 3, 4, 5].map((index) => (
                    <div className="col" key={index}>
                        <div className="card border-0 shadow-sm p-3 bg-white rounded-3 placeholder-glow" style={{ minHeight: "110px" }}>
                            <span className="placeholder col-7 mb-2"></span>
                            <span className="placeholder col-5 fs-4 mb-2"></span>
                            <span className="placeholder col-4"></span>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="alert alert-danger d-flex align-items-center justify-content-between p-3 rounded-3 shadow-sm mb-4" role="alert">
                <div><i className="fa-solid fa-triangle-exclamation me-2"></i>{error || t.errorMessage}</div>
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setReload((value) => value + 1)}>
                    {t.retry}
                </button>
            </div>
        );
    }

    const cards = [
        { key: "sales_this_month", label: t.sales, icon: "fa-euro-sign", color: "text-primary", value: `€${data.sales_this_month.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, action: () => setShowSalesModal(true) },
        { key: "new_leads", label: t.leads, icon: "fa-user-plus", color: "text-primary", value: data.new_leads.value, action: () => navigate("/leads?filter=period") },
        { key: "active_clients", label: t.clients, icon: "fa-users", color: "text-success", value: data.active_clients.value, action: () => navigate("/clients?status=active") },
        { key: "jobs_in_progress", label: t.jobs, icon: "fa-briefcase", color: "text-warning", value: data.jobs_in_progress.value, action: () => navigate("/jobs?status=in_progress") },
        { key: "appointments", label: t.appointments, icon: "fa-calendar-days", color: "text-info", value: data.appointments.value, action: () => navigate("/agenda?filter=period") },
    ];
    const empty = cards.every((card) => Number(data[card.key].value) === 0);

    return (
        <>
            <div className="row g-3 mb-4 row-cols-1 row-cols-md-5">
                {cards.map((card) => {
                    const metric = data[card.key];
                    return (
                        <div className="col" key={card.key}>
                            <button type="button" className="card border-0 shadow-sm p-3 bg-white rounded-3 h-100 text-start w-100 text-decoration-none transition-hover" onClick={card.action}>
                                <div className="d-flex justify-content-between align-items-center mb-1 w-100">
                                    <span className="text-secondary small">{card.label}</span>
                                    <span className={`badge bg-light rounded-circle p-2 d-flex align-items-center justify-content-center ${card.color}`} style={{ width: "28px", height: "28px" }}><i className={`fa-solid ${card.icon}`}></i></span>
                                </div>
                                <h3 className="fw-bold mb-2 text-dark">{card.value}</h3>
                                <div className={`d-flex align-items-center small ${changeClass(metric.change_percentage)}`}>
                                    <span className="fw-semibold me-1">{metricChange(metric.change_percentage)}</span>
                                    <span className="text-muted" style={{ fontSize: "0.75rem" }}>{t.previousPeriod}</span>
                                </div>
                            </button>
                        </div>
                    );
                })}
            </div>

            {empty && <div className="text-center text-muted py-3 small bg-white rounded-3 mb-4 shadow-sm">{t.emptyData}</div>}

            {showSalesModal && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(15, 23, 42, 0.45)" }} onKeyDown={(event) => event.key === "Escape" && setShowSalesModal(false)}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header border-0">
                                <h5 className="modal-title fw-bold">{t.salesModalTitle}</h5>
                                <button ref={modalCloseButtonRef} type="button" className="btn-close" onClick={() => setShowSalesModal(false)} aria-label={t.close}></button>
                            </div>
                            <div className="modal-body">
                                <ul className="list-group list-group-flush">
                                    <li className="list-group-item d-flex justify-content-between px-0"><span>{t.totalSales}</span><strong>€{data.sales_this_month.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></li>
                                    <li className="list-group-item d-flex justify-content-between px-0"><span>{t.completedJobs}</span><strong>{data.sales_summary.completed_jobs}</strong></li>
                                    <li className="list-group-item d-flex justify-content-between px-0"><span>{t.activeClients}</span><strong>{data.sales_summary.associated_clients}</strong></li>
                                    <li className="list-group-item d-flex justify-content-between px-0"><span>{t.avgPerJob}</span><strong>€{data.sales_summary.average_per_job.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></li>
                                </ul>
                            </div>
                            <div className="modal-footer border-0">
                                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowSalesModal(false)}>{t.close}</button>
                                <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate("/jobs?status=completed")}>{t.viewReport}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
