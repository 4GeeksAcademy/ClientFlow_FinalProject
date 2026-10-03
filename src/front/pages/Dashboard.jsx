import React, { useEffect, useState } from "react";
import { KPICards } from "../components/Dashboard/KPICards";
import { InteractiveCharts } from "../components/Dashboard/InteractiveCharts";
import { useLanguage } from "../context/LanguageContext";
import { dashboardTranslations } from "../i18n/dashboard";
import { getDashboardContext } from "../services/dashboardService";

export const Dashboard = () => {
    const { locale } = useLanguage();
    const t = dashboardTranslations[locale] || dashboardTranslations.es;
    const [context, setContext] = useState(null);
    const [error, setError] = useState("");
    const [reload, setReload] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        const token = localStorage.getItem("access_token") || localStorage.getItem("jwt_token") || localStorage.getItem("token");

        setError("");
        getDashboardContext(token, controller.signal)
            .then((account) => {
                const company = account.companies?.[0];
                if (!company) throw new Error(t.contextError);
                setContext({ token, company, user: account.user });
            })
            .catch((requestError) => {
                if (requestError.name !== "AbortError") {
                    setError(requestError.message || t.contextError);
                }
            });

        return () => controller.abort();
    }, [reload, t.contextError]);

    const firstName = context?.user?.first_name || context?.user?.name || "";

    return (
        <div className="container-fluid px-4 py-4" style={{ backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
            <div className="container px-0">
                <div className="d-flex justify-content-between align-items-start mb-4">
                    <div>
                        <span className="text-uppercase text-muted fw-bold" style={{ fontSize: "0.65rem", letterSpacing: "0.5px" }}>
                            {t.eyebrow}{context?.company?.name ? ` • ${context.company.name}` : ""}
                        </span>
                        <h2 className="fw-bold text-dark mb-1">{t.greeting}{firstName ? `, ${firstName}` : ""}</h2>
                        <p className="text-secondary small mb-0">{t.summary}</p>
                        <div className="d-flex align-items-center mt-2">
                            <span className="badge bg-success rounded-pill p-1 me-1" style={{ width: "8px", height: "8px" }}></span>
                            <span className="text-muted" style={{ fontSize: "0.75rem" }}>{t.updated}</span>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
                        <span>{error}</span>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setReload((value) => value + 1)}>
                            {t.retry}
                        </button>
                    </div>
                )}

                {context && (
                    <>
                        <KPICards token={context.token} companyId={context.company.id} currentLang={locale} />
                        <InteractiveCharts token={context.token} companyId={context.company.id} currentLang={locale} />
                    </>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
