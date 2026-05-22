import { useEffect, useRef } from 'react';
import { generateVerificationHTML } from '../../utils/generateVerificationHTML';
import styles from './VerifierIframe.module.css';

interface VerifierIframeProps {
  code: string;
  onError: (message: string) => void;
  onSuccess: () => void;
  onLoaded: () => void;
}

export function VerifierIframe({ code, onError, onSuccess, onLoaded }: VerifierIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data.type !== 'string') return;

      switch (data.type) {
        case 'preview:loaded':
          onLoaded();
          break;
        case 'preview:error':
          onError(data.message || 'Unknown error');
          break;
        case 'preview:success':
          onSuccess();
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onError, onSuccess, onLoaded]);

  const html = generateVerificationHTML(code);

  return (
    <iframe
      ref={iframeRef}
      className={styles.hidden}
      sandbox="allow-scripts"
      srcDoc={html}
      title="verifier"
    />
  );
}
