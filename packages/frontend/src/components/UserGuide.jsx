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
                        <p className="guide-text">Create an account with your email and a password. Optionally add your <strong>Telegram username</strong> to enable password recovery via bot.</p>
                        <div className="guide-tip">
                            <strong>💡 Tip</strong>
                            <p>Adding Telegram lets you reset your password through <strong>@WeeklyWalletBot</strong> — no email needed!</p>
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
                                <span className="guide-feature-icon">📈</span>
                                <div>
                                    <strong>Trend</strong>
                                    <p>Cumulative spending vs ideal line. Toggle weekly/monthly views.</p>
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
                            <li>Choose type: <span className="guide-badge-green">Credit</span> (deductions from salary) or <span className="guide-badge-red">Spend</span> (weekly budget)</li>
                            <li>Set <strong>frequency</strong>: weekly or monthly (÷4)</li>
                            <li>Tap <strong>Save</strong></li>
                        </ol>
                        <div className="guide-tip">
                            <strong>💡 Budget Calculation</strong>
                            <p><strong>Weekly</strong> categories → budget per week as-is. <strong>Monthly</strong> → budget ÷ 4 = weekly allowance.</p>
                        </div>
                    </section>

                    {/* Section 6 — Telegram & Security */}
                    <section className="guide-section">
                        <div className="guide-section-header">
                            <span className="guide-step-num">6</span>
                            <h2>Telegram & Security</h2>
                        </div>

                        {/* 6a — Linking Telegram */}
                        <p className="guide-text" style={{ fontWeight: 700, color: '#1F2937', marginBottom: 6 }}>📱 Step A: Link Your Telegram Account</p>
                        <p className="guide-text">First, you need to link your Telegram account to Weekly Wallet. You can do this during registration or at any time after:</p>
                        <ol className="guide-steps">
                            <li>Tap the <strong>cat avatar</strong> (top right of Dashboard)</li>
                            <li>Select <strong>"📱 Link Telegram"</strong></li>
                            <li>A <strong>6-digit code</strong> will appear on screen (valid for 10 minutes)</li>
                            <li>Open <strong>Telegram</strong> on your phone</li>
                            <li>Search for <strong>@WeeklyWalletBot</strong> and tap <strong>Start</strong> (or send <strong>/start</strong>) to activate the bot</li>
                            <li>Send the <strong>6-digit code</strong> as a message to the bot</li>
                            <li>The bot will reply with <strong>"✅ Account linked!"</strong></li>
                        </ol>
                        <div className="guide-tip">
                            <strong>💡 Important</strong>
                            <p>You only need to link once. After linking, the bot knows your account and can send you reset codes whenever you need.</p>
                        </div>

                        {/* 6b — Password Reset */}
                        <p className="guide-text" style={{ fontWeight: 700, color: '#1F2937', marginTop: 24, marginBottom: 6 }}>🔑 Step B: Resetting Your Password via Telegram</p>
                        <p className="guide-text">Forgot your password? If you linked Telegram, follow these steps:</p>
                        <ol className="guide-steps">
                            <li>On the <strong>Login page</strong>, tap <strong>"Forgot Password?"</strong></li>
                            <li>Enter your <strong>Telegram username</strong> (the one you linked)</li>
                            <li>Tap <strong>"Send Reset Code"</strong></li>
                            <li>Open <strong>Telegram</strong> — the bot (<strong>@WeeklyWalletBot</strong>) will send you a <strong>6-digit code</strong></li>
                            <li>Go back to the app and enter the <strong>reset code</strong></li>
                            <li>Type your <strong>new password</strong> (min. 8 characters)</li>
                            <li>Tap <strong>"Reset Password"</strong> — done! You can now log in with your new password</li>
                        </ol>
                        <div className="guide-tip">
                            <strong>⚠️ Didn't receive the code?</strong>
                            <p>Make sure you linked the correct Telegram account. The code expires after 10 minutes — if it expired, tap "Send Reset Code" again to get a new one.</p>
                        </div>

                        {/* 6c — Security */}
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
                            <div className="guide-ref-item"><span>🔑</span> <strong>Reset</strong> — "Forgot Password" → Telegram code</div>
                            <div className="guide-ref-item"><span>🚀</span> <strong>Runway</strong> — Tap explosion icon on Dashboard!</div>
                        </div>
                    </section>

                </div>
            </div>
        </div>
    );
};

export default UserGuide;
