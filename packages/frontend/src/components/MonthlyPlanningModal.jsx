import React, { useState, useEffect } from 'react';
import '../styles/MonthlyPlanning.css';
import { api } from '../lib/api';

const MonthlyPlanningModal = ({ isOpen, onClose }) => {
    const [categories, setCategories] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [salary, setSalary] = useState(0);
    const [salaryInput, setSalaryInput] = useState('');

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
            setSalary(data.salary || 0);
            setSalaryInput(data.salary ? data.salary.toString() : '');
            setIsDataLoaded(true);
        } catch (error) {
            console.error("Failed to load monthly planning", error);
        }
    };

    const saveData = async (updatedCategories, updatedExpenses, updatedSalary) => {
        try {
            await api.saveMonthlyPlanning({
                categories: updatedCategories,
                expenses: updatedExpenses,
                salary: updatedSalary
            });
        } catch (error) {
            console.error("Failed to save", error);
        }
    };

    const handleSaveSalary = () => {
        const salaryValue = parseFloat(salaryInput);
        if (!isNaN(salaryValue)) {
            setSalary(salaryValue);
            saveData(categories, expenses, salaryValue);
        }
    };

    const handleAddCategory = () => {
        if (!newCategory.trim()) return;
        const updatedCategories = [...categories, newCategory.trim()];
        setCategories(updatedCategories);
        setNewCategory('');
        saveData(updatedCategories, expenses, salary);

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
            category: selectedCategory
        };

        const updatedExpenses = [...expenses, newExpense];
        setExpenses(updatedExpenses);
        setNewExpenseName('');
        setNewExpenseAmount('');
        saveData(categories, updatedExpenses, salary);
    };

    const deleteExpense = (id) => {
        const updatedExpenses = expenses.filter(exp => exp.id !== id);
        setExpenses(updatedExpenses);
        saveData(categories, updatedExpenses, salary);
    };

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const remainingAmount = salary - totalExpenses;

    if (!isOpen) return null;

    return (
        <div className="monthly-planning-overlay" onClick={onClose}>
            <div className="monthly-planning-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Monthly Planning</h2>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>

                <div className="modal-content">
                    {/* Salary Input */}
                    <div className="salary-section">
                        <label>Monthly Budget / Salary</label>
                        <div className="salary-input-group">
                            <input
                                type="number"
                                value={salaryInput}
                                onChange={e => setSalaryInput(e.target.value)}
                                placeholder="Enter amount"
                                className="salary-input"
                            />
                            <button className="save-btn" onClick={handleSaveSalary}>Save</button>
                        </div>
                    </div>

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
                                    <div>
                                        <span className="expense-name" style={{ color: '#fff' }}>
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
                        <span>Available / Salary</span>
                        <span>R$ {salary.toFixed(2)}</span>
                    </div>
                    <div className="summary-row total">
                        <span>Total Expenses</span>
                        <span>R$ {totalExpenses.toFixed(2)}</span>
                    </div>
                    <div className="summary-row" style={{ color: remainingAmount >= 0 ? '#4caf50' : '#ff5252', fontWeight: 'bold' }}>
                        <span>Remaining</span>
                        <span>R$ {remainingAmount.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MonthlyPlanningModal;
