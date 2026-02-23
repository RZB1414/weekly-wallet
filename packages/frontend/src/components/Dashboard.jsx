import React, { useMemo, useState, useEffect, useLayoutEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { api } from '../lib/api';
import { formatCurrency, getFinancialInfo, getMonthQuarters } from '../lib/utils';
import {
    PieChart, Pie, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import '../styles/Dashboard.css';
import weeklyAvatar from '/chewie.jpg';

const Dashboard = ({ weeks, categories, totalSavings, onNavigate, onAddExpense, onOpenPlanning, onToggleMenu }) => {
    const { user } = useAuth();
    const [showRunwayInfo, setShowRunwayInfo] = useState(false);
    const [chartsReady, setChartsReady] = useState(false);

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

    // ── 4. Realistic Runway Calculation (Hero) ────────────────
    const [realisticRunway, setRealisticRunway] = useState({ value: 'Calculating...', loading: true, details: '', wealth: 0, daysRunway: '', isSafe: false });

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

                console.log("[RUNWAY DEBUG] --- Base Values ---");
                console.log("Total Income (Salaries from Plans):", totalIncome);
                console.log("Extra Income (Credits):", extraIncome);
                console.log("Start Balance:", startBalance);
                console.log("Total Expenses:", totalExpenses);
                console.log("=> Global Net Worth:", globalNetWorth);

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

                console.log("[RUNWAY DEBUG] --- Monthly Flow ---");
                console.log("Monthly Income (Latest Plan Salary):", monthlyIncome);
                console.log("Monthly Burn (Planned Spend Categories or 4x Week):", monthlyBurn);
                console.log("=> Net Monthly Flow:", netMonthlyFlow);

                let resultString = '';
                let detailsString = '';
                let isSafe = false;
                let daysRunwayStr = '';

                if (globalNetWorth <= 0) {
                    resultString = '0 Months';
                    detailsString = 'No current wealth. Watch your spending!';
                } else {
                    const burnToUse = monthlyBurn > 0 ? monthlyBurn : (totalExpenses || 1);

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
                            detailsString = `Wealth growing by ${formatCurrency(netMonthlyFlow)}/mo`;
                        } else if (netMonthlyFlow < 0) {
                            detailsString = `Burning ${formatCurrency(Math.abs(netMonthlyFlow))}/mo`;
                        } else {
                            detailsString = `Stagnant wealth growth`;
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

                console.log("[RUNWAY DEBUG] --- Final Results ---");
                console.log("Result String:", resultString);
                console.log("Details String:", detailsString);
                console.log("Days Runway:", daysRunwayStr);
                console.log("-----------------------------------");

                setRealisticRunway({
                    value: resultString,
                    loading: false,
                    details: detailsString,
                    wealth: globalNetWorth,
                    daysRunway: daysRunwayStr,
                    isSafe
                });

            } catch (err) {
                console.error("Runway calc failed", err);
                setRealisticRunway({ value: 'Error', loading: false, details: 'Check connection', isSafe: false });
            }
        };

        if (weeks.length > 0) {
            calculateRunway();
        } else {
            setRealisticRunway({ value: '∞ Safe', loading: false, details: 'No data yet. Start tracking!', wealth: 0, isSafe: true });
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
                <div className="greeting-text">
                    <h1>Hi, {user?.email?.split('@')[0] || 'Friend'}!</h1>
                    <p>Financial Health Check 🩺</p>
                </div>
                <div className="weekly-avatar" onClick={onToggleMenu} style={{ cursor: 'pointer' }}>
                    <img src={weeklyAvatar} alt="Profile" onError={(e) => e.target.style.display = 'none'} />
                </div>
            </header>

            {/* 1. HERO CARD: RUNWAY */}
            <section className="hero-section">
                <div className={`hero-card ${realisticRunway.isSafe ? 'safe-glow' : 'warning-glow'}`}>
                    <div className="hero-label-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <span className="hero-label" style={{ margin: 0 }}>Real Runway</span>
                        <button
                            className="info-icon-btn"
                            onClick={() => setShowRunwayInfo(true)}
                            title="How is this calculated?"
                        >
                            ?
                        </button>
                    </div>
                    <div className="hero-value">
                        {realisticRunway.loading ? <span className="skeleton-text"></span> : realisticRunway.value}
                    </div>
                    <span className="hero-subtext">
                        {realisticRunway.details}
                    </span>
                    {realisticRunway.daysRunway && !realisticRunway.isSafe && (
                        <div className="hero-badge">
                            ⏳ ~{realisticRunway.daysRunway} left at avg spend
                        </div>
                    )}
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

            <section className="quick-actions-footer">
                <button className="fab-main" onClick={onAddExpense}>
                    ➕ Add Expense
                </button>
                <div className="secondary-actions">
                    <button className="btn-small" onClick={onOpenPlanning}>📅 Plan</button>
                    <button className="btn-small" onClick={() => onNavigate('weeks')}>📊 History</button>
                </div>
            </section>

            {/* 6. RUNWAY EXPLAINER MODAL */}
            {showRunwayInfo && (
                <div className="modal-overlay" onClick={() => setShowRunwayInfo(false)}>
                    <div className="modal-content info-modal" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowRunwayInfo(false)}>×</button>
                        <h2>How the Runway Works ⏳</h2>
                        <div className="info-content">
                            <p>The <strong>Real Runway</strong> indicates how long your money will last if you suddenly lose your main source of income, based on your current lifestyle.</p>

                            <div className="info-step">
                                <h3>1. Net Worth calculation</h3>
                                <p>We sum up all your historical salaries, extra incomes, and your very first initial balance, then subtract everything you've ever spent. This gives us your total available cash pile: <strong>{formatCurrency(realisticRunway.wealth || 0)}</strong>.</p>
                            </div>

                            <div className="info-step">
                                <h3>2. Monthly Burn Rate</h3>
                                <p>We look at your latest Monthly Plan. If your planned expenses are higher than your salary, you are "burning" cash. Your monthly deficit determines how fast your cash pile shrinks.</p>
                            </div>

                            <div className="info-step">
                                <h3>3. The Result</h3>
                                <p>We divide your Net Worth by your Monthly Burn Rate to show exactly how many <strong>Months</strong> or <strong>Years</strong> you can survive if your income drops to zero.<br />
                                    If you have more than 3 months of runway built up, you get a <strong>Safe 🟢</strong> badge! Otherwise, a warning indicates you should keep building your savings. 🔴</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Dashboard;
