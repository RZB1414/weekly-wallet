import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import ExpenseList from './ExpenseList';
import AddExpenseModal from './AddExpenseModal';
import { formatCurrency, calculateRemaining, getWeekRange } from '../lib/utils';
import '../styles/WeekCard.css';

const WeekCard = ({ week, categories, onUpdateWeek }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const remaining = calculateRemaining(week.initialBalance, week.expenses);
    const isLow = remaining < 0; // Simple logic: negative is low/bad

    const handleAddExpense = (expense) => {
        const updatedExpenses = [expense, ...week.expenses];
        onUpdateWeek({ ...week, expenses: updatedExpenses });
    };

    const handleDeleteExpense = (id) => {
        const updatedExpenses = week.expenses.filter(e => e.id !== id);
        onUpdateWeek({ ...week, expenses: updatedExpenses });
    };

    const handleBalanceChange = (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
            onUpdateWeek({ ...week, initialBalance: val });
        }
    };

    return (
        <div className="week-card">
            <div className="card-header">
                <h3 className="week-title">{getWeekRange(week.startDate)}</h3>
                <span className="week-status">ACTIVE</span>
            </div>

            <div className="balance-section">
                <div className="balance-label">REMAINING CREDITS</div>
                <div className={`balance-amount ${isLow ? 'low' : 'positive'}`}>
                    {formatCurrency(remaining)}
                </div>
                <div style={{ marginTop: '0.5rem', opacity: 0.7 }}>
                    <span>Initial: </span>
                    <input
                        className="initial-balance-input"
                        type="number"
                        value={week.initialBalance}
                        onChange={handleBalanceChange}
                    />
                </div>
            </div>

            <div className="card-content">
                <ExpenseList expenses={week.expenses} onDelete={handleDeleteExpense} />
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
                categories={categories}
            />
        </div>
    );
};

export default WeekCard;
