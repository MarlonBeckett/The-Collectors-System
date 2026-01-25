'use client';

import { daysUntilExpiration, getExpirationStatus, type ExpirationStatus } from '@/lib/dateUtils';

interface ExpirationIndicatorProps {
  expirationDate: string | null;
  showText?: boolean;
}

const statusConfig: Record<ExpirationStatus, { color: string; bgColor: string; text: string }> = {
  expired: {
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    text: 'EXPIRED',
  },
  warning: {
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    text: 'days left',
  },
  soon: {
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    text: 'days left',
  },
  current: {
    color: 'text-secondary',
    bgColor: 'bg-secondary/10',
    text: 'days left',
  },
  unknown: {
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    text: 'No date',
  },
};

export function ExpirationIndicator({ expirationDate, showText = true }: ExpirationIndicatorProps) {
  const days = daysUntilExpiration(expirationDate);
  const status = getExpirationStatus(expirationDate);
  const config = statusConfig[status];

  const getText = () => {
    if (status === 'unknown') return config.text;
    if (status === 'expired') {
      const absDays = Math.abs(days!);
      return absDays === 1 ? 'Expired 1 day ago' : `Expired ${absDays} days ago`;
    }
    return days === 1 ? '1 day left' : `${days} ${config.text}`;
  };

  return (
    <div className={`inline-flex items-center gap-2 px-2 py-1 ${config.bgColor}`}>
      <span className={`w-2 h-2 ${config.color.replace('text-', 'bg-')}`} />
      {showText && (
        <span className={`text-sm font-medium ${config.color}`}>
          {getText()}
        </span>
      )}
    </div>
  );
}

export function ExpirationDot({ expirationDate }: { expirationDate: string | null }) {
  const status = getExpirationStatus(expirationDate);
  const config = statusConfig[status];

  return (
    <span
      className={`w-3 h-3 inline-block ${config.color.replace('text-', 'bg-')}`}
      title={status}
    />
  );
}
