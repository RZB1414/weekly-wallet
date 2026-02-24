import React, { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { api } from '../lib/api';
import { formatCurrency, getFinancialInfo, getMonthQuarters } from '../lib/utils';
import {
    PieChart, Pie, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import '../styles/Dashboard.css';

const Dashboard = ({ weeks, categories, totalSavings, onNavigate, onAddExpense, onOpenPlanning, onToggleMenu }) => {
    // Default avatar if none provided (avoids Vite import errors on missing files)
    const weeklyAvatar = '/chewie.jpg';
    const { user } = useAuth();
    const [showRunwayInfo, setShowRunwayInfo] = useState(false);
    const [showRunwayMath, setShowRunwayMath] = useState(false);
    const [chartsReady, setChartsReady] = useState(false);
    const [isEditingProjection, setIsEditingProjection] = useState(false);
    const [showWorstCase, setShowWorstCase] = useState(false);
    const [showAvatarZoom, setShowAvatarZoom] = useState(false);
    const projectionInputRef = useRef(null);

    // Defer chart rendering
    useLayoutEffect(() => {
        const frame = requestAnimationFrame(() => setChartsReady(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    // ── 1. KPI & Budget Calculations ─────────────────────────────

    // Current Week Data
    const currentWeekData = useMemo(() => {
        if (!weeks || weeks.length === 0) return null;
        const now = new Date();
        const { quarter } = getFinancialInfo(now);
        const currentWeek = weeks.find(w => w.id === quarter.id);

        const weeklyBudget = categories.reduce((sum, cat) => {
            if (cat.frequency === 'weekly') {
                return sum + (cat.budget || 0);
            }
            return sum + ((cat.budget || 0) / 4);
        }, 0);

        if (!currentWeek) return { budget: weeklyBudget, spent: 0, balance: weeklyBudget };

        const spent = currentWeek.expenses
            .filter(e => e.type !== 'credit')
            .reduce((sum, e) => sum + Number(e.amount), 0);

        return {
            budget: weeklyBudget,
            spent,
            balance: weeklyBudget - spent
        };
    }, [weeks, categories]);

    // Current Month Data
    const currentMonthData = useMemo(() => {
        const now = new Date();
        const { year, month } = getFinancialInfo(now);
        const quarters = getMonthQuarters(year, month);

        const currentMonthWeeks = quarters.map(q => {
            const existing = weeks.find(w => w.id === q.id);
            return existing || { id: q.id, expenses: [] };
        });

        const monthlyBudget = categories.reduce((sum, cat) => {
            if (cat.frequency === 'monthly') {
                return sum + (cat.budget || 0);
            }
            return sum + ((cat.budget || 0) * 4);
        }, 0);

        const totalSpent = currentMonthWeeks.reduce((total, week) => {
            return total + week.expenses
                .filter(e => e.type !== 'credit')
                .reduce((sum, e) => sum + Number(e.amount), 0);
        }, 0);

        return {
            budget: monthlyBudget,
            spent: totalSpent,
            balance: monthlyBudget - totalSpent,
            weeks: currentMonthWeeks
        };
    }, [weeks, categories]);

    // Progress Calculation
    const getProgressInfo = (spent, budget) => {
        if (budget <= 0) return { percent: 0, color: '#34D399' }; // Default safe
        const pct = Math.min((spent / budget) * 100, 100);
        let color = '#34D399'; // Emerald
        if (pct >= 100) color = '#EF4444'; // Red
        else if (pct >= 80) color = '#F59E0B'; // Amber
        return { percent: pct, color };
    };

    const weeklyProgress = getProgressInfo(currentWeekData?.spent || 0, currentWeekData?.budget || 0);
    const monthlyProgress = getProgressInfo(currentMonthData?.spent || 0, currentMonthData?.budget || 0);

    // ── 2. Recent Transactions ─────────────────────────
    const recentTransactions = useMemo(() => {
        const allExpenses = [];
        // Flatten expenses from all weeks, sort by date
        weeks.forEach(week => {
            week.expenses.forEach(e => {
                allExpenses.push({ ...e, weekId: week.id });
            });
        });

        allExpenses.sort((a, b) => {
            // Sort by date desc, then by creation id if possible
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) return dateB - dateA;
            // Fallback
            return (b.id || "").localeCompare(a.id || "");
        });

        return allExpenses.slice(0, 5); // top 5
    }, [weeks]);

    // ── 3. Donut Data ──────────────────────────────
    const donutData = useMemo(() => {
        const catMap = {};
        let total = 0;
        currentMonthData.weeks.forEach(week => {
            week.expenses.forEach(e => {
                if (e.type === 'credit') return;
                const amount = Number(e.amount);
                const cat = e.category || 'Uncategorized';
                catMap[cat] = (catMap[cat] || 0) + amount;
                total += amount;
            });
        });

        const sorted = Object.entries(catMap)
            .sort(([, a], [, b]) => b - a)
            .map(([name, value]) => ({
                name,
                value,
                percent: total > 0 ? (value / total) * 100 : 0
            }));

        if (sorted.length <= 5) return sorted;

        const top5 = sorted.slice(0, 5);
        const othersValue = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);
        const othersPercent = total > 0 ? (othersValue / total) * 100 : 0;

        top5.push({ name: 'Others', value: othersValue, percent: othersPercent });
        return top5;
    }, [currentMonthData]);

    const COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6', '#6B7280'];

    // ── 4. Realistic & Optimistic Runway Calculations (Hero) ────────────────
    const [realisticRunway, setRealisticRunway] = useState({ value: 'Calculating...', loading: true, details: '', wealth: 0, daysRunway: '', isSafe: false, raw: {} });
    const [optimisticRunway, setOptimisticRunway] = useState({ value: 'Calculating...', loading: true, details: '', wealth: 0, daysRunway: '', isSafe: false, netMonthlyFlow: 0, raw: {} });
    const [projectionMonths, setProjectionMonths] = useState(() => {
        // Prefer user profile value from R2, fallback to localStorage
        if (user?.projectionMonths) return Number(user.projectionMonths);
        return Number(localStorage.getItem('projectionMonths')) || 12;
    });

    useEffect(() => {
        const calculateRunway = async () => {
            setRealisticRunway(prev => ({ ...prev, loading: true }));
            try {
                const plansList = await api.getMonthlyPlannings();

                const allPlansData = plansList.plans ? await Promise.all(
                    plansList.plans.map(p => api.getMonthlyPlanning(p.year, p.month))
                ) : [];

                const totalIncome = allPlansData.reduce((sum, plan) => sum + (plan.salary || 0), 0);

                const sortedWeeks = [...weeks].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
                const startBalance = sortedWeeks.length > 0 ? (sortedWeeks[0].initialBalance || 0) : 0;

                const totalExpenses = weeks.reduce((total, week) => {
                    return total + week.expenses.reduce((wSum, e) => {
                        return e.type !== 'credit' ? wSum + Number(e.amount) : wSum;
                    }, 0);
                }, 0);

                const extraIncome = weeks.reduce((total, week) => {
                    return total + week.expenses.reduce((wSum, e) => {
                        return e.type === 'credit' ? wSum + Number(e.amount) : wSum;
                    }, 0);
                }, 0);

                const globalNetWorth = totalIncome + extraIncome + startBalance - totalExpenses;


                let monthlyBurn = 0;
                let monthlyIncome = 0;
                const latestPlanRef = plansList.plans && plansList.plans.length > 0 ? plansList.plans[0] : null;

                if (latestPlanRef) {
                    const latestData = await api.getMonthlyPlanning(latestPlanRef.year, latestPlanRef.month);
                    monthlyIncome = latestData.salary || 0;
                    monthlyBurn = latestData.categories.reduce((sum, c) => sum + (c.type === 'spend' ? c.budget : 0), 0);
                }

                if (monthlyBurn === 0 && currentWeekData) {
                    monthlyBurn = currentWeekData.spent * 4;
                }

                const netMonthlyFlow = monthlyIncome - monthlyBurn;

                let resultString = '';
                let detailsString = '';
                let isSafe = false;
                let daysRunwayStr = '';

                // Define burnToUse at a higher scope so it can be passed to state safely
                const burnToUse = monthlyBurn > 0 ? monthlyBurn : (totalExpenses || 1);

                if (globalNetWorth <= 0) {
                    resultString = '0 Months';
                    detailsString = 'No current wealth. Watch your spending!';
                } else {

                    if (burnToUse <= 0) {
                        resultString = '∞ Safe';
                        detailsString = 'No expenses recorded yet';
                        isSafe = true;
                    } else {
                        const monthsLeft = globalNetWorth / burnToUse;

                        if (monthsLeft >= 12) {
                            const years = (monthsLeft / 12).toFixed(1);
                            resultString = `${years} Years`;
                        } else {
                            // If it's very small show decimal, else normal
                            resultString = `${monthsLeft.toFixed(1)} Months`;
                        }

                        // We consider it "Safe" if you have at least 3 months of runway built up
                        isSafe = monthsLeft >= 3;

                        // Display the Context underneath
                        if (netMonthlyFlow > 0) {
                            detailsString = `If zero income, burning ${formatCurrency(burnToUse)}/mo`;
                        } else if (netMonthlyFlow < 0) {
                            detailsString = `Including income, burning ${formatCurrency(Math.abs(netMonthlyFlow))}/mo`;
                        } else {
                            detailsString = `Burning ${formatCurrency(burnToUse)}/mo`;
                        }

                        // Calculate more accurate days based on burn rate
                        const dailyBurn = burnToUse / 30.416; // Average days in month
                        const daysLeft = Math.floor(globalNetWorth / dailyBurn);

                        // Only show the prominent days label if runway is less than 3 months
                        if (daysLeft < 90) {
                            daysRunwayStr = `${daysLeft} days`;
                        }
                    }
                }

                // --- Optimistic Calculation (Financial Momentum) ---
                let optResultString = '';
                let optDetailsString = ''; // String used when NOT in safe mode
                let optIsSafe = false;

                if (netMonthlyFlow > 0) {
                    optResultString = '∞ Safe';
                    optDetailsString = ''; // Handled dynamically by JSX input
                    optIsSafe = true;
                } else if (netMonthlyFlow === 0) {
                    optResultString = 'Stagnant';
                    optDetailsString = `0 growth expected`;
                    optIsSafe = true;
                } else {
                    const monthlyBurnNet = Math.abs(netMonthlyFlow);
                    const optMonthsLeft = globalNetWorth / monthlyBurnNet;
                    if (optMonthsLeft >= 12) {
                        const years = (optMonthsLeft / 12).toFixed(1);
                        optResultString = `${years} Years`;
                    } else {
                        optResultString = `${optMonthsLeft.toFixed(1)} Months`;
                    }
                    optDetailsString = `Burning ${formatCurrency(monthlyBurnNet)}/mo`;
                    optIsSafe = optMonthsLeft >= 3;
                }

                setRealisticRunway({
                    value: resultString,
                    loading: false,
                    details: detailsString,
                    wealth: globalNetWorth,
                    daysRunway: daysRunwayStr,
                    isSafe,
                    raw: { totalIncome, extraIncome, startBalance, totalExpenses, monthlyBurn: burnToUse }
                });

                setOptimisticRunway({
                    value: optResultString,
                    loading: false,
                    details: optDetailsString,
                    wealth: globalNetWorth,
                    netMonthlyFlow, // Pass flow straight to state to render dynamic projections
                    daysRunway: '', // Usually not helpful for optimistic view
                    isSafe: optIsSafe,
                    raw: { monthlyIncome, monthlyBurn: burnToUse, netMonthlyFlow }
                });

            } catch (err) {
                console.error("Runway calc failed", err);
                setRealisticRunway({ value: 'Error', loading: false, details: 'Check connection', isSafe: false });
                setOptimisticRunway({ value: 'Error', loading: false, details: 'Check connection', isSafe: false });
            }
        };

        if (weeks.length > 0) {
            calculateRunway();
        } else {
            setRealisticRunway({ value: '∞ Safe', loading: false, details: 'No data yet. Start tracking!', wealth: 0, isSafe: true });
            setOptimisticRunway({ value: '∞ Safe', loading: false, details: 'No data yet. Start tracking!', wealth: 0, isSafe: true });
        }
    }, [weeks]);

    // Format relative time (e.g. "Today", "Yesterday", "Oct 12")
    const formatExpenseDate = (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }


    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="dashboard-header-bg" style={{ backgroundImage: `url(${user?.avatar || '/no-avatar.jpg'})` }}></div>
                <div className="dashboard-header-overlay"></div>
                <button
                    className="header-menu-btn"
                    onClick={onToggleMenu}
                    title="Menu"
                    style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}
                >
                    ☰
                </button>
                <div className="greeting-text" style={{
                    position: 'absolute', bottom: '16px', left: '16px', zIndex: 2,
                    background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.25)', borderRadius: '16px', padding: '10px 16px'
                }}>
                    <h1>Hi, {user?.email?.split('@')[0] || 'Friend'}!</h1>
                    <p>Financial Health Check</p>
                </div>
            </header>

            {/* 1. HERO CARDS: RUNWAY & MOMENTUM */}
            <section className="hero-section">
                <div className={`hero-card ${optimisticRunway.isSafe ? 'optimistic-glow' : 'warning-glow'}`}>
                    <div className="hero-label-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', position: 'relative', width: '100%', justifyContent: 'center' }}>
                        <span className="hero-label" style={{ margin: 0 }}>Financial Momentum</span>
                        <button
                            className="info-icon-btn"
                            onClick={() => setShowRunwayInfo('optimistic')}
                            title="How is this calculated?"
                        >
                            ?
                        </button>

                        {optimisticRunway.value === '∞ Safe' && optimisticRunway.netMonthlyFlow > 0 && (
                            <button
                                type="button"
                                className={`projection-action-btn ${isEditingProjection ? 'saving' : ''}`}
                                style={{ position: 'absolute', right: 0 }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    if (isEditingProjection) {
                                        const val = Number(projectionMonths);
                                        if (val >= 0) {
                                            localStorage.setItem('projectionMonths', val);
                                            api.updateProfile({ projectionMonths: val });
                                        }
                                        setIsEditingProjection(false);
                                    } else {
                                        setIsEditingProjection(true);
                                        setTimeout(() => projectionInputRef.current?.focus(), 10);
                                    }
                                }}
                                title={isEditingProjection ? "Save projection months" : "Edit projection months"}
                                onMouseDown={(e) => e.preventDefault()}
                            >
                                {isEditingProjection ? '✓' : '✎'}
                            </button>
                        )}
                    </div>
                    <div className="hero-value">
                        {optimisticRunway.loading ? <span className="skeleton-text"></span> : optimisticRunway.value}
                    </div>
                    <div className="hero-subtext" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        {optimisticRunway.value === '∞ Safe' && optimisticRunway.netMonthlyFlow > 0 ? (
                            <>
                                <span style={{ fontSize: '0.95rem', color: '#4B5563' }}>
                                    Wealth growing by <strong style={{ color: '#059669' }}>{formatCurrency(optimisticRunway.netMonthlyFlow)}</strong>/mo
                                </span>
                                <div className="projection-container">
                                    <span className="projection-prefix">Projection for</span>

                                    <div className={`projection-editor ${isEditingProjection ? 'editing' : ''}`}>
                                        {isEditingProjection ? (
                                            <input
                                                ref={projectionInputRef}
                                                type="number"
                                                min="1"
                                                max="360"
                                                value={projectionMonths}
                                                onChange={(e) => setProjectionMonths(e.target.value)}
                                                onBlur={() => {
                                                    const val = Number(projectionMonths);
                                                    if (val >= 0) {
                                                        localStorage.setItem('projectionMonths', val);
                                                        api.updateProfile({ projectionMonths: val });
                                                    }
                                                    setIsEditingProjection(false);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const val = Number(projectionMonths);
                                                        if (val >= 0) {
                                                            localStorage.setItem('projectionMonths', val);
                                                            api.updateProfile({ projectionMonths: val });
                                                        }
                                                        setIsEditingProjection(false);
                                                    }
                                                }}
                                                className="projection-input"
                                                title="Contract length / Projection months"
                                            />
                                        ) : (
                                            <span style={{ fontWeight: 700, color: '#3B82F6', padding: '0 4px' }}>
                                                {projectionMonths}
                                            </span>
                                        )}
                                        <span className="projection-suffix">months</span>
                                    </div>

                                    <span className="projection-result">
                                        : <strong style={{ color: '#111827' }}>{formatCurrency(optimisticRunway.wealth + (optimisticRunway.netMonthlyFlow * (Number(projectionMonths) || 0)))}</strong>
                                    </span>
                                </div>
                            </>
                        ) : (
                            <span>{optimisticRunway.details}</span>
                        )}
                    </div>
                </div>
            </section>

            {/* 2. QUICK GLANCES */}
            <section className="quick-glance-section">
                <div className="glance-card">
                    <span className="glance-label">Weekly Balance</span>
                    <span className={`glance-value ${currentWeekData?.balance >= 0 ? 'positive' : 'negative'}`}>
                        {formatCurrency(currentWeekData?.balance || 0)}
                    </span>
                    <span className="glance-subtext">Left to spend</span>
                </div>
                <div className="glance-card">
                    <span className="glance-label">Monthly Spend</span>
                    <span className="glance-value neutral">
                        {formatCurrency(currentMonthData?.spent || 0)}
                    </span>
                    <span className="glance-subtext">Of {formatCurrency(currentMonthData?.budget || 0)}</span>
                </div>
            </section>

            {/* 3. BUDGET PROGRESS BARS */}
            <section className="progress-section">
                <div className="glass-card">
                    <h3>Budget Progress</h3>

                    <div className="progress-item">
                        <div className="progress-header">
                            <span className="progress-title">This Week</span>
                            <span className="progress-stats">{formatCurrency(currentWeekData?.spent || 0)} / {formatCurrency(currentWeekData?.budget || 0)}</span>
                        </div>
                        <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{ width: `${weeklyProgress.percent}%`, backgroundColor: weeklyProgress.color }}></div>
                        </div>
                    </div>

                    <div className="progress-item">
                        <div className="progress-header">
                            <span className="progress-title">This Month</span>
                            <span className="progress-stats">{formatCurrency(currentMonthData?.spent || 0)} / {formatCurrency(currentMonthData?.budget || 0)}</span>
                        </div>
                        <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{ width: `${monthlyProgress.percent}%`, backgroundColor: monthlyProgress.color }}></div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="charts-and-lists">
                {/* 4. RECENT TRANSACTIONS */}
                <div className="glass-card recent-tx-card">
                    <div className="card-header">
                        <h3>Recent Transactions</h3>
                        <button className="text-btn" onClick={() => onNavigate('weeks')}>See All</button>
                    </div>
                    <div className="tx-list">
                        {recentTransactions.length > 0 ? (
                            recentTransactions.map((tx, idx) => (
                                <div key={tx.id || idx} className="tx-item">
                                    <div className={`tx-icon ${tx.type === 'credit' ? 'credit' : 'expense'}`}>
                                        {tx.type === 'credit' ? '+' : '-'}
                                    </div>
                                    <div className="tx-details">
                                        <span className="tx-name">{tx.name || tx.category}</span>
                                        <span className="tx-date">{formatExpenseDate(tx.date)} &bull; {tx.category}</span>
                                    </div>
                                    <div className={`tx-amount ${tx.type === 'credit' ? 'positive' : ''}`}>
                                        {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">No transactions yet.</div>
                        )}
                    </div>
                </div>

                {/* 5. DONUT CHART */}
                <div className="glass-card chart-card">
                    <h3>Where it goes</h3>
                    <div style={{ width: '100%', minWidth: 1, height: 200, minHeight: 1, position: 'relative', overflow: 'hidden' }}>
                        {chartsReady && donutData.length > 0 ? (
                            <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0} debounce={300}>
                                <PieChart>
                                    <Pie
                                        data={donutData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={75}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {donutData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        formatter={(value) => formatCurrency(value)}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="empty-state" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No expenses this month</div>
                        )}
                    </div>

                    {/* Custom Legend */}
                    {donutData.length > 0 && (
                        <div className="custom-legend">
                            {donutData.map((entry, index) => (
                                <div key={`legend-${index}`} className="legend-item">
                                    <div className="legend-color" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    <span className="legend-label">{entry.name}</span>
                                    <span className="legend-value">
                                        {formatCurrency(entry.value)}
                                        <span style={{ fontSize: '0.85em', color: '#9CA3AF', marginLeft: '6px', fontWeight: 500 }}>
                                            ({entry.percent.toFixed(0)}%)
                                        </span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* WORST CASE SCENARIO TOGGLE */}
            <section className="worst-case-section" style={{ padding: '0 20px', marginBottom: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <button
                    className="worst-case-btn"
                    onClick={() => setShowWorstCase(!showWorstCase)}
                    style={{
                        background: 'transparent',
                        border: '2px dashed #EF4444',
                        color: '#EF4444',
                        padding: '12px 24px',
                        borderRadius: '16px',
                        fontFamily: 'var(--font-display)',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        marginBottom: showWorstCase ? '20px' : '0'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'scale(1)'; }}
                >
                    {showWorstCase ? "Hide Worst Case Scenario 🙈" : "Show Worst Case Scenario 🚨"}
                </button>

                {showWorstCase && (
                    <div className={`hero-card ${realisticRunway.isSafe ? 'safe-glow' : 'warning-glow'}`} style={{ width: '100%', maxWidth: '600px' }}>
                        <div className="hero-label-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', justifyContent: 'center' }}>
                            <span className="hero-label" style={{ margin: 0 }}>Strict Runway</span>
                            <button
                                className="info-icon-btn"
                                onClick={() => setShowRunwayInfo('strict')}
                                title="How is this calculated?"
                            >
                                ?
                            </button>
                        </div>
                        <div className="hero-value">
                            {realisticRunway.loading ? <span className="skeleton-text"></span> : realisticRunway.value}
                        </div>
                        <span className="hero-subtext" style={{ textAlign: 'center', display: 'block' }}>
                            {realisticRunway.details}
                        </span>
                        {realisticRunway.daysRunway && !realisticRunway.isSafe && (
                            <div className="hero-badge" style={{ margin: '12px auto 0' }}>
                                ⏳ ~{realisticRunway.daysRunway} left at avg spend
                            </div>
                        )}
                    </div>
                )}
            </section>

            <section className="quick-actions-footer">
                <button className="fab-main" onClick={onAddExpense}>
                    ➕ Add Expense
                </button>
                <div className="secondary-actions">
                    <button className="btn-small" onClick={onOpenPlanning}>📅 Plan</button>
                    <button className="btn-small" onClick={() => onNavigate('weeks')}>📊 History</button>
                </div>
            </section>

            {/* 6. EXPLAINER MODAL */}
            {showRunwayInfo && (
                <div className="modal-overlay info-modal-overlay" onClick={() => { setShowRunwayInfo(false); setShowRunwayMath(false); }}>
                    <div className="modal-content info-modal" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => { setShowRunwayInfo(false); setShowRunwayMath(false); }}>×</button>

                        {showRunwayInfo === 'strict' ? (
                            <>
                                <h2>{showRunwayMath ? "Runway: The Math 🧮" : "How 'Runway' Works ⏳"}</h2>
                                <div className="info-content">
                                    {!showRunwayMath ? (
                                        <>
                                            <p>The <strong>Runway</strong> is a strict stress-test: <em>how long could you survive if your income suddenly dropped to zero today?</em></p>

                                            <div className="info-step">
                                                <h3>1. Total Cash Pile (Net Worth)</h3>
                                                <p>We sum up every real penny you have — initial starting balance + all historical income + extra credits — minus all historical expenses. This is your war chest.</p>
                                            </div>

                                            <div className="info-step">
                                                <h3>2. Monthly Burn</h3>
                                                <p>We look at your current Monthly Plan to see your regular scheduled 'spend' categories to determine your standard monthly cost of living.</p>
                                            </div>

                                            <div className="info-step">
                                                <h3>3. The Result</h3>
                                                <p>We divide your Total Cash Pile by your Monthly Burn to tell you exactly how many months you can survive.<br />
                                                    If you possess at least 3 months of runway, you earn a <strong>Safe 🟢</strong> badge! 🔴 means keep building your emergency fund.</p>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="math-breakdown" style={{ background: 'rgba(0,0,0,0.03)', padding: '16px', borderRadius: '12px', marginTop: '12px' }}>
                                            <div style={{ marginBottom: '16px' }}>
                                                <h3 style={{ fontSize: '0.9rem', color: '#4B5563', marginBottom: '8px' }}>Total Cash Pile (Net Worth)</h3>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                                                    <span>+ Start Balance:</span> <span style={{ textAlign: 'right' }}>{formatCurrency(realisticRunway.raw?.startBalance || 0)}</span>
                                                    <span>+ Total Income:</span> <span style={{ textAlign: 'right' }}>{formatCurrency(realisticRunway.raw?.totalIncome || 0)}</span>
                                                    <span>+ Extra Credits:</span> <span style={{ textAlign: 'right' }}>{formatCurrency(realisticRunway.raw?.extraIncome || 0)}</span>
                                                    <span style={{ color: '#EF4444' }}>- Total Expenses:</span> <span style={{ textAlign: 'right', color: '#EF4444' }}>{formatCurrency(realisticRunway.raw?.totalExpenses || 0)}</span>
                                                    <div style={{ gridColumn: '1 / -1', height: '1px', background: '#D1D5DB', margin: '4px 0' }}></div>
                                                    <strong>= Net Worth:</strong> <strong style={{ textAlign: 'right' }}>{formatCurrency(realisticRunway.wealth || 0)}</strong>
                                                </div>
                                            </div>

                                            <div>
                                                <h3 style={{ fontSize: '0.9rem', color: '#4B5563', marginBottom: '8px' }}>Runway Calculation</h3>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                                                    <span>Net Worth:</span> <span style={{ textAlign: 'right' }}>{formatCurrency(realisticRunway.wealth || 0)}</span>
                                                    <span>÷ Monthly Burn:</span> <span style={{ textAlign: 'right' }}>{formatCurrency(realisticRunway.raw?.monthlyBurn || 0)}</span>
                                                    <div style={{ gridColumn: '1 / -1', height: '1px', background: '#D1D5DB', margin: '4px 0' }}></div>
                                                    <strong>= Runway:</strong> <strong style={{ textAlign: 'right' }}>{realisticRunway.value}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        className="math-info-btn"
                                        style={{ width: '100%', marginTop: '16px' }}
                                        onClick={() => setShowRunwayMath(!showRunwayMath)}
                                    >
                                        {showRunwayMath ? "↩ Back to explanation" : "Math Info 🧮"}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h2>{showRunwayMath ? "Financial Momentum: The Math 🧮" : "How 'Financial Momentum' Works 🚀"}</h2>
                                <div className="info-content">
                                    {!showRunwayMath ? (
                                        <>
                                            <p>The <strong>Financial Momentum</strong> card gives you an optimistic view of the future by assuming you keep your current job.</p>

                                            <div className="info-step">
                                                <h3>1. Wealth Growing</h3>
                                                <p>We subtract your <strong>Monthly Burn</strong> from your <strong>Monthly Salary</strong>. If the result is positive, congratulations! Your wealth is growing every month.</p>
                                            </div>

                                            <div className="info-step">
                                                <h3>2. Infinite Runway & Projections</h3>
                                                <p>If your wealth is growing, you technically have an <strong>∞ Safe</strong> runway! We calculate exactly how much money you will have accumulated at the end of a given period.</p>
                                            </div>

                                            <div className="info-step">
                                                <h3>3. Custom Contracts</h3>
                                                <p>If you have a fixed-term contract, simply click the edit pencil icon (✎) on the card to change the standard 12-month projection into your exact remaining contract length.</p>
                                            </div>

                                            <div className="info-step">
                                                <h3>4. Deficit Mode</h3>
                                                <p>If you are spending more than you earn, we tell you how many months until your deficit drains your entire Net Worth.</p>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="math-breakdown" style={{ background: 'rgba(0,0,0,0.03)', padding: '16px', borderRadius: '12px', marginTop: '12px' }}>
                                            <div style={{ marginBottom: '16px' }}>
                                                <h3 style={{ fontSize: '0.9rem', color: '#4B5563', marginBottom: '8px' }}>Net Monthly Flow</h3>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                                                    <span>+ Monthly Salary:</span> <span style={{ textAlign: 'right' }}>{formatCurrency(optimisticRunway.raw?.monthlyIncome || 0)}</span>
                                                    <span style={{ color: '#EF4444' }}>- Monthly Burn:</span> <span style={{ textAlign: 'right', color: '#EF4444' }}>{formatCurrency(optimisticRunway.raw?.monthlyBurn || 0)}</span>
                                                    <div style={{ gridColumn: '1 / -1', height: '1px', background: '#D1D5DB', margin: '4px 0' }}></div>
                                                    <strong>= Net Flow:</strong> <strong style={{ textAlign: 'right', color: (optimisticRunway.raw?.netMonthlyFlow || 0) >= 0 ? '#059669' : '#EF4444' }}>{formatCurrency(optimisticRunway.raw?.netMonthlyFlow || 0)}</strong>
                                                </div>
                                            </div>

                                            {(optimisticRunway.raw?.netMonthlyFlow || 0) > 0 ? (
                                                <div>
                                                    <h3 style={{ fontSize: '0.9rem', color: '#4B5563', marginBottom: '8px' }}>Future Projection Formula</h3>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                                                        <span>Current Net Worth:</span> <span style={{ textAlign: 'right' }}>{formatCurrency(optimisticRunway.wealth || 0)}</span>
                                                        <span>+ (Net Flow × Months):</span> <span style={{ textAlign: 'right' }}>{formatCurrency((optimisticRunway.raw?.netMonthlyFlow || 0) * (Number(projectionMonths) || 1))}</span>
                                                        <div style={{ gridColumn: '1 / -1', height: '1px', background: '#D1D5DB', margin: '4px 0' }}></div>
                                                        <strong>= Future Wealth:</strong> <strong style={{ textAlign: 'right' }}>{formatCurrency((optimisticRunway.wealth || 0) + ((optimisticRunway.raw?.netMonthlyFlow || 0) * (Number(projectionMonths) || 1)))}</strong>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <h3 style={{ fontSize: '0.9rem', color: '#4B5563', marginBottom: '8px' }}>Deficit Runway</h3>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                                                        <span>Net Worth:</span> <span style={{ textAlign: 'right' }}>{formatCurrency(optimisticRunway.wealth || 0)}</span>
                                                        <span>÷ Shortfall:</span> <span style={{ textAlign: 'right' }}>{formatCurrency(Math.abs(optimisticRunway.raw?.netMonthlyFlow || 0))}</span>
                                                        <div style={{ gridColumn: '1 / -1', height: '1px', background: '#D1D5DB', margin: '4px 0' }}></div>
                                                        <strong>= Runway:</strong> <strong style={{ textAlign: 'right' }}>{optimisticRunway.value}</strong>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <button
                                        className="math-info-btn"
                                        style={{ width: '100%', marginTop: '16px' }}
                                        onClick={() => setShowRunwayMath(!showRunwayMath)}
                                    >
                                        {showRunwayMath ? "↩ Back to explanation" : "Math Info 🧮"}
                                    </button>
                                </div>
                            </>
                        )}

                    </div>
                </div>
            )}

            {/* 7. AVATAR ZOOM MODAL */}
            {showAvatarZoom && (
                <div className="avatar-zoom-overlay" onClick={() => setShowAvatarZoom(false)}>
                    <div className="avatar-zoom-content" onClick={(e) => e.stopPropagation()}>
                        <button className="avatar-zoom-close" onClick={() => setShowAvatarZoom(false)}>×</button>
                        <img
                            src={user?.avatar || '/no-avatar.jpg'}
                            alt="Avatar Zoomed"
                            className="avatar-zoom-image"
                            onError={(e) => { e.target.onerror = null; e.target.src = '/no-avatar.jpg'; }}
                        />
                    </div>
                </div>
            )}

        </div>
    );
};

export default Dashboard;
