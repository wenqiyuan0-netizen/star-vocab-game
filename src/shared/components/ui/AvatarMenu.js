import React, { useRef, useState } from 'react';
import { Image as ImageIcon, LogOut, ChevronDown } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export default function AvatarMenu({ avatarUrl, displayName, onChangeAvatar, onLogout, logoutLabel = '退出登录' }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const fileRef = useRef(null);

  const handlePick = () => {
    fileRef.current?.click();
  };

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChangeAvatar && onChangeAvatar(reader.result);
      setOpen(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-full shadow-sm"
        style={{ backgroundColor: `${theme.overlay}`, color: theme.text }}
      >
        <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center" style={{ backgroundColor: theme.primary }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-white">{(displayName || 'U').charAt(0).toUpperCase()}</span>
          )}
        </div>
        <ChevronDown className="w-4 h-4 opacity-60" />
      </button>

      {open && (
        <div 
          className="absolute right-0 mt-2 w-48 rounded-2xl shadow-lg glass-panel p-2 z-50"
          style={{ borderColor: `${theme.primary}33` }}
        >
          <button
            onClick={handlePick}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10"
            style={{ color: theme.text }}
          >
            <ImageIcon className="w-4 h-4" />
            <span className="text-sm">自定义头像</span>
          </button>
          
          {onLogout && (
            <button
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">{logoutLabel}</span>
            </button>
          )}
          <input 
            ref={fileRef} 
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleFile}
          />
        </div>
      )}
    </div>
  );
}
