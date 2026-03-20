import React from 'react';
import { motion } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';
import '../styles/ExpenseList.css';

const ExpenseList = ({ expenses, onDelete, onEdit }) => {
    const sortedExpenses = [...expenses].sort((leftExpense, rightExpense) => {
        const leftDate = new Date(leftExpense.date).getTime();
        const rightDate = new Date(rightExpense.date).getTime();

        if (leftDate !== rightDate) {
            return rightDate - leftDate;
        }

        return (rightExpense.id || '').localeCompare(leftExpense.id || '');
    });

    return (
        <div className="expense-list-container">
            {expenses.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                    No records found in databanks.
                </div>
            ) : (
                sortedExpenses.map((expense, index) => (
                    <motion.div
                        key={expense.id}
                        className="expense-item"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                    >
                        <div className="expense-info">
                            <h4>{expense.name}</h4>
                            <span className="expense-date">{formatDate(expense.date)}</span>
                            <span className="expense-category-label">{expense.category || 'Uncategorized'}</span>
                        </div>
                        <div className="expense-actions">
                            <span className={`expense-amount ${expense.type === 'credit' ? 'credit-amount' : ''}`}>
                                {expense.type === 'credit' ? '+' : '-'} {formatCurrency(expense.amount)}
                            </span>
                            <button
                                className="btn-edit"
                                onClick={() => onEdit?.(expense)}
                                aria-label="Edit expense"
                            >
                                <Pencil size={16} />
                            </button>
                            <button
                                className="btn-delete"
                                onClick={() => onDelete(expense.id)}
                                aria-label="Delete expense"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </motion.div>
                ))
            )}
        </div>
    );
};

export default ExpenseList;
