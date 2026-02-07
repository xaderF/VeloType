// QueueOverlay: Overlay for queueing players before match starts. Used in PlayScreen.
// Depends on: framer-motion, cn util.
// Props: isVisible, onCancel, elapsedTime, className.
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface QueueOverlayProps {
  isVisible: boolean;
  onCancel: () => void;
  elapsedTime?: number;
  className?: string;
}

export function QueueOverlay({ 
  isVisible, 
  onCancel, 
  elapsedTime = 0,
  className 
}: QueueOverlayProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md",
            className
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="text-center space-y-8"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            {/* Animated rings */}
            <div className="relative w-32 h-32 mx-auto">
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary/30"
                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary/30"
                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary/30"
                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 1 }}
              />
              
              {/* Center icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center glow-primary"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <span className="text-2xl">⚔️</span>
                </motion.div>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Finding Opponent...</h2>
              <p className="text-muted-foreground">
                Searching for a worthy challenger
              </p>
            </div>

            {/* Timer */}
            <div className="font-mono text-3xl text-primary text-glow-primary">
              {formatTime(elapsedTime)}
            </div>

            {/* Cancel button */}
            <motion.button
              onClick={onCancel}
              className="px-6 py-2 rounded-lg border border-border hover:border-destructive hover:text-destructive transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Cancel
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
