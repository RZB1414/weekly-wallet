import React, { useState, useEffect } from 'react';
import WeekCarousel from './components/WeekCarousel';
import LoginPage from './components/LoginPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import { useAuth } from './lib/AuthContext';
import { api } from './lib/api';
import { getWeekId, getMonthQuarters, findCurrentWeekIndex, getFinancialInfo } from './lib/utils';
import './styles/App.css';
import './styles/LoginPage.css';

import MonthlyPlanningModal from './components/MonthlyPlanningModal';

const App = () => {
    const { user, loading: authLoading, logout, changePassword } = useAuth();

    // ── User Menu Dropdown ────────────────────────
    const [showUserMenu, setShowUserMenu] = useState(false);

    // ── Password Reset via URL ────────────────────
    const [resetMode, setResetMode] = useState(false);
    const [resetToken, setResetToken] = useState('');
    const [resetEmail, setResetEmail] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('reset') === 'true' && params.get('token') && params.get('email')) {
            setResetMode(true);
            setResetToken(params.get('token'));
            setResetEmail(params.get('email'));
        }
    }, []);

    // ── Change Password Modal ─────────────────────
    const [showChangePwd, setShowChangePwd] = useState(false);
    const [oldPwd, setOldPwd] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const [changePwdError, setChangePwdError] = useState('');
    const [changePwdSuccess, setChangePwdSuccess] = useState('');
    const [changePwdLoading, setChangePwdLoading] = useState(false);

    const handleChangePwd = async (e) => {
        e.preventDefault();
        setChangePwdError('');
        setChangePwdSuccess('');

        if (newPwd !== confirmPwd) {
            setChangePwdError('New passwords do not match');
            return;
        }

        setChangePwdLoading(true);
        const result = await changePassword(oldPwd, newPwd);
        setChangePwdLoading(false);

        if (result.success) {
            setChangePwdSuccess('Password changed successfully!');
            setTimeout(() => {
                setShowChangePwd(false);
                setOldPwd('');
                setNewPwd('');
                setConfirmPwd('');
                setChangePwdSuccess('');
            }, 1500);
        } else {
            setChangePwdError(result.error || 'Failed to change password');
        }
    };

    // ── App State ─────────────────────────────────
    const [weeks, setWeeks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMonthlyPlanningOpen, setIsMonthlyPlanningOpen] = useState(false);
    const [activeCategories, setActiveCategories] = useState([]);

    // Date Filter State
    const currentDate = new Date();
    const initialMonth = currentDate.getDate() >= 26 ? currentDate.getMonth() + 2 : currentDate.getMonth() + 1;
    const initialYear = initialMonth > 12 ? currentDate.getFullYear() + 1 : currentDate.getFullYear();
    const normalizedMonth = initialMonth > 12 ? 1 : initialMonth;

    const [selectedMonth, setSelectedMonth] = useState(normalizedMonth);
    const [selectedYear, setSelectedYear] = useState(initialYear);

    // Initial Load — only when user is logged in
    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const loadData = async () => {
            try {
                const data = await api.getWeeks();
                if (data.weeks && data.weeks.length > 0) {
                    setWeeks(data.weeks);
                } else {
                    const currentWeekId = getWeekId(new Date());
                    setWeeks([{
                        id: currentWeekId,
                        startDate: new Date().toISOString(),
                        initialBalance: 0,
                        expenses: []
                    }]);
                }
            } catch (error) {
                console.error("Failed to load data", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [user]);

    // Default categories for new months
    const defaultCategories = [
        { name: 'Market', budget: 0, type: 'credit' },
        { name: 'Coffee', budget: 0, type: 'credit' },
        { name: 'Savings', budget: 0, type: 'credit' },
    ];

    // Load Categories for Selected Month
    useEffect(() => {
        if (!user) return;

        const loadPlanning = async () => {
            try {
                const plan = await api.getMonthlyPlanning(selectedYear, selectedMonth);
                if (plan && plan.categories && plan.categories.length > 0) {
                    const cats = plan.categories.map(c => typeof c === 'string' ? { name: c, budget: 0 } : c);
                    setActiveCategories(cats);
                } else {
                    setActiveCategories(defaultCategories);
                }
            } catch (error) {
                console.error("Failed to load planning", error);
                setActiveCategories(defaultCategories);
            }
        };
        loadPlanning();
    }, [selectedYear, selectedMonth, user]);

    // Sync to Backend whenever weeks change
    useEffect(() => {
        if (!user) return;
        if (!loading && weeks.length > 0) {
            const timeout = setTimeout(() => {
                api.saveWeeks(weeks);
            }, 1000);
            return () => clearTimeout(timeout);
        }
    }, [weeks, loading, user]);

    const handleUpdateWeek = (updatedWeek) => {
        const existingIndex = weeks.findIndex(w => w.id === updatedWeek.id);

        if (existingIndex !== -1) {
            const newWeeks = [...weeks];
            newWeeks[existingIndex] = updatedWeek;
            setWeeks(newWeeks);
        } else {
            setWeeks([...weeks, updatedWeek]);
        }
    };

    const handleGlobalAddExpense = (expense) => {
        const { quarter } = getFinancialInfo(expense.date);
        const targetWeekId = quarter.id;
        const existingWeek = weeks.find(w => w.id === targetWeekId);

        let targetWeek;
        if (existingWeek) {
            targetWeek = { ...existingWeek };
        } else {
            targetWeek = {
                id: targetWeekId,
                startDate: quarter.start,
                endDate: quarter.end,
                initialBalance: 0,
                expenses: [],
                isQuarter: true
            };
        }

        const updatedExpenses = [expense, ...targetWeek.expenses];
        const updatedWeek = { ...targetWeek, expenses: updatedExpenses };
        handleUpdateWeek(updatedWeek);
    };

    const handleCreateWeek = () => {
        let nextMonth = selectedMonth + 1;
        let nextYear = selectedYear;

        if (nextMonth > 12) {
            nextMonth = 1;
            nextYear += 1;
        }

        setSelectedMonth(nextMonth);
        setSelectedYear(nextYear);
    };

    // Calculate Total Savings
    const totalSavings = React.useMemo(() => {
        if (!weeks) return 0;
        const expenseSavings = weeks.reduce((total, week) => {
            if (!week.expenses) return total;
            const weekSavings = week.expenses
                .filter(e => e.category.toLowerCase() === 'savings' || e.category.toLowerCase() === 'poupança')
                .reduce((sum, e) => sum + e.amount, 0);
            return total + weekSavings;
        }, 0);

        const savingsCat = activeCategories.find(c => c.name.toLowerCase() === 'savings' || c.name.toLowerCase() === 'poupança');
        const savingsBudget = savingsCat ? (savingsCat.budget || 0) : 0;

        return expenseSavings + savingsBudget;
    }, [weeks, activeCategories]);

    // State for Carousel Index
    const [activeIndex, setActiveIndex] = useState(0);

    // Filter & Generate Logic
    const displayedWeeks = React.useMemo(() => {
        if (loading) return [];

        const quarters = getMonthQuarters(selectedYear, selectedMonth);

        return quarters.map(q => {
            const existing = weeks.find(w => w.id === q.id);
            if (existing) {
                return { ...existing, startDate: q.start, endDate: q.end };
            }
            return {
                id: q.id,
                startDate: q.start,
                endDate: q.end,
                initialBalance: 0,
                expenses: [],
                isQuarter: true
            };
        });
    }, [weeks, selectedYear, selectedMonth, loading]);

    // Reset index when displayedWeeks changes
    useEffect(() => {
        if (displayedWeeks.length > 0) {
            const idx = findCurrentWeekIndex(displayedWeeks);
            setActiveIndex(idx);
        } else {
            setActiveIndex(0);
        }
    }, [displayedWeeks]);

    const getMonthName = (m) => new Date(0, m - 1).toLocaleString('default', { month: 'long' });

    // ── Render ────────────────────────────────────

    // Password Reset Page (from email link)
    if (resetMode) {
        return (
            <ResetPasswordPage
                email={resetEmail}
                token={resetToken}
                onDone={() => {
                    setResetMode(false);
                    window.history.replaceState({}, '', window.location.pathname);
                }}
            />
        );
    }

    // Auth loading
    if (authLoading) {
        return <div className="loading-screen">INITIALIZING HYPERDRIVE...</div>;
    }

    // Not logged in
    if (!user) {
        return <LoginPage />;
    }

    // Data loading
    if (loading) {
        return <div className="loading-screen">LOADING YOUR DATA...</div>;
    }

    return (
        <div className="app-container">
            {/* Floating User Avatar */}
            <div className="user-avatar-floating" onClick={() => setShowUserMenu(!showUserMenu)}>
                🐱
            </div>

            {/* User Menu Dropdown */}
            {showUserMenu && (
                <>
                    <div className="user-menu-backdrop" onClick={() => setShowUserMenu(false)} />
                    <div className="user-menu-dropdown">
                        <div className="user-menu-header">
                            <div className="user-menu-avatar">🐱</div>
                            <div className="user-menu-email">{user.email}</div>
                        </div>
                        <div className="user-menu-divider" />
                        <button className="user-menu-item" onClick={() => { setShowChangePwd(true); setShowUserMenu(false); }}>
                            🔑 Change Password
                        </button>
                        <button className="user-menu-item logout" onClick={() => { logout(); setShowUserMenu(false); }}>
                            🚪 Logout
                        </button>
                    </div>
                </>
            )}

            {/* Month/Year Selection Header */}
            <div className="filter-header" style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '10px',
                padding: '20px',
                zIndex: 10,
                position: 'relative'
            }}>
                <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="glass-select"
                >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>{getMonthName(m)}</option>
                    ))}
                </select>
                <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="glass-select"
                >
                    {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i).map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            </div>

            <WeekCarousel
                weeks={displayedWeeks}
                categories={activeCategories}
                onUpdateWeek={(updatedWeek) => handleUpdateWeek(updatedWeek)}
                onGlobalAddExpense={handleGlobalAddExpense}
                onCreateWeek={handleCreateWeek}
                activeIndex={activeIndex}
                onIndexChange={setActiveIndex}
                totalSavings={totalSavings}
            />

            <button
                className="monthly-planning-btn"
                onClick={() => setIsMonthlyPlanningOpen(true)}
            >
                Monthly Planning
            </button>

            <MonthlyPlanningModal
                isOpen={isMonthlyPlanningOpen}
                onClose={() => setIsMonthlyPlanningOpen(false)}
                weeks={weeks}
                onUpdateWeeks={setWeeks}
                onPlanSave={(year, month, categories) => {
                    if (year === selectedYear && month === selectedMonth) {
                        setActiveCategories(categories);
                    }
                }}
            />

            {/* Floating "Go to Current" Button */}
            {(() => {
                const isCorrectMonth = selectedMonth === normalizedMonth && selectedYear === initialYear;
                const currentWeekIdx = isCorrectMonth ? findCurrentWeekIndex(displayedWeeks) : -1;
                const showButton = !isCorrectMonth || (isCorrectMonth && activeIndex !== currentWeekIdx);

                if (!showButton) return null;

                return (
                    <button
                        onClick={() => {
                            if (!isCorrectMonth) {
                                setSelectedMonth(normalizedMonth);
                                setSelectedYear(initialYear);
                            } else {
                                setActiveIndex(currentWeekIdx);
                            }
                        }}
                        style={{
                            position: 'fixed',
                            bottom: '20px',
                            right: '25px',
                            zIndex: 100,
                            padding: '12px 24px',
                            borderRadius: '30px',
                            border: 'none',
                            background: 'var(--color-primary)',
                            color: 'white',
                            boxShadow: '0 4px 15px rgba(255, 140, 0, 0.4)',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        Current Week
                    </button>
                );
            })()}

            {/* Change Password Modal */}
            {showChangePwd && (
                <div className="change-pwd-overlay" onClick={(e) => {
                    if (e.target === e.currentTarget) setShowChangePwd(false);
                }}>
                    <div className="change-pwd-card">
                        <h2>🔑 Change Password</h2>
                        <form className="login-form" onSubmit={handleChangePwd}>
                            <div className="form-group">
                                <label htmlFor="old-pwd">Current Password</label>
                                <input
                                    id="old-pwd"
                                    type="password"
                                    value={oldPwd}
                                    onChange={(e) => setOldPwd(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="new-pwd">New Password</label>
                                <input
                                    id="new-pwd"
                                    type="password"
                                    value={newPwd}
                                    onChange={(e) => setNewPwd(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    minLength={8}
                                    autoComplete="new-password"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="confirm-new-pwd">Confirm New Password</label>
                                <input
                                    id="confirm-new-pwd"
                                    type="password"
                                    value={confirmPwd}
                                    onChange={(e) => setConfirmPwd(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    minLength={8}
                                    autoComplete="new-password"
                                />
                            </div>
                            {changePwdError && <div className="auth-error">{changePwdError}</div>}
                            {changePwdSuccess && <div className="auth-success">{changePwdSuccess}</div>}
                            <div className="change-pwd-actions">
                                <button
                                    type="button"
                                    className="btn-cancel"
                                    onClick={() => {
                                        setShowChangePwd(false);
                                        setOldPwd('');
                                        setNewPwd('');
                                        setConfirmPwd('');
                                        setChangePwdError('');
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-save"
                                    disabled={changePwdLoading}
                                >
                                    {changePwdLoading ? '⏳' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
