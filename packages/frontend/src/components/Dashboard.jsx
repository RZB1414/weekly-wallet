import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { api } from '../lib/api';
import { formatCurrency, formatDate, getFinancialInfo, calculateRemaining } from '../lib/utils';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    LineChart, Line, CartesianGrid, Legend,
    PieChart, Pie
} from 'recharts';
import '../styles/Dashboard.css';
import pusheenAvatar from '/chewie.jpg';
import explosionImg from '/explosion.png'; // Direct import if in public/src or reference as string if in public

const Dashboard = ({ weeks, categories, totalSavings, onNavigate, onAddExpense, onOpenPlanning, onToggleMenu }) => {
    const { user } = useAuth();
    const [showRunway, setShowRunway] = useState(false);
    const [barTooltipActive, setBarTooltipActive] = useState(false);
    const barChartRef = useRef(null);

    // Dismiss bar chart tooltip on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (barChartRef.current && !barChartRef.current.contains(e.target)) {
                setBarTooltipActive(false);
            }
        };
        document.addEventListener('click', handleClickOutside, true);
        return () => document.removeEventListener('click', handleClickOutside, true);
    }, []);

    // ── 1. KPI Calculations ─────────────────────────────

    // Current Week Data
    const currentWeekData = useMemo(() => {
        if (!weeks || weeks.length === 0) return null;
        const now = new Date();
        const { quarter } = getFinancialInfo(now);
        const currentWeek = weeks.find(w => w.id === quarter.id);

        // Calculate Weekly Budget based on Frequency
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

    // Cash Runway
    const cashRunway = useMemo(() => {
        if (!currentWeekData) return '∞';
        const remaining = currentWeekData.balance;
        if (remaining <= 0) return '0 Days';

        const now = new Date();
        const daysPassed = now.getDay() + 1;
        const avgDailySpend = currentWeekData.spent / daysPassed;

        if (avgDailySpend <= 0) return 'Safe';

        const daysLeft = Math.floor(remaining / avgDailySpend);
        return `${daysLeft} Days`;
    }, [currentWeekData]);


    // ── 2. Chart Data Preparation ───────────────────────

    // Bar Chart
    const barChartData = useMemo(() => {
        if (!weeks) return [];

        const weeklyBudget = categories.reduce((sum, cat) => {
            if (cat.frequency === 'weekly') {
                return sum + (cat.budget || 0);
            }
            return sum + ((cat.budget || 0) / 4);
        }, 0);

        return weeks.slice(0, 4).map((week, index) => {
            const spent = week.expenses
                .filter(e => e.type !== 'credit')
                .reduce((sum, e) => sum + Number(e.amount), 0);

            // Warm/Happy Theme Colors
            let fill = '#34D399'; // Emerald (Safe)
            if (spent > weeklyBudget) fill = '#F87171'; // Red (Over)
            else if (spent > weeklyBudget * 0.8) fill = '#FBBF24'; // Amber (Caution)

            return {
                name: `W${index + 1}`,
                Budget: weeklyBudget,
                Actual: spent,
                fill
            };
        });
    }, [weeks, categories]);

    // Trend Data
    const trendData = useMemo(() => {
        const weeklyBudget = categories.reduce((sum, cat) => {
            if (cat.frequency === 'weekly') {
                return sum + (cat.budget || 0);
            }
            return sum + ((cat.budget || 0) / 4);
        }, 0);
        let cumulativeActual = 0;
        let cumulativeIdeal = 0;

        return weeks.map((week, index) => {
            const spent = week.expenses
                .filter(e => e.type !== 'credit')
                .reduce((sum, e) => sum + Number(e.amount), 0);

            cumulativeActual += spent;
            cumulativeIdeal += weeklyBudget;

            return {
                name: `W${index + 1}`,
                Ideal: cumulativeIdeal,
                Actual: cumulativeActual
            };
        });
    }, [weeks, categories]);

    // Donut Data
    const donutData = useMemo(() => {
        const catMap = {};
        let total = 0;
        weeks.forEach(week => {
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
    }, [weeks]);

    // Happy & Warm Palette
    const COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6', '#6B7280'];



    // ── 3. Realistic Runway Calculation ────────────────
    const [realisticRunway, setRealisticRunway] = useState({ value: '?', loading: false, details: '', wealth: 0, daysRunway: '' });

    useEffect(() => {
        if (!showRunway) return;

        const calculateRunway = async () => {
            setRealisticRunway(prev => ({ ...prev, loading: true }));
            try {
                // 1. Fetch ALL Monthly Plans (to get Salary History)
                const plansList = await api.getMonthlyPlannings();

                const allPlansData = plansList.plans ? await Promise.all(
                    plansList.plans.map(p => api.getMonthlyPlanning(p.year, p.month))
                ) : [];

                // 2. Calculate Total Historical Income (Sum of Salary)
                const totalIncome = allPlansData.reduce((sum, plan) => sum + (plan.salary || 0), 0);

                // 3. Calculate Total Historical Spent & Initial Balance
                // Ensure weeks are sorted to get the true Initial Balance of the very first week
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

                // Current Net Worth
                // Income (Salaries) + Extra Credits + Initial Balance - Expenses
                const globalNetWorth = totalIncome + extraIncome + startBalance - totalExpenses;

                // 4. Future Projection
                // Find latest plan for burn rate
                const latestPlanRef = plansList.plans && plansList.plans.length > 0 ? plansList.plans[0] : null;
                let monthlyBurn = 0;
                let monthlyIncome = 0;

                if (latestPlanRef) {
                    const latestData = await api.getMonthlyPlanning(latestPlanRef.year, latestPlanRef.month);
                    monthlyIncome = latestData.salary || 0;
                    monthlyBurn = latestData.categories.reduce((sum, c) => sum + (c.type === 'spend' ? c.budget : 0), 0);
                }

                // If no plan, use reasonable defaults
                if (monthlyBurn === 0 && currentWeekData) {
                    monthlyBurn = currentWeekData.spent * 4;
                }

                // Net Monthly Flow
                const netMonthlyFlow = monthlyIncome - monthlyBurn;

                // Calculation
                let resultString = '';
                let detailsString = '';

                if (globalNetWorth <= 0) {
                    resultString = '0 Months';
                    detailsString = 'No current wealth';
                } else if (netMonthlyFlow >= 0) {
                    resultString = '∞ Safe';
                    detailsString = `Growing by ${formatCurrency(netMonthlyFlow)}/mo`;
                } else {
                    const monthlyBurnNet = Math.abs(netMonthlyFlow);

                    const monthsLeft = globalNetWorth / monthlyBurnNet;

                    if (monthsLeft > 12) {
                        const years = (monthsLeft / 12).toFixed(1);
                        resultString = `${years} Years`;
                    } else {
                        resultString = `${monthsLeft.toFixed(1)} Months`;
                    }
                    detailsString = `Burning ${formatCurrency(monthlyBurnNet)}/mo`;
                }

                // 5. Days Runway based on average daily spend
                let daysRunwayStr = '';
                if (globalNetWorth > 0 && totalExpenses > 0) {
                    // Calculate total days tracked
                    const firstDate = new Date(sortedWeeks[0].startDate);
                    const lastWeek = sortedWeeks[sortedWeeks.length - 1];
                    const lastDate = lastWeek.endDate ? new Date(lastWeek.endDate) : new Date();
                    const totalDaysTracked = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)));
                    const avgDailySpend = totalExpenses / totalDaysTracked;

                    if (avgDailySpend > 0) {
                        const daysLeft = Math.floor(globalNetWorth / avgDailySpend);
                        daysRunwayStr = `${daysLeft} days`;
                    }
                }

                setRealisticRunway({
                    value: resultString,
                    loading: false,
                    details: detailsString,
                    wealth: globalNetWorth,
                    daysRunway: daysRunwayStr
                });

            } catch (err) {
                console.error("Runway calc failed", err);
                setRealisticRunway({ value: 'Error', loading: false, details: 'Check connection' });
            }
        };

        calculateRunway();
    }, [showRunway, weeks]);


    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="greeting-text">
                    <h1>Hi, {user?.email?.split('@')[0] || 'Friend'}!</h1>
                    <p>Financial Health Check 🩺</p>
                </div>
                <div className="pusheen-avatar" onClick={onToggleMenu} style={{ cursor: 'pointer' }}>
                    <img src={pusheenAvatar} alt="Profile" onError={(e) => e.target.style.display = 'none'} />
                </div>
            </header>

            <section className="kpi-section" style={{ gridTemplateColumns: '1fr' }}>
                <div className="kpi-card" style={{ maxWidth: '400px', margin: '0 auto' }}>
                    <span className="kpi-label">Weekly Balance</span>
                    <span className={`kpi-value ${currentWeekData?.balance >= 0 ? 'positive' : 'negative'}`}>
                        {formatCurrency(currentWeekData?.balance || 0)}
                    </span>
                    <span className="kpi-subtext">Left to spend</span>
                </div>
            </section>

            <section className="charts-section">
                <div className="chart-card wide">
                    <h3>Weekly Goals</h3>
                    <div ref={barChartRef} style={{ width: '100%', height: 280, position: 'relative' }} onClick={() => setBarTooltipActive(true)}>
                        <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0} debounce={300}>
                            <BarChart data={barChartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fill: '#6B7280', fontSize: 12, fontFamily: 'Inter' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    hide
                                />
                                <Tooltip
                                    active={barTooltipActive ? undefined : false}
                                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    formatter={(value) => formatCurrency(value)}
                                />
                                <Bar dataKey="Actual" radius={[6, 6, 6, 6]} barSize={40}>
                                    {barChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="chart-card">
                    <h3>Trend</h3>
                    <div style={{ width: '100%', height: 250, position: 'relative' }}>
                        <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0} debounce={300}>
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fill: '#6B7280', fontSize: 12, fontFamily: 'Inter' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis hide />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    formatter={(value) => formatCurrency(value)}
                                />
                                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                <Line
                                    type="monotone"
                                    dataKey="Ideal"
                                    stroke="#CBD5E1"
                                    strokeDasharray="5 5"
                                    strokeWidth={2}
                                    dot={false}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="Actual"
                                    stroke="#F59E0B"
                                    strokeWidth={3}
                                    dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="chart-card">
                    <h3>Categories</h3>
                    <div style={{ width: '100%', height: 220, position: 'relative' }}>
                        <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0} debounce={300}>
                            <PieChart>
                                <Pie
                                    data={donutData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
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
                    </div>

                    {/* Custom Legend */}
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
                </div>
            </section>

            {/* Hidden Runway Section at Bottom */}
            {showRunway && (
                <div style={{ marginTop: '40px', marginBottom: '80px', animation: 'fadeIn 0.5s ease' }}>
                    <div className="kpi-card warning-glow">
                        <span className="kpi-label">Real Runway</span>
                        <span className="kpi-value warning" style={{ fontSize: '1.8rem' }}>
                            {realisticRunway.loading ? 'Calculating...' : realisticRunway.value}
                        </span>
                        <span className="kpi-subtext">
                            {realisticRunway.details || "Based on total wealth & future flow"}
                        </span>
                        {realisticRunway.wealth > 0 && (
                            <div style={{ fontSize: '0.8rem', marginTop: '5px', opacity: 0.8 }}>
                                Net Wealth combined: {formatCurrency(realisticRunway.wealth)}
                            </div>
                        )}
                        {realisticRunway.daysRunway && (
                            <div style={{ fontSize: '0.85rem', marginTop: '8px', padding: '6px 12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', fontWeight: 600 }}>
                                ⏳ ~{realisticRunway.daysRunway} at current avg spending
                            </div>
                        )}
                    </div>
                </div>
            )}

            <section className="quick-actions-footer">
                <button className="fab-main" onClick={onAddExpense}>
                    ➕ Add Expense
                </button>
                <div className="secondary-actions">
                    <button className="btn-small" onClick={onOpenPlanning}>📅 Plan</button>
                    <button className="btn-small" onClick={() => onNavigate('weeks')}>📊 History</button>
                </div>
            </section>

            {/* Explosion Trigger */}
            <div
                className="explosion-trigger"
                onClick={() => setShowRunway(!showRunway)}
                title="Reveal Runway"
            >
                <img src="/explosion.png" alt="Explosion" />
            </div>
        </div>
    );
};

export default Dashboard;
