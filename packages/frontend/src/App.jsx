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

    // Initial Load
    useEffect(() => {
        const loadData = async () => {
            try {
                const data = await api.getWeeks();
                if (data.weeks && data.weeks.length > 0) {
                    setWeeks(data.weeks);
                } else {
                    // Initialize with current week if empty
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
        // Logic to create next week based on last week
        const lastWeek = weeks[weeks.length - 1];
        const lastDate = new Date(lastWeek.startDate);
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + 7);

        const newWeek = {
            id: getWeekId(nextDate),
            startDate: nextDate.toISOString(),
            initialBalance: lastWeek.initialBalance, // Carry over budget setting? or 0? keeping setting.
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
                />
            )}
        </div>
    );
};

export default App;
