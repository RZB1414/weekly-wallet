import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import WeekCarousel from './components/WeekCarousel';
import LoginPage from './components/LoginPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import { useAuth } from './lib/AuthContext';
import { api } from './lib/api';
import { getWeekId, getMonthQuarters, findCurrentWeekIndex, getFinancialInfo, ensureRefundsCategory, normalizeRefundExpense, calculateCategoryNet, dedupeRefundExpenses } from './lib/utils';
import './styles/App.css';
import './styles/LoginPage.css';

import MonthlyPlanningModal from './components/MonthlyPlanningModal';
import AddExpenseModal from './components/AddExpenseModal';
import Dashboard from './components/Dashboard';
import UserGuide from './components/UserGuide';

const BASE_DEFAULT_CATEGORIES = [
    { name: 'Market', budget: 0, type: 'credit', frequency: 'monthly' },
    { name: 'Coffee', budget: 0, type: 'credit', frequency: 'weekly' },
    { name: 'Savings', budget: 0, type: 'credit', frequency: 'monthly' }
];

const getDefaultCategories = () => ensureRefundsCategory(BASE_DEFAULT_CATEGORIES.map(cat => ({ ...cat })));

const normalizeWeeksRefunds = (weeks = []) => {
    return weeks.map(week => ({
        ...week,
        expenses: dedupeRefundExpenses((week.expenses || []).map(expense => normalizeRefundExpense(expense)))
    }));
};

