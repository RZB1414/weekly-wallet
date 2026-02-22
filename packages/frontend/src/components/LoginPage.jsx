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
    const [recoveryKey, setRecoveryKey] = useState('');
    const [recoverySecretToDisplay, setRecoverySecretToDisplay] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [copiedKey, setCopiedKey] = useState(false);
    const [tempToken, setTempToken] = useState('');

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
                if (telegramUsername) {
                    // Register WITHOUT auto-login so we can show link-telegram screen or recovery key
                    const result = await api.auth.register(email, password, telegramUsername);
                    if (result.error) {
                        setError(result.error);
                    } else {
                        // Registration success. User MUST save the recovery key.
                        setTempToken(result.token);
                        setRecoverySecretToDisplay(result.recoverySecret);
                        setMode('presentation-recovery-key');
                    }
                } else {
                    const result = await api.auth.register(email, password);
                    if (result.error) {
                        setError(result.error);
                    } else {
                        setTempToken(result.token);
                        setRecoverySecretToDisplay(result.recoverySecret);
                        setMode('presentation-recovery-key');
                    }
                }
            } else if (mode === 'login') {
                const result = await login(email, password);
                if (result.error) {
                    setError(result.error);
                }
            } else if (mode === 'forgot') {
                if (!email.trim() || !recoveryKey.trim() || !newPassword.trim()) {
                    setError('Please fill all fields');
                    setLoading(false);
                    return;
                }
                if (newPassword !== confirmNewPassword) {
                    setError('Passwords do not match');
                    setLoading(false);
                    return;
                }
                const result = await api.auth.resetPassword(email, recoveryKey, newPassword);
                if (result.success) {
                    setSuccess(result.message || 'Password reset! You can now sign in.');
                    setTimeout(() => {
                        setMode('login');
                        setSuccess('');
                        setRecoveryKey('');
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
            case 'forgot': return 'Recover your account using your Recovery Key.';
            case 'presentation-recovery-key': return 'CRITICAL: Save your Recovery Key';
            case 'link-telegram': return 'Link your Telegram to easily receive your key.';
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
                    <h1 className="login-title">Weekly Wallet</h1>
                    <p className="login-subtitle">{getSubtitle()}</p>
                </div>

                {/* Form */}
                <form className="login-form" onSubmit={handleSubmit}>
                    {/* Email — shown in login, register, AND forgot */}
                    {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
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

                    {/* Confirm Password & Telegram Linking — register only */}
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

                    {/* Recovery Key — forgot mode */}
                    {mode === 'forgot' && (
                        <div className="form-group">
                            <label htmlFor="recovery-key">Recovery Key</label>
                            <input
                                id="recovery-key"
                                type="text"
                                value={recoveryKey}
                                onChange={(e) => setRecoveryKey(e.target.value)}
                                placeholder="pw-rec-..."
                                required
                                autoComplete="off"
                                style={{ fontFamily: 'monospace' }}
                            />
                        </div>
                    )}
                    {/* New Password fields — forgot mode */}
                    {mode === 'forgot' && (
                        <>
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
                        disabled={loading || (mode === 'forgot' && !!success) || mode === 'presentation-recovery-key'}
                        style={{ display: mode === 'link-telegram' || mode === 'presentation-recovery-key' ? 'none' : undefined }}
                    >
                        {loading ? (
                            <span className="btn-spinner">⏳</span>
                        ) : (
                            getButtonLabel()
                        )}
                    </button>
                </form>

                {/* Presentation Recovery Key Modal */}
                {mode === 'presentation-recovery-key' && (
                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🚨</div>
                        <p style={{ color: 'var(--color-danger)', fontWeight: 'bold', marginBottom: '8px' }}>
                            CRITICAL: Save this Recovery Key
                        </p>
                        <p style={{ color: 'var(--color-text)', marginBottom: '16px', fontSize: '0.90rem' }}>
                            If you lose your password AND this key, your data cannot be recovered by anyone. We do NOT store this key.
                        </p>

                        <div style={{
                            background: 'var(--color-bg)',
                            padding: '16px',
                            borderRadius: '8px',
                            fontFamily: 'monospace',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            letterSpacing: '1px',
                            color: 'var(--color-primary)',
                            marginBottom: '16px',
                            userSelect: 'all',
                            wordBreak: 'break-all'
                        }}>
                            {recoverySecretToDisplay}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                            <button
                                type="button"
                                className="login-btn"
                                onClick={() => {
                                    navigator.clipboard.writeText(recoverySecretToDisplay);
                                    setCopiedKey(true);
                                    setTimeout(() => setCopiedKey(false), 3000);
                                }}
                            >
                                {copiedKey ? '✅ Copied!' : '📋 Copy to Clipboard'}
                            </button>

                            {telegramUsername && (
                                <a
                                    className="link-btn accent"
                                    style={{
                                        background: '#0088cc',
                                        color: 'white',
                                        padding: '12px',
                                        borderRadius: 'var(--radius)',
                                        fontWeight: 'bold',
                                        textDecoration: 'none',
                                        display: 'block',
                                        textAlign: 'center'
                                    }}
                                    href={`https://t.me/share/url?url=&text=${encodeURIComponent("My Weekly Wallet Recovery Key (Keep this safe!):\n\n" + recoverySecretToDisplay)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    ✈️ Save to Telegram (Saved Messages)
                                </a>
                            )}
                        </div>

                        <button
                            type="button"
                            className="link-btn accent"
                            onClick={async () => {
                                // Double check they copied it
                                if (!confirm("Are you absolutely sure you saved your Recovery Key? Without it, you cannot reset your password.")) {
                                    return;
                                }
                                if (telegramUsername) {
                                    setMode('link-telegram');
                                } else {
                                    await login(email, password);
                                }
                            }}
                            style={{ marginTop: '8px' }}
                        >
                            ⚠️ I have securely saved it, continue
                        </button>
                    </div>
                )}

                {/* Telegram Link Prompt — after registration */}
                {mode === 'link-telegram' && (
                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📱</div>
                        <p style={{ color: 'var(--color-text)', marginBottom: '16px', fontSize: '0.95rem' }}>
                            Open the bot on Telegram and click <strong>START</strong> to link your account automatically.
                        </p>
                        <a
                            href="https://t.me/WeeklyWalletBot?start=link"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="login-btn"
                            style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: '12px' }}
                        >
                            📱 Open @WeeklyWalletBot
                        </a>
                        <button
                            type="button"
                            className="link-btn accent"
                            onClick={async () => {
                                await login(email, password);
                            }}
                            style={{ marginTop: '8px' }}
                        >
                            ✅ Done, continue to app
                        </button>
                    </div>
                )}

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
                                onClick={() => { setMode('login'); setError(''); setSuccess(''); setRecoveryKey(''); }}
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
            </div >
        </div >
    );
};

export default LoginPage;
