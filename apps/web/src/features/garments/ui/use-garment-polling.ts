import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';

const pollInterval = 2500;

export const useGarmentPolling = (enabled: boolean) => {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const timer = setInterval(() => {
      router.invalidate().catch(() => undefined);
    }, pollInterval);
    return () => clearInterval(timer);
  }, [enabled, router]);
};
