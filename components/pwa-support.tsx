'use client';

import { useEffect, useState } from 'react';

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
const DISMISSED = 'stride-install-dismissed-v1';

/** Presentation only: never reads or changes account/training storage. */
export function PwaSupport() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    const mode = window.matchMedia('(display-mode: standalone)');
    const installed = () => mode.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const sync = () => {
      let dismissed = false;
      try { dismissed = localStorage.getItem(DISMISSED) === '1'; } catch { /* optional preference */ }
      document.documentElement.toggleAttribute('data-standalone', installed());
      setHidden(dismissed || installed());
    };
    sync();
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    const onPrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const onInstalled = () => { setPrompt(null); setHidden(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    mode.addEventListener('change', sync);

    // Keep keyboard-only UI adjustments tied to focus. Mobile Safari's reported
    // visual viewport can be much shorter than the actually usable dialog area.
    const keyboardInputIsFocused = () => {
      const active = document.activeElement;
      if (active instanceof HTMLTextAreaElement || active instanceof HTMLElement && active.isContentEditable) return true;
      if (!(active instanceof HTMLInputElement)) return false;
      return !['button', 'checkbox', 'color', 'date', 'datetime-local', 'file', 'hidden', 'month', 'radio', 'range', 'reset', 'submit', 'time', 'week'].includes(active.type);
    };
    const syncKeyboard = () => {
      document.documentElement.toggleAttribute('data-keyboard-open', keyboardInputIsFocused());
    };
    const refreshKeyboard = () => {
      syncKeyboard();
      requestAnimationFrame(syncKeyboard);
      window.setTimeout(syncKeyboard, 300);
    };
    syncKeyboard();
    window.addEventListener('focusin', refreshKeyboard);
    window.addEventListener('focusout', refreshKeyboard);

    // Root-relative URLs preserve each origin's own auth cookies and custom domain.
    // No forced activation/reload: a waiting worker takes over after all app tabs close.
    let registration: ServiceWorkerRegistration | undefined;
    const check = () => { if (document.visibilityState === 'visible') void registration?.update().catch(() => {}); };
    if ('serviceWorker' in navigator && window.isSecureContext && process.env.NODE_ENV === 'production') {
      void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then(r => { registration = r; }).catch(() => { /* app remains fully network-based */ });
    }
    document.addEventListener('visibilitychange', check);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      mode.removeEventListener('change', sync);
      window.removeEventListener('focusin', refreshKeyboard);
      window.removeEventListener('focusout', refreshKeyboard);
      document.removeEventListener('visibilitychange', check);
      document.documentElement.removeAttribute('data-keyboard-open');
    };
  }, []);
  if (hidden || (!ios && !prompt)) return null;
  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem(DISMISSED, '1'); } catch { /* session dismissal still works */ }
  };
  return <aside className="pwa-install" aria-label="Install Stride">
    <div><strong>Stride on your home screen</strong>
      {ios ? <p>In Safari, open Share → Add to Home Screen, then tap Add.</p> : <p>Open Stride in its own app window.</p>}
    </div>
    {!ios && prompt && <button className="secondary" onClick={async () => {
      try { await prompt.prompt(); const choice = await prompt.userChoice; setPrompt(null); if (choice.outcome === 'dismissed') dismiss(); else setHidden(true); } catch { setPrompt(null); }
    }}>Install Stride</button>}
    <button className="icon-button" aria-label="Dismiss installation instructions" onClick={dismiss}>×</button>
  </aside>;
}
