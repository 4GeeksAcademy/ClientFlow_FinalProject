export function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function parseDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 12);
}
export function monthCells(year, month) {
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) =>
        index < offset || index >= offset + days ? null : new Date(year, month, index - offset + 1, 12));
}
export function dayAppointments(items, date) {
    return items.filter(item => item.date === date).sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
}
