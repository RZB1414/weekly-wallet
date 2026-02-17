import React, { useMemo, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
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

    // ── 1. KPI Calculations ─────────────────────────────

    // Current Week Data
    const currentWeekData = useMemo(() => {
        if (!weeks || weeks.length === 0) return null;
        const now = new Date();
        const { quarter } = getFinancialInfo(now);
        const currentWeek = weeks.find(w => w.id === quarter.id);

        const totalMonthlyBudget = categories.reduce((sum, cat) => sum + (cat.budget || 0), 0);
        const weeklyBudget = totalMonthlyBudget / 4;

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
        const totalMonthlyBudget = categories.reduce((sum, cat) => sum + (cat.budget || 0), 0);
        const weeklyBudget = totalMonthlyBudget / 4;

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
        const totalMonthlyBudget = categories.reduce((sum, cat) => sum + (cat.budget || 0), 0);
        const weeklyBudget = totalMonthlyBudget / 4;
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
        weeks.forEach(week => {
            week.expenses.forEach(e => {
                if (e.type === 'credit') return;
                const cat = e.category || 'Uncategorized';
                catMap[cat] = (catMap[cat] || 0) + Number(e.amount);
            });
        });
        const sorted = Object.entries(catMap).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value }));
        if (sorted.length <= 5) return sorted;
        const top5 = sorted.slice(0, 5);
        const others = sorted.slice(5).reduce((sum, [, val]) => sum + val, 0);
        top5.push({ name: 'Others', value: others });
        return top5;
    }, [weeks]);

    // Happy & Warm Palette
    const COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6', '#6B7280'];


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
                    <div style={{ width: '100%', height: 280, position: 'relative' }}>
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
                                <span className="legend-value">{formatCurrency(entry.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Hidden Runway Section at Bottom */}
            {showRunway && (
                <div style={{ marginTop: '40px', marginBottom: '80px', animation: 'fadeIn 0.5s ease' }}>
                    <div className="kpi-card warning-glow">
                        <span className="kpi-label">Runway</span>
                        <span className="kpi-value warning">
                            {cashRunway}
                        </span>
                        <span className="kpi-subtext">Until $0 breakdown</span>
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
