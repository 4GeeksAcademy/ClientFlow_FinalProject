export const initialClients = [
    {
        id: "cli-1",
        name: "Antonio Ruiz",
        company: "Reformas e Interiorismo Ruiz",
        email: "antonio.ruiz@example.com",
        phone: "+34 611 987 654",
        address: "Av. de la Constitución 12, 41001 Sevilla",
        status: "active",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        relatedJobs: [
            { id: "job-2", title: "Renovación de Puertas de Cocina", status: "completed", budget: 950.00, dueDate: "2026-04-25" }
        ],
        appointments: [
            { id: "app-1", title: "Entrega y revisión de cliente", date: "2026-04-24 11:00", status: "completed" }
        ],
        documents: [
            { id: "doc-1", name: "Contrato_Servicios_Ruiz.pdf", size: "2.4 MB", type: "pdf" },
            { id: "photo-1", name: "Cocina_Terminada.jpg", size: "4.1 MB", type: "image", url: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400" }
        ],
        recentActivity: [
            { id: "act-1", date: "24 Abr 2026", description: "Trabajo marcado como completado y entregado." }
        ],
        nextAction: {
            id: "na-1",
            title: "Llamada de seguimiento de satisfacción",
            date: "2026-05-02 10:30",
            owner: "Carlos Alberto",
            relatedRecord: "Renovación de Puertas de Cocina (job-2)",
            objective: "Asegurar que el cliente está conforme con los acabados y ofrecer mantenimiento preventivo.",
            checklist: [
                { id: "chk-1", text: "Comprobar apertura de bisagras", completed: false },
                { id: "chk-2", text: "Enviar encuesta de satisfacción por correo", completed: false }
            ]
        }
    },
    {
        id: "cli-2",
        name: "María Gómez",
        company: "Particular",
        email: "maria.gomez@example.com",
        phone: "+34 622 334 556",
        address: "Calle Sierpes 45, 41004 Sevilla",
        status: "lead",
        avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
        relatedJobs: [],
        appointments: [
            { id: "app-2", title: "Visita comercial y presupuesto", date: "2026-05-01 16:00", status: "pending" }
        ],
        documents: [
            { id: "doc-2", name: "Presupuesto_Preliminar.pdf", size: "1.1 MB", type: "pdf" }
        ],
        recentActivity: [
            { id: "act-2", date: "26 Abr 2026", description: "Creado nuevo lead desde formulario web." }
        ],
        nextAction: {
            id: "na-2",
            title: "Preparar dossier de materiales",
            date: "2026-04-30 09:00",
            owner: "Sofía Martínez",
            relatedRecord: "Visita comercial (app-2)",
            objective: "Llevar muestras físicas de madera y tiradores a la cita.",
            checklist: [
                { id: "chk-3", text: "Imprimir catálogo de tiradores", completed: true },
                { id: "chk-4", text: "Cotizar paneles de roble", completed: false }
            ]
        }
    }
];