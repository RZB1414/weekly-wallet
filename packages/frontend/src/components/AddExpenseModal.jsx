import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { getFinancialInfo, getMonthQuarters } from '../lib/utils';
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

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name || !amount) return;

        // If split is enabled
        if (isSplit && type === 'expense' && installments > 1) {
            const expensesToAdd = [];
            const splitAmount = parseFloat(amount) / installments;
            const startDateObj = new Date(date);

            for (let i = 0; i < installments; i++) {
                // Calculate date for this installment (add 7 days * i)
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
                amount: parseFloat(amount),
                date,
                type,
                category: category || 'Uncategorized'
            });
        }

        setName('');
        setAmount('');
        setType('expense');
        setCategory('');
        setIsSplit(false);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="modal-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <motion.div
                        className="modal-content"
                        variants={modalVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                    >
                        <h2>Add Transaction</h2>
                        <form onSubmit={handleSubmit}>
                            {/* Type Toggle */}
                            <div className="form-group" style={{ flexDirection: 'row', gap: '10px' }}>
                                <button
                                    type="button"
                                    className={`type-btn ${type === 'expense' ? 'active' : ''}`}
                                    onClick={() => setType('expense')}
                                    style={{
                                        flex: 1,
                                        padding: '8px',
                                        background: type === 'expense' ? '#ff5252' : 'rgba(255,255,255,0.1)',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: '#fff',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Expense
                                </button>
                                <button
                                    type="button"
                                    className={`type-btn ${type === 'credit' ? 'active' : ''}`}
                                    onClick={() => setType('credit')}
                                    style={{
                                        flex: 1,
                                        padding: '8px',
                                        background: type === 'credit' ? '#4caf50' : 'rgba(255,255,255,0.1)',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: '#fff',
                                        cursor: 'pointer'
                                    }}
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
                                <div className="form-group checkbox-group" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <input
                                            type="checkbox"
                                            id="split-expense"
                                            checked={isSplit}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setIsSplit(checked);
                                                if (checked) {
                                                    const remaining = getRemainingQuarters().length;
                                                    setInstallments(remaining > 0 ? remaining : 1);
                                                }
                                            }}
                                            style={{ width: 'auto', margin: 0 }}
                                        />
                                        <label htmlFor="split-expense" style={{ margin: 0, fontWeight: 'normal' }}>
                                            Split expense
                                        </label>
                                    </div>

                                    {isSplit && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '25px', width: '100%' }}>
                                            <span style={{ fontSize: '0.9rem', color: '#ccc' }}>Over</span>
                                            <select
                                                value={installments}
                                                onChange={e => setInstallments(parseInt(e.target.value))}
                                                style={{
                                                    padding: '5px',
                                                    borderRadius: '6px',
                                                    border: '1px solid #ccc',
                                                    background: 'white',
                                                    color: 'black'
                                                }}
                                            >
                                                {Array.from({ length: getRemainingQuarters().length }, (_, i) => i + 1)
                                                    .map(num => (
                                                        <option key={num} value={num}>{num}</option>
                                                    ))
                                                }
                                            </select>
                                            <span style={{ fontSize: '0.9rem', color: '#ccc' }}>weeks</span>
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
                                <button type="submit" className="btn-save">Save</button>
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
