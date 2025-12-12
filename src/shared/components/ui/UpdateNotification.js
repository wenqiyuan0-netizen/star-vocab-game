import React, { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';

export const UpdateNotification = () => {
  const [registration, setRegistration] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleUpdate = (e) => {
      console.log('Update available event received', e.detail);
      setRegistration(e.detail);
      setShow(true);
    };

    window.addEventListener('SW_UPDATE_AVAILABLE', handleUpdate);
    
    return () => window.removeEventListener('SW_UPDATE_AVAILABLE', handleUpdate);
  }, []);

  const handleUpdate = () => {
    if (!registration || !registration.waiting) {
      // Fallback: simple reload if something is wrong with registration object
      window.location.reload();
      return;
    }
    
    console.log('Posting SKIP_WAITING to waiting worker');
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    setShow(false);
    
    // Reload when controller changes
    // We add this listener once. If it fires, we reload.
    // If for some reason it doesn't fire immediately (rare), the user might need to reload manually, 
    // but SKIP_WAITING usually triggers controllerchange immediately.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Controller changed, reloading...');
      window.location.reload();
    });
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] w-[90%] max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-slate-900/90 backdrop-blur-md border border-white/20 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4">
        <div className="flex-1">
          <h4 className="font-bold text-sm">发现新版本</h4>
          <p className="text-xs text-slate-300">应用内容已更新，请刷新以应用。</p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setShow(false)}
             className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
           >
             <X size={18} />
           </button>
           <button 
             onClick={handleUpdate}
             className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-blue-500/20"
           >
             <RefreshCw size={16} className="animate-pulse" />
             刷新
           </button>
        </div>
      </div>
    </div>
  );
};
