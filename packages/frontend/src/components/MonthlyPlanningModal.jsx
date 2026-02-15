import React, { useState, useEffect, useMemo } from 'react';
import '../styles/MonthlyPlanning.css';
import { api } from '../lib/api';
import { getFinancialInfo } from '../lib/utils';

const MonthlyPlanningModal = ({ isOpen, onClose, weeks = [], onUpdateWeeks, onPlanSave }) => {
    // View State: 'LIST' | 'DETAIL'
    const [view, setView] = useState('LIST');
    const [isEditing, setIsEditing] = useState(false);
    const [availablePlans, setAvailablePlans] = useState([]);

    // Date State
    const currentDate = new Date();
    const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1); // 1-12

    // Data State
    // categories: { id, name, budget, type }[]
    const [categories, setCategories] = useState([]);
    const [salary, setSalary] = useState(0);
    const [salaryInput, setSalaryInput] = useState('');

    // UI State
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryBudget, setNewCategoryBudget] = useState('');
    const [newCategoryType, setNewCategoryType] = useState('credit'); // 'credit' (standard) | 'spend' (deducts budget)
    const [expandedCategoryId, setExpandedCategoryId] = useState(null);
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [editCategoryName, setEditCategoryName] = useState('');
    const [editCategoryBudget, setEditCategoryBudget] = useState('');

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

    // Calculate Actual Expenses from Weeks Data
    const monthlyExpenses = useMemo(() => {
        const relevantExpenses = [];
        if (!weeks || weeks.length === 0) return relevantExpenses;

        weeks.forEach(week => {
            if (week.expenses) {
                week.expenses.forEach(exp => {
                    if (!exp.date) return;

                    // Use Financial Month logic to match the rest of the app
                    const { month, year } = getFinancialInfo(exp.date);

                    if (year === selectedYear && month === selectedMonth) {
                        relevantExpenses.push(exp);
                    }
                });
            }
        });
        return relevantExpenses;
    }, [weeks, selectedYear, selectedMonth]);

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

    const defaultCategories = () => [
        { id: crypto.randomUUID(), name: 'Market', budget: 0, type: 'credit' },
        { id: crypto.randomUUID(), name: 'Coffee', budget: 0, type: 'credit' },
        { id: crypto.randomUUID(), name: 'Savings', budget: 0, type: 'credit' },
    ];

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await api.getMonthlyPlanning(selectedYear, selectedMonth);

            // Migrate legacy categories (strings) to objects if needed
            const loadedCategories = (data.categories || []).map(cat => {
                if (typeof cat === 'string') {
                    return { id: Date.now() + Math.random(), name: cat, budget: 0, type: 'credit' };
                }
                return { ...cat, type: cat.type || 'credit' }; // Ensure type exists
            });

            setCategories(loadedCategories.length > 0 ? loadedCategories : defaultCategories());
            setSalary(data.salary || 0);
            setSalaryInput(data.salary ? data.salary.toString() : '');
        } catch (error) {
            console.error("Failed to load monthly planning", error);
            setCategories(defaultCategories());
            setSalary(0);
            setSalaryInput('');
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
        setCategories([
            { id: crypto.randomUUID(), name: 'Market', budget: 0, type: 'credit' },
            { id: crypto.randomUUID(), name: 'Coffee', budget: 0, type: 'credit' },
            { id: crypto.randomUUID(), name: 'Savings', budget: 0, type: 'credit' },
        ]);
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

            // We ONLY save Categories and Salary. Expenses are derived from daily logs now.
            await api.saveMonthlyPlanning(selectedYear, selectedMonth, {
                categories: categories,
                salary: finalSalary
            });
            setSalary(finalSalary);

            if (onPlanSave) {
                onPlanSave(selectedYear, selectedMonth, categories, finalSalary);
            }

            loadAvailablePlans();
        } catch (error) {
            console.error("Failed to save", error);
        } finally {
            setIsSaving(false);
            setIsEditing(false); // Ensure we go back to read-only
        }
    };

    const handleSalaryChange = (e) => {
        setSalaryInput(e.target.value);
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) setSalary(val);
        else setSalary(0);
    };

    const handleAddCategory = () => {
        if (!newCategoryName.trim()) return;

        const budgetVal = parseFloat(newCategoryBudget);
        const newCat = {
            id: Date.now(),
            name: newCategoryName.trim(),
            budget: !isNaN(budgetVal) ? budgetVal : 0,
            type: newCategoryType
        };

        const updatedCategories = [...categories, newCat];
        setCategories(updatedCategories);
        setNewCategoryName('');
        setNewCategoryBudget('');
        setNewCategoryType('credit'); // Reset to default
    };

    const handleDeleteCategory = (id) => {
        if (window.confirm("Are you sure you want to delete this category?")) {
            // Find category to delete
            const categoryToDelete = categories.find(c => c.id === id);

            // Remove from local categories
            setCategories(categories.filter(c => c.id !== id));

            // Cascade Delete Expenses for this Category & Month
            if (categoryToDelete && weeks.length > 0) {
                const updatedWeeks = weeks.map(week => {
                    if (!week.expenses || week.expenses.length === 0) return week;

                    const filteredExpenses = week.expenses.filter(exp => {
                        // Check if expense matches the deleted category
                        if (exp.category === categoryToDelete.name) {
                            // Check if specific expense falls within Selected Month/Year
                            const expDate = new Date(exp.date);
                            if (expDate.getFullYear() === selectedYear && (expDate.getMonth() + 1) === selectedMonth) {
                                return false; // Remove!
                            }
                        }
                        return true; // Keep
                    });

                    // Only update reference if something changed
                    if (filteredExpenses.length !== week.expenses.length) {
                        return { ...week, expenses: filteredExpenses };
                    }
                    return week;
                });

                // If any week changed, update app state
                if (onUpdateWeeks) {
                    onUpdateWeeks(updatedWeeks);
                }
            }
        }
    };

    const toggleCategoryExpand = (id) => {
        setExpandedCategoryId(expandedCategoryId === id ? null : id);
    };

    const handleStartEditCategory = (cat) => {
        setEditingCategoryId(cat.id);
        setEditCategoryName(cat.name);
        setEditCategoryBudget(cat.budget.toString());
    };

    const handleSaveEditCategory = (id) => {
        const budgetVal = parseFloat(editCategoryBudget);
        setCategories(categories.map(c => {
            if (c.id === id) {
                return {
                    ...c,
                    name: editCategoryName.trim() || c.name,
                    budget: !isNaN(budgetVal) ? budgetVal : c.budget
                };
            }
            return c;
        }));
        setEditingCategoryId(null);
    };

    // Helper to calculate spent per category
    const getCategorySpent = (catName) => {
        const catExpenses = monthlyExpenses.filter(e => e.category === catName);
        return catExpenses.reduce((sum, e) => {
            return e.type === 'credit' ? sum - e.amount : sum + e.amount;
        }, 0);
    };

    // Calculations
    // Total Spent (Calculated from Spend Budgets + Credit Actuals)
    const totalCalculatedSpent = useMemo(() => {
        let total = 0;

        // 1. Add Budgets of 'Spend' categories
        const spendCategories = categories.filter(c => c.type === 'spend');
        const spendCategoryNames = spendCategories.map(c => c.name);

        spendCategories.forEach(cat => {
            total += cat.budget;
        });

        // 2. Add Actuals of 'Credit' categories AND Uncategorized
        const relevantExpenses = monthlyExpenses.filter(e => !spendCategoryNames.includes(e.category));

        const relevantActuals = relevantExpenses.reduce((sum, exp) => {
            return exp.type === 'credit' ? sum - exp.amount : sum + exp.amount;
        }, 0);

        return total + relevantActuals;
    }, [categories, monthlyExpenses]);

    // Remaining Balance Logic:
    // Salary - Total Spent
    const remainingAmount = useMemo(() => {
        return salary - totalCalculatedSpent;
    }, [salary, totalCalculatedSpent]);

    const getMonthName = (m) => new Date(0, m - 1).toLocaleString('default', { month: 'long' });

    // Category Summary Logic
    const categorySummaries = categories.map(cat => {
        const spent = getCategorySpent(cat.name);
        return {
            ...cat,
            spent,
            remaining: cat.budget - spent,
            expenses: monthlyExpenses.filter(e => e.category === cat.name)
        };
    });

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

                            {/* Category Summaries */}
                            <div className="category-summary-section">
                                <h3>Category Budgets</h3>
                                <div className="category-summary-list">
                                    {categorySummaries.map(cat => (
                                        <div
                                            key={cat.id}
                                            className={`category-summary-card ${expandedCategoryId === cat.id ? 'expanded' : ''}`}
                                            onClick={() => toggleCategoryExpand(cat.id)}
                                            style={{ cursor: 'pointer', borderLeft: cat.type === 'spend' ? '4px solid #ff5252' : '1px solid rgba(255,255,255,0.1)' }}
                                        >
                                            {editingCategoryId === cat.id ? (
                                                <div className="cat-edit-form" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        type="text"
                                                        value={editCategoryName}
                                                        onChange={e => setEditCategoryName(e.target.value)}
                                                        className="add-item-input"
                                                        placeholder="Category name"
                                                    />
                                                    <input
                                                        type="number"
                                                        value={editCategoryBudget}
                                                        onChange={e => setEditCategoryBudget(e.target.value)}
                                                        className="add-item-input"
                                                        placeholder="Budget"
                                                    />
                                                    <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
                                                        <button
                                                            className="add-btn"
                                                            onClick={() => handleSaveEditCategory(cat.id)}
                                                            style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingCategoryId(null)}
                                                            style={{ fontSize: '0.8rem', padding: '4px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '6px', cursor: 'pointer' }}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="cat-sum-header">
                                                        <span>{cat.name} <small style={{ fontWeight: 'normal', opacity: 0.7, fontSize: '0.7em' }}>({cat.type === 'spend' ? 'Spend' : 'Credit'})</small></span>
                                                        <span>AED {cat.budget.toFixed(2)}</span>
                                                    </div>
                                                    <div className="cat-sum-row">
                                                        <span>Spent:</span>
                                                        <span>AED {cat.spent.toFixed(2)}</span>
                                                    </div>
                                                    <div className={`cat-sum-remaining ${cat.remaining < 0 ? 'negative' : 'positive'}`}>
                                                        <span>Remaining:</span>
                                                        <span>AED {cat.remaining.toFixed(2)}</span>
                                                    </div>

                                                    {/* Expandable Expense List */}
                                                    {expandedCategoryId === cat.id && (
                                                        <div className="cat-expenses-list" onClick={e => e.stopPropagation()}>
                                                            <h4>Transactions</h4>
                                                            {cat.expenses.length === 0 ? (
                                                                <div className="no-expenses">No transactions</div>
                                                            ) : (
                                                                <ul>
                                                                    {cat.expenses.map(exp => (
                                                                        <li key={exp.id} className="cat-expense-item">
                                                                            <span>{exp.name}</span>
                                                                            <span className={exp.type === 'credit' ? 'credit-text' : 'expense-text'}>
                                                                                {exp.type === 'credit' ? '+' : '-'} AED {exp.amount.toFixed(2)}
                                                                            </span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </div>
                                                    )}

                                                    {isEditing && (
                                                        <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleStartEditCategory(cat);
                                                                }}
                                                                style={{ background: 'transparent', border: 'none', color: '#64b5f6', cursor: 'pointer', fontSize: '0.8rem' }}
                                                            >
                                                                ✏️ Edit
                                                            </button>
                                                            <button
                                                                className="delete-cat-btn"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteCategory(cat.id);
                                                                }}
                                                                style={{ background: 'transparent', border: 'none', color: '#ff5252', cursor: 'pointer', fontSize: '0.8rem' }}
                                                            >
                                                                🗑️ Remove
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Add Category Section */}
                            {isEditing && (
                                <div className="add-category-section">
                                    <div className="transaction-type-toggle">
                                        <button
                                            className={`type-btn ${newCategoryType === 'credit' ? 'active credit' : ''}`}
                                            onClick={() => setNewCategoryType('credit')}
                                        >
                                            Credit
                                        </button>
                                        <button
                                            className={`type-btn ${newCategoryType === 'spend' ? 'active expense' : ''}`}
                                            onClick={() => setNewCategoryType('spend')}
                                        >
                                            Spend
                                        </button>
                                    </div>
                                    <div className="add-category-form">
                                        <input
                                            type="text"
                                            placeholder="New Category"
                                            value={newCategoryName}
                                            onChange={e => setNewCategoryName(e.target.value)}
                                            className="add-item-input"
                                        />
                                        <input
                                            type="number"
                                            placeholder="Budget"
                                            value={newCategoryBudget}
                                            onChange={e => setNewCategoryBudget(e.target.value)}
                                            className="add-item-input"
                                        />
                                        <button className="add-btn" onClick={handleAddCategory} title="Add Category">+</button>
                                    </div>
                                </div>
                            )}

                        </div>

                        <div className="modal-footer">
                            <div className="summary-row">
                                <span>Available / Salary</span>
                                <span>AED {salary.toFixed(2)}</span>
                            </div>
                            <div className="summary-row total">
                                <span>Total Spent (Calculated)</span>
                                <span>AED {totalCalculatedSpent.toFixed(2)}</span>
                            </div>
                            <div className="summary-row" style={{ color: remainingAmount >= 0 ? '#4caf50' : '#ff5252', fontWeight: 'bold' }}>
                                <span>Remaining Global Balance</span>
                                <span>AED {remainingAmount.toFixed(2)}</span>
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
