import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import WeekCard from './WeekCard';
import '../styles/WeekCarousel.css';

const variants = {
    enter: (direction) => ({
        x: direction > 0 ? '100%' : '-100%', // Use percentages for responsiveness
        opacity: 0,
        scale: 0.8,
        position: 'absolute' // Keep absolute for the transition only if needed, but grid might handle it.
        // Actually with grid-area 1/1, standard flow works better if we don't position absolute?
        // Wait, for sliding OUT, we need them to coexist. Grid cell can hold multiple items (overlapping).
        // So static position is fine!
    }),
    center: {
        zIndex: 1,
        x: 0,
        opacity: 1,
        scale: 1,
        position: 'relative' // Reset to relative when centered
    },
    exit: (direction) => ({
        zIndex: 0,
        x: direction < 0 ? '100%' : '-100%',
        opacity: 0,
        scale: 0.8,
        position: 'absolute' // Force absolute on exit to not push layout?
        // With Grid 1/1, they overlap by default, so positioning doesn't strictly matter for layout shift,
        // BUT we want to ensure smooth crossfade.
    })
};

// Simplified variants for Grid overlap
const gridVariants = {
    enter: (direction) => ({
        x: direction > 0 ? 500 : -500, // Pixel offset is safer for "fly in" feel than % sometimes, or use viewport width
        opacity: 0,
        scale: 0.8,
    }),
    center: {
        zIndex: 1,
        x: 0,
        opacity: 1,
        scale: 1,
    },
    exit: (direction) => ({
        zIndex: 0,
        x: direction < 0 ? 500 : -500,
        opacity: 0,
        scale: 0.8,
    })
};

const swipeConfidenceThreshold = 10000;
const swipePower = (offset, velocity) => {
    return Math.abs(offset) * velocity;
};

const WeekCarousel = ({ weeks, categories, onUpdateWeek, onCreateWeek, activeIndex, onIndexChange, onGlobalAddExpense, totalSavings, onOpenAddExpense }) => {
    // We rely on parent for index management now.
    // Internal direction state is fine to keep here for animations
    const [direction, setDirection] = useState(0);

    const paginate = (newDirection) => {
        const nextIndex = activeIndex + newDirection;
        if (nextIndex >= 0 && nextIndex < weeks.length) {
            setDirection(newDirection);
            onIndexChange(nextIndex);
        } else if (nextIndex >= weeks.length) {
            onCreateWeek();
            setDirection(newDirection);
        }
    };

    const currentWeek = weeks[activeIndex];

    // Calculate Current Month Savings (from displayed weeks)
    const currentMonthSavings = React.useMemo(() => {
        if (!weeks) return 0;
        return weeks.reduce((total, week) => {
            if (!week.expenses) return total;
            const weekSavings = week.expenses
                .filter(e => e.category.toLowerCase() === 'savings' || e.category.toLowerCase() === 'poupança')
                .reduce((sum, e) => {
                    // Credit = Deposit (Add), Expense = Withdrawal (Subtract)
                    return e.type === 'credit' ? sum + e.amount : sum - e.amount;
                }, 0);
            return total + weekSavings;
        }, 0);
    }, [weeks]);

    // Safety check just in case index is out of bounds (e.g. during reload)
    if (!currentWeek && weeks.length > 0) {
        // Parent will likely reset index soon, return null or fallback
        // onIndexChange(0); // Optional
        return null;
    }

    // Handle empty state
    if (!weeks || weeks.length === 0) {
        return (
            <div className="carousel-container">
                <div className="star-field" />
                <div style={{ color: 'white', zIndex: 1, textAlign: 'center', marginTop: '50px' }}>
                    No weeks found for this month.
                    <br />
                    <button
                        className="carousel-nav-btn"
                        style={{ position: 'static', marginTop: '20px', width: 'auto', padding: '10px 20px' }}
                        onClick={onCreateWeek}
                    >
                        Create First Week
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="carousel-container">
            <div className="star-field" />

            <button className="carousel-nav-btn prev" onClick={() => paginate(-1)} disabled={activeIndex === 0}>
                <ChevronLeft size={24} />
            </button>

            <button className="carousel-nav-btn next" onClick={() => paginate(1)}>
                <ChevronRight size={24} />
            </button>

            <div className="carousel-track">
                <AnimatePresence initial={false} custom={direction}>
                    <motion.div
                        key={activeIndex}
                        custom={direction}
                        variants={gridVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                            x: { type: "spring", stiffness: 300, damping: 30 },
                            opacity: { duration: 0.2 }
                        }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={1}
                        onDragEnd={(e, { offset, velocity }) => {
                            const swipe = swipePower(offset.x, velocity.x);

                            if (swipe < -swipeConfidenceThreshold) {
                                paginate(1);
                            } else if (swipe > swipeConfidenceThreshold) {
                                paginate(-1);
                            }
                        }}
                        style={{
                            width: '100%',
                            maxWidth: '500px',
                            height: 'fit-content',
                            display: 'flex',
                            justifyContent: 'center'
                        }}
                    >
                        {currentWeek && (
                            <WeekCard
                                week={currentWeek}
                                categories={categories}
                                onUpdateWeek={(updated) => onUpdateWeek(updated)} // Pass just updated week, parent handles index map
                                onGlobalAddExpense={onGlobalAddExpense} // Pass global handler
                                weekNumber={activeIndex + 1}
                                totalWeeks={weeks.length}
                                totalSavings={totalSavings}
                                currentMonthSavings={currentMonthSavings}
                                onOpenAddExpense={onOpenAddExpense}
                            />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default WeekCarousel;
