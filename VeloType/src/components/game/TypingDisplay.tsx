import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TypingDisplayProps {
  text: string;
  currentIndex: number;
  className?: string;
}

export function TypingDisplay({ text, currentIndex, className }: TypingDisplayProps) {
  const characters = text.split('');

  return (
    <div className={cn("font-mono text-2xl md:text-3xl leading-relaxed select-none", className)}>
      {characters.map((char, index) => {
        let charClass = 'text-typing-pending';
        
        if (index < currentIndex) {
          charClass = 'text-typing-correct';
        } else if (index === currentIndex) {
          charClass = 'text-typing-current';
        }

        const isCurrentChar = index === currentIndex;

        return (
          <span key={index} className="relative inline">
            <span className={cn(charClass, "transition-colors duration-75")}>
              {char === ' ' ? '\u00A0' : char}
            </span>
            {isCurrentChar && (
              <motion.span
                className="absolute -bottom-0.5 left-0 w-full h-0.5 bg-primary"
                layoutId="cursor"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.1 }}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}
