'use client';

import { useEffect, useState } from 'react';

export function MockProvider({ children }: { children: React.ReactNode }) {
  const [mockReady, setMockReady] = useState(false);

  useEffect(() => {
    async function initMocks() {
      if (process.env.NEXT_PUBLIC_USE_MOCK === 'true') {
        const { worker } = await import('@/mocks');
        
        await worker.start({
          onUnhandledRequest: 'bypass',
          serviceWorker: {
            url: '/mockServiceWorker.js',
          },
        });
        
        console.log('🔧 Mock Service Worker initialized');
      }
      setMockReady(true);
    }

    initMocks();
  }, []);

  // Don't render until mocks are ready (if using mocks) or immediately if not using mocks
  if (process.env.NEXT_PUBLIC_USE_MOCK === 'true' && !mockReady) {
    return <div>Loading mock environment...</div>;
  }

  return <>{children}</>;
}