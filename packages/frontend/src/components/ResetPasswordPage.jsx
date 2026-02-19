import React, { useState } from 'react';
import { api } from '../lib/api';
import '../styles/LoginPage.css';

const ResetPasswordPage = ({ email, token, onDone }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            const result = await api.auth.resetPassword(email, token, newPassword);
            if (result.success) {
                setSuccess(result.message || 'Password reset! You can now sign in.');
                // Clear URL params after successful reset
                setTimeout(() => {
                    window.history.replaceState({}, '', window.location.pathname);
                    if (onDone) onDone();
                }, 2000);
            } else {
                setError(result.error || 'Failed to reset password');
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <span className="login-logo">🐱</span>
                    <h1 className="login-title">Weekly Wallet</h1>
                    <p className="login-subtitle">Create a new password for your account.</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="reset-email">Email</label>
                        <input
                            id="reset-email"
                            type="email"
                            value={email}
                            disabled
                            className="disabled-input"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="new-password">New Password</label>
                        <input
                            id="new-password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={8}
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirm-new-password">Confirm New Password</label>
                        <input
                            id="confirm-new-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={8}
                            autoComplete="new-password"
                        />
                    </div>

                    {error && <div className="auth-error">{error}</div>}
                    {success && <div className="auth-success">{success}</div>}

                    <button
                        type="submit"
                        className="login-btn"
                        disabled={loading || !!success}
                    >
                        {loading ? (
                            <span className="btn-spinner">⏳</span>
                        ) : (
                            '🔑 Reset Password'
                        )}
                    </button>
                </form>

                <div className="security-badge">
                    <span>🛡️</span>
                    <span>AES-256-GCM Encrypted • scrypt Hashed</span>
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
