import React, { useState, useEffect } from 'react';
import '../styles/MonthlyPlanning.css';
import { api } from '../lib/api';

const MonthlyPlanningModal = ({ isOpen, onClose }) => {
    // Date State
    const currentDate = new Date();
    const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1); // 1-12

    // Data State
    const [categories, setCategories] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [salary, setSalary] = useState(0);
    const [salaryInput, setSalaryInput] = useState('');

    // UI State
    const [newCategory, setNewCategory] = useState('');
    const [newExpenseName, setNewExpenseName] = useState('');
    const [newExpenseAmount, setNewExpenseAmount] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen, selectedYear, selectedMonth]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await api.getMonthlyPlanning(selectedYear, selectedMonth);
            setCategories(data.categories || []);
            setExpenses(data.expenses || []);
            setSalary(data.salary || 0);
            setSalaryInput(data.salary ? data.salary.toString() : '');
        } catch (error) {
            console.error("Failed to load monthly planning", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            // Update salary from input before saving if changed
            const currentSalaryInput = parseFloat(salaryInput);
            const finalSalary = !isNaN(currentSalaryInput) ? currentSalaryInput : salary;

            await api.saveMonthlyPlanning(selectedYear, selectedMonth, {
                categories: categories,
                expenses: expenses,
                salary: finalSalary
            });
            setSalary(finalSalary);
            // Optional: Show success message/close
            // onClose(); // Uncomment if we want to close on save
        } catch (error) {
            console.error("Failed to save", error);
        } finally {
            setIsSaving(false);
        }
    };

    // Salary Input Handler (Just updates local state)
    const handleSalaryChange = (e) => {
        setSalaryInput(e.target.value);
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) setSalary(val);
        else setSalary(0);
    };

    const handleAddCategory = () => {
        if (!newCategory.trim()) return;
        const updatedCategories = [...categories, newCategory.trim()];
        setCategories(updatedCategories);
        setNewCategory('');

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
    };

    const deleteExpense = (id) => {
        const updatedExpenses = expenses.filter(exp => exp.id !== id);
        setExpenses(updatedExpenses);
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
                    {/* Date Selection */}
                    <div className="date-selection-section">
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="date-select"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
                            ))}
                        </select>
                        <input
                            type="number"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="date-input"
                        />
                    </div>

                    {isLoading ? (
                        <div className="loading-state">Loading...</div>
                    ) : (
                        <>
                            {/* Salary Input */}
                            <div className="salary-section">
                                <label>Monthly Budget / Salary</label>
                                <div className="salary-input-group">
                                    <input
                                        type="number"
                                        value={salaryInput}
                                        onChange={handleSalaryChange}
                                        placeholder="Enter amount"
                                        className="salary-input"
                                    />
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
                        </>
                    )}
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

                    <button
                        className="save-all-btn"
                        onClick={handleSaveAll}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Saving...' : 'Save Monthly Plan'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MonthlyPlanningModal;
