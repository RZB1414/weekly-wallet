import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
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

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name || !amount) return;

        onAdd({
            id: uuidv4(),
            name,
            amount: parseFloat(amount),
            date,
            type,
            category: category || 'Uncategorized'
        });

        setName('');
        setAmount('');
        setType('expense');
        setCategory('');
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
