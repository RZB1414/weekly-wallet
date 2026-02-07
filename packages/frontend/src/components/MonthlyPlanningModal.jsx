import React, { useState, useEffect } from 'react';
import '../styles/MonthlyPlanning.css';
import { api } from '../lib/api';

const MonthlyPlanningModal = ({ isOpen, onClose }) => {
    const [categories, setCategories] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [newCategory, setNewCategory] = useState('');
    const [newExpenseName, setNewExpenseName] = useState('');
    const [newExpenseAmount, setNewExpenseAmount] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    useEffect(() => {
        if (isOpen && !isDataLoaded) {
            loadData();
        }
    }, [isOpen]);

    const loadData = async () => {
        try {
            const data = await api.getMonthlyPlanning();
            setCategories(data.categories || []);
            setExpenses(data.expenses || []);
            setIsDataLoaded(true);
        } catch (error) {
            console.error("Failed to load monthly planning", error);
        }
    };

    const saveData = async (updatedCategories, updatedExpenses) => {
        try {
            await api.saveMonthlyPlanning({
                categories: updatedCategories,
                expenses: updatedExpenses
            });
        } catch (error) {
            console.error("Failed to save", error);
        }
    };

    const handleAddCategory = () => {
        if (!newCategory.trim()) return;
        const updatedCategories = [...categories, newCategory.trim()];
        setCategories(updatedCategories);
        setNewCategory('');
        saveData(updatedCategories, expenses);

        // Auto select if it's the first category
        if (!selectedCategory) {
            setSelectedCategory(newCategory.trim());
        }
    };

    const handleAddExpense = () => {
        if (!newExpenseName.trim() || !newExpenseAmount || !selectedCategory) return;

        const newExpense = {
            id: Date.now(),
            name: newExpenseName.trim(),
            amount: parseFloat(newExpenseAmount),
            category: selectedCategory,
            completed: false
        };

        const updatedExpenses = [...expenses, newExpense];
        setExpenses(updatedExpenses);
        setNewExpenseName('');
        setNewExpenseAmount('');
        saveData(categories, updatedExpenses);
    };

    const toggleExpense = (id) => {
        const updatedExpenses = expenses.map(exp =>
            exp.id === id ? { ...exp, completed: !exp.completed } : exp
        );
        setExpenses(updatedExpenses);
        saveData(categories, updatedExpenses);
    };

    const deleteExpense = (id) => {
        const updatedExpenses = expenses.filter(exp => exp.id !== id);
        setExpenses(updatedExpenses);
        saveData(categories, updatedExpenses);
    };

    const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const paidAmount = expenses.filter(exp => exp.completed).reduce((sum, exp) => sum + exp.amount, 0);
    const remainingAmount = totalAmount - paidAmount;

    if (!isOpen) return null;

    return (
        <div className="monthly-planning-overlay" onClick={onClose}>
            <div className="monthly-planning-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Monthly Planning</h2>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>

                <div className="modal-content">
                    {/* Add Expense Form */}
                    <div className="add-item-form">
                        <input
                            type="text"
                            placeholder="Expense Name"
                            value={newExpenseName}
                            onChange={e => setNewExpenseName(e.target.value)}
                            className="add-item-input"
                        />
                        <input
                            type="number"
                            placeholder="Amount"
                            value={newExpenseAmount}
                            onChange={e => setNewExpenseAmount(e.target.value)}
                            className="add-item-input"
                            style={{ maxWidth: '80px' }}
                        />
                        <select
                            value={selectedCategory}
                            onChange={e => setSelectedCategory(e.target.value)}
                            className="category-select"
                        >
                            <option value="" disabled>Category</option>
                            {categories.map((cat, index) => (
                                <option key={index} value={cat}>{cat}</option>
                            ))}
                        </select>
                        <button className="add-btn" onClick={handleAddExpense}>+</button>
                    </div>

                    {/* Expense List */}
                    <ul className="expense-list">
                        {expenses.map(expense => (
                            <li key={expense.id} className="expense-item">
                                <div className="expense-details">
                                    <input
                                        type="checkbox"
                                        className="expense-checkbox"
                                        checked={expense.completed}
                                        onChange={() => toggleExpense(expense.id)}
                                    />
                                    <div>
                                        <span className="expense-name" style={{
                                            textDecoration: expense.completed ? 'line-through' : 'none',
                                            color: expense.completed ? '#666' : '#fff'
                                        }}>
                                            {expense.name}
                                        </span>
                                        <span className="expense-category">{expense.category}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span className="expense-amount">
                                        R$ {expense.amount.toFixed(2)}
                                    </span>
                                    <button
                                        className="delete-btn"
                                        onClick={() => deleteExpense(expense.id)}
                                    >
                                        &times;
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>

                    {/* Add Category Section */}
                    <div className="add-category-section">
                        <div className="add-category-form">
                            <input
                                type="text"
                                placeholder="New Category"
                                value={newCategory}
                                onChange={e => setNewCategory(e.target.value)}
                                className="add-item-input"
                            />
                            <button className="add-btn" onClick={handleAddCategory}>Add Cat</button>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="summary-row">
                        <span>Paid</span>
                        <span>R$ {paidAmount.toFixed(2)}</span>
                    </div>
                    <div className="summary-row">
                        <span>Remaining</span>
                        <span>R$ {remainingAmount.toFixed(2)}</span>
                    </div>
                    <div className="summary-row total">
                        <span>Total Projected</span>
                        <span>R$ {totalAmount.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MonthlyPlanningModal;
