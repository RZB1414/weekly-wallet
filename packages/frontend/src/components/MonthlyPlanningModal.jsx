import React, { useState, useEffect } from 'react';
import '../styles/MonthlyPlanning.css';
import { api } from '../lib/api';

const MonthlyPlanningModal = ({ isOpen, onClose }) => {
    // View State: 'LIST' | 'DETAIL'
    const [view, setView] = useState('LIST');
    const [isEditing, setIsEditing] = useState(false);
    const [availablePlans, setAvailablePlans] = useState([]);

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
            setView('LIST'); // Always start with list
            loadAvailablePlans();
        }
    }, [isOpen]);

    // Load detailed data when switching to DETAIL view
    useEffect(() => {
        if (isOpen && view === 'DETAIL') {
            loadData();
        }
    }, [isOpen, view, selectedYear, selectedMonth]);

    const loadAvailablePlans = async () => {
        setIsLoading(true);
        try {
            const data = await api.getMonthlyPlannings();
            setAvailablePlans(data.plans || []);
        } catch (error) {
            console.error("Failed to load plans list", error);
        } finally {
            setIsLoading(false);
        }
    };

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

    const handleCreateNew = () => {
        const now = new Date();
        setSelectedYear(now.getFullYear());
        setSelectedMonth(now.getMonth() + 1);
        setIsEditing(true);
        setView('DETAIL');
        // Reset data for new plan (though loadData will likely overwrite/clear it)
        setCategories([]);
        setExpenses([]);
        setSalary(0);
        setSalaryInput('');
    };

    const handlePlanClick = (year, month) => {
        setSelectedYear(year);
        setSelectedMonth(month);
        setIsEditing(false); // Read-only
        setView('DETAIL');
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            const currentSalaryInput = parseFloat(salaryInput);
            const finalSalary = !isNaN(currentSalaryInput) ? currentSalaryInput : salary;

            await api.saveMonthlyPlanning(selectedYear, selectedMonth, {
                categories: categories,
                expenses: expenses,
                salary: finalSalary
            });
            setSalary(finalSalary);
            setIsEditing(false); // Switch back to read-only after save
            // Refresh list in background
            loadAvailablePlans();
        } catch (error) {
            console.error("Failed to save", error);
        } finally {
            setIsSaving(false);
        }
    };

    // Salary Input Handler
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
        if (!selectedCategory) setSelectedCategory(newCategory.trim());
    };

    const handleAddExpense = () => {
        if (!newExpenseName.trim() || !newExpenseAmount || !selectedCategory) return;
        const newExpense = {
            id: Date.now(),
            name: newExpenseName.trim(),
            amount: parseFloat(newExpenseAmount),
            category: selectedCategory
        };
        setExpenses([...expenses, newExpense]);
        setNewExpenseName('');
        setNewExpenseAmount('');
    };

    const deleteExpense = (id) => {
        setExpenses(expenses.filter(exp => exp.id !== id));
    };

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const remainingAmount = salary - totalExpenses;

    const getMonthName = (m) => new Date(0, m - 1).toLocaleString('default', { month: 'long' });

    if (!isOpen) return null;

    return (
        <div className="monthly-planning-overlay" onClick={onClose}>
            <div className={`monthly-planning-modal ${!isEditing && view === 'DETAIL' ? 'read-only' : ''}`} onClick={e => e.stopPropagation()}>

                {view === 'LIST' && (
                    <>
                        <div className="modal-header">
                            <h2>Monthly Plannings</h2>
                            <button className="close-button" onClick={onClose}>&times;</button>
                        </div>
                        <div className="modal-content">
                            <button className="create-new-btn" onClick={handleCreateNew}>
                                + Create New Monthly Plan
                            </button>

                            {isLoading ? (
                                <div className="loading-state">Loading plans...</div>
                            ) : availablePlans.length === 0 ? (
                                <div className="loading-state">No Monthly Plannings yet</div>
                            ) : (
                                <div className="plan-list">
                                    {availablePlans.map((plan, index) => (
                                        <div key={index} className="plan-card" onClick={() => handlePlanClick(plan.year, plan.month)}>
                                            <div className="plan-info">
                                                <h3>{getMonthName(plan.month)} {plan.year}</h3>
                                            </div>
                                            <div className="plan-arrow">→</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {view === 'DETAIL' && (
                    <>
                        <div className="modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button className="close-button" onClick={() => setView('LIST')} style={{ fontSize: '1rem', marginRight: '10px' }}>
                                    ← Back
                                </button>
                                <h2>{getMonthName(selectedMonth)} {selectedYear}</h2>
                                {!isEditing && (
                                    <button className="edit-btn" onClick={() => setIsEditing(true)} title="Edit Plan">
                                        {/* Pencil SVG */}
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 20h9"></path>
                                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                        </svg>
                                    </button>
                                )}
                            </div>
                            <button className="close-button" onClick={onClose}>&times;</button>
                        </div>

                        <div className="modal-content">
                            {/* Date Selection - Only visible in Edit Mode */}
                            {isEditing && (
                                <div className="date-selection-section">
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                        className="date-select"
                                    >
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                            <option key={m} value={m}>{getMonthName(m)}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                        className="date-input"
                                    />
                                </div>
                            )}

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
                                        disabled={!isEditing}
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
                                    disabled={!isEditing}
                                />
                                <input
                                    type="number"
                                    placeholder="Amount"
                                    value={newExpenseAmount}
                                    onChange={e => setNewExpenseAmount(e.target.value)}
                                    className="add-item-input"
                                    style={{ maxWidth: '80px' }}
                                    disabled={!isEditing}
                                />
                                <select
                                    value={selectedCategory}
                                    onChange={e => setSelectedCategory(e.target.value)}
                                    className="category-select"
                                    disabled={!isEditing}
                                >
                                    <option value="" disabled>Category</option>
                                    {categories.map((cat, index) => (
                                        <option key={index} value={cat}>{cat}</option>
                                    ))}
                                </select>
                                <button className="add-btn" onClick={handleAddExpense} disabled={!isEditing}>+</button>
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
                                                disabled={!isEditing}
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
                                        disabled={!isEditing}
                                    />
                                    <button className="add-btn" onClick={handleAddCategory} disabled={!isEditing}>Add Cat</button>
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

                            {isEditing && (
                                <button
                                    className="save-all-btn"
                                    onClick={handleSaveAll}
                                    disabled={isSaving}
                                >
                                    {isSaving ? 'Saving...' : 'Save Monthly Plan'}
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default MonthlyPlanningModal;