const App = () => {
    const { user, loading: authLoading, logout, changePassword, updateAvatar } = useAuth();

    // ── User Menu Dropdown ────────────────────────
    const [showUserMenu, setShowUserMenu] = useState(false);

    // ── User Guide ────────────────────────────────
    const [showUserGuide, setShowUserGuide] = useState(false);

    // ── Avatar Gallery ──────────────────────────────
    const [showAvatarGallery, setShowAvatarGallery] = useState(false);
    const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

    const AVAILABLE_AVATARS = [
        '/art-colector.jpg', '/bezos.jpg', '/gangsta.jpg', '/investor.jpg', '/jujuba.jpg',
        '/king.jpg', '/madam.jpg', '/model.jpg', '/old-money.jpg',
        '/steve.jpg', '/wall-stret.jpg', '/no-avatar.jpg'
    ];

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
    const [recoveryKey, setRecoveryKey] = useState('');
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

        if (!recoveryKey) {
            setChangePwdError('Recovery Key is required to verify ownership');
            return;
        }

        setChangePwdLoading(true);
        const result = await changePassword(oldPwd, newPwd, recoveryKey);
        setChangePwdLoading(false);

        if (result.success) {
            setChangePwdSuccess('Password changed successfully!');
            setTimeout(() => {
                setShowChangePwd(false);
                setOldPwd('');
                setNewPwd('');
                setConfirmPwd('');
                setRecoveryKey('');
                setChangePwdSuccess('');
            }, 1500);
        } else {
            setChangePwdError(result.error || 'Failed to change password');
        }
    };


    // ── App State ─────────────────────────────────
    const [currentView, setCurrentViewRaw] = useState('dashboard'); // 'dashboard' | 'weeks'
    const [weeks, setWeeks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMonthlyPlanningOpen, setIsMonthlyPlanningOpen] = useState(false);
    const [activeCategories, setActiveCategories] = useState(() => getDefaultCategories());
    const [editingExpense, setEditingExpense] = useState(null);

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
                    setWeeks(normalizeWeeksRefunds(data.weeks));
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

    // Load Categories for Selected Month
    useEffect(() => {
        if (!user) return;

        const loadPlanning = async () => {
            try {
                const plan = await api.getMonthlyPlanning(selectedYear, selectedMonth);
                if (plan && plan.categories && plan.categories.length > 0) {
                    const cats = plan.categories.map(c => {
                        const parsed = typeof c === 'string' ? { name: c, budget: 0, type: 'credit', frequency: 'monthly' } : c;

                        // Enforce Coffee as weekly automatically
                        let frequency = parsed.frequency || 'monthly';
                        let budget = parsed.budget || 0;
                        if ((parsed.name.toLowerCase() === 'coffee' || parsed.name.toLowerCase() === 'café') && frequency !== 'weekly') {
                            frequency = 'weekly';
                            budget = budget / 4;
                        }

                        return { ...parsed, type: parsed.type || 'credit', frequency, budget };
                    });
                    setActiveCategories(ensureRefundsCategory(cats));
                } else {
                    setActiveCategories(getDefaultCategories());
                }
            } catch (error) {
                console.error("Failed to load planning", error);
                setActiveCategories(getDefaultCategories());
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

    const handleGlobalAddExpense = (expenseOrExpenses) => {
        const expensesToAdd = Array.isArray(expenseOrExpenses) ? expenseOrExpenses : [expenseOrExpenses];

        // Group expenses by target week ID to minimize state updates
        const expensesByWeek = {};

        expensesToAdd.forEach(expense => {
            const { quarter } = getFinancialInfo(expense.date);
            const targetWeekId = quarter.id;

            if (!expensesByWeek[targetWeekId]) {
                expensesByWeek[targetWeekId] = {
                    quarter,
                    expenses: []
                };
            }
            expensesByWeek[targetWeekId].expenses.push(expense);
        });

        // Update weeks state
        setWeeks(prevWeeks => {
            const newWeeks = [...prevWeeks];

            Object.entries(expensesByWeek).forEach(([weekId, data]) => {
                const existingIndex = newWeeks.findIndex(w => w.id === weekId);

                if (existingIndex !== -1) {
                    const existingWeek = newWeeks[existingIndex];
                    newWeeks[existingIndex] = {
                        ...existingWeek,
                        expenses: [...data.expenses, ...existingWeek.expenses]
                    };
                } else {
                    newWeeks.push({
                        id: weekId,
                        startDate: data.quarter.start,
                        endDate: data.quarter.end,
                        initialBalance: 0,
                        expenses: data.expenses,
                        isQuarter: true
                    });
                }
            });

            return newWeeks;
        });
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
            const weekSavings = -calculateCategoryNet(week.expenses, 'Savings');
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

    // ── Add Expense Modal State ──
    const [isAddExpenseModalOpen, setIsAddExpenseModalOpenRaw] = useState(false);

    // ── Browser History Navigation ──────────────────
    // Wrap state setters to push/pop history entries for back gesture support
    const setCurrentView = useCallback((view) => {
        setCurrentViewRaw((previousView) => {
            if (previousView === view) {
                return previousView;
            }

            if (view !== 'dashboard') {
                window.history.pushState({ view }, '');
            }

            return view;
        });
    }, []);

    const setIsAddExpenseModalOpen = useCallback((open) => {
        if (open && !isAddExpenseModalOpen) {
            window.history.pushState({ modal: 'addExpense' }, '');
        }
        setIsAddExpenseModalOpenRaw(open);
    }, [isAddExpenseModalOpen]);

    const openMonthlyPlanning = useCallback(() => {
        if (!isMonthlyPlanningOpen) {
            window.history.pushState({ modal: 'planning' }, '');
        }
        setIsMonthlyPlanningOpen(true);
    }, [isMonthlyPlanningOpen]);

    const closeMonthlyPlanning = useCallback(() => {
        setIsMonthlyPlanningOpen(false);
    }, []);

    // Listen for popstate (browser back gesture / button)
    useEffect(() => {
        const handlePopState = (e) => {
            // Close modals first, then navigate views
            if (showUserGuide) {
                setShowUserGuide(false);
                return;
            }

            if (showChangePwd) {
                setShowChangePwd(false);
                return;
            }
            if (showUserMenu) {
                setShowUserMenu(false);
                return;
            }
            if (isAddExpenseModalOpen) {
                setIsAddExpenseModalOpenRaw(false);
                return;
            }
            if (isMonthlyPlanningOpen) {
                setIsMonthlyPlanningOpen(false);
                return;
            }
            // Navigate back to dashboard from weeks view
            if (currentView !== 'dashboard') {
                setCurrentViewRaw('dashboard');
                return;
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [currentView, isAddExpenseModalOpen, isMonthlyPlanningOpen, showChangePwd, showUserMenu, showUserGuide]);

    const handleOpenAddExpense = () => {
        setEditingExpense(null);
        setIsAddExpenseModalOpen(true);
    };

    const handleCloseAddExpense = () => {
        setEditingExpense(null);
        setIsAddExpenseModalOpen(false);
    };

    const handleOpenEditExpense = useCallback((expense) => {
        setEditingExpense(expense);
        setIsAddExpenseModalOpen(true);
    }, [setIsAddExpenseModalOpen]);

    const handleQuickAction = useCallback((action) => {
        switch (action) {
            case 'dashboard':
                setIsMonthlyPlanningOpen(false);
                setIsAddExpenseModalOpenRaw(false);
                setCurrentView('dashboard');
                break;
            case 'weeks':
                setIsMonthlyPlanningOpen(false);
                setIsAddExpenseModalOpenRaw(false);
                setCurrentView('weeks');
                break;
            case 'plan':
                setCurrentViewRaw('dashboard');
                setIsAddExpenseModalOpenRaw(false);
                openMonthlyPlanning();
                break;
            case 'add-expense':
                setCurrentViewRaw('dashboard');
                setIsMonthlyPlanningOpen(false);
                setIsAddExpenseModalOpen(true);
                break;
            default:
                break;
        }
    }, [openMonthlyPlanning, setCurrentView, setIsAddExpenseModalOpen]);

    const onAddExpense = (expense) => {
        handleGlobalAddExpense(expense);
        setEditingExpense(null);
        setIsAddExpenseModalOpen(false);
    };

    const onSaveExpense = useCallback((updatedExpense) => {
        const { quarter } = getFinancialInfo(updatedExpense.date);
        const targetWeekId = quarter.id;

        setWeeks(prevWeeks => {
            const weeksWithoutExpense = prevWeeks.map((week) => ({
                ...week,
                expenses: (week.expenses || []).filter((expense) => expense.id !== updatedExpense.id)
            }));

            const targetWeekIndex = weeksWithoutExpense.findIndex((week) => week.id === targetWeekId);

            if (targetWeekIndex !== -1) {
                const targetWeek = weeksWithoutExpense[targetWeekIndex];
                weeksWithoutExpense[targetWeekIndex] = {
                    ...targetWeek,
                    expenses: [...targetWeek.expenses, updatedExpense]
                };
                return weeksWithoutExpense;
            }

            return [
                ...weeksWithoutExpense,
                {
                    id: targetWeekId,
                    startDate: quarter.start,
                    endDate: quarter.end,
                    initialBalance: 0,
                    expenses: [updatedExpense],
                    isQuarter: true
                }
            ];
        });

        setEditingExpense(null);
        setIsAddExpenseModalOpen(false);
    }, [setIsAddExpenseModalOpen]);

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

    const isAnyModalOpen = isMonthlyPlanningOpen || isAddExpenseModalOpen;
    const isAnyBlockingModalOpen = isAddExpenseModalOpen;
    const isQuickActionsHidden = isAnyBlockingModalOpen || showUserGuide || showChangePwd || showAvatarGallery || showUserMenu;

    return (
        <div className="app-container">
            {/* User Menu Dropdown - Global */}
            {showUserMenu && (
                <>
                    <div className="user-menu-backdrop" onClick={() => setShowUserMenu(false)} />
                    <div className="user-menu-dropdown">
                        <div className="user-menu-header">
                            <div className="user-menu-email">{user.email}</div>
                        </div>
                        <div className="user-menu-divider" />
                        <button className="user-menu-item" onClick={() => { setShowChangePwd(true); setShowUserMenu(false); }}>
                            <span className="menu-icon">🔑</span>
                            <span className="menu-label">Change Password</span>
                        </button>
                        <button className="user-menu-item" onClick={() => { setShowUserGuide(true); setShowUserMenu(false); }}>
                            <span className="menu-icon">❓</span>
                            <span className="menu-label">Help</span>
                        </button>
                        <button className="user-menu-item" onClick={() => { setShowAvatarGallery(true); setShowUserMenu(false); }}>
                            <span className="menu-icon">🖼️</span>
                            <span className="menu-label">Edit Avatar</span>
                        </button>
                        <button className="user-menu-item logout" onClick={() => { logout(); setShowUserMenu(false); }}>
                            <span className="menu-icon">🚪</span>
                            <span className="menu-label">Logout</span>
                        </button>
                    </div>
                </>
            )}

            {/* Avatar Gallery Modal */}
            {showAvatarGallery && (
                <div className="avatar-gallery-overlay" onClick={() => setShowAvatarGallery(false)}>
                    <div className="avatar-gallery-content" onClick={(e) => e.stopPropagation()}>
                        <div className="avatar-gallery-header">
                            <h2>Select Avatar</h2>
                            <button className="avatar-gallery-close" onClick={() => setShowAvatarGallery(false)}>×</button>
                        </div>
                        <div className="avatar-gallery-grid">
                            {AVAILABLE_AVATARS.map((avatarUrl, idx) => (
                                <div
                                    key={idx}
                                    className={`avatar-gallery-item ${user?.avatar === avatarUrl ? 'selected' : ''}`}
                                    onClick={async () => {
                                        if (isUpdatingAvatar) return;
                                        setIsUpdatingAvatar(true);
                                        await updateAvatar(avatarUrl);
                                        setIsUpdatingAvatar(false);
                                        setShowAvatarGallery(false);
                                    }}
                                >
                                    <img src={avatarUrl} alt={`Avatar ${idx}`} loading="lazy" />
                                    {user?.avatar === avatarUrl && <div className="avatar-selected-badge">✓</div>}
                                </div>
                            ))}
                        </div>
                        {isUpdatingAvatar && <div className="avatar-saving-state">Saving...</div>}
                    </div>
                </div>
            )}

            {currentView === 'dashboard' && (
                <Dashboard
                    weeks={weeks}
                    categories={activeCategories}
                    totalSavings={totalSavings}
                    onNavigate={(view) => setCurrentView(view)}
                    onAddExpense={() => setIsAddExpenseModalOpen(true)}
                    onOpenPlanning={openMonthlyPlanning}
                    onToggleMenu={() => setShowUserMenu(!showUserMenu)}
                />
            )}

            <div className="history-view-container" style={{ display: currentView !== 'dashboard' && !isAnyModalOpen ? 'block' : 'none' }}>

                {/* Modal-style Header for History */}
                <div className="history-header">
                    <div className="history-header-content">
                        <div className="history-header-top">
                            <h2>History</h2>
                            <button
                                className="close-button"
                                onClick={() => setCurrentView('dashboard')}
                                aria-label="Close"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Month/Year Selection Filters */}
                        <div className="history-filters">
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
                    </div>
                </div>

                <WeekCarousel
                    weeks={displayedWeeks}
                    categories={activeCategories}
                    onUpdateWeek={(updatedWeek) => handleUpdateWeek(updatedWeek)}
                    onGlobalAddExpense={handleGlobalAddExpense}
                    onEditExpense={handleOpenEditExpense}
                    onCreateWeek={handleCreateWeek}
                    activeIndex={activeIndex}
                    onIndexChange={setActiveIndex}
                    totalSavings={totalSavings}
                    onOpenAddExpense={handleOpenAddExpense}
                />

                <motion.button
                    className="add-expense-fab-global"
                    onClick={handleOpenAddExpense}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                >
                    <Plus size={32} />
                </motion.button>

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
                                bottom: '80px',
                                left: '20px',
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
            </div>

            <MonthlyPlanningModal
                isOpen={isMonthlyPlanningOpen}
                onClose={closeMonthlyPlanning}
                weeks={weeks}
                onUpdateWeeks={setWeeks}
                onPlanSave={(year, month, categories) => {
                    if (year === selectedYear && month === selectedMonth) {
                        setActiveCategories(categories);
                    }
                }}
            />

            {/* Global Add Expense Modal */}
            <AddExpenseModal
                isOpen={isAddExpenseModalOpen}
                onClose={handleCloseAddExpense}
                onAdd={onAddExpense}
                onSave={onSaveExpense}
                initialExpense={editingExpense}
                categories={activeCategories.map(c => c.name)}
            />

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
                            {/* Removed extra padding here, keeping structure */}
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
                                />
                                <small style={{ color: 'var(--color-text-muted)', display: 'block', marginTop: '4px' }}>
                                    Required to prove ownership mathematically.
                                </small>
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
                                        setRecoveryKey('');
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

            {/* User Guide */}
            <UserGuide isOpen={showUserGuide} onClose={() => setShowUserGuide(false)} />

            <section
                className={`quick-actions-footer ${isQuickActionsHidden ? 'is-hidden' : ''} ${isMonthlyPlanningOpen ? 'is-plan-open' : ''}`.trim()}
                aria-label="Primary navigation"
                aria-hidden={isQuickActionsHidden}
            >
                <button
                    type="button"
                    className={`quick-action-btn ${currentView === 'dashboard' && !isMonthlyPlanningOpen ? 'active' : ''}`}
                    onClick={() => handleQuickAction('dashboard')}
                    aria-pressed={currentView === 'dashboard' && !isMonthlyPlanningOpen}
                >
                    Dashboard
                </button>
                <button
                    type="button"
                    className={`quick-action-btn ${currentView === 'weeks' ? 'active' : ''}`}
                    onClick={() => handleQuickAction('weeks')}
                    aria-pressed={currentView === 'weeks'}
                >
                    Week
                </button>
                <button
                    type="button"
                    className={`quick-action-btn ${isMonthlyPlanningOpen ? 'active' : ''}`}
                    onClick={() => handleQuickAction('plan')}
                    aria-pressed={isMonthlyPlanningOpen}
                >
                    Plan
                </button>
                <button
                    className="quick-action-btn quick-action-btn-primary"
                    type="button"
                    onClick={() => handleQuickAction('add-expense')}
                >
                    Add Expense
                </button>
            </section>
        </div>
    );
};

export default App;
