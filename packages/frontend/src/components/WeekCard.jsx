import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Settings } from 'lucide-react';
import ExpenseList from './ExpenseList';
import { formatCurrency, calculateRemaining, getWeekRange, formatDate } from '../lib/utils';
import { useAuth } from '../lib/AuthContext';
import '../styles/WeekCard.css';

const WeekCard = ({ week, categories, onUpdateWeek, onGlobalAddExpense, weekNumber, totalWeeks, totalSavings, currentMonthSavings, onOpenAddExpense }) => {

    const handleDeleteExpense = (id) => {
        if (window.confirm("Are you sure you want to delete this expense?")) {
            const updatedExpenses = week.expenses.filter(e => e.id !== id);
            onUpdateWeek({ ...week, expenses: updatedExpenses });
        }
    };

    const { user, updatePreferences } = useAuth();
    const [viewMode, setViewMode] = useState('LATEST'); // 'LATEST' | custom tab string
    const [selectedCustomTabs, setSelectedCustomTabs] = useState(() => {
        if (user?.customTabs && Array.isArray(user.customTabs)) {
            return user.customTabs;
        }
        const saved = localStorage.getItem('weekCardCustomTabs');
        return saved ? JSON.parse(saved) : ['Market', 'Coffee', 'Savings'];
    });

    useEffect(() => {
        if (user?.customTabs && Array.isArray(user.customTabs)) {
            setSelectedCustomTabs(user.customTabs);
        }
    }, [user?.customTabs]);
    const [showTabEditor, setShowTabEditor] = useState(false);
    const popoverRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                setShowTabEditor(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getStatus = () => {
        if (!week.startDate || !week.endDate) return 'UNKNOWN';
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const start = new Date(week.startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(week.endDate);
        end.setHours(23, 59, 59, 999); // End of the day

        if (now < start) return 'UPCOMING';
        if (now > end) return 'COMPLETED';
        return 'ACTIVE';
    };

    const status = getStatus();

    const getCategoryData = (catName) => {
        if (!catName || catName === 'LATEST') return null;

        const cat = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
        const budget = cat ? (cat.budget || 0) : 0;
        const isWeekly = cat?.frequency === 'weekly';
        const lowerName = catName.toLowerCase();

        let label1, val1, label2, val2, val2Class;
        const catExpenses = week.expenses.filter(e => e.category.toLowerCase() === lowerName);
        const spent = catExpenses.reduce((acc, curr) => acc + curr.amount, 0);

        if (lowerName === 'savings' || lowerName === 'poupança') {
            label1 = 'Saved this month';
            val1 = budget + (currentMonthSavings || 0);
            label2 = 'Total saved';
            val2 = totalSavings || 0;
            val2Class = 'positive';
            return { label1, val1, label2, val2, val2Class, expenses: catExpenses };
        }

        let displayBudget = budget;
        if (lowerName === 'market' || lowerName === 'mercado') {
            displayBudget = isWeekly ? budget : budget / 4;
            label1 = 'Weekly Budget';
        } else if (lowerName === 'coffee' || lowerName === 'café') {
            displayBudget = budget;
            label1 = isWeekly ? 'Weekly Budget' : 'Monthly Budget';
        } else {
            // Default generic behavior
            displayBudget = isWeekly ? budget : budget / 4;
            label1 = isWeekly ? 'Weekly Budget' : 'Weekly Eq. Budget';
        }

        const remaining = displayBudget - spent;
        label2 = 'Remaining';
        val2 = remaining;
        val2Class = remaining < 0 ? 'negative' : 'positive';

        return { label1, val1: displayBudget, label2, val2, val2Class, expenses: catExpenses };
    };

    return (
        <div className={`week-card ${status.toLowerCase()}`}>
            <div className="card-header">
                <div className="header-info">
                    <h3 className="week-title">
                        {week.startDate && week.endDate
                            ? `${formatDate(week.startDate).slice(0, 5)} - ${formatDate(week.endDate).slice(0, 5)}`
                            : getWeekRange(week.startDate)
                        }
                    </h3>
                    {weekNumber && totalWeeks && (
                        <span className="week-number">
                            Week {weekNumber}/{totalWeeks}
                        </span>
                    )}
                    <span className={`week-status ${status.toLowerCase()}`}>{status}</span>
                </div>

                <div className="header-actions-weekcard" style={{ position: 'relative' }}>
                    {/* View Tabs */}
                    <div className="view-tabs">
                        <button
                            className={`view-tab ${viewMode === 'LATEST' ? 'active' : ''}`}
                            onClick={() => setViewMode('LATEST')}
                        >
                            Latest
                        </button>
                        {selectedCustomTabs.map(tab => (
                            <button
                                key={tab}
                                className={`view-tab ${viewMode === tab ? 'active' : ''}`}
                                onClick={() => setViewMode(tab)}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                    <button
                        className="edit-tabs-btn"
                        onClick={() => setShowTabEditor(!showTabEditor)}
                        title="Edit View Tabs"
                    >
                        <Settings size={18} />
                    </button>

                    {showTabEditor && (
                        <div className="tab-editor-popover" ref={popoverRef}>
                            <div className="tab-editor-header">
                                <h4>Select 3 Tabs</h4>
                                <span className="tab-count">{selectedCustomTabs.length}/3</span>
                            </div>
                            <div className="tab-editor-options">
                                {categories.map(c => (
                                    <label key={c.name} className="tab-option-label">
                                        <input
                                            type="checkbox"
                                            checked={selectedCustomTabs.includes(c.name)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    if (selectedCustomTabs.length >= 3) {
                                                        alert('You can only select up to 3 categories.');
                                                        return;
                                                    }
                                                    const newTabs = [...selectedCustomTabs, c.name];
                                                    setSelectedCustomTabs(newTabs);
                                                    localStorage.setItem('weekCardCustomTabs', JSON.stringify(newTabs));
                                                    updatePreferences({ customTabs: newTabs });
                                                } else {
                                                    const newTabs = selectedCustomTabs.filter(t => t !== c.name);
                                                    setSelectedCustomTabs(newTabs);
                                                    localStorage.setItem('weekCardCustomTabs', JSON.stringify(newTabs));
                                                    updatePreferences({ customTabs: newTabs });
                                                    if (viewMode === c.name) setViewMode('LATEST');
                                                }
                                            }}
                                        />
                                        <span>{c.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="card-content">
                {viewMode === 'LATEST' ? (
                    <ExpenseList expenses={week.expenses} onDelete={handleDeleteExpense} />
                ) : (
                    (() => {
                        const data = getCategoryData(viewMode);
                        if (!data) return <ExpenseList expenses={week.expenses} onDelete={handleDeleteExpense} />;

                        return (
                            <div className="supermarket-view">
                                <div className="supermarket-summary">
                                    <div className="summary-item">
                                        <span className="label">{data.label1}</span>
                                        <span className="value">{formatCurrency(data.val1)}</span>
                                    </div>
                                    <div className="summary-item main">
                                        <span className="label">{data.label2}</span>
                                        <span className={`value ${data.val2Class}`}>
                                            {formatCurrency(data.val2)}
                                        </span>
                                    </div>
                                </div>
                                <ExpenseList expenses={data.expenses} onDelete={handleDeleteExpense} />
                            </div>
                        );
                    })()
                )}
            </div>

            <motion.button
                className="add-expense-btn"
                onClick={onOpenAddExpense}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
            >
                <Plus size={32} />
            </motion.button>
        </div>
    );
};

export default WeekCard;
