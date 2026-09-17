'use client';

import { useEffect } from 'react';

export function EmbedHeightReporter() {
  useEffect(() => {
    function publish() {
      const height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      window.parent.postMessage({ type: 'pifh-enroll-height', height }, '*');
    }
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(document.body);
    window.addEventListener('load', publish);
    return () => {
      observer.disconnect();
      window.removeEventListener('load', publish);
    };
  }, []);
  return null;
}
