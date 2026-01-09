// src/components/PageTransition.jsx
import React from 'react';
import { motion } from 'framer-motion';

const animations = {
    initial: { opacity: 0, scale: 0.99, filter: "blur(5px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 1.01, filter: "blur(5px)" }
};

const PageTransition = ({ children }) => {
    return (
        <motion.div
            variants={animations}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{
                duration: 0.3,
                ease: [0.4, 0, 0.2, 1] // "Curve - Material Design Standard"
            }}
            className="w-full h-full"
        >
            {children}
        </motion.div>
    );
};

export default PageTransition;