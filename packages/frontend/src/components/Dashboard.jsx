import React, { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../lib/AuthContext';
import { api } from '../lib/api';
import { calculateCategoryNet, filterExpensesByCategory, formatCurrency, getFinancialInfo, getMonthQuarters, getWeeklyCategoryCarryover, normalizeRefundExpense } from '../lib/utils';
import {
    PieChart, Pie, Tooltip, Cell
} from 'recharts';
import '../styles/Dashboard.css';

const Dashboard = ({ weeks, categories, totalSavings, onNavigate, onAddExpense, onOpenPlanning, onToggleMenu, isAppLoading = false, planningVersion = 0 }) => {
    // Default avatar if none provided (avoids Vite import errors on missing files)
    const weeklyAvatar = '/chewie.jpg';
    const { user } = useAuth();
    const today = new Date();
    const currentMonthValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const [showRunwayInfo, setShowRunwayInfo] = useState(false);
    const [showRunwayMath, setShowRunwayMath] = useState(false);
    const [chartsReady, setChartsReady] = useState(false);
    const [isEditingProjection, setIsEditingProjection] = useState(false);
    const [showWorstCase, setShowWorstCase] = useState(false);
    const [showAvatarZoom, setShowAvatarZoom] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(currentMonthValue);
    const [savedPlanningMonths, setSavedPlanningMonths] = useState([]);
    const [monthCategories, setMonthCategories] = useState(categories);
    const projectionInputRef = useRef(null);
    const chartContainerRef = useRef(null);
    const [chartBounds, setChartBounds] = useState({ width: 0, height: 0 });

    const selectedYearNum = Number(selectedMonth.split('-')[0]);
    const selectedMonthNum = Number(selectedMonth.split('-')[1]);

    const monthOptions = useMemo(() => {
        return [...savedPlanningMonths]
            .sort((leftMonth, rightMonth) => rightMonth.value.localeCompare(leftMonth.value))
            .map(option => ({
                value: option.value,
                label: option.label
            }));
    }, [savedPlanningMonths]);

    const isManualPlan = (plan = {}) => {
        return plan.source === 'manual';
    };

    useEffect(() => {
        let isMounted = true;

        const loadSavedMonths = async () => {
            try {
                const plansList = await api.getMonthlyPlannings();
                if (!isMounted) return;

                const planRefs = (plansList.plans || []).sort((leftPlan, rightPlan) => {
                    if (leftPlan.year !== rightPlan.year) {
                        return rightPlan.year - leftPlan.year;
                    }

                    return rightPlan.month - leftPlan.month;
                });

                const detailedPlans = await api.getMonthlyPlanningDetails(planRefs);

                const options = detailedPlans
                    .filter(({ data }) => isManualPlan(data))
                    .map(plan => {
                        const value = `${plan.year}-${String(plan.month).padStart(2, '0')}`;
                        return {
                            value,
                            label: new Date(plan.year, plan.month - 1, 1).toLocaleDateString('en-US', {
                                month: 'long',
                                year: 'numeric'
                            }),
                            year: plan.year,
                            month: plan.month
                        };
                    });

                setSavedPlanningMonths(options);

                if (options.length === 0) return;

                const currentMonthOption = options.find(option => option.value === currentMonthValue);
                setSelectedMonth(currentMonthOption ? currentMonthValue : options[0].value);
            } catch (error) {
                console.error('Failed to load saved planning months', error);
            }
        };

        loadSavedMonths();

        return () => {
            isMounted = false;
        };
    }, [currentMonthValue, planningVersion]);

    const normalizePlanningCategories = (planningCategories = []) => {
        if (!planningCategories.length) return categories;

        return planningCategories.map(category => {
            const parsedCategory = typeof category === 'string'
                ? { name: category, budget: 0, type: 'credit', frequency: 'monthly' }
                : category;

            return {
                ...parsedCategory,
                type: parsedCategory.type || 'credit',
                frequency: parsedCategory.frequency || 'monthly',
                budget: parsedCategory.budget || 0
            };
        });
    };

    useEffect(() => {
        let isMounted = true;

        const loadMonthPlanning = async () => {
            try {
                const planning = await api.getMonthlyPlanning(selectedYearNum, selectedMonthNum);
                if (!isMounted) return;

                if (planning?.categories?.length) {
                    setMonthCategories(normalizePlanningCategories(planning.categories));
                    return;
                }

                setMonthCategories(categories);
            } catch (error) {
                console.error('Failed to load dashboard planning', error);
                if (isMounted) {
                    setMonthCategories(categories);
                }
            }
        };

        loadMonthPlanning();

        return () => {
            isMounted = false;
        };
    }, [selectedYearNum, selectedMonthNum, categories]);

    const effectiveCategories = monthCategories?.length ? monthCategories : categories;
    const selectedMonthDate = new Date(selectedYearNum, selectedMonthNum - 1, 1);
    const clampedSelectedDate = new Date(
        selectedYearNum,
        selectedMonthNum - 1,
        Math.min(today.getDate(), new Date(selectedYearNum, selectedMonthNum, 0).getDate())
    );

    // Defer chart rendering
    useLayoutEffect(() => {
        const frame = requestAnimationFrame(() => setChartsReady(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    useLayoutEffect(() => {
        if (!chartContainerRef.current) return undefined;

        const updateBounds = () => {
            if (!chartContainerRef.current) return;

            const nextWidth = chartContainerRef.current.clientWidth;
            const nextHeight = chartContainerRef.current.clientHeight;
            if (nextWidth > 0 && nextHeight > 0) {
                setChartBounds({ width: nextWidth, height: nextHeight });
            }
        };

        updateBounds();

        const observer = new ResizeObserver(() => updateBounds());
        observer.observe(chartContainerRef.current);

        return () => observer.disconnect();
    }, []);

    // ── 1. KPI & Budget Calculations ─────────────────────────────

    // Current Week Data
    const currentWeekData = useMemo(() => {
        if (!weeks || weeks.length === 0) return null;
        const { year, month, quarter } = getFinancialInfo(clampedSelectedDate);
        const currentWeek = weeks.find(w => w.id === quarter.id);

        // Generate standard quarters for the current month to find the proper chronological previous week
        const quarters = getMonthQuarters(year, month);
        const currentQIndex = quarters.findIndex(q => q.id === quarter.id);
        const monthWeeks = quarters.map(q => weeks.find(w => w.id === q.id) || { id: q.id, expenses: [], startDate: q.start, endDate: q.end });

        const weeklyCategoryCarryover = effectiveCategories.reduce((sum, cat) => {
            if (cat.frequency !== 'weekly') return sum;
            return sum + getWeeklyCategoryCarryover(monthWeeks, currentQIndex, cat);
        }, 0);

        const baseWeeklyBudget = effectiveCategories.reduce((sum, cat) => {
            if (cat.frequency === 'weekly') {
                return sum + (cat.budget || 0);
            }
            return sum + ((cat.budget || 0) / 4);
        }, 0);

        const weeklyBudget = baseWeeklyBudget + weeklyCategoryCarryover;

        if (!currentWeek) return { budget: weeklyBudget, spent: 0, balance: weeklyBudget };

        const spent = currentWeek.expenses
            .filter(e => e.type !== 'credit')
            .reduce((sum, e) => sum + Number(e.amount), 0);

        return {
            budget: weeklyBudget,
            spent,
            balance: weeklyBudget - spent
        };
    }, [weeks, effectiveCategories, clampedSelectedDate]);

    // Current Month Data
    const currentMonthData = useMemo(() => {
        const { year, month } = getFinancialInfo(selectedMonthDate);
        const quarters = getMonthQuarters(year, month);

        const currentMonthWeeks = quarters.map(q => {
            const existing = weeks.find(w => w.id === q.id);
            return existing || { id: q.id, expenses: [] };
        });

        const monthlyBudget = effectiveCategories.reduce((sum, cat) => {
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
    }, [weeks, effectiveCategories, selectedMonthDate]);

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

    const monthlyExpenses = useMemo(() => {
        return currentMonthData.weeks.flatMap(week => {
            return (week.expenses || []).map(expense => normalizeRefundExpense(expense));
        });
    }, [currentMonthData]);

    const overBudgetCategories = useMemo(() => {
        return effectiveCategories
            .map(category => {
                const monthlyBudget = category.frequency === 'weekly'
                    ? (category.budget || 0) * 4
                    : (category.budget || 0);
                const spent = calculateCategoryNet(monthlyExpenses, category.name);

                return {
                    ...category,
                    monthlyBudget,
                    spent,
                    remaining: monthlyBudget - spent,
                    exceededAmount: Math.max(spent - monthlyBudget, 0),
                    expenses: filterExpensesByCategory(monthlyExpenses, category.name)
                };
            })
            .filter(category => category.remaining < 0)
            .sort((leftCategory, rightCategory) => rightCategory.exceededAmount - leftCategory.exceededAmount);
    }, [effectiveCategories, monthlyExpenses]);

    const totalOverBudgetAmount = useMemo(() => {
        return overBudgetCategories.reduce((sum, category) => sum + category.exceededAmount, 0);
    }, [overBudgetCategories]);

    const currentFinancialWeekSpent = useMemo(() => {
        if (!weeks || weeks.length === 0) return 0;

        const { quarter } = getFinancialInfo(new Date());
        const currentWeek = weeks.find(week => week.id === quarter.id);
        if (!currentWeek) return 0;

        return (currentWeek.expenses || [])
            .filter(expense => expense.type !== 'credit')
            .reduce((sum, expense) => sum + Number(expense.amount), 0);
    }, [weeks]);

    // ── 2. Recent Transactions ─────────────────────────
    const recentTransactions = useMemo(() => {
        const allExpenses = [];
        const { year, month } = getFinancialInfo(selectedMonthDate);
        const quarters = getMonthQuarters(year, month);

        quarters.forEach(quarter => {
            const week = weeks.find(item => item.id === quarter.id);
            if (!week) return;

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
    }, [weeks, selectedMonthDate]);

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
        if (isAppLoading) {
            setRealisticRunway(prev => ({ ...prev, loading: true }));
            setOptimisticRunway(prev => ({ ...prev, loading: true }));
            return;
        }

        if (!Array.isArray(weeks)) return;

        let isCancelled = false;

        const calculateRunway = async () => {
            setRealisticRunway(prev => ({ ...prev, loading: true }));
            setOptimisticRunway(prev => ({ ...prev, loading: true }));
            try {
                const plansList = await api.getMonthlyPlannings();
                const sortedPlans = [...(plansList.plans || [])].sort((leftPlan, rightPlan) => {
                    if (leftPlan.year !== rightPlan.year) {
                        return rightPlan.year - leftPlan.year;
                    }

                    return rightPlan.month - leftPlan.month;
                });

                const allPlansData = sortedPlans.length > 0 ? await api.getMonthlyPlanningDetails(sortedPlans) : [];

                const manualPlansData = allPlansData.filter(plan => isManualPlan(plan.data));

                let accumulatedRemainingBalance = 0;
                manualPlansData.forEach(({ data }) => {
                    const mIncome = data.salary || 0;
                    const mBudgets = (data.categories || []).reduce((sum, c) => {
                        const monthlyEquivalent = c.frequency === 'weekly' ? (c.budget || 0) * 4 : (c.budget || 0);
                        return sum + monthlyEquivalent;
                    }, 0);
                    accumulatedRemainingBalance += (mIncome - mBudgets);
                });

                const globalNetWorth = accumulatedRemainingBalance + (totalSavings || 0);


                let monthlyBurn = 0;
                let monthlyIncome = 0;
                let totalBudgets = 0;
                let latestRemainingBalance = 0;
                const latestManualPlan = manualPlansData.length > 0 ? manualPlansData[0] : null;

                if (latestManualPlan) {
                    const latestData = latestManualPlan.data;
                    monthlyIncome = latestData.salary || 0;

                    totalBudgets = (latestData.categories || []).reduce((sum, c) => {
                        const monthlyEquivalent = c.frequency === 'weekly' ? (c.budget || 0) * 4 : (c.budget || 0);
                        return sum + monthlyEquivalent;
                    }, 0);

                    latestRemainingBalance = monthlyIncome - totalBudgets;
                    monthlyBurn = Math.max(totalBudgets, 0);
                }

                if (monthlyBurn === 0 && currentFinancialWeekSpent > 0) {
                    monthlyBurn = currentFinancialWeekSpent * 4;
                }
                if (totalBudgets === 0 && currentFinancialWeekSpent > 0) {
                    totalBudgets = currentFinancialWeekSpent * 4;
                }

                const netMonthlyFlow = latestRemainingBalance;

                let resultString = '';
                let detailsString = '';
                let isSafe = false;
                let daysRunwayStr = '';

                // Define burnToUse at a higher scope so it can be passed to state safely
                const burnToUse = monthlyBurn > 0 ? monthlyBurn : (totalBudgets > 0 ? totalBudgets : 1);

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

                let optResultString = `${netMonthlyFlow > 0 ? '+' : netMonthlyFlow < 0 ? '-' : ''}${formatCurrency(Math.abs(netMonthlyFlow))}/mo`;
                let optDetailsString = netMonthlyFlow > 0
                    ? 'Positive monthly momentum'
                    : netMonthlyFlow < 0
                        ? 'Negative monthly momentum'
                        : 'No monthly momentum';
                let optIsSafe = netMonthlyFlow >= 0;

                if (isCancelled) return;

                setRealisticRunway({
                    value: resultString,
                    loading: false,
                    details: detailsString,
                    wealth: globalNetWorth,
                    daysRunway: daysRunwayStr,
                    isSafe,
                    raw: { accumulatedRemainingBalance, totalSavings: totalSavings || 0, monthlyBurn: burnToUse }
                });

                setOptimisticRunway({
                    value: optResultString,
                    loading: false,
                    details: optDetailsString,
                    wealth: globalNetWorth,
                    netMonthlyFlow, // Pass flow straight to state to render dynamic projections
                    daysRunway: '', // Usually not helpful for optimistic view
                    isSafe: optIsSafe,
                    raw: { monthlyIncome, monthlyBurn: burnToUse, totalBudgets, netMonthlyFlow }
                });

            } catch (err) {
                console.error("Runway calc failed", err);
                if (isCancelled) return;
                setRealisticRunway({ value: 'Error', loading: false, details: 'Check connection', isSafe: false });
                setOptimisticRunway({ value: 'Error', loading: false, details: 'Check connection', isSafe: false });
            }
        };

        if (weeks && weeks.length > 0) {
            calculateRunway();
        } else {
            setRealisticRunway({ value: '∞ Safe', loading: false, details: 'No data yet. Start tracking!', wealth: 0, isSafe: true });
            setOptimisticRunway({ value: `${formatCurrency(0)}/mo`, loading: false, details: 'No data yet. Start tracking!', wealth: 0, isSafe: true, netMonthlyFlow: 0, raw: {} });
        }

        return () => {
            isCancelled = true;
        };
    }, [weeks, totalSavings, isAppLoading, currentFinancialWeekSpent]);

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
                <div className={`hero-card financial-momentum-card ${optimisticRunway.isSafe ? 'optimistic-glow' : 'warning-glow'}`}>
                    <div className="hero-label-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', position: 'relative', width: '100%', justifyContent: 'center' }}>
                        <span className="hero-label" style={{ margin: 0 }}>Financial Momentum</span>
                        <button
                            type="button"
                            className="info-icon-btn"
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setShowRunwayInfo('optimistic');
                                setShowRunwayMath(false);
                            }}
                            title="How is this calculated?"
                            aria-label="Open Financial Momentum explanation"
                        >
                            ?
                        </button>

                        {optimisticRunway.netMonthlyFlow > 0 && (
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
                        {optimisticRunway.netMonthlyFlow > 0 ? (
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
                                        <strong style={{ color: '#111827' }}>{formatCurrency(optimisticRunway.wealth + (optimisticRunway.netMonthlyFlow * (Number(projectionMonths) || 0)))}</strong>
                                    </span>
                                </div>
                            </>
                        ) : (
                            <span>{optimisticRunway.details}</span>
                        )}
                    </div>
                </div>
            </section>

            <div className="dashboard-month-selector">
                <label htmlFor="dashboard-month" className="month-select-label">Dashboard month</label>
                <select
                    id="dashboard-month"
                    className="month-select"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                    disabled={monthOptions.length === 0}
                >
                    {monthOptions.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </div>

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

                {overBudgetCategories.length > 0 && (
                    <div className="glass-card dashboard-over-budget-card">
                        <div className="dashboard-over-budget-header">
                            <h3>Categories Over Limit</h3>
                            <span className="dashboard-over-budget-total">{formatCurrency(totalOverBudgetAmount)}</span>
                        </div>
                        <div className="dashboard-over-budget-list">
                            {overBudgetCategories.map(category => (
                                <div key={`dashboard-over-budget-${category.name}`} className="dashboard-over-budget-item">
                                    <div>
                                        <div className="dashboard-over-budget-name">{category.name}</div>
                                        <div className="dashboard-over-budget-meta">
                                            Planned {formatCurrency(category.monthlyBudget)} • Spent {formatCurrency(category.spent)}
                                        </div>
                                    </div>
                                    <div className="dashboard-over-budget-amount">+ {formatCurrency(category.exceededAmount)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
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
                    <div ref={chartContainerRef} className="chart-container-shell">
                        {chartsReady && donutData.length > 0 && chartBounds.width > 0 && chartBounds.height > 0 ? (
                            <PieChart width={chartBounds.width} height={chartBounds.height}>
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

            {/* WORST CASE SCENARIO BUTTON */}
            <section className="worst-case-section-apocalipse">
                <button
                    className="worst-case-btn-apocalipse"
                    onClick={() => setShowWorstCase(true)}
                >
                    Show Worst Case Scenario
                </button>
            </section>

            {/* FULL PAGE APOCALYPTIC OVERLAY */}
            {showWorstCase && (
                <div className="worst-case-overlay" onClick={() => setShowWorstCase(false)}>
                    {/* APOCALYPSE VIDEO BACKGROUND */}
                    <video className="apocalypse-video" autoPlay loop muted playsInline>
                        <source src="/apocalipse-cats.mp4" type="video/mp4" />
                    </video>

                    <button className="worst-case-close-btn" onClick={(e) => { e.stopPropagation(); setShowWorstCase(false); }}>
                        ESCAPE THE APOCALYPSE
                    </button>
                    <div className="worst-case-content" onClick={e => e.stopPropagation()}>
                        <h2 className="apocalypse-title-apocalipse">
                            WORST CASE SCENARIO
                        </h2>
                        <div className="hero-card worst-case-card-blend hero-card-apocalipse">
                            <div className="hero-label-wrapper-apocalipse">
                                <span className="hero-label-apocalipse">Strict Runway Survival</span>
                                <button
                                    type="button"
                                    className="info-icon-btn-apocalipse"
                                    onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setShowWorstCase(false);
                                        setShowRunwayInfo('strict');
                                        setShowRunwayMath(false);
                                    }}
                                    title="How is this calculated?"
                                    aria-label="Open Strict Runway explanation"
                                >
                                    ?
                                </button>
                            </div>
                            <div className="hero-value-apocalipse">
                                {realisticRunway.loading ? <span className="skeleton-text"></span> : realisticRunway.value}
                            </div>
                            <span className="hero-subtext-apocalipse">
                                {realisticRunway.details}
                            </span>
                            {!realisticRunway.loading && (() => {
                                const burn = realisticRunway.raw?.monthlyBurn || 0;
                                const runwayMonths = burn > 0 ? realisticRunway.wealth / burn : Infinity;
                                if (runwayMonths >= 6) {
                                    return (
                                        <div className="survival-status-apocalipse survival-safe-apocalipse">
                                            🛡️ You'll cruise through the apocalypse! Your emergency fund is solid enough to weather any storm.
                                        </div>
                                    );
                                } else if (runwayMonths >= 3) {
                                    return (
                                        <div className="survival-status-apocalipse survival-tight-apocalipse">
                                            ⚠️ You'll survive, but it'll be tight. The apocalypse will test your limits — start stacking supplies!
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div className="survival-status-apocalipse survival-zombie-apocalipse">
                                            🧟 You're about to join the zombie horde! Without more reserves, survival is not guaranteed...
                                        </div>
                                    );
                                }
                            })()}
                            {realisticRunway.daysRunway && !realisticRunway.isSafe && (
                                <div className="hero-badge-apocalipse">
                                    ⏳ ~{realisticRunway.daysRunway} left at avg spend
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 6. EXPLAINER MODAL */}
            {showRunwayInfo && createPortal((
                <div className="modal-overlay info-modal-overlay" onClick={() => { setShowRunwayInfo(false); setShowRunwayMath(false); }}>
                    <div className="modal-content info-modal" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => { setShowRunwayInfo(false); setShowRunwayMath(false); }}>×</button>

                        {showRunwayInfo === 'strict' ? (
                            <>
                                <h2>{showRunwayMath ? "Runway: The Math 🧮" : "How 'Runway' Works ⏳"}</h2>
                                <div className="info-content">
                                    {!showRunwayMath ? (
                                        <>
                                            <p>The <strong>Strict Runway</strong> is a worst-case stress-test: <em>how long could you survive if all income stopped today?</em></p>

                                            <div className="info-step">
                                                <h3>1. Global Net Worth</h3>
                                                <p>We calculate your total real wealth by adding: the <strong>Remaining Monthly Balance</strong> of all your added months + your total <strong>Savings</strong>.</p>
                                            </div>

                                            <div className="info-step">
                                                <h3>2. Monthly Burn Rate</h3>
                                                <p>We take your <strong>Current Salary</strong> from the latest Monthly Plan and subtract the <strong>Current Remaining Monthly Balance</strong> (Salary - All budgets). If no plan exists, we estimate by multiplying your <strong>current week's spending × 4</strong>.</p>
                                            </div>

                                            <div className="info-step">
                                                <h3>3. The Result</h3>
                                                <p>We divide your <strong>Net Worth</strong> by your <strong>Monthly Burn</strong> — assuming zero future income. This tells you exactly how many months you could survive.<br />
                                                    ≥ 3 months = <strong>Safe 🟢</strong> · under 3 months = <strong>Danger 🔴</strong>. If under 90 days, a countdown badge appears.</p>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="math-breakdown" style={{ background: 'rgba(0,0,0,0.03)', padding: '16px', borderRadius: '12px', marginTop: '12px' }}>
                                            <div style={{ marginBottom: '16px' }}>
                                                <h3 style={{ fontSize: '0.9rem', color: '#4B5563', marginBottom: '8px' }}>Total Cash Pile (Net Worth)</h3>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                                                    <span>+ Remaining Monthly Balances:</span> <span style={{ textAlign: 'right' }}>{formatCurrency(realisticRunway.raw?.accumulatedRemainingBalance || 0)}</span>
                                                    <span>+ Total Savings:</span> <span style={{ textAlign: 'right' }}>{formatCurrency(realisticRunway.raw?.totalSavings || 0)}</span>
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
                                            <p>The <strong>Financial Momentum</strong> card shows the monthly balance generated by your latest manual plan.</p>

                                            <div className="info-step">
                                                <h3>1. Base Month</h3>
                                                <p>We read your most recent month with <strong>source: manual</strong>. Propagated months are ignored so the card reflects the month you actually planned.</p>
                                            </div>

                                            <div className="info-step">
                                                <h3>2. Net Monthly Flow</h3>
                                                <p>We subtract your <strong>Total Budget</strong> from your <strong>Monthly Salary</strong>. Weekly categories are converted to their monthly equivalent before the total is calculated.</p>
                                            </div>

                                            <div className="info-step">
                                                <h3>3. Reading the Result</h3>
                                                <p>If the result is positive, the card shows how much you are adding per month. If it is negative, the card shows your monthly deficit. The amount is always displayed as <strong>AED/month</strong>.</p>
                                            </div>

                                            <div className="info-step">
                                                <h3>4. Projection Block</h3>
                                                <p>The projection underneath uses that same monthly flow together with your current net worth, so positive flow grows the projection and negative flow reduces it.</p>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="math-breakdown" style={{ background: 'rgba(0,0,0,0.03)', padding: '16px', borderRadius: '12px', marginTop: '12px' }}>
                                            <div style={{ marginBottom: '16px' }}>
                                                <h3 style={{ fontSize: '0.9rem', color: '#4B5563', marginBottom: '8px' }}>Net Monthly Flow</h3>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                                                    <span>+ Monthly Salary:</span> <span style={{ textAlign: 'right' }}>{formatCurrency(optimisticRunway.raw?.monthlyIncome || 0)}</span>
                                                    <span style={{ color: '#EF4444' }}>- Total Budget:</span> <span style={{ textAlign: 'right', color: '#EF4444' }}>{formatCurrency(optimisticRunway.raw?.totalBudgets || 0)}</span>
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
                                                    <h3 style={{ fontSize: '0.9rem', color: '#4B5563', marginBottom: '8px' }}>Deficit Projection</h3>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                                                        <span>Net Worth:</span> <span style={{ textAlign: 'right' }}>{formatCurrency(optimisticRunway.wealth || 0)}</span>
                                                        <span>+ (Net Flow × Months):</span> <span style={{ textAlign: 'right' }}>{formatCurrency((optimisticRunway.raw?.netMonthlyFlow || 0) * (Number(projectionMonths) || 1))}</span>
                                                        <div style={{ gridColumn: '1 / -1', height: '1px', background: '#D1D5DB', margin: '4px 0' }}></div>
                                                        <strong>= Future Wealth:</strong> <strong style={{ textAlign: 'right' }}>{formatCurrency((optimisticRunway.wealth || 0) + ((optimisticRunway.raw?.netMonthlyFlow || 0) * (Number(projectionMonths) || 1)))}</strong>
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
            ), document.body)}

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