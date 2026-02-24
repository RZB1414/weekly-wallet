import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import ExpenseList from './ExpenseList';
import { formatCurrency, calculateRemaining, getWeekRange, formatDate } from '../lib/utils';
import '../styles/WeekCard.css';

const WeekCard = ({ week, categories, onUpdateWeek, onGlobalAddExpense, weekNumber, totalWeeks, totalSavings, currentMonthSavings, onOpenAddExpense }) => {

    const handleDeleteExpense = (id) => {
        if (window.confirm("Are you sure you want to delete this expense?")) {
            const updatedExpenses = week.expenses.filter(e => e.id !== id);
            onUpdateWeek({ ...week, expenses: updatedExpenses });
        }
    };

    const [viewMode, setViewMode] = useState('LATEST'); // 'LATEST' | 'MARKET'

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

    // Market Logic
    const marketCategory = categories.find(c => c.name.toLowerCase() === 'market' || c.name.toLowerCase() === 'mercado');
    // Calculate Budget based on Frequency
    const marketBudget = marketCategory ? (marketCategory.budget || 0) : 0;
    const isMarketWeekly = marketCategory?.frequency === 'weekly';
    const weeklyMarketBudget = isMarketWeekly ? marketBudget : marketBudget / 4;

    // Calculate spent specific to market
    const marketExpenses = week.expenses.filter(e =>
        e.category.toLowerCase() === 'market' || e.category.toLowerCase() === 'mercado'
    );
    const marketSpent = marketExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const marketRemaining = weeklyMarketBudget - marketSpent;

    // Coffee Logic
    const coffeeCategory = categories.find(c => c.name.toLowerCase() === 'coffee' || c.name.toLowerCase() === 'café');
    const coffeeBudget = coffeeCategory ? (coffeeCategory.budget || 0) : 0;
    const isCoffeeWeekly = coffeeCategory?.frequency === 'weekly';

    // For Coffee, we display the defined budget (whether weekly or monthly)
    // If Weekly, we compare match weekly spend to weekly budget.
    // If Monthly, we compare weekly spend to monthly budget (legacy behavior preserved).
    const displayCoffeeBudget = coffeeBudget;

    const coffeeExpenses = week.expenses.filter(e =>
        e.category.toLowerCase() === 'coffee' || e.category.toLowerCase() === 'café'
    );
    const coffeeSpent = coffeeExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const coffeeRemaining = displayCoffeeBudget - coffeeSpent;

    // Savings Logic
    const savingsCategory = categories.find(c => c.name.toLowerCase() === 'savings' || c.name.toLowerCase() === 'poupança');
    const monthlySavingsBudget = savingsCategory ? (savingsCategory.budget || 0) : 0;

    const savingsExpenses = week.expenses.filter(e =>
        e.category.toLowerCase() === 'savings' || e.category.toLowerCase() === 'poupança'
    );
    const savingsSpent = savingsExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const savingsRemaining = monthlySavingsBudget - savingsSpent;

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

                <div className="header-actions-weekcard">
                    {/* View Tabs */}
                    <div className="view-tabs">
                        <button
                            className={`view-tab ${viewMode === 'LATEST' ? 'active' : ''}`}
                            onClick={() => setViewMode('LATEST')}
                        >
                            Latest
                        </button>
                        <button
                            className={`view-tab ${viewMode === 'MARKET' ? 'active' : ''}`}
                            onClick={() => setViewMode('MARKET')}
                        >
                            Market
                        </button>
                        <button
                            className={`view-tab ${viewMode === 'COFFEE' ? 'active' : ''}`}
                            onClick={() => setViewMode('COFFEE')}
                        >
                            Coffee
                        </button>
                        <button
                            className={`view-tab ${viewMode === 'SAVINGS' ? 'active' : ''}`}
                            onClick={() => setViewMode('SAVINGS')}
                        >
                            Savings
                        </button>
                    </div>
                </div>
            </div>

            <div className="card-content">
                {viewMode === 'LATEST' && (
                    <ExpenseList expenses={week.expenses} onDelete={handleDeleteExpense} />
                )}

                {viewMode === 'MARKET' && (
                    <div className="supermarket-view">
                        <div className="supermarket-summary">
                            <div className="summary-item">
                                <span className="label">Weekly Budget</span>
                                <span className="value">{formatCurrency(weeklyMarketBudget)}</span>
                            </div>
                            <div className="summary-item main">
                                <span className="label">Remaining</span>
                                <span className={`value ${marketRemaining < 0 ? 'negative' : 'positive'}`}>
                                    {formatCurrency(marketRemaining)}
                                </span>
                            </div>
                        </div>
                        <ExpenseList expenses={marketExpenses} onDelete={handleDeleteExpense} />
                    </div>
                )}

                {viewMode === 'COFFEE' && (
                    <div className="supermarket-view">
                        <div className="supermarket-summary">
                            <div className="summary-item">
                                <span className="label">{isCoffeeWeekly ? 'Weekly Budget' : 'Monthly Budget'}</span>
                                <span className="value">{formatCurrency(displayCoffeeBudget)}</span>
                            </div>
                            <div className="summary-item main">
                                <span className="label">Remaining</span>
                                <span className={`value ${coffeeRemaining < 0 ? 'negative' : 'positive'}`}>
                                    {formatCurrency(coffeeRemaining)}
                                </span>
                            </div>
                        </div>
                        <ExpenseList expenses={coffeeExpenses} onDelete={handleDeleteExpense} />
                    </div>
                )}

                {viewMode === 'SAVINGS' && (
                    <div className="supermarket-view">
                        <div className="supermarket-summary">
                            <div className="summary-item">
                                <span className="label">Saved this month</span>
                                <span className="value">{formatCurrency((monthlySavingsBudget || 0) + (currentMonthSavings || 0))}</span>
                            </div>
                            <div className="summary-item main">
                                <span className="label">Total saved</span>
                                <span className={`value positive`}>
                                    {formatCurrency(totalSavings || 0)}
                                </span>
                            </div>
                        </div>
                        <ExpenseList expenses={savingsExpenses} onDelete={handleDeleteExpense} />
                    </div>
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
