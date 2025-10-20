import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AnimatedCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  variant?: 'fadeIn' | 'slideUp' | 'slideLeft' | 'scale' | 'bounce';
}

const variants = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  },
  slideLeft: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 }
  },
  bounce: {
    initial: { opacity: 0, scale: 0.3 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 20
      }
    },
    exit: { opacity: 0, scale: 0.3 }
  }
};

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  delay = 0,
  duration = 0.3,
  className,
  variant = 'fadeIn',
  ...props
}) => {
  const selectedVariant = variants[variant];

  return (
    <motion.div
      initial={selectedVariant.initial}
      animate={selectedVariant.animate}
      exit={selectedVariant.exit}
      transition={{
        duration,
        delay,
        ease: "easeOut"
      }}
      className={cn("w-full", className)}
      {...props}
    >
      <Card className="backdrop-blur-sm bg-card/95 border-0">
        {children}
      </Card>
    </motion.div>
  );
};

export const AnimatedCardContent: React.FC<AnimatedCardProps> = ({
  children,
  delay = 0,
  duration = 0.3,
  className,
  variant = 'fadeIn',
  ...props
}) => {
  const selectedVariant = variants[variant];

  return (
    <motion.div
      initial={selectedVariant.initial}
      animate={selectedVariant.animate}
      exit={selectedVariant.exit}
      transition={{
        duration,
        delay,
        ease: "easeOut"
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// Page transition wrapper
export const PageTransition: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Staggered animation for lists
export const StaggerContainer: React.FC<{
  children: React.ReactNode;
  staggerDelay?: number;
  className?: string;
}> = ({ children, staggerDelay = 0.1, className }) => {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay
          }
        }
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const StaggerItem: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
      transition={{
        duration: 0.4,
        ease: "easeOut"
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Hover animations
export const HoverCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  scale?: number;
}> = ({ children, className, scale = 1.02 }) => {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 20
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Loading skeleton animation
export const SkeletonPulse: React.FC<{
  className?: string;
}> = ({ className }) => {
  return (
    <motion.div
      animate={{
        opacity: [0.5, 1, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      className={cn("bg-muted rounded", className)}
    />
  );
};