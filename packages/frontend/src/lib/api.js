const API_URL = import.meta.env.VITE_API_URL || 'https://weekly-wallet-backend.renanbuiatti14.workers.dev/api';

export const api = {
    getWeeks: async () => {
        try {
            const res = await fetch(`${API_URL}/weeks`, { mode: 'cors' });
            if (!res.ok) throw new Error('Failed to fetch weeks');
            return await res.json();
        } catch (e) {
            console.error(e);
            // Fallback to local storage or empty for now
            return { weeks: [] };
        }
    },

    saveWeeks: async (weeksData) => {
        try {
            await fetch(`${API_URL}/weeks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ weeks: weeksData }),
                mode: 'cors'
            });
        } catch (e) {
            console.error('Failed to save', e);
        }
    },

    getMonthlyPlanning: async () => {
        try {
            const res = await fetch(`${API_URL}/monthly-planning`, { mode: 'cors' });
            if (!res.ok) throw new Error('Failed to fetch monthly planning');
            return await res.json();
        } catch (e) {
            console.error(e);
            return { categories: [], expenses: [] };
        }
    },

    saveMonthlyPlanning: async (data) => {
        try {
            await fetch(`${API_URL}/monthly-planning`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                mode: 'cors'
            });
        } catch (e) {
            console.error('Failed to save monthly planning', e);
        }
    }
};
