// CountdownOverlay: Displays a countdown before the game starts. Used in TypingArena and MatchHUD.
// Depends on: framer-motion, cn util.
// Props: count, isVisible, className.
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CountdownOverlayProps {
  count: number | string;
  isVisible: boolean;
  className?: string;
}

export function CountdownOverlay({ count, isVisible, className }: CountdownOverlayProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm",
            className
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            key={count}
            className="relative"
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ 
              duration: 0.5,
              ease: [0.34, 1.56, 0.64, 1]
            }}
          >
            {/* Pulse ring */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-primary"
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
            
            {/* Number/text */}
            <div className="text-8xl md:text-9xl font-bold font-mono text-primary text-glow-primary">
              {count}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
