const pad = (value) => String(value).padStart(2, "0");

export const localDateValue = (date) => (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
);

export const addDays = (dateValue, days) => {
    const [year, month, day] = dateValue.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);
    return localDateValue(date);
};

export const defaultJobSchedule = (today = new Date()) => {
    const startDate = localDateValue(today);
    return { startDate, dueDate: addDays(startDate, 30) };
};
