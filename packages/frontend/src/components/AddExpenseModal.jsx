import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import '../styles/AddExpenseModal.css';

const modalVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { type: 'spring', damping: 25, stiffness: 500 } },
    exit: { opacity: 0, scale: 0.8 }
};

const AddExpenseModal = ({ isOpen, onClose, onAdd }) => {
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name || !amount) return;

        onAdd({
            id: uuidv4(),
            name,
            amount: parseFloat(amount),
            date
        });

        setName('');
        setAmount('');
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
                        <h2>Add Access Logs (Expense)</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Description (Code Name)</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Lightsaber Fuel"
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label>Credits Cost</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    step="0.01"
                                />
                            </div>
                            <div className="form-group">
                                <label>Date Cycle</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={onClose}>Abort</button>
                                <button type="submit" className="btn-save">Confirm Entry</button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AddExpenseModal;
