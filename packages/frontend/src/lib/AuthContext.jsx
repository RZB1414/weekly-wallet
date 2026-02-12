import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // On mount, check localStorage for saved session
    useEffect(() => {
        const savedToken = localStorage.getItem('pw_token');
        const savedUser = localStorage.getItem('pw_user');
        if (savedToken && savedUser) {
            try {
                const parsed = JSON.parse(savedUser);
                setUser({ ...parsed, token: savedToken });
            } catch {
                localStorage.removeItem('pw_token');
                localStorage.removeItem('pw_user');
            }
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        const result = await api.auth.login(email, password);
        if (result.success) {
            localStorage.setItem('pw_token', result.token);
            localStorage.setItem('pw_user', JSON.stringify(result.user));
            setUser({ ...result.user, token: result.token });
        }
        return result;
    };

    const register = async (email, password, telegramUsername) => {
        const result = await api.auth.register(email, password, telegramUsername);
        if (result.success) {
            localStorage.setItem('pw_token', result.token);
            localStorage.setItem('pw_user', JSON.stringify(result.user));
            setUser({ ...result.user, token: result.token });
        }
        return result;
    };

    const logout = () => {
        localStorage.removeItem('pw_token');
        localStorage.removeItem('pw_user');
        setUser(null);
    };

    const changePassword = async (oldPassword, newPassword) => {
        if (!user) return { error: 'Not logged in' };
        const result = await api.auth.changePassword(user.email, oldPassword, newPassword);
        if (result.success && result.token) {
            localStorage.setItem('pw_token', result.token);
            setUser(prev => ({ ...prev, token: result.token }));
        }
        return result;
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, changePassword }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
