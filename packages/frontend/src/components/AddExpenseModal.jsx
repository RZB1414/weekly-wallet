import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { getFinancialInfo, getMonthQuarters, REFUNDS_CATEGORY_NAME, isRefundsCategory } from '../lib/utils';
import '../styles/AddExpenseModal.css';

const modalVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { type: 'spring', damping: 25, stiffness: 500 } },
    exit: { opacity: 0, scale: 0.8 }
};

const AddExpenseModal = ({ isOpen, onClose, onAdd, categories = [] }) => {
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [type, setType] = useState('expense'); // 'expense' | 'credit'
    const [category, setCategory] = useState('');
    const [isSplit, setIsSplit] = useState(false);
    const [installments, setInstallments] = useState(2);
    const [refundTargetCategory, setRefundTargetCategory] = useState('');
    const refundTargetOptions = React.useMemo(() => {
        const seen = new Set();
        return categories
            .map(cat => cat?.trim())
            .filter(name => name && !isRefundsCategory(name) && name !== 'Uncategorized')
            .filter(name => {
                if (seen.has(name)) return false;
                seen.add(name);
                return true;
            });
    }, [categories]);

    // Calculate remaining weeks for splitting
    const getRemainingQuarters = () => {
        try {
            const { year, month } = getFinancialInfo(date);
            const quarters = getMonthQuarters(year, month);

            const { quarter: currentQuarter } = getFinancialInfo(date);

            // Find current quarter index
            const currentIndex = quarters.findIndex(q => q.id === currentQuarter.id);

            // Return current and future quarters
            // User requested if 2 weeks "left", show 1 and 2. 
            // "Faltar duas semanas para acabar" -> e.g. current is week 3, so week 3 and 4 left. Total 2.
            // So slice from currentIndex.
            if (currentIndex === -1) return [];
            return quarters.slice(currentIndex);
        } catch (e) {
            return [];
        }
    };

    // Ensure installments updates when date changes
    React.useEffect(() => {
        if (isSplit) {
            const remaining = getRemainingQuarters().length;
            const max = remaining > 0 ? remaining : 1;
            // Always set to max when date changes so it reflects "remaining from selected date"
            setInstallments(max);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date, isSplit]); // Removed installments from deps to avoid loop and force update on date change

    React.useEffect(() => {
        if (category === REFUNDS_CATEGORY_NAME && type !== 'credit') {
            setType('credit');
        }
    }, [category, type]);

    React.useEffect(() => {
        if (category === REFUNDS_CATEGORY_NAME) {
            if (refundTargetOptions.length === 0) {
                setRefundTargetCategory('');
            } else {
                setRefundTargetCategory(prev => (prev && refundTargetOptions.includes(prev) ? prev : refundTargetOptions[0]));
            }
        } else if (refundTargetCategory) {
            setRefundTargetCategory('');
        }
    }, [category, refundTargetOptions, refundTargetCategory]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name || !amount) return;

        const parsedAmount = parseFloat(amount);
        if (Number.isNaN(parsedAmount)) return;

        if (category === REFUNDS_CATEGORY_NAME) {
            if (refundTargetOptions.length === 0 || !refundTargetCategory) return;

            const baseName = name.trim() || 'Refund';
            const refundEntry = {
                id: uuidv4(),
                name: baseName,
                amount: parsedAmount,
                date,
                type: 'credit',
                category: REFUNDS_CATEGORY_NAME,
                refundTargetCategory
            };
            onAdd(refundEntry);
        } else if (isSplit && type === 'expense' && installments > 1) {
            const expensesToAdd = [];
            const splitAmount = parsedAmount / installments;
            const startDateObj = new Date(date);

            for (let i = 0; i < installments; i++) {
                const installmentDate = new Date(startDateObj);
                installmentDate.setDate(startDateObj.getDate() + (i * 7));

                expensesToAdd.push({
                    id: uuidv4(),
                    name: `${name} (${i + 1}/${installments})`,
                    amount: splitAmount,
                    date: installmentDate.toISOString().slice(0, 10),
                    type,
                    category: category || 'Uncategorized'
                });
            }
            onAdd(expensesToAdd);
        } else {
            onAdd({
                id: uuidv4(),
                name,
                amount: parsedAmount,
                date,
                type,
                category: category || 'Uncategorized'
            });
        }

        setName('');
        setAmount('');
        setType('expense');
        setCategory('');
        setRefundTargetCategory('');
        setIsSplit(false);
        onClose();
    };

    const disableSave = category === REFUNDS_CATEGORY_NAME && refundTargetOptions.length === 0;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="add-tx-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <motion.div
                        className="add-tx-content"
                        variants={modalVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                    >
                        <h2>Add Transaction</h2>
                        <form onSubmit={handleSubmit}>
                            {/* Type Toggle */}
                            <div className="type-toggle-container">
                                <button
                                    type="button"
                                    className={`type-btn expense ${type === 'expense' ? 'active' : ''}`}
                                    onClick={() => setType('expense')}
                                >
                                    Expense
                                </button>
                                <button
                                    type="button"
                                    className={`type-btn credit ${type === 'credit' ? 'active' : ''}`}
                                    onClick={() => setType('credit')}
                                >
                                    Credit
                                </button>
                            </div>

                            <div className="form-group">
                                <label>Description</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Lightsaber Fuel"
                                    autoFocus
                                />
                            </div>

                            {type === 'expense' && (
                                <div className="form-group">
                                    <div className="split-checkbox-wrapper">
                                        <input
                                            type="checkbox"
                                            id="split-expense"
                                            className="split-checkbox"
                                            checked={isSplit}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setIsSplit(checked);
                                                if (checked) {
                                                    const remaining = getRemainingQuarters().length;
                                                    setInstallments(remaining > 0 ? remaining : 1);
                                                }
                                            }}
                                        />
                                        <label htmlFor="split-expense" className="split-label">
                                            Split expense
                                        </label>
                                    </div>

                                    {isSplit && (
                                        <div className="split-controls">
                                            <span>Over</span>
                                            <select
                                                value={installments}
                                                onChange={e => setInstallments(parseInt(e.target.value))}
                                            >
                                                {Array.from({ length: getRemainingQuarters().length }, (_, i) => i + 1)
                                                    .map(num => (
                                                        <option key={num} value={num}>{num}</option>
                                                    ))
                                                }
                                            </select>
                                            <span>weeks</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="form-group">
                                <label>Amount (AED)</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    step="0.01"
                                />
                            </div>

                            <div className="form-group">
                                <label>Category</label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                >
                                    <option value="" disabled>Select Category</option>
                                    {categories.map((cat, index) => (
                                        <option key={index} value={cat} style={{ color: 'black' }}>
                                            {cat}
                                        </option>
                                    ))}
                                    <option value="Uncategorized" style={{ color: 'black' }}>Uncategorized</option>
                                </select>
                            </div>

                            {type === 'credit' && category === REFUNDS_CATEGORY_NAME && (
                                <div className="form-group">
                                    <label>Apply credit to</label>
                                    <select
                                        value={refundTargetCategory}
                                        onChange={(e) => setRefundTargetCategory(e.target.value)}
                                        disabled={refundTargetOptions.length === 0}
                                    >
                                        <option value="" disabled>
                                            {refundTargetOptions.length === 0 ? 'No categories available yet' : 'Select target category'}
                                        </option>
                                        {refundTargetOptions.map((target) => (
                                            <option key={target} value={target} style={{ color: 'black' }}>
                                                {target}
                                            </option>
                                        ))}
                                    </select>
                                    <small style={{ display: 'block', marginTop: '4px', color: refundTargetOptions.length === 0 ? '#f87171' : '#4ade80' }}>
                                        {refundTargetOptions.length === 0
                                            ? 'Create a budget category before logging refunds.'
                                            : 'Adds a credit to the selected category plus tracks the refund under Refunds.'}
                                    </small>
                                </div>
                            )}

                            <div className="form-group">
                                <label>Date</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
                                <button type="submit" className="btn-save" disabled={disableSave}>Save</button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )
            }
        </AnimatePresence >
    );
};

export default AddExpenseModal;
