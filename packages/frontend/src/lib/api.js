const API_URL = import.meta.env.VITE_API_URL || 'https://weekly-wallet-backend.renanbuiatti14.workers.dev/api';

// ──────────────────────────────────────────────
// Token helper
// ──────────────────────────────────────────────

function getAuthHeaders() {
    const token = localStorage.getItem('pw_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

// ──────────────────────────────────────────────
// API
// ──────────────────────────────────────────────

export const api = {
    // ── Auth ──────────────────────────────────
    auth: {
        register: async (email, password) => {
            try {
                const res = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                    mode: 'cors',
                });
                return await res.json();
            } catch (e) {
                console.error('Register failed:', e);
                return { error: 'Connection error. Please try again.' };
            }
        },

        login: async (email, password) => {
            try {
                const res = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                    mode: 'cors',
                });
                return await res.json();
            } catch (e) {
                console.error('Login failed:', e);
                return { error: 'Connection error. Please try again.' };
            }
        },

        changePassword: async (email, oldPassword, newPassword) => {
            try {
                const res = await fetch(`${API_URL}/auth/change-password`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ email, oldPassword, newPassword }),
                    mode: 'cors',
                });
                return await res.json();
            } catch (e) {
                console.error('Change password failed:', e);
                return { error: 'Connection error. Please try again.' };
            }
        },

        forgotPassword: async (email) => {
            try {
                const res = await fetch(`${API_URL}/auth/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, frontendUrl: window.location.origin }),
                    mode: 'cors',
                });
                return await res.json();
            } catch (e) {
                console.error('Forgot password failed:', e);
                return { error: 'Connection error. Please try again.' };
            }
        },

        resetPassword: async (email, token, newPassword) => {
            try {
                const res = await fetch(`${API_URL}/auth/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, token, newPassword }),
                    mode: 'cors',
                });
                return await res.json();
            } catch (e) {
                console.error('Reset password failed:', e);
                return { error: 'Connection error. Please try again.' };
            }
        },
    },

    // ── Data (Protected) ─────────────────────
    getWeeks: async () => {
        try {
            const res = await fetch(`${API_URL}/weeks`, {
                headers: getAuthHeaders(),
                mode: 'cors',
            });
            if (res.status === 401) {
                localStorage.removeItem('pw_token');
                localStorage.removeItem('pw_user');
                window.location.reload();
                return { weeks: [] };
            }
            if (!res.ok) throw new Error('Failed to fetch weeks');
            return await res.json();
        } catch (e) {
            console.error(e);
            return { weeks: [] };
        }
    },

    saveWeeks: async (weeksData) => {
        try {
            await fetch(`${API_URL}/weeks`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ weeks: weeksData }),
                mode: 'cors'
            });
        } catch (e) {
            console.error('Failed to save', e);
        }
    },

    getMonthlyPlanning: async (year, month) => {
        try {
            const res = await fetch(`${API_URL}/monthly-planning/${year}/${month}`, {
                headers: getAuthHeaders(),
                mode: 'cors',
            });
            if (res.status === 401) {
                localStorage.removeItem('pw_token');
                localStorage.removeItem('pw_user');
                window.location.reload();
                return { categories: [], expenses: [], salary: 0 };
            }
            if (!res.ok) throw new Error('Failed to fetch monthly planning');
            return await res.json();
        } catch (e) {
            console.error(e);
            return { categories: [], expenses: [], salary: 0 };
        }
    },

    saveMonthlyPlanning: async (year, month, data) => {
        try {
            await fetch(`${API_URL}/monthly-planning/${year}/${month}`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
                mode: 'cors'
            });
        } catch (e) {
            console.error('Failed to save monthly planning', e);
        }
    },

    getMonthlyPlannings: async () => {
        try {
            const res = await fetch(`${API_URL}/monthly-plannings`, {
                headers: getAuthHeaders(),
                mode: 'cors',
            });
            if (res.status === 401) {
                localStorage.removeItem('pw_token');
                localStorage.removeItem('pw_user');
                window.location.reload();
                return { plans: [] };
            }
            if (!res.ok) throw new Error('Failed to fetch monthly plannings list');
            return await res.json();
        } catch (e) {
            console.error(e);
            return { plans: [] };
        }
    }
};
