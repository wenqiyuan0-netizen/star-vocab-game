import React, { useState } from 'react';
import { Music2, VolumeX } from 'lucide-react';
import { useTheme } from '../../../shared/hooks/useTheme';
import { withOpacity, getOffToggleColor } from '../../../utils/colorUtils';
import { soundManager } from '../../../shared/services/audio/SoundManager';

export function SoundCard({ accentColor }) {
  const theme = useTheme();
  const color = accentColor || theme.primary;
  const [muted, setMuted] = useState(soundManager.muted);
  const [volume, setVolume] = useState(soundManager.volume);

  const toggle = () => {
    const next = !muted;
    soundManager.setMuted(next);
    setMuted(next);
    if (!next) soundManager.playToggle(true);
  };

  return (
    <div className="col-span-12 glass-panel rounded-3xl px-5 py-4 flex items-center gap-4">
      <div className="p-2 rounded-xl" style={{ backgroundColor: withOpacity(color, 0.12), color }}>
        {muted ? <VolumeX className="w-5 h-5" /> : <Music2 className="w-5 h-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold" style={{ color: theme.text }}>音效与触感</div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          disabled={muted}
          onChange={e => { const v = parseFloat(e.target.value); setVolume(v); soundManager.setVolume(v); }}
          onPointerUp={() => soundManager.playMatch()}
          className="w-full mt-1 disabled:opacity-40"
          style={{ accentColor: color }}
          aria-label="音效音量"
        />
      </div>
      <button
        role="switch"
        aria-checked={!muted}
        onClick={toggle}
        data-silent
        className="relative inline-flex h-6 w-11 items-center rounded-full shadow-inner"
        style={{ backgroundColor: !muted ? color : getOffToggleColor(theme) }}
        aria-label="音效开关"
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${!muted ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}
