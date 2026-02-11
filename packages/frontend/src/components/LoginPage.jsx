import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { api } from '../lib/api';
import '../styles/LoginPage.css';

const LoginPage = () => {
    const { login, register } = useAuth();
    const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
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
                const result = await register(email, password);
                if (result.error) {
                    setError(result.error);
                }
            } else if (mode === 'login') {
                const result = await login(email, password);
                if (result.error) {
                    setError(result.error);
                }
            } else if (mode === 'forgot') {
                const result = await api.auth.forgotPassword(email);
                if (result.success) {
                    setSuccess('If an account exists with this email, a reset link has been sent. Check your inbox!');
                } else {
                    setError(result.error || 'Something went wrong');
                }
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
                {/* Header */}
                <div className="login-header">
                    <span className="login-logo">🐱</span>
                    <h1 className="login-title">Pusheen Wallet</h1>
                    <p className="login-subtitle">
                        {mode === 'login' && 'Welcome back! Sign in to your account.'}
                        {mode === 'register' && 'Create your secure account.'}
                        {mode === 'forgot' && 'Enter your email to reset your password.'}
                    </p>
                </div>

                {/* Form */}
                <form className="login-form" onSubmit={handleSubmit}>
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

                    {mode !== 'forgot' && (
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

                    {mode === 'register' && (
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
                    )}

                    {error && <div className="auth-error">{error}</div>}
                    {success && <div className="auth-success">{success}</div>}

                    <button
                        type="submit"
                        className="login-btn"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="btn-spinner">⏳</span>
                        ) : (
                            <>
                                {mode === 'login' && '🔐 Sign In'}
                                {mode === 'register' && '✨ Create Account'}
                                {mode === 'forgot' && '📧 Send Reset Link'}
                            </>
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
                    {mode === 'forgot' && (
                        <p>
                            Remember your password?{' '}
                            <button
                                type="button"
                                className="link-btn accent"
                                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
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
