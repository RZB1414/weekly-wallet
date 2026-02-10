import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import ExpenseList from './ExpenseList';
import AddExpenseModal from './AddExpenseModal';
import { formatCurrency, calculateRemaining, getWeekRange, formatDate } from '../lib/utils';
import '../styles/WeekCard.css';

const WeekCard = ({ week, categories, onUpdateWeek, onGlobalAddExpense, weekNumber, totalWeeks }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);



    const handleAddExpense = (expense) => {
        if (onGlobalAddExpense) {
            onGlobalAddExpense(expense);
        } else {
            // Fallback for isolated testing or legacy
            const updatedExpenses = [expense, ...week.expenses];
            onUpdateWeek({ ...week, expenses: updatedExpenses });
        }
    };

    const handleDeleteExpense = (id) => {
        const updatedExpenses = week.expenses.filter(e => e.id !== id);
        onUpdateWeek({ ...week, expenses: updatedExpenses });
    };



    const [viewMode, setViewMode] = useState('LATEST'); // 'LATEST' | 'SUPERMARKET'

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

    // Supermarket Logic
    const supermarketCategory = categories.find(c => c.name.toLowerCase() === 'supermarket' || c.name.toLowerCase() === 'mercado');
    // Note: Category object from MonthlyPlanning uses 'budget', but we fallback to 0 safely
    const monthlySupermarketBudget = supermarketCategory ? (supermarketCategory.budget || 0) : 0;
    const weeklySupermarketBudget = monthlySupermarketBudget / 4;

    // Calculate spent specific to supermarket
    const supermarketExpenses = week.expenses.filter(e =>
        e.category.toLowerCase() === 'supermarket' || e.category.toLowerCase() === 'mercado'
    );
    const supermarketSpent = supermarketExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const supermarketRemaining = weeklySupermarketBudget - supermarketSpent;

    // Coffee Logic
    const coffeeCategory = categories.find(c => c.name.toLowerCase() === 'coffee' || c.name.toLowerCase() === 'café');
    const monthlyCoffeeBudget = coffeeCategory ? (coffeeCategory.budget || 0) : 0;
    // const weeklyCoffeeBudget = monthlyCoffeeBudget / 4; // Use full monthly budget as requested

    const coffeeExpenses = week.expenses.filter(e =>
        e.category.toLowerCase() === 'coffee' || e.category.toLowerCase() === 'café'
    );
    const coffeeSpent = coffeeExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const coffeeRemaining = monthlyCoffeeBudget - coffeeSpent; // Calculate against monthly budget

    return (
        <div className={`week-card ${status.toLowerCase()}`}>
            <div className="card-header">
                <div>
                    <h3 className="week-title">
                        {week.startDate && week.endDate
                            ? `${formatDate(week.startDate).slice(0, 5)} - ${formatDate(week.endDate).slice(0, 5)}`
                            : getWeekRange(week.startDate)
                        }
                    </h3>
                    {weekNumber && totalWeeks && (
                        <span style={{ fontSize: '0.8rem', opacity: 0.7, marginLeft: '0.5rem' }}>
                            Week {weekNumber} of {totalWeeks}
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                    <span className={`week-status ${status.toLowerCase()}`}>{status}</span>

                    {/* View Tabs */}
                    <div className="view-tabs">
                        <button
                            className={`view-tab ${viewMode === 'LATEST' ? 'active' : ''}`}
                            onClick={() => setViewMode('LATEST')}
                        >
                            Latest
                        </button>
                        <button
                            className={`view-tab ${viewMode === 'SUPERMARKET' ? 'active' : ''}`}
                            onClick={() => setViewMode('SUPERMARKET')}
                        >
                            Supermarket
                        </button>
                        <button
                            className={`view-tab ${viewMode === 'COFFEE' ? 'active' : ''}`}
                            onClick={() => setViewMode('COFFEE')}
                        >
                            Coffee
                        </button>
                    </div>
                </div>
            </div>

            <div className="card-content">
                {viewMode === 'LATEST' && (
                    <ExpenseList expenses={week.expenses} onDelete={handleDeleteExpense} />
                )}

                {viewMode === 'SUPERMARKET' && (
                    <div className="supermarket-view">
                        <div className="supermarket-summary">
                            <div className="summary-item">
                                <span className="label">Weekly Budget</span>
                                <span className="value">{formatCurrency(weeklySupermarketBudget)}</span>
                            </div>
                            <div className="summary-item main">
                                <span className="label">Remaining</span>
                                <span className={`value ${supermarketRemaining < 0 ? 'negative' : 'positive'}`}>
                                    {formatCurrency(supermarketRemaining)}
                                </span>
                            </div>
                        </div>
                        <ExpenseList expenses={supermarketExpenses} onDelete={handleDeleteExpense} />
                    </div>
                )}

                {viewMode === 'COFFEE' && (
                    <div className="supermarket-view">
                        <div className="supermarket-summary">
                            <div className="summary-item">
                                <span className="label">Monthly Budget</span>
                                <span className="value">{formatCurrency(monthlyCoffeeBudget)}</span>
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
            </div>

            <motion.button
                className="add-expense-btn"
                onClick={() => setIsModalOpen(true)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
            >
                <Plus size={32} />
            </motion.button>

            <AddExpenseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAdd={handleAddExpense}
                categories={categories.map(c => c.name)} // Pass strings to modal
            />
        </div>
    );
};

export default WeekCard;
