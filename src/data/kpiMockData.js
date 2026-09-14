// Contrato de datos y simulación para el Ticket #13
export const kpiTranslations = {
    es: {
        sales: "Ventas este mes",
        leads: "Nuevos leads",
        clients: "Clientes activos",
        jobs: "Trabajos en curso",
        appointments: "Citas",
        thisMonth: "este mes",
        salesModalTitle: "Resumen de Ventas",
        totalSales: "Ventas totales:",
        completedJobs: "Trabajos completados:",
        activeClients: "Clientes asociados:",
        avgPerJob: "Valor medio por trabajo:",
        close: "Cerrar",
        viewReport: "Ver reporte completo",
        emptyData: "No hay datos disponibles",
        errorMessage: "Error al cargar las métricas"
    },
    en: {
        sales: "Sales this month",
        leads: "New leads",
        clients: "Active clients",
        jobs: "Jobs in progress",
        appointments: "Appointments",
        thisMonth: "this month",
        salesModalTitle: "Sales Summary",
        totalSales: "Total sales:",
        completedJobs: "Completed jobs:",
        activeClients: "Associated clients:",
        avgPerJob: "Average value per job:",
        close: "Close",
        viewReport: "View full report",
        emptyData: "No data available",
        errorMessage: "Error loading metrics"
    },
    pt: {
        sales: "Vendas deste mês",
        leads: "Novos leads",
        clients: "Clientes ativos",
        jobs: "Trabalhos em andamento",
        appointments: "Compromissos",
        thisMonth: "este mês",
        salesModalTitle: "Resumo de Vendas",
        totalSales: "Vendas totais:",
        completedJobs: "Trabalhos concluídos:",
        activeClients: "Clientes associados:",
        avgPerJob: "Valor médio por trabalho:",
        close: "Fechar",
        viewReport: "Ver relatório completo",
        emptyData: "Sem dados disponíveis",
        errorMessage: "Erro ao carregar métricas"
    }
};

export const mockKpiStates = {
    success: {
        sales: { value: 18420, change: "+8.4%", textKey: "thisMonth", avgJob: 1023.33 },
        leads: { value: 48, change: "+12.5%", textKey: "thisMonth" },
        clients: { value: 126, change: "+6.2%", textKey: "thisMonth" },
        jobs: { value: 18, change: "+3.1%", textKey: "thisMonth" },
        appointments: { value: 24, change: "+9.8%", textKey: "thisMonth" }
    },
    empty: {
        sales: { value: 0, change: "0%", textKey: "thisMonth", avgJob: 0 },
        leads: { value: 0, change: "0%", textKey: "thisMonth" },
        clients: { value: 0, change: "0%", textKey: "thisMonth" },
        jobs: { value: 0, change: "0%", textKey: "thisMonth" },
        appointments: { value: 0, change: "0%", textKey: "thisMonth" }
    },
    error: null
};