import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';

export const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

export const formatDate = (dateString) => {
    if (!dateString) return '';
    return format(new Date(dateString), 'dd/MM/yyyy');
};

export const getWeekId = (date) => {
    return format(startOfWeek(date, { weekStartsOn: 0 }), 'yyyy-MM-dd');
};

export const getWeekRange = (startDateStr) => {
    const date = new Date(startDateStr);
    const start = startOfWeek(date, { weekStartsOn: 0 });
    const end = endOfWeek(date, { weekStartsOn: 0 });
    return `${format(start, 'dd/MM')} - ${format(end, 'dd/MM')}`;
};

export const calculateRemaining = (initialBalance, expenses) => {
    const totalSpent = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
    return initialBalance - totalSpent;
};

export const getMonthQuarters = (year, month) => {
    // month is 1-12 (representing the Financial Month)
    // Fin Month X starts on (X-1)/26

    // Calculate Start Date: 26th of Previous Month
    // If month is 1 (Jan), previous is 0 (Dec of Year-1); but Date handles month wraparound/underflow.
    // Date(2024, 0, 26) -> Jan 26.
    // Date(2024, -1, 26) -> Dec 26, 2023. 
    // JS Date month is 0-indexed.

    // Start: Year, Month-2 (because input is 1-based, so Jan=1 -> Month 0. Previous is -1).
    const startDate = new Date(year, month - 2, 26);

    // We need 4 weeks. Let's calculate standard 7-day intervals + remainder.
    // Actually, simple fixed logic:
    // W1: 26 (prev) - 01 (curr) [approx 6-7 days]
    // W2: 02 - 09
    // W3: 10 - 17
    // W4: 18 - 25

    const f = (d) => format(d, 'yyyy-MM-dd');
    const mkDate = (d) => new Date(d); // Clone

    // Generate ranges
    // Q1: Start - Start+6 days? 
    // Let's stick to the "26th to 1st" style if possible, but months vary.
    // Jan 26 (31 days in Jan) -> Jan 31 (6 days) + Feb 1 = 7 days.
    // Feb 26 (28 days) -> Feb 28 (3 days) + Mar 1 = 4 days? Short week.
    // Let's just use +7 days logic for consistency?
    // User asked "divide... into 4 week cards".
    // 26th to 25th is fixed.

    // We need 4 weeks logic matching user preference (7-7-7-Rest).
    // W1: 26th - +6 days (7 days total)
    // W2: +7 days - +13 days
    // W3: +14 days - +20 days
    // W4: +21 days - 25th of current month

    // Helper helpers
    const addDays = (d, days) => {
        const result = new Date(d);
        result.setDate(result.getDate() + days);
        return result;
    }

    // W1: Start (26th prev)
    const q1Start = startDate;
    const q1End = addDays(q1Start, 6); // 26, 27, 28, 29, 30, 31, 1 (e.g.) or 26..1

    // W2
    const q2Start = addDays(q1End, 1);
    const q2End = addDays(q2Start, 6);

    // W3
    const q3Start = addDays(q2End, 1);
    const q3End = addDays(q3Start, 6);

    // W4
    const q4Start = addDays(q3End, 1);
    // End is ALWAYS 25th of current month
    const q4End = new Date(year, month - 1, 25);

    return [
        { id: `${year}-${month}-Q1`, start: f(q1Start), end: f(q1End), weekNumber: 1 },
        { id: `${year}-${month}-Q2`, start: f(q2Start), end: f(q2End), weekNumber: 2 },
        { id: `${year}-${month}-Q3`, start: f(q3Start), end: f(q3End), weekNumber: 3 },
        { id: `${year}-${month}-Q4`, start: f(q4Start), end: f(q4End), weekNumber: 4 },
    ];
};

export const findCurrentWeekIndex = (weekList) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const index = weekList.findIndex(w => {
        const start = new Date(w.startDate);
        start.setHours(0, 0, 0, 0);

        // Use explicit endDate if available, else fallback to +6 days (inclusive range)
        let end;
        if (w.endDate) {
            end = new Date(w.endDate);
        } else {
            end = new Date(start);
            end.setDate(end.getDate() + 6);
        }
        end.setHours(23, 59, 59, 999); // End of the day inclusive

        return now >= start && now <= end;
    });
    return index !== -1 ? index : 0; // Default to first week if not found
};
// Helper to determine Financial Info for a given Date
export const getFinancialInfo = (dateInput) => {
    const date = new Date(dateInput);
    date.setHours(0, 0, 0, 0);

    // 1. Determine Financial Month/Year
    // If date >= 26th, it belongs to NEXT month
    let financialMonth = date.getMonth() + 1; // 1-12
    let financialYear = date.getFullYear();

    if (date.getDate() >= 26) {
        financialMonth += 1;
        if (financialMonth > 12) {
            financialMonth = 1;
            financialYear += 1;
        }
    } else {
        // If date < 26th, it belongs to CURRENT month
        // But what about Jan 15? It is Jan.
        // What about Jan 27? It is Feb.
        // Logic holds.
        // Wait, what about Dec 2023 27th? -> Jan 2024.
        // Logic holds.
    }

    // 2. Generate Quarters for this Financial Month
    const quarters = getMonthQuarters(financialYear, financialMonth);

    // 3. Find which Quarter spans this date
    let foundQuarter = quarters.find(q => {
        const start = new Date(q.start);
        const end = new Date(q.end);
        // Normalize time
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return date >= start && date <= end;
    });

    // Fallback: if not found (edge case?), default to Q1 or something safe?
    // With 26th-25th logic, it should always cover. 
    // Wait, getMonthQuarters ends at 25th of financial month. 
    // And starts at 26th of prev month.
    // So it should cover all dates.

    if (!foundQuarter) {
        console.warn("Date out of range??", dateInput, quarters);
        foundQuarter = quarters[0];
    }

    return {
        year: financialYear,
        month: financialMonth,
        quarter: foundQuarter
    };
};
