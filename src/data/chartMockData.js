// Contrato de datos y escalas para las gráficas del Dashboard (Ticket #14)
export const chartTranslations = {
    es: {
        title: "Leads y clientes",
        subtitle: "Compara el rendimiento entre distintas escalas de tiempo",
        leadsSeries: "Leads",
        clientsSeries: "Clientes",
        conversion: "Conversión",
        bestMoment: "Mejor momento",
        avgDaily: "Media diaria",
        jobStatusTitle: "Estado de trabajos",
        leadSourcesTitle: "Lead sources",
        pending: "Pendiente",
        inProgress: "En progreso",
        completed: "Completado",
        blocked: "Bloqueado"
    },
    en: {
        title: "Leads vs clients",
        subtitle: "Compare performance across different time scales",
        leadsSeries: "Leads",
        clientsSeries: "Clients",
        conversion: "Conversion",
        bestMoment: "Best moment",
        avgDaily: "Daily average",
        jobStatusTitle: "Job status",
        leadSourcesTitle: "Lead sources",
        pending: "Pending",
        inProgress: "In progress",
        completed: "Completed",
        blocked: "Blocked"
    },
    pt: {
        title: "Leads e clientes",
        subtitle: "Compare o desempenho em diferentes escalas de tempo",
        leadsSeries: "Leads",
        clientsSeries: "Clientes",
        conversion: "Conversão",
        bestMoment: "Melhor momento",
        avgDaily: "Média diária",
        jobStatusTitle: "Estado dos trabalhos",
        leadSourcesTitle: "Lead sources",
        pending: "Pendente",
        inProgress: "Em andamento",
        completed: "Concluído",
        blocked: "Bloqueado"
    }
};

// Datos por escalas temporales para la gráfica principal
export const chartScaleData = {
    years: {
        labels: ["2021", "2022", "2023", "2024", "2025", "2026"],
        leads: [850, 920, 1100, 1250, 1400, 1552],
        clients: [600, 680, 790, 880, 950, 1041],
        metrics: { conversion: "67%", bestMoment: "2026", avg: "3.4 p/d" }
    },
    months: {
        labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
        leads: [120, 135, 150, 145, 160, 175, 180, 170, 165, 190, 200, 210],
        clients: [80, 90, 95, 100, 110, 115, 120, 115, 110, 125, 130, 140],
        metrics: { conversion: "68.5%", bestMoment: "Nov 2026", avg: "5.2 p/d" }
    },
    days: {
        labels: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
        leads: [12, 18, 15, 22, 25, 10, 8],
        clients: [8, 12, 10, 15, 17, 6, 4],
        metrics: { conversion: "65.2%", bestMoment: "Viernes", avg: "18.5 p/d" }
    },
    hours: {
        labels: ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"],
        leads: [2, 5, 8, 4, 7, 3, 1],
        clients: [1, 3, 5, 2, 4, 2, 1],
        metrics: { conversion: "60.0%", bestMoment: "12:00", avg: "4.2 p/h" }
    }
};

// Datos para trabajos por estado y fuentes de lead
export const breakdownData = {
    jobStatus: [
        { label: "pending", count: 12, color: "#0dcaf0" },
        { label: "inProgress", count: 18, color: "#ffc107" },
        { label: "completed", count: 9, color: "#198754" },
        { label: "blocked", count: 3, color: "#dc3545" }
    ],
    leadSources: [
        { name: "WhatsApp", percentage: 42, color: "#198754" },
        { name: "Instagram", percentage: 28, color: "#d63384" },
        { name: "Website", percentage: 19, color: "#0d6efd" },
        { name: "Referral", percentage: 11, color: "#6c757d" }
    ]
};