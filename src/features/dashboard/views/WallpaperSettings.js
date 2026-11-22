import React, { useState, useRef, useEffect } from 'react';
import { Image, Upload, Move, ZoomIn, Sun, Moon, Droplet, Layers, X, Monitor, CheckCircle, Home, Zap } from 'lucide-react';
import { extractPaletteFromImage } from '../../../utils/colorUtils';
import { useI18n } from '../../../shared/i18n';
import { useTheme } from '../../../shared/hooks/useTheme';

export function WallpaperSettings({ type, onSave, onClose }) {
  const theme = useTheme();
  const { t } = useI18n();
  const [selectedImage, setSelectedImage] = useState(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [filterType, setFilterType] = useState('none');
  const [blurIntensity, setBlurIntensity] = useState(0); // 0-100
  const [saturation, setSaturation] = useState(100); // 0-200, default 100%
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedPalette, setExtractedPalette] = useState(null);
  const [imgAspectRatio, setImgAspectRatio] = useState(null);
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const [hoverTarget, setHoverTarget] = useState(null); // 'upload', 'home', 'system'
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const imgRef = useRef(null);

  // 实时构建 CSS filter 字符串
  const getFilterString = () => {
    let f = '';
    if (filterType !== 'none') f += filterType + ' ';
    if (blurIntensity > 0) f += `blur(${blurIntensity / 10}px) `;
    if (saturation !== 100) f += `saturate(${saturation}%) `;
    return f.trim() || 'none';
  };

  const filters = [
    { name: t('wall.filter.none'), value: 'none', icon: Layers },
    { name: t('wall.filter.gray'), value: 'grayscale(100%)', icon: Moon },
    { name: t('wall.filter.retro'), value: 'sepia(60%) contrast(110%) brightness(90%)', icon: Sun },
    { name: t('wall.filter.cool'), value: 'hue-rotate(180deg) saturate(80%)', icon: Layers },
  ];

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && (file.type === 'image/jpeg' || file.type === 'image/png')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedImage(event.target.result);
        setScale(1);
        setPosition({ x: 0, y: 0 });
        setBlurIntensity(0);
        setSaturation(100);
        setFilterType('none');
        setExtractedPalette(null);
        setImgAspectRatio(null);
      };
      reader.readAsDataURL(file);
    }
  };

  // 提取颜色 (当图片加载或更改时)
  useEffect(() => {
      if (selectedImage && imgRef.current && !extractedPalette) {
          // Give image a moment to render
          setTimeout(() => {
              extractPaletteFromImage(imgRef.current).then(palette => {
                  setExtractedPalette(palette);
              });
          }, 500);
      }
  }, [selectedImage]);


  // 简单的拖拽逻辑
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 保存处理后的图片
  const handleSaveAction = async (target) => {
    if (!selectedImage || !canvasRef.current) return;
    setIsProcessing(true);

    // Ensure palette is ready or extract it now
    let paletteToSave = extractedPalette;
    if (!paletteToSave && imgRef.current) {
        try {
            paletteToSave = await extractPaletteFromImage(imgRef.current);
        } catch (e) {
            console.error("Palette extraction failed", e);
        }
    }

    // 使用 setTimeout 让 UI 有机会更新 loading 状态
    setTimeout(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = new window.Image();
        img.src = selectedImage;
        
        img.onload = () => {
            canvas.width = 1920;
            canvas.height = 1080;

            // 填充背景
            ctx.fillStyle = theme.background || '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 应用滤镜
            const currentFilter = getFilterString();
            if (currentFilter !== 'none') {
                ctx.filter = currentFilter;
            }

            const containerAspect = canvas.width / canvas.height;
            const imgAspect = img.width / img.height;
            
            let drawWidth, drawHeight;
            if (imgAspect > containerAspect) {
                drawHeight = canvas.height;
                drawWidth = canvas.height * imgAspect;
            } else {
                drawWidth = canvas.width;
                drawHeight = canvas.width / imgAspect;
            }
            
            // Calculate scale ratio between Canvas (1920) and UI Container
            // This ensures that the UI drag distance matches the Canvas shift
            // The UI container height is roughly 45vh. 
            // We need to map the UI offsets (position.x/y) to Canvas coordinates.
            
            // Since we don't know exact pixel size of UI container, we rely on the visual scale.
            // Ideally, we should capture the container size.
            // For now, we use a simplified approach: 
            // Map the offset based on the ratio of canvas size to displayed image size.
            
            // Draw image
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.translate(position.x * 2, position.y * 2); // Approximation factor
            ctx.scale(scale, scale);
            ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
            ctx.restore();

            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            onSave(target, dataUrl, paletteToSave);
            setIsProcessing(false);
        };
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xl flex flex-col animate-fade-in">
      {/* 顶部导航栏 */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-white/10 glass-panel rounded-none z-10">
        <button onClick={onClose} className="p-2 -ml-2 text-gray-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>
        <h3 className="text-white font-bold text-lg">{t('wall.title')}</h3>
        <div className="w-10"></div> {/* Spacer */}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto">
      {!selectedImage ? (
        <div className="w-full max-w-md space-y-6">
           <div className="grid grid-cols-1 gap-4 max-w-xs mx-auto w-full">
             <button 
                onClick={() => fileInputRef.current.click()}
                onMouseEnter={() => setHoverTarget('upload')}
                onMouseLeave={() => setHoverTarget(null)}
                className="aspect-[3/4] rounded-2xl glass-button border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-4 hover:bg-white/10 transition-all group"
                style={{ borderColor: hoverTarget === 'upload' ? theme.primary : undefined }}
             >
                <div 
                    className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center transition-colors"
                    style={{ backgroundColor: hoverTarget === 'upload' ? theme.primary : undefined }}
                >
                    <Upload className="w-8 h-8 text-gray-400 group-hover:text-white" />
                </div>
                <span className="text-sm font-bold text-gray-400 group-hover:text-white">{t('wall.upload')}</span>
             </button>
             
           </div>
           <input 
            ref={fileInputRef}
            type="file" 
            accept="image/jpeg, image/png" 
            className="hidden" 
            onChange={handleFileChange}
          />
        </div>
      ) : (
        <div className="w-full max-w-lg space-y-6">
          {/* 预览/裁剪区域 */}
          <div 
            ref={containerRef}
            // 强制使用横屏比例，以适配移动端横屏操作和实际游戏/桌面比例
            className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-black/50 border border-white/20 cursor-move group shadow-2xl touch-none flex items-center justify-center"
            style={{ maxHeight: '45vh' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
            }}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
            }}
            onTouchEnd={handleMouseUp}
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
               <span className="text-white text-xs font-bold drop-shadow-md flex items-center gap-1"><Move className="w-3 h-3"/> {t('wall.drag')}</span>
            </div>
            <img 
              ref={imgRef}
              src={selectedImage} 
              alt="Preview"
              crossOrigin="anonymous"
              onLoad={(e) => setImgAspectRatio(e.target.naturalWidth / e.target.naturalHeight)}
              className="max-w-none origin-center transition-transform duration-0"
              style={{ 
                ...(imgAspectRatio && {
                    width: imgAspectRatio > (16/9) ? 'auto' : '100%',
                    height: imgAspectRatio > (16/9) ? '100%' : 'auto',
                }),
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                filter: getFilterString()
              }}
              draggable={false}
            />
          </div>

          {/* 色卡预览 */}
          {extractedPalette && (
             <div className="flex items-center justify-center gap-2">
                <span className="text-[10px] text-gray-500 mr-2">{t('wall.palette')}</span>
                <div className="w-6 h-6 rounded-full shadow-md" style={{ backgroundColor: extractedPalette.primary }} title={t('wall.primary')} />
                <div className="w-6 h-6 rounded-full shadow-md" style={{ backgroundColor: extractedPalette.secondary }} title={t('wall.secondary')} />
                <div className="w-6 h-6 rounded-full shadow-md" style={{ backgroundColor: extractedPalette.accent }} title={t('wall.accent')} />
             </div>
          )}

          {/* 控制栏 */}
          <div className="space-y-6 glass-panel p-4 rounded-2xl">
            {/* 缩放 */}
            <div className="flex items-center gap-3">
                <ZoomIn className="w-4 h-4 text-gray-400" />
                <input 
                  type="range" 
                  min="0.5" 
                  max="3" 
                  step="0.1" 
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor: theme.primary }}
                />
            </div>

             {/* 模糊 */}
             <div className="flex items-center gap-3">
                <Droplet className="w-4 h-4 text-gray-400" />
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  step="1" 
                  value={blurIntensity}
                  onChange={(e) => setBlurIntensity(parseInt(e.target.value))}
                  className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor: theme.secondary }}
                />
                <span className="text-xs text-gray-400 w-8">{blurIntensity}%</span>
            </div>

            {/* 饱和度 */}
            <div className="flex items-center gap-3">
                <Zap className="w-4 h-4 text-gray-400" />
                <input 
                  type="range" 
                  min="0" 
                  max="200" 
                  step="5" 
                  value={saturation}
                  onChange={(e) => setSaturation(parseInt(e.target.value))}
                  className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor: theme.accent }}
                />
                <span className="text-xs text-gray-400 w-8">{saturation}%</span>
            </div>

            {/* 滤镜 */}
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {filters.map(f => (
                <button
                  key={f.name}
                  onClick={() => setFilterType(f.value)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg min-w-[60px] transition-colors ${
                    filterType === f.value ? 'glass-button ring-2 bg-white/10 text-white' : 'glass-button text-gray-400'
                  }`}
                  style={filterType === f.value ? { '--tw-ring-color': theme.primary } : {}}
                >
                  <f.icon className="w-4 h-4" />
                  <span className="text-[10px]">{f.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 保存操作区 */}
          <div className="flex justify-center pt-4 flex-col items-center gap-4">
            {!showSaveOptions ? (
                <button 
                   disabled={isProcessing}
                   onClick={() => setShowSaveOptions(true)}
                   className="flex items-center gap-3 px-8 py-4 rounded-full text-white shadow-lg active:scale-95 transition-all hover:shadow-xl"
                   style={{ 
                       backgroundImage: `linear-gradient(to right, ${theme.primary}, ${theme.secondary})`,
                       boxShadow: `0 10px 15px -3px ${theme.primary}4D`
                   }}
                >
                   {isProcessing ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                   ) : (
                      <CheckCircle className="w-5 h-5" />
                   )}
                   <span className="font-bold">{t('wall.apply')}</span>
                </button>
            ) : (
                <div className="flex gap-4 animate-fade-in w-full justify-center">
                    <button 
                       disabled={isProcessing}
                       onClick={() => handleSaveAction('home')}
                       onMouseEnter={() => setHoverTarget('home')}
                       onMouseLeave={() => setHoverTarget(null)}
                       className="flex-1 max-w-[140px] flex flex-col items-center gap-2 p-3 rounded-2xl glass-button text-white transition-all shadow-lg group"
                       style={hoverTarget === 'home' ? {
                           backgroundColor: theme.primary,
                           borderColor: theme.primary
                       } : {}}
                    >
                       <div 
                           className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center transition-colors"
                           style={hoverTarget === 'home' ? { backgroundColor: theme.secondary } : {}}
                       >
                           <Home className="w-5 h-5" />
                       </div>
                       <span className="text-xs font-bold">{t('wall.setHome')}</span>
                    </button>
                    <button 
                       disabled={isProcessing}
                       onClick={() => handleSaveAction('system')}
                       onMouseEnter={() => setHoverTarget('system')}
                       onMouseLeave={() => setHoverTarget(null)}
                       className="flex-1 max-w-[140px] flex flex-col items-center gap-2 p-3 rounded-2xl glass-button text-white transition-all shadow-lg group"
                       style={hoverTarget === 'system' ? {
                           backgroundColor: theme.secondary,
                           borderColor: theme.secondary
                       } : {}}
                    >
                       <div 
                           className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center transition-colors"
                           style={hoverTarget === 'system' ? { backgroundColor: theme.primary } : {}}
                       >
                           <Monitor className="w-5 h-5" />
                       </div>
                       <span className="text-xs font-bold">{t('wall.setSystem')}</span>
                    </button>
                </div>
            )}
          </div>
          
          <div className="flex justify-center">
             <button onClick={() => setSelectedImage(null)} className="text-xs text-gray-500 hover:text-gray-300 underline">
                {t('wall.reupload')}
             </button>
          </div>

          {/* 隐藏的 Canvas 用于生成最终图片 */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
      </div>
    </div>
  );
}
