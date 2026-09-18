export const initialLeads = [
    {
        id: 1,
        name: "María Torres",
        email: "maria.torres@example.com",
        phone: "+34 600 123 456",
        origin: "WhatsApp",
        service: "Armario a medida",
        serviceZone: "Sevilla Centro",
        status: "Calificado",
        priority: "Alta",
        assignedUser: "Carlos Alberto",
        description: "Cliente interesado en un armario empotrado para dormitorio principal con puertas correderas.",
        internalNotes: "Prefiere contacto por la tarde. Presupuesto aproximado de 1.500€.",
        recentInteractions: [
            { date: "15 Sep 2026", type: "WhatsApp", notes: "Consulta inicial sobre medidas y calidades." },
            { date: "14 Sep 2026", type: "Llamada", notes: "Llamada de prospección de 5 minutos." }
        ],
        nextAction: {
            date: "18 Sep 2026 - 10:00",
            owner: "Carlos Alberto",
            description: "Enviar presupuesto preliminar detallado."
        }
    },
    {
        id: 2,
        name: "Javier Ruiz",
        email: "javier.ruiz@example.com",
        phone: "+34 611 987 654",
        origin: "Instagram",
        service: "Cocina completa",
        serviceZone: "Nervión",
        status: "Nuevo",
        priority: "Media",
        assignedUser: "Ana Gómez",
        description: "Remodelación total de cocina abierta al salón estilo moderno.",
        internalNotes: "Viene recomendado por un cliente anterior.",
        recentInteractions: [
            { date: "16 Sep 2026", type: "Instagram DM", notes: "Solicitud de catálogo de cocinas." }
        ],
        nextAction: {
            date: "19 Sep 2026 - 12:00",
            owner: "Ana Gómez",
            description: "Agendar visita técnica a domicilio."
        }
    },
    {
        id: 3,
        name: "Elena Navarro",
        email: "elena.navarro@example.com",
        phone: "+34 622 334 455",
        origin: "Web",
        service: "Puertas interiores",
        serviceZone: "Los Remedios",
        status: "Contactado",
        priority: "Baja",
        assignedUser: "Carlos Alberto",
        description: "Cambio de 6 puertas de paso en vivienda unifamiliar.",
        internalNotes: "Pendiente de confirmar medidas exactas de los huecos.",
        recentInteractions: [
            { date: "12 Sep 2026", type: "Formulario Web", notes: "Solicitud recibida desde la landing page." }
        ],
        nextAction: {
            date: "20 Sep 2026 - 16:00",
            owner: "Carlos Alberto",
            description: "Llamar para confirmar medidas."
        }
    },
    {
        id: 4,
        name: "David León",
        email: "david.leon@example.com",
        phone: "+34 633 445 566",
        origin: "WhatsApp",
        service: "Reforma de vestidor",
        serviceZone: "Triana",
        status: "Presupuesto",
        priority: "Alta",
        assignedUser: "Ana Gómez",
        description: "Diseño y montaje de vestidor abierto en madera de roble.",
        internalNotes: "Presupuesto enviado el pasado lunes.",
        recentInteractions: [
            { date: "14 Sep 2026", type: "Email", notes: "Envío de presupuesto formal." }
        ],
        nextAction: {
            date: "17 Sep 2026 - 11:00",
            owner: "Ana Gómez",
            description: "Seguimiento de presupuesto enviado."
        }
    }
];