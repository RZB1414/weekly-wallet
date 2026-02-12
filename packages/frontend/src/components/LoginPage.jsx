import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { api } from '../lib/api';
import '../styles/LoginPage.css';

const LoginPage = () => {
    const { login, register } = useAuth();
    const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot' | 'verify-code' | 'reset'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [telegramUsername, setTelegramUsername] = useState('');
    const [resetCode, setResetCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (mode === 'register') {
                if (password !== confirmPassword) {
                    setError('Passwords do not match');
                    setLoading(false);
                    return;
                }
                const result = await register(email, password, telegramUsername || undefined);
                if (result.error) {
                    setError(result.error);
                }
            } else if (mode === 'login') {
                const result = await login(email, password);
                if (result.error) {
                    setError(result.error);
                }
            } else if (mode === 'forgot') {
                if (!telegramUsername.trim()) {
                    setError('Please enter your Telegram username');
                    setLoading(false);
                    return;
                }
                const result = await api.auth.forgotPassword(telegramUsername);
                if (result.success) {
                    setSuccess('A reset code has been sent to your Telegram.');
                    // Switch to code entry mode after short delay
                    setTimeout(() => {
                        setMode('verify-code');
                        setSuccess('');
                    }, 1500);
                } else {
                    setError(result.error || 'Something went wrong');
                }
            } else if (mode === 'verify-code') {
                if (resetCode.length !== 6) {
                    setError('Please enter the 6-digit code');
                    setLoading(false);
                    return;
                }
                // Move to password reset step
                setMode('reset');
            } else if (mode === 'reset') {
                if (newPassword !== confirmNewPassword) {
                    setError('Passwords do not match');
                    setLoading(false);
                    return;
                }
                const result = await api.auth.resetPassword(email, resetCode, newPassword);
                if (result.success) {
                    setSuccess(result.message || 'Password reset! You can now sign in.');
                    setTimeout(() => {
                        setMode('login');
                        setSuccess('');
                        setResetCode('');
                        setNewPassword('');
                        setConfirmNewPassword('');
                    }, 2000);
                } else {
                    setError(result.error || 'Failed to reset password');
                }
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const getSubtitle = () => {
        switch (mode) {
            case 'login': return 'Welcome back! Sign in to your account.';
            case 'register': return 'Create your secure account.';
            case 'forgot': return 'Enter your Telegram username to receive a reset code.';
            case 'verify-code': return 'Enter the 6-digit code sent to your Telegram.';
            case 'reset': return 'Create a new password for your account.';
            default: return '';
        }
    };

    const getButtonLabel = () => {
        switch (mode) {
            case 'login': return '🔐 Sign In';
            case 'register': return '✨ Create Account';
            case 'forgot': return '� Send Reset Code';
            case 'verify-code': return '✅ Verify Code';
            case 'reset': return '🔑 Reset Password';
            default: return 'Submit';
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                {/* Header */}
                <div className="login-header">
                    <span className="login-logo">🐱</span>
                    <h1 className="login-title">Pusheen Wallet</h1>
                    <p className="login-subtitle">{getSubtitle()}</p>
                </div>

                {/* Form */}
                <form className="login-form" onSubmit={handleSubmit}>
                    {/* Email — shown in login, register only */}
                    {(mode === 'login' || mode === 'register') && (
                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                autoComplete="email"
                            />
                        </div>
                    )}

                    {/* Telegram Username — forgot mode */}
                    {mode === 'forgot' && (
                        <div className="form-group">
                            <label htmlFor="forgot-telegram">Telegram Username</label>
                            <input
                                id="forgot-telegram"
                                type="text"
                                value={telegramUsername}
                                onChange={(e) => setTelegramUsername(e.target.value)}
                                placeholder="@your_username"
                                required
                                autoComplete="off"
                            />
                            <small style={{ color: 'var(--color-text-muted)', opacity: 0.6, fontSize: '0.75rem' }}>
                                The username you registered with
                            </small>
                        </div>
                    )}

                    {/* Password — shown in login, register */}
                    {(mode === 'login' || mode === 'register') && (
                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={8}
                                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            />
                        </div>
                    )}

                    {/* Confirm Password — register only */}
                    {mode === 'register' && (
                        <>
                            <div className="form-group">
                                <label htmlFor="confirmPassword">Confirm Password</label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    minLength={8}
                                    autoComplete="new-password"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="telegramUsername">Telegram Username <span style={{ opacity: 0.5, fontWeight: 'normal' }}>(optional)</span></label>
                                <input
                                    id="telegramUsername"
                                    type="text"
                                    value={telegramUsername}
                                    onChange={(e) => setTelegramUsername(e.target.value)}
                                    placeholder="@your_username"
                                    autoComplete="off"
                                />
                                <small style={{ color: 'var(--color-text-muted)', opacity: 0.6, fontSize: '0.75rem' }}>
                                    Used for password recovery via @WeeklyWalletBot
                                </small>
                            </div>
                        </>
                    )}

                    {/* 6-digit Code Input — verify-code mode */}
                    {mode === 'verify-code' && (
                        <div className="form-group">
                            <label htmlFor="reset-code">Reset Code</label>
                            <input
                                id="reset-code"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]{6}"
                                maxLength={6}
                                value={resetCode}
                                onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000000"
                                required
                                autoComplete="one-time-code"
                                style={{
                                    textAlign: 'center',
                                    fontSize: '1.5rem',
                                    letterSpacing: '8px',
                                    fontFamily: 'monospace',
                                }}
                            />
                        </div>
                    )}

                    {/* New Password fields — reset mode */}
                    {mode === 'reset' && (
                        <>
                            <div className="form-group">
                                <label htmlFor="reset-email">Email</label>
                                <input
                                    id="reset-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    required
                                    autoComplete="email"
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
                                    value={confirmNewPassword}
                                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    minLength={8}
                                    autoComplete="new-password"
                                />
                            </div>
                        </>
                    )}

                    {error && <div className="auth-error">{error}</div>}
                    {success && <div className="auth-success">{success}</div>}

                    <button
                        type="submit"
                        className="login-btn"
                        disabled={loading || (mode === 'forgot' && !!success)}
                    >
                        {loading ? (
                            <span className="btn-spinner">⏳</span>
                        ) : (
                            getButtonLabel()
                        )}
                    </button>
                </form>

                {/* Footer Links */}
                <div className="login-footer">
                    {mode === 'login' && (
                        <>
                            <button
                                type="button"
                                className="link-btn"
                                onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}
                            >
                                Forgot password?
                            </button>
                            <div className="footer-divider" />
                            <p>
                                Don't have an account?{' '}
                                <button
                                    type="button"
                                    className="link-btn accent"
                                    onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                                >
                                    Sign Up
                                </button>
                            </p>
                        </>
                    )}
                    {mode === 'register' && (
                        <p>
                            Already have an account?{' '}
                            <button
                                type="button"
                                className="link-btn accent"
                                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                            >
                                Sign In
                            </button>
                        </p>
                    )}
                    {(mode === 'forgot' || mode === 'verify-code' || mode === 'reset') && (
                        <p>
                            Remember your password?{' '}
                            <button
                                type="button"
                                className="link-btn accent"
                                onClick={() => { setMode('login'); setError(''); setSuccess(''); setResetCode(''); }}
                            >
                                Back to Sign In
                            </button>
                        </p>
                    )}
                </div>

                {/* Security Badge */}
                <div className="security-badge">
                    <span>🛡️</span>
                    <span>AES-256-GCM Encrypted • scrypt Hashed</span>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
