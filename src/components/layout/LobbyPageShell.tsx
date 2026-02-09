import { ReactNode } from 'react';
import { LetterParticles } from '@/components/game-ui/LetterParticles';
import { cn } from '@/lib/utils';

interface LobbyPageShellProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function LobbyPageShell({ children, className, contentClassName }: LobbyPageShellProps) {
  return (
    <div className={cn('min-h-screen bg-lobby-bg relative overflow-hidden', className)}>
      <LetterParticles />
      <div className={cn('relative z-10', contentClassName)}>
        {children}
      </div>
    </div>
  );
}
