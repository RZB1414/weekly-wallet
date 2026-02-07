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
