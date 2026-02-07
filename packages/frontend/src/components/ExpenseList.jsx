import React from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';
import '../styles/ExpenseList.css';

const ExpenseList = ({ expenses, onDelete }) => {
    return (
        <div className="expense-list-container">
            {expenses.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                    No records found in databanks.
                </div>
            ) : (
                expenses.map((expense, index) => (
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
                        </div>
                        <div className="expense-actions">
                            <span className="expense-amount">
                                - {formatCurrency(expense.amount)}
                            </span>
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
