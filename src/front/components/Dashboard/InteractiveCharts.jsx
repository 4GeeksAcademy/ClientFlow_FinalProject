import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { chartTranslations } from "../../i18n/dashboard";
import { getDashboardCharts } from "../../services/dashboardService";

const statusColours = { draft: "#94a3b8", scheduled: "#0dcaf0", in_progress: "#ffc107", review: "#6f42c1", completed: "#198754", cancelled: "#dc3545" };

export const InteractiveCharts = ({ token, companyId, currentLang = "es" }) => {
    const scales = ["years", "months", "days", "hours"];
    const [scaleIndex, setScaleIndex] = useState(1);
    const [showLeads, setShowLeads] = useState(true);
    const [showClients, setShowClients] = useState(true);
    const [selectedPoint, setSelectedPoint] = useState(null);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reload, setReload] = useState(0);
    const currentScale = scales[scaleIndex];
    const navigate = useNavigate();
    const t = chartTranslations[currentLang] || chartTranslations.es;

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError("");
        setSelectedPoint(null);
        getDashboardCharts({ token, companyId, signal: controller.signal }, currentScale)
            .then(setData)
            .catch((requestError) => {
                if (requestError.name !== "AbortError") setError(requestError.message || t.error);
            })
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, [companyId, currentScale, reload, t.error, token]);

    if (loading) return <div className="card border-0 shadow-sm p-5 text-center text-muted mb-4 placeholder-glow"><span className="placeholder col-5 mx-auto"></span><span className="mt-3">{t.loading}</span></div>;
    if (error || !data) return <div className="alert alert-danger d-flex justify-content-between align-items-center mb-4" role="alert"><span>{error || t.error}</span><button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setReload((value) => value + 1)}>{t.retry}</button></div>;

    const maxValue = Math.max(1, ...data.series.flatMap((item) => [item.leads, item.clients]));
    const empty = data.series.every((item) => item.leads === 0 && item.clients === 0);

    return (
        <div className="row g-4 mb-4" onWheel={(event) => event.stopPropagation()}>
            <div className="col-12 col-lg-8">
                <div className="card border-0 shadow-sm p-4 bg-white rounded-3 h-100">
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                        <div><h5 className="fw-bold mb-1 text-dark">{t.title}</h5><p className="text-secondary small mb-0">{t.subtitle}</p></div>
                        <div className="btn-group btn-group-sm shadow-sm" role="group" aria-label={t.subtitle}>
                            <button type="button" className="btn btn-outline-secondary" onClick={() => setScaleIndex((value) => value - 1)} disabled={scaleIndex === 0} aria-label="Zoom out"><i className="fa-solid fa-minus"></i></button>
                            <span className="btn btn-light disabled text-dark fw-bold border-top border-bottom">{t[currentScale]}</span>
                            <button type="button" className="btn btn-outline-secondary" onClick={() => setScaleIndex((value) => value + 1)} disabled={scaleIndex === scales.length - 1} aria-label="Zoom in"><i className="fa-solid fa-plus"></i></button>
                        </div>
                    </div>

                    <div className="d-flex gap-2 mb-3">
                        <button type="button" className={`btn btn-sm ${showLeads ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setShowLeads((value) => !value)}><i className="fa-solid fa-user-plus me-1"></i>{t.leadsSeries}</button>
                        <button type="button" className={`btn btn-sm ${showClients ? "btn-success" : "btn-outline-success"}`} onClick={() => setShowClients((value) => !value)}><i className="fa-solid fa-users me-1"></i>{t.clientsSeries}</button>
                    </div>

                    <div className="row g-2 mb-4 text-center">
                        <div className="col-4"><div className="p-2 bg-light rounded-2"><span className="d-block text-muted small">{t.conversion}</span><strong>{data.metrics.conversion_percentage}%</strong></div></div>
                        <div className="col-4"><div className="p-2 bg-light rounded-2"><span className="d-block text-muted small">{t.bestMoment}</span><strong>{data.metrics.best_moment || "—"}</strong></div></div>
                        <div className="col-4"><div className="p-2 bg-light rounded-2"><span className="d-block text-muted small">{t.average}</span><strong>{data.metrics.average_leads}</strong></div></div>
                    </div>

                    {empty ? <div className="d-flex align-items-center justify-content-center text-muted bg-light rounded-3" style={{ minHeight: "220px" }}>{t.empty}</div> : (
                        <div className="overflow-auto">
                            <div className="d-flex align-items-end justify-content-between border-bottom pb-2 mb-3" style={{ height: "220px", minWidth: currentScale === "hours" ? "900px" : "600px" }}>
                                {data.series.map((point) => (
                                    <button key={point.label} type="button" className="btn d-flex flex-column align-items-center h-100 justify-content-end flex-grow-1 mx-1 p-0 border-0" onClick={() => setSelectedPoint(point)} title={point.label}>
                                        <div className="d-flex align-items-end gap-1 w-100 justify-content-center h-100">
                                            {showLeads && <span className="bg-primary rounded-top" style={{ height: `${point.leads * 100 / maxValue}%`, minHeight: point.leads ? "3px" : 0, width: "12px", opacity: 0.85 }}></span>}
                                            {showClients && <span className="bg-success rounded-top" style={{ height: `${point.clients * 100 / maxValue}%`, minHeight: point.clients ? "3px" : 0, width: "12px", opacity: 0.85 }}></span>}
                                        </div>
                                        <span className="text-muted mt-2 text-nowrap" style={{ fontSize: "0.65rem" }}>{point.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {selectedPoint ? <div className="alert alert-info py-2 px-3 small d-flex justify-content-between align-items-center flex-wrap gap-2 mb-0"><strong>{t.selectedPeriod}: {selectedPoint.label} — {t.leadsSeries}: {selectedPoint.leads} | {t.clientsSeries}: {selectedPoint.clients}</strong><div className="d-flex gap-2"><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => navigate(`/leads?scale=${currentScale}&period=${encodeURIComponent(selectedPoint.label)}`)}>{t.viewLeads}</button><button type="button" className="btn btn-sm btn-outline-success" onClick={() => navigate(`/clients?scale=${currentScale}&period=${encodeURIComponent(selectedPoint.label)}`)}>{t.viewClients}</button></div></div> : !empty && <div className="text-muted text-center small">{t.selectHint}</div>}
                </div>
            </div>

            <div className="col-12 col-lg-4 d-flex flex-column gap-3">
                <div className="card border-0 shadow-sm p-3 bg-white rounded-3">
                    <h6 className="fw-bold text-dark mb-3">{t.jobStatusTitle}</h6>
                    {data.job_status.length ? data.job_status.map((item) => <button key={item.status} type="button" className="btn btn-light dashboard-breakdown-item d-flex justify-content-between align-items-center py-2 px-3 mb-2 border-0 text-start w-100" onClick={() => navigate(`/jobs?status=${item.status}`)}><span className="d-flex align-items-center gap-2"><span className="rounded-circle" style={{ width: "10px", height: "10px", backgroundColor: statusColours[item.status] || "#64748b" }}></span><span className="small fw-semibold">{t[item.status] || item.status}</span></span><span className="badge bg-secondary rounded-pill">{item.count}</span></button>) : <span className="text-muted small">{t.empty}</span>}
                </div>
                <div className="card border-0 shadow-sm p-3 bg-white rounded-3">
                    <h6 className="fw-bold text-dark mb-3">{t.leadSourcesTitle}</h6>
                    {data.lead_sources.length ? data.lead_sources.map((source) => <button key={source.source} type="button" className="btn btn-light dashboard-breakdown-item d-flex justify-content-between align-items-center py-2 px-3 mb-2 border-0 text-start w-100" onClick={() => navigate(`/leads?source=${encodeURIComponent(source.source.toLowerCase())}`)}><span className="small fw-semibold">{source.source}</span><span className="badge bg-primary rounded-pill">{source.percentage}%</span></button>) : <span className="text-muted small">{t.empty}</span>}
                </div>
            </div>
        </div>
    );
};
