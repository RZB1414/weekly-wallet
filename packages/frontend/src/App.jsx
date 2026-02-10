import React, { useState, useEffect } from 'react';
import WeekCarousel from './components/WeekCarousel';
import { api } from './lib/api';
import { getWeekId, getMonthQuarters, findCurrentWeekIndex, getFinancialInfo } from './lib/utils';
import './styles/App.css';

import MonthlyPlanningModal from './components/MonthlyPlanningModal';

const App = () => {
    const [weeks, setWeeks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMonthlyPlanningOpen, setIsMonthlyPlanningOpen] = useState(false);
    const [activeCategories, setActiveCategories] = useState([]);

    // Date Filter State
    const currentDate = new Date();
    // If today is 26th or later, we consider it the NEXT month's cycle
    // e.g., Jan 26 -> February Cycle
    const initialMonth = currentDate.getDate() >= 26 ? currentDate.getMonth() + 2 : currentDate.getMonth() + 1;
    // Handle Year rollover (Dec 26 -> Month 13 -> Jan Next Year)
    const initialYear = initialMonth > 12 ? currentDate.getFullYear() + 1 : currentDate.getFullYear();
    const normalizedMonth = initialMonth > 12 ? 1 : initialMonth;

    const [selectedMonth, setSelectedMonth] = useState(normalizedMonth); // 1-12
    const [selectedYear, setSelectedYear] = useState(initialYear);

    // Initial Load
    useEffect(() => {
        const loadData = async () => {
            try {
                // Load Weeks
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
    }, []);

    // Load Categories for Selected Month (syncs Budget view)
    useEffect(() => {
        const loadPlanning = async () => {
            try {
                const plan = await api.getMonthlyPlanning(selectedYear, selectedMonth);
                if (plan && plan.categories) {
                    const cats = plan.categories.map(c => typeof c === 'string' ? { name: c, budget: 0 } : c);
                    setActiveCategories(cats);
                } else {
                    setActiveCategories([]);
                }
            } catch (error) {
                console.error("Failed to load planning", error);
                setActiveCategories([]);
            }
        };
        loadPlanning();
    }, [selectedYear, selectedMonth]);

    // Sync to Backend whenever weeks change
    useEffect(() => {
        if (!loading && weeks.length > 0) {
            const timeout = setTimeout(() => {
                api.saveWeeks(weeks);
            }, 1000); // Debounce save
            return () => clearTimeout(timeout);
        }
    }, [weeks, loading]);

    const handleUpdateWeek = (updatedWeek) => {
        // We need to find the correct index in the MAIN weeks array
        // If the week exists (by ID), update it.
        // If it DOESN'T exist (newly generated Quarter), add it.

        const existingIndex = weeks.findIndex(w => w.id === updatedWeek.id);

        if (existingIndex !== -1) {
            const newWeeks = [...weeks];
            newWeeks[existingIndex] = updatedWeek;
            setWeeks(newWeeks);
        } else {
            // New week (e.g. first interaction with a Quarter)
            setWeeks([...weeks, updatedWeek]);
        }
    };

    const handleGlobalAddExpense = (expense) => {
        // 1. Determine which week this expense belongs to
        const { quarter } = getFinancialInfo(expense.date);
        const targetWeekId = quarter.id;

        // 2. Find if this week exists in our state
        const existingWeek = weeks.find(w => w.id === targetWeekId);

        let targetWeek;

        if (existingWeek) {
            targetWeek = { ...existingWeek };
        } else {
            // Create new week if it doesn't exist (e.g. jumping to future/past date)
            targetWeek = {
                id: targetWeekId,
                startDate: quarter.start,
                endDate: quarter.end,
                initialBalance: 0,
                expenses: [],
                isQuarter: true
            };
        }

        // 3. Add Expense
        const updatedExpenses = [expense, ...targetWeek.expenses];
        const updatedWeek = { ...targetWeek, expenses: updatedExpenses };

        // 4. Update State
        handleUpdateWeek(updatedWeek);
    };

    const handleCreateWeek = () => {
        // When user clicks "Next" on the last week of the current month, 
        // we simply switch to the NEXT month.
        // The 'displayedWeeks' logic will automatically generate/load the weeks for that new month.

        let nextMonth = selectedMonth + 1;
        let nextYear = selectedYear;

        if (nextMonth > 12) {
            nextMonth = 1;
            nextYear += 1;
        }

        setSelectedMonth(nextMonth);
        setSelectedYear(nextYear);
    };

    // State for Carousel Index
    const [activeIndex, setActiveIndex] = useState(0);

    // Filter & Generate Logic
    // Instead of filtering by date (which fails for 26th overlap), we generate the expected 4 quarters
    // and find their data in the state.
    const displayedWeeks = React.useMemo(() => {
        if (loading) return [];

        const quarters = getMonthQuarters(selectedYear, selectedMonth);

        return quarters.map(q => {
            // Check if we have data for this Quarter ID
            // We look for ID match first
            const existing = weeks.find(w => w.id === q.id);
            if (existing) {
                // Ensure the display dates (start/end) match the quarter definition
                // just in case they drifted or were legacy. 
                // Actually, let's just use existing data but override dates for display if needed?
                // No, rely on 'existing' being correct if it was created with this ID.
                return { ...existing, startDate: q.start, endDate: q.end };
            }

            // If not found by ID, maybe check if we have a legacy week with same start date?
            // (Optional migration step, skip for now to keep it clean)

            // Return a placeholder structure for the new Quarter
            return {
                id: q.id,
                startDate: q.start,
                endDate: q.end,
                initialBalance: 0,
                expenses: [],
                isQuarter: true // FLag
            };
        });
    }, [weeks, selectedYear, selectedMonth, loading]);

    // Reset index when displayedWeeks (month/year) changes
    useEffect(() => {
        if (displayedWeeks.length > 0) {
            // If "Today" is in the new list, jump to it. Otherwise start at 0.
            const idx = findCurrentWeekIndex(displayedWeeks);
            setActiveIndex(idx);
        } else {
            setActiveIndex(0);
        }
    }, [displayedWeeks]); // This ensures "Month Switching" resets the view correctly

    const getMonthName = (m) => new Date(0, m - 1).toLocaleString('default', { month: 'long' });

    if (loading) {
        return <div className="loading-screen">INITIALIZING HYPERDRIVE...</div>;
    }

    return (
        <div className="app-container">
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
                onGlobalAddExpense={handleGlobalAddExpense} // Pass global handler
                onCreateWeek={handleCreateWeek}
                activeIndex={activeIndex}
                onIndexChange={setActiveIndex}
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
                weeks={weeks} // Pass ALL weeks data for calculation, not just filtered
                onUpdateWeeks={setWeeks} // Allow modal to update weeks (e.g. cascade delete)
                onPlanSave={(year, month, categories) => {
                    // If we updated the CURRENTLY VIEWED month, update our active categories for correct budget calculation
                    if (year === selectedYear && month === selectedMonth) {
                        setActiveCategories(categories);
                    }
                }}
            />

            {/* Floating "Go to Current" Button */}
            {/* Show if:
                1. Not viewing correct Month/Year
                OR
                2. Viewing correct Month/Year BUT looking at wrong Index (not Today's week)
            */}
            {(() => {
                const isCorrectMonth = selectedMonth === normalizedMonth && selectedYear === initialYear;
                const currentWeekIdx = isCorrectMonth ? findCurrentWeekIndex(displayedWeeks) : -1;
                // Note: findCurrentWeekIndex returns 0 if not found, but if we are in correct month, it SHOULD be found or match 0.

                // If we are in correct month, show button only if activeIndex != logic's idea of current
                const showButton = !isCorrectMonth || (isCorrectMonth && activeIndex !== currentWeekIdx);

                if (!showButton) return null;

                return (
                    <button
                        onClick={() => {
                            if (!isCorrectMonth) {
                                setSelectedMonth(normalizedMonth);
                                setSelectedYear(initialYear);
                            } else {
                                // Just snap to index
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
                        <span>🚀</span> Current Week
                    </button>
                );
            })()}
        </div>
    );
};

export default App;
