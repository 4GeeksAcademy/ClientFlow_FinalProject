export const aiMessages = {
    es: {
        reasons: {
            agent_service_unavailable: "No se pudo conectar con el servicio de IA. Comprueba la conexión del servidor y vuelve a intentarlo.",
            knowledge_service_unavailable: "No se pudo consultar el conocimiento de la empresa. Vuelve a intentarlo cuando el servicio esté disponible.",
            invalid_agent_response: "La IA devolvió una respuesta que no se pudo validar. No se ha enviado al cliente.",
            context_limit: "La conversación o los documentos superan el límite del servicio. El equipo debe revisar este caso.",
            insufficient_relevance: "No se encontró información suficientemente relacionada en los documentos autorizados.",
            no_authorized_sources: "El agente no tiene documentos procesados y autorizados para responder esta consulta.",
            invalid_retrieval_configuration: "La configuración de búsqueda necesita revisión.",
            agent_requested_human: "Esta consulta necesita confirmación del equipo. No se ha enviado ninguna respuesta automáticamente.",
        },
        fallback: "No se envió ninguna respuesta. Continúa la atención manualmente.",
        latestMessage: "Usar mensaje más reciente de esta página",
    },
};
