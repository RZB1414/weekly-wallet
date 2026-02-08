import React, { useState, useEffect } from 'react';
import WeekCarousel from './components/WeekCarousel';
import { api } from './lib/api';
import { getWeekId } from './lib/utils';
import './styles/App.css';

import MonthlyPlanningModal from './components/MonthlyPlanningModal';

const App = () => {
    const [weeks, setWeeks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMonthlyPlanningOpen, setIsMonthlyPlanningOpen] = useState(false);
    const [activeCategories, setActiveCategories] = useState([]);

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

                // Load Current Month Categories for Dropdowns
                const now = new Date();
                const plan = await api.getMonthlyPlanning(now.getFullYear(), now.getMonth() + 1);
                if (plan && plan.categories) {
                    // Extract just categories if they are objects, or use them if strings
                    const cats = plan.categories.map(c => typeof c === 'string' ? c : c.name);
                    setActiveCategories(cats);
                }

            } catch (error) {
                console.error("Failed to load data", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // Sync to Backend whenever weeks change
    useEffect(() => {
        if (!loading && weeks.length > 0) {
            const timeout = setTimeout(() => {
                api.saveWeeks(weeks);
            }, 1000); // Debounce save
            return () => clearTimeout(timeout);
        }
    }, [weeks, loading]);

    const handleUpdateWeek = (index, updatedWeek) => {
        const newWeeks = [...weeks];
        newWeeks[index] = updatedWeek;
        setWeeks(newWeeks);
    };

    const handleCreateWeek = () => {
        const lastWeek = weeks[weeks.length - 1];
        const lastDate = new Date(lastWeek.startDate);
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + 7);

        const newWeek = {
            id: getWeekId(nextDate),
            startDate: nextDate.toISOString(),
            initialBalance: lastWeek.initialBalance,
            expenses: []
        };

        setWeeks([...weeks, newWeek]);
    };

    if (loading) {
        return <div className="loading-screen">INITIALIZING HYPERDRIVE...</div>;
    }

    return (
        <div className="app-container">
            <WeekCarousel
                weeks={weeks}
                categories={activeCategories}
                onUpdateWeek={handleUpdateWeek}
                onCreateWeek={handleCreateWeek}
            />

            <button
                className="monthly-planning-btn"
                onClick={() => setIsMonthlyPlanningOpen(true)}
            >
                Monthly Planning
            </button>

            {isMonthlyPlanningOpen && (
                <MonthlyPlanningModal
                    isOpen={isMonthlyPlanningOpen}
                    onClose={() => setIsMonthlyPlanningOpen(false)}
                    weeks={weeks} // Pass weeks data for calculation
                />
            )}
        </div>
    );
};

export default App;
