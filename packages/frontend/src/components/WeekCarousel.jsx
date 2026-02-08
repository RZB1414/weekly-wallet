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

const WeekCarousel = ({ weeks, categories, onUpdateWeek, onCreateWeek }) => {
    const [currentIndex, setCurrentIndex] = useState(weeks.length - 1);
    const [direction, setDirection] = useState(0);

    const paginate = (newDirection) => {
        const nextIndex = currentIndex + newDirection;
        if (nextIndex >= 0 && nextIndex < weeks.length) {
            setDirection(newDirection);
            setCurrentIndex(nextIndex);
        } else if (nextIndex >= weeks.length) {
            onCreateWeek();
            setDirection(newDirection);
            setCurrentIndex(weeks.length);
        }
    };

    const currentWeek = weeks[currentIndex];

    return (
        <div className="carousel-container">
            <div className="star-field" />

            <button className="carousel-nav-btn prev" onClick={() => paginate(-1)} disabled={currentIndex === 0}>
                <ChevronLeft size={24} />
            </button>

            <button className="carousel-nav-btn next" onClick={() => paginate(1)}>
                <ChevronRight size={24} />
            </button>

            <div className="carousel-track">
                <AnimatePresence initial={false} custom={direction}>
                    <motion.div
                        key={currentIndex}
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
                                onUpdateWeek={(updated) => onUpdateWeek(currentIndex, updated)}
                            />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default WeekCarousel;
