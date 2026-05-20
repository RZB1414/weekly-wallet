import React from 'react';
import '../styles/UserGuide.css';

const UserGuide = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="guide-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="guide-container">
                {/* Header */}
                <div className="guide-header">
                    <button className="guide-close" onClick={onClose}>✕</button>
                    <div className="guide-hero">
                        <div className="guide-hero-icon">🐱</div>
                        <h1>Weekly Wallet</h1>
                        <p>User Guide</p>
                    </div>
                </div>

                {/* Content */}
                <div className="guide-content">

                    {/* Section 1 — Getting Started */}
                    <section className="guide-section">
                        <div className="guide-section-header">
                            <span className="guide-step-num">1</span>
                            <h2>Getting Started</h2>
                        </div>
                        <p className="guide-text">Create an account with your email and a password. You will receive a <strong>Recovery Key</strong> during registration.</p>
                        <div className="guide-tip">
                            <strong>⚠️ CRITICAL</strong>
                            <p>Save your <strong>Recovery Key</strong> in a safe place! It is the ONLY way to recover your account if you forget your password.</p>
                        </div>
                    </section>

                    {/* Section 2 — Dashboard */}
                    <section className="guide-section">
                        <div className="guide-section-header">
                            <span className="guide-step-num">2</span>
                            <h2>Dashboard</h2>
                        </div>
                        <p className="guide-text">Your home screen shows everything at a glance:</p>
                        <div className="guide-features">
                            <div className="guide-feature">
                                <span className="guide-feature-icon">💰</span>
                                <div>
                                    <strong>Weekly Balance</strong>
                                    <p>How much of your weekly budget is left. Green = on track, red = over.</p>
                                </div>
                            </div>
                            <div className="guide-feature">
                                <span className="guide-feature-icon">📊</span>
                                <div>
                                    <strong>Weekly Goals</strong>
                                    <p>Bar chart comparing spending vs budget for each week. Badge shows monthly % remaining.</p>
                                </div>
                            </div>
                            <div className="guide-feature">
                                <span className="guide-feature-icon">🚀</span>
                                <div>
                                    <strong>Financial Momentum & Runway</strong>
                                    <p>See how your wealth is growing or how long your savings will last at your current burn rate.</p>
                                </div>
                            </div>
                            <div className="guide-feature">
                                <span className="guide-feature-icon">🍩</span>
                                <div>
                                    <strong>Categories</strong>
                                    <p>Donut chart showing where your money goes — top 5 categories.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Section 3 — Adding Expenses */}
                    <section className="guide-section">
                        <div className="guide-section-header">
                            <span className="guide-step-num">3</span>
                            <h2>Adding Expenses</h2>
                        </div>
                        <p className="guide-text">Tap <strong>"➕ Add Expense"</strong> from the Dashboard or Week History.</p>
                        <ol className="guide-steps">
                            <li>Choose <strong>Expense</strong> (money out) or <strong>Credit</strong> (money in)</li>
                            <li>Enter a <strong>description</strong> and <strong>amount</strong></li>
                            <li>Pick a <strong>category</strong> from your Monthly Planning</li>
                            <li>Select the <strong>date</strong> — auto-assigns to the correct week</li>
                            <li>Optionally <strong>split into installments</strong> across weeks</li>
                            <li>Tap <strong>Add</strong>!</li>
                        </ol>
                        <div className="guide-tip">
                            <strong>💡 Splitting</strong>
                            <p>Big purchase? Split across 2–4 weeks. The app creates entries like "Laptop (1/3)", "Laptop (2/3)", etc.</p>
                        </div>
                    </section>

                    {/* Section 4 — Week History */}
                    <section className="guide-section">
                        <div className="guide-section-header">
                            <span className="guide-step-num">4</span>
                            <h2>Week History</h2>
                        </div>
                        <p className="guide-text">Tap <strong>"📊 History"</strong> to browse your weekly expense cards:</p>
                        <ul className="guide-list">
                            <li><strong>Swipe</strong> left/right between the 4 weeks of the month</li>
                            <li>Use <strong>month/year selectors</strong> to navigate</li>
                            <li>Each card lists expenses with category, name, and amount</li>
                            <li><strong>Credits</strong> appear in green with a "+" sign</li>
                            <li>Tap <strong>"Current Week"</strong> to jump back</li>
                        </ul>
                    </section>

                    {/* Section 5 — Monthly Planning */}
                    <section className="guide-section">
                        <div className="guide-section-header">
                            <span className="guide-step-num">5</span>
                            <h2>Monthly Planning</h2>
                        </div>
                        <p className="guide-text">Tap <strong>"📅 Plan"</strong> to set up your monthly budget:</p>
                        <ol className="guide-steps">
                            <li>Enter your <strong>monthly salary</strong></li>
                            <li>Add <strong>categories</strong> with name, type, and budget</li>
                            <li>Choose type: <span className="guide-badge-green">Flexible Spending Budget</span> or <span className="guide-badge-red">Spend</span></li>
                            <li>Set <strong>frequency</strong>: weekly or monthly</li>
                            <li>Tap <strong>Save</strong></li>
                        </ol>
                        <div className="guide-tip">
                            <strong>💡 How Categories Work</strong>
                            <p><strong><span className="guide-badge-green">Flexible Spending Budget</span>:</strong> The amount is reserved from your <strong>Global Monthly Balance</strong> for a category you will spend from throughout the month, but it is <strong>NOT</strong> automatically recorded as an expense.</p>
                            <p style={{ marginTop: '8px' }}><strong><span className="guide-badge-red">Spend</span>:</strong> The amount is immediately considered "spent" or "saved" (like a fixed bill, debt payment, or money put into Savings). It is deducted both from the Global Balance and instantly affects your actual cash flow.</p>
                        </div>
                    </section>

                    {/* Section 6 — Recovery Key & Security */}
                    <section className="guide-section">
                        <div className="guide-section-header">
                            <span className="guide-step-num">6</span>
                            <h2>Recovery Key & Security</h2>
                        </div>

                        {/* 6a — Password Reset */}
                        <p className="guide-text" style={{ fontWeight: 700, color: '#1F2937', marginBottom: 6 }}>🔑 Resetting Your Password</p>
                        <p className="guide-text">Forgot your password? You will need your Recovery Key to regain access:</p>
                        <ol className="guide-steps">
                            <li>On the <strong>Login page</strong>, tap <strong>"Forgot Password?"</strong></li>
                            <li>Enter your <strong>Email</strong> and your <strong>Recovery Key</strong> (e.g., pw-rec-...)</li>
                            <li>Tap <strong>"Recover Account"</strong></li>
                            <li>You will be prompted to create a <strong>new password</strong></li>
                            <li>Tap <strong>"Reset Password"</strong> — done! You can now log in with your new password</li>
                        </ol>
                        <div className="guide-tip">
                            <strong>⚠️ Lost your Recovery Key?</strong>
                            <p>If you lose your Recovery Key and forget your password, your account cannot be restored under any circumstances. Keep it safe!</p>
                        </div>

                        {/* 6b — Security */}
                        <p className="guide-text" style={{ fontWeight: 700, color: '#1F2937', marginTop: 24, marginBottom: 6 }}>🔐 Your Data is Secure</p>
                        <div className="guide-security">
                            <h3>End-to-End Encryption</h3>
                            <ul className="guide-list">
                                <li>All your financial data is encrypted with <strong>AES-256-GCM</strong> — military-grade encryption</li>
                                <li>Each user has a <strong>unique encryption key (DEK)</strong> tied to your password</li>
                                <li>Data is stored encrypted on <strong>Cloudflare R2</strong> — fast & globally distributed</li>
                                <li><strong>Nobody</strong> can read your data — not even the server or the developer</li>
                                <li>Your password is <strong>never stored</strong> in plain text — only a secure hash</li>
                            </ul>
                        </div>
                    </section>

                    {/* Section 7 — Quick Reference */}
                    <section className="guide-section">
                        <div className="guide-section-header">
                            <span className="guide-step-num">✨</span>
                            <h2>Quick Reference</h2>
                        </div>
                        <div className="guide-ref-grid">
                            <div className="guide-ref-item"><span>📊</span> <strong>Balance</strong> — Open app → Dashboard</div>
                            <div className="guide-ref-item"><span>➕</span> <strong>Add</strong> — Dashboard → "Add Expense"</div>
                            <div className="guide-ref-item"><span>📅</span> <strong>Plan</strong> — "Plan" → salary + categories</div>
                            <div className="guide-ref-item"><span>📈</span> <strong>Trends</strong> — Scroll → toggle weekly/monthly</div>
                            <div className="guide-ref-item"><span>🔄</span> <strong>Split</strong> — Add Expense → installments</div>
                            <div className="guide-ref-item"><span>💰</span> <strong>Savings</strong> — "Savings" category tracks deposits</div>
                            <div className="guide-ref-item"><span>🔑</span> <strong>Reset</strong> — "Forgot Password" → Recovery Key</div>
                            <div className="guide-ref-item"><span>🚀</span> <strong>Runway</strong> — Tap explosion icon on Dashboard!</div>
                        </div>
                    </section>

                </div>
            </div>
        </div>
    );
};

export default UserGuide;
