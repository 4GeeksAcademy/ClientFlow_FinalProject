

export const initialJobs = [
    {
        id: "job-1",
        title: "Fabricación de Librería a Medida",
        client: {
            name: "María Gómez",
            email: "maria.gomez@example.com",
            phone: "+34 600 123 456"
        },
        address: "Calle Sierpes 24, 41004 Sevilla",
        assignedTeam: ["Carlos Alberto", "Manuel Carpintero"],
        budget: 1850.00, // En euros
        startDate: "2026-05-01",
        dueDate: "2026-05-20",
        completionDate: null,
        status: "in_progress", // pending, in_progress, completed
        progress: 60, // Porcentaje
        stages: [
            { id: 1, name: "Medición y Diseño", status: "completed" },
            { id: 2, name: "Corte de Madera", status: "completed" },
            { id: 3, name: "Ensamblaje y Lijado", status: "in_progress" },
            { id: 4, name: "Barnizado y Acabado", status: "pending" },
            { id: 5, name: "Instalación en Domicilio", status: "pending" }
        ],
        materials: [
            { id: 1, name: "Tablero de Roble Macizo", quantity: "4 unidades", status: "Disponible" },
            { id: 2, name: "Herrajes y Bisagras de Acero", quantity: "12 juegos", status: "Disponible" },
            { id: 3, name: "Barniz Mate Ecológico", quantity: "2 litros", status: "Pendiente de stock" }
        ],
        documents: [
            { id: 1, name: "Plano_Libreria_Sierpes.pdf", type: "pdf", size: "2.4 MB" },
            { id: 2, name: "Presupuesto_Firmado_MG.pdf", type: "pdf", size: "1.1 MB" }
        ],
        photos: [
            { id: 1, url: "https://images.unsplash.com/photo-1544457070-4cd773b4d71e?auto=format&fit=crop&w=600&q=80", caption: "Estado inicial del espacio" },
            { id: 2, url: "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=600&q=80", caption: "Corte de piezas en taller" }
        ],
        appointments: [
            { id: 1, date: "2026-05-05 10:00", title: "Visita de medición inicial" },
            { id: 2, date: "2026-05-18 16:30", title: "Instalación programada" }
        ],
        recentActivity: [
            { id: 1, date: "Hace 2 horas", description: "Manuel actualizó la etapa 'Corte de Madera' a completado." },
            { id: 2, date: "Ayer", description: "Se añadió el plano técnico aprobado por el cliente." }
        ]
    },
    {
        id: "job-2",
        title: "Renovación de Puertas de Cocina",
        client: {
            name: "Antonio Ruiz",
            email: "antonio.ruiz@example.com",
            phone: "+34 611 987 654"
        },
        address: "Av. de la Constitución 12, 41001 Sevilla",
        assignedTeam: ["Carlos Alberto"],
        budget: 950.00,
        startDate: "2026-04-10",
        dueDate: "2026-04-25",
        completionDate: "2026-04-24",
        status: "completed",
        progress: 100,
        stages: [
            { id: 1, name: "Toma de medidas", status: "completed" },
            { id: 2, name: "Fabricación de frentes", status: "completed" },
            { id: 3, name: "Lacado en blanco", status: "completed" },
            { id: 4, name: "Montaje final", status: "completed" }
        ],
        materials: [
            { id: 1, name: "Puertas MDF hidrófugo", quantity: "8 unidades", status: "Utilizado" },
            { id: 2, name: "Pintura laca blanca satinada", quantity: "3 litros", status: "Utilizado" }
        ],
        documents: [
            { id: 1, name: "Factura_Final_AR.pdf", type: "pdf", size: "850 KB" }
        ],
        photos: [
            { id: 1, url: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=80", caption: "Cocina terminada y montada" }
        ],
        appointments: [
            { id: 1, date: "2026-04-24 11:00", title: "Entrega y revisión de cliente" }
        ],
        recentActivity: [
            { id: 1, date: "24 Abr 2026", description: "Trabajo marcado como completado y entregado con éxito." }
        ]
    }
];