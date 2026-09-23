import React, { useState, useEffect, useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { 
    getAppointments, 
    createAppointment, 
    cancelAppointment 
} from "../services/appointmentService"; // Importamos los servicios que creamos

export const Agenda = () => {
    const { store } = useContext(Context); // Obtenemos el token de autenticación
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    const location = useLocation();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDateStr, setSelectedDateStr] = useState(new Date().toISOString().split('T')[0]);

    // Vistas de mes y semana
    const [currentView, setCurrentView] = useState("month");

    // Cargar citas desde el backend al iniciar o cuando cambia el token
    useEffect(() => {
        if (store.token) {
            fetchAppointments();
        }
    }, [store.token]);

    const fetchAppointments = async () => {
        try {
            setLoading(true);
            setErrorMsg(null);
            const data = await getAppointments(store.token);
            setAppointments(data);
        } catch (err) {
            console.error(err);
            setErrorMsg("No se pudieron cargar las citas del servidor.");
        } finally {
            setLoading(false);
        }
    };

    // Detectar si llegamos desde un enlace con un appointment ID específico
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const appId = params.get("appointmentId");
        if (appId && appointments.length > 0) {
            const foundApp = appointments.find(a => String(a.id) === String(appId));
            if (foundApp && foundApp.starts_at) {
                const datePart = foundApp.starts_at.split('T')[0];
                setSelectedDateStr(datePart); 
                setCurrentDate(new Date(datePart)); 
            }
        }
    }, [location.search, appointments]);

    // Modal de Nueva Cita
    const [showModal, setShowModal] = useState(false);
    const [newApp, setNewApp] = useState({
        title: "",
        date: selectedDateStr,
        time: "10:00",
        type: "Medición",
        clientName: "Antonio Ruiz",
        clientId: 1, // Ajustado a número o ID válido para tu backend
        responsible: "Carlos Alberto",
        relatedJob: "Renovación de Puertas de Cocina",
        jobId: 1
    });

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const handlePrev = () => {
        if (currentView === "month") {
            setCurrentDate(new Date(year, month - 1, 1));
        } else {
            const d = new Date(currentDate);
            d.setDate(d.getDate() - 7);
            setCurrentDate(d);
        }
    };

    const handleNext = () => {
        if (currentView === "month") {
            setCurrentDate(new Date(year, month + 1, 1));
        } else {
            const d = new Date(currentDate);
            d.setDate(d.getDate() + 7);
            setCurrentDate(d);
        }
    };

    const handleToday = () => {
        const now = new Date();
        setCurrentDate(now);
        setSelectedDateStr(now.toISOString().split('T')[0]);
    };

    // Crear cita conectada al Backend (con manejo de conflicto 409)
    const handleCreateAppointment = async (e) => {
        e.preventDefault();
        
        // Formatear fecha y hora para que coincidan con lo que espera el backend (ISO 8601)
        const startsAtIso = `${newApp.date}T${newApp.time}:00`;
        // Calculamos una hora de duración por defecto paraends_at
        const startDateObj = new Date(startsAtIso);
        startDateObj.setHours(startDateObj.getHours() + 1);
        const endsAtIso = startDateObj.toISOString().slice(0, 19);

        const payload = {
            title: newApp.title,
            notes: `${newApp.type} - Responsable: ${newApp.responsible}`,
            starts_at: startsAtIso,
            ends_at: endsAtIso,
            client_id: Number(newApp.clientId)
        };

        try {
            await createAppointment(store.token, payload);
            setShowModal(false);
            fetchAppointments(); // Recargamos la lista desde la base de datos
            alert("¡Cita creada con éxito!");
        } catch (err) {
            // Si el backend devuelve 409 Conflict, mostramos el mensaje de error específico
            if (err.status === 409) {
                alert(`Conflicto de horario: ${err.message}`);
            } else {
                alert(err.message || "Error al programar la cita.");
            }
        }
    };

    // Función para eliminar/cancelar una cita conectada al Backend
    const handleDeleteAppointment = async (id) => {
        if (window.confirm("¿Estás seguro de que deseas cancelar esta cita?")) {
            try {
                await cancelAppointment(store.token, id);
                fetchAppointments(); // Recargamos la lista actualizada
            } catch (err) {
                alert(err.message || "Error al eliminar la cita.");
            }
        }
    };

    const firstDayIndex = new Date(year, month, 1).getDay();
    const adjustedFirstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const totalDays = new Date(year, month + 1, 0).getDate();

    const getWeekDays = (date) => {
        const start = new Date(date);
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(start.setDate(diff));
        let week = [];
        for (let i = 0; i < 7; i++) {
            const nextDay = new Date(monday);
            nextDay.setDate(monday.getDate() + i);
            week.push(nextDay.toISOString().split('T')[0]);
        }
        return week;
    };
    const currentWeekDays = getWeekDays(currentDate);

    // Filtramos las citas comparando la fecha de la base de datos con la seleccionada en el calendario
    const selectedDayAppointments = appointments.filter(app => {
        if (!app.starts_at) return false;
        return app.starts_at.split('T')[0] === selectedDateStr;
    });

    return (
        <div className="container-fluid px-0" style={{ color: "#212529" }}>
            {/* Cabecera general */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                <div>
                    <h2 className="fw-bold mb-1" style={{ color: "#212529" }}>Agenda y Calendario</h2>
                    <p className="text-secondary small mb-0">Gestión de citas, visitas y planificación operativa.</p>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <button
                        className="btn btn-primary btn-sm d-flex align-items-center gap-2 shadow-sm"
                        style={{ backgroundColor: "#635bff", border: "none" }}
                        onClick={() => {
                            setNewApp(prev => ({ ...prev, date: selectedDateStr }));
                            setShowModal(true);
                        }}
                    >
                        <i className="fa-solid fa-plus"></i> Nueva Cita
                    </button>
                </div>
            </div>

            {errorMsg && <div className="alert alert-danger">{errorMsg}</div>}
            {loading && <p className="text-muted">Cargando citas...</p>}

            <div className="row g-4">
                {/* Columna Izquierda: Calendario */}
                <div className="col-12 col-xl-7">
                    <div className="card border-0 shadow-sm h-100 rounded-4 overflow-hidden bg-white">
                        {/* Cabecera del calendario */}
                        <div className="card-header py-3 border-0 d-flex flex-wrap justify-content-between align-items-center gap-2 bg-white">
                            <div className="d-flex align-items-center gap-2">
                                <div className="btn-group btn-group-sm">
                                    <button className="btn btn-outline-secondary border px-2 shadow-sm" onClick={handlePrev}><i className="fa-solid fa-chevron-left"></i></button>
                                    <button className="btn btn-outline-secondary border px-2 fw-semibold shadow-sm" onClick={handleToday}>Hoy</button>
                                    <button className="btn btn-outline-secondary border px-2 shadow-sm" onClick={handleNext}><i className="fa-solid fa-chevron-right"></i></button>
                                </div>
                                <h5 className="fw-bold m-0 ms-2 text-dark">
                                    {currentView === 'month' && `${monthNames[month]} ${year}`}
                                    {currentView === 'week' && `Vista Semanal`}
                                </h5>
                            </div>

                            <div className="btn-group btn-group-sm">
                                <button
                                    className={`btn ${currentView === 'month' ? 'btn-primary' : 'btn-outline-secondary border shadow-sm'}`}
                                    onClick={() => setCurrentView('month')}
                                    style={currentView === 'month' ? { backgroundColor: "#635bff", border: "none" } : {}}
                                >
                                    Mes
                                </button>
                                <button
                                    className={`btn ${currentView === 'week' ? 'btn-primary' : 'btn-outline-secondary border shadow-sm'}`}
                                    onClick={() => setCurrentView('week')}
                                    style={currentView === 'week' ? { backgroundColor: "#635bff", border: "none" } : {}}
                                >
                                    Semana
                                </button>
                            </div>
                        </div>

                        <div className="card-body pt-0 px-3 pb-3 bg-white">
                            {currentView === 'month' && (
                                <div>
                                    {/* Días de la semana */}
                                    <div className="row text-center fw-bold mb-2 py-2 rounded-3 mx-0 bg-light text-dark" style={{ fontSize: "0.8rem" }}>
                                        <div className="col">Lun</div>
                                        <div className="col">Mar</div>
                                        <div className="col">Mié</div>
                                        <div className="col">Jue</div>
                                        <div className="col">Vie</div>
                                        <div className="col">Sáb</div>
                                        <div className="col">Dom</div>
                                    </div>
                                    <div className="d-flex flex-column gap-1">
                                        {(() => {
                                            let rows = [];
                                            let cells = [];
                                            
                                            // Celdas vacías iniciales para alinear al lunes
                                            for (let i = 0; i < adjustedFirstDayIndex; i++) {
                                                cells.push(
                                                    <div className="col p-2 text-muted opacity-25 border-0 rounded-2" key={`empty-${i}`} style={{ minHeight: "95px" }}>
                                                        &nbsp;
                                                    </div>
                                                );
                                            }

                                            // Días del mes
                                            for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
                                                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                                                const dayApps = appointments.filter(a => a.starts_at && a.starts_at.split('T')[0] === dateStr);
                                                const isSelected = selectedDateStr === dateStr;

                                                cells.push(
                                                    <div className="col p-1" key={dateStr} style={{ minHeight: "95px", maxWidth: "14.28%" }}>
                                                        <div
                                                            onClick={() => setSelectedDateStr(dateStr)}
                                                            className="h-100 d-flex flex-column justify-content-between p-2 rounded-2 position-relative bg-white"
                                                            style={{ 
                                                                cursor: "pointer",
                                                                border: isSelected ? "2px solid #635bff" : "1px solid #dee2e6",
                                                                boxShadow: isSelected ? "0 0 0 1px #635bff" : "none",
                                                                transition: "all 0.15s ease-in-out" 
                                                            }}
                                                        >
                                                            <div className="d-flex justify-content-between align-items-center">
                                                                <span className="fw-bold small px-1 text-dark" style={{ fontSize: "0.75rem" }}>
                                                                    {dayNum}
                                                                </span>
                                                                {dayApps.length > 0 && <span className="badge rounded-pill text-white" style={{ fontSize: "0.55rem", backgroundColor: "#635bff" }}>{dayApps.length}</span>}
                                                            </div>
                                                            <div className="overflow-hidden d-flex flex-column gap-1 mt-1" style={{ maxHeight: "50px" }}>
                                                                {dayApps.map(app => {
                                                                    const timeStr = app.starts_at ? app.starts_at.split('T')[1].substring(0, 5) : "";
                                                                    return (
                                                                        <div key={app.id} className="text-truncate rounded-1 px-1 py-0.5 text-white fw-semibold" style={{ fontSize: "0.6rem", backgroundColor: '#635bff' }}>
                                                                            {timeStr} {app.title}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );

                                                if ((adjustedFirstDayIndex + dayNum) % 7 === 0 || dayNum === totalDays) {
                                                    if (dayNum === totalDays && cells.length % 7 !== 0) {
                                                        const remaining = 7 - (cells.length % 7);
                                                        for (let r = 0; r < remaining; r++) {
                                                            cells.push(
                                                                <div className="col p-2 text-muted opacity-25 border-0 rounded-2" key={`empty-end-${r}`} style={{ minHeight: "95px" }}>
                                                                    &nbsp;
                                                                </div>
                                                            );
                                                        }
                                                    }
                                                    rows.push(
                                                        <div className="row g-1 mb-1" key={`row-${dayNum}`}>
                                                            {cells}
                                                        </div>
                                                    );
                                                    cells = [];
                                                }
                                            }
                                            return rows;
                                        })()}
                                    </div>
                                </div>
                            )}

                            {currentView === 'week' && (
                                <div className="row g-2">
                                    {currentWeekDays.map(dateStr => {
                                        const dayApps = appointments.filter(a => a.starts_at && a.starts_at.split('T')[0] === dateStr);
                                        const isSelected = selectedDateStr === dateStr;
                                        return (
                                            <div 
                                                className="col-12 col-md p-2 rounded-3 bg-white" 
                                                key={dateStr} 
                                                style={{ 
                                                    minHeight: "320px", 
                                                    border: isSelected ? "2px solid #635bff" : "1px solid #dee2e6",
                                                    boxShadow: isSelected ? "0 0 0 1px #635bff" : "none",
                                                    transition: "all 0.15s ease-in-out"
                                                }}
                                            >
                                                <div
                                                    onClick={() => setSelectedDateStr(dateStr)}
                                                    className="h-100 d-flex flex-column"
                                                    style={{ cursor: "pointer" }}
                                                >
                                                    <div className="fw-bold small mb-2 pb-2 border-bottom text-center text-dark border-light">
                                                        {dateStr.split('-').slice(1).reverse().join('/')}
                                                    </div>
                                                    <div className="d-flex flex-column gap-1 flex-grow-1">
                                                        {dayApps.map(app => {
                                                            const timeStr = app.starts_at ? app.starts_at.split('T')[1].substring(0, 5) : "";
                                                            return (
                                                                <div key={app.id} className="p-1.5 text-white rounded-1 shadow-xs" style={{ fontSize: "0.7rem", backgroundColor: "#635bff" }}>
                                                                    <strong>{timeStr}</strong> {app.title}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Columna Derecha: Detalle de Citas del Día */}
                <div className="col-12 col-xl-5">
                    <div className="card border-0 shadow-sm h-100 rounded-4 overflow-hidden bg-white">
                        <div className="card-header py-3 border-0 d-flex justify-content-between align-items-center bg-white">
                            <h5 className="fw-bold m-0 text-dark">
                                <i className="fa-solid fa-calendar-day me-2" style={{ color: "#635bff" }}></i> Citas del Día
                            </h5>
                            <span className="badge text-white px-2.5 py-1.5 rounded-pill shadow-xs" style={{ backgroundColor: "#635bff" }}>{selectedDateStr}</span>
                        </div>
                        <div className="card-body pt-0 px-3 pb-3 bg-white">
                            {selectedDayAppointments.length === 0 ? (
                                <div className="text-center py-5">
                                    <i className="fa-solid fa-calendar-xmark fa-2x text-muted mb-3 opacity-50"></i>
                                    <p className="text-secondary small mb-0">No hay citas programadas para este día.</p>
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-3">
                                    {selectedDayAppointments.map(app => {
                                        const params = new URLSearchParams(location.search);
                                        const isHighlighted = String(params.get("appointmentId")) === String(app.id);
                                        const timeStr = app.starts_at ? app.starts_at.split('T')[1].substring(0, 5) : "";

                                        return (
                                            <div
                                                className={`p-3 rounded-3 border-0 shadow-xs bg-light position-relative`}
                                                key={app.id}
                                                style={{ 
                                                    borderLeft: !isHighlighted ? "4px solid #635bff" : "4px solid #198754" 
                                                }}
                                            >
                                                <div className="d-flex justify-content-between align-items-start mb-2">
                                                    <div>
                                                        <span className="badge text-white mb-1" style={{ fontSize: "0.7rem", backgroundColor: "#495057" }}>{app.status || "Confirmada"}</span>
                                                        <h6 className="fw-bold mb-0 text-dark">
                                                            {app.title} {isHighlighted && <span className="text-success small ms-1">(Seleccionada)</span>}
                                                        </h6>
                                                    </div>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className="fw-bold small" style={{ color: "#635bff" }}><i className="fa-solid fa-clock me-1"></i>{timeStr}</span>
                                                        <button 
                                                            className="btn btn-outline-danger btn-sm border-0 p-1" 
                                                            title="Eliminar cita"
                                                            onClick={() => handleDeleteAppointment(app.id)}
                                                        >
                                                            <i className="fa-solid fa-trash-can"></i>
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="small text-secondary mb-0">
                                                    <p className="mb-1">
                                                        <i className="fa-solid fa-note-sticky me-2 text-dark opacity-75"></i>
                                                        <strong>Notas:</strong> {app.notes || "Sin notas"}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Nueva Cita */}
            {showModal && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg rounded-4 bg-white text-dark">
                            <div className="modal-header border-0 pb-0">
                                <h5 className="fw-bold text-dark">Programar Nueva Cita</h5>
                                <button type="button" className="btn-close shadow-none" onClick={() => setShowModal(false)}></button>
                            </div>
                            <form onSubmit={handleCreateAppointment}>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-dark">Título de la Cita</label>
                                        <input
                                            type="text"
                                            className="form-control shadow-none rounded-3 border bg-light text-dark"
                                            required
                                            value={newApp.title}
                                            onChange={e => setNewApp({ ...newApp, title: e.target.value })}
                                            placeholder="Ej. Toma de medidas salón"
                                        />
                                    </div>
                                    <div className="row g-2 mb-3">
                                        <div className="col">
                                            <label className="form-label small fw-semibold text-dark">Fecha</label>
                                            <input
                                                type="date"
                                                className="form-control border shadow-none rounded-3 bg-white text-dark"
                                                required
                                                value={newApp.date}
                                                onChange={e => setNewApp({ ...newApp, date: e.target.value })}
                                                style={{ cursor: "pointer" }}
                                            />
                                        </div>
                                        <div className="col">
                                            <label className="form-label small fw-semibold text-dark">Hora</label>
                                            <input
                                                type="time"
                                                className="form-control border shadow-none rounded-3 bg-white text-dark"
                                                required
                                                value={newApp.time}
                                                onChange={e => setNewApp({ ...newApp, time: e.target.value })}
                                                style={{ cursor: "pointer" }}
                                            />
                                        </div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-dark">ID del Cliente</label>
                                        <input
                                            type="number"
                                            className="form-control shadow-none rounded-3 border bg-light text-dark"
                                            required
                                            value={newApp.clientId}
                                            onChange={e => setNewApp({ ...newApp, clientId: e.target.value })}
                                            placeholder="Ej. 1"
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer border-0 pt-0">
                                    <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 px-3" onClick={() => setShowModal(false)}>Cancelar</button>
                                    <button type="submit" className="btn btn-primary btn-sm px-4 rounded-3" style={{ backgroundColor: "#635bff", border: "none" }}>Guardar Cita</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Agenda;