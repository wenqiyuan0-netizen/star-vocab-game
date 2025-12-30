import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Home, Book, User, Calendar } from 'lucide-react';
import { HomeView } from '../views/HomeView';
import { LibraryView } from '../../vocabulary/components/LibraryView';
import { ProfileView } from '../../profile/components/ProfileView';
import { TodayView } from '../../learning/components/TodayView';
import { useTheme } from '../../../shared/hooks/useTheme';
import { withOpacity } from '../../../utils/colorUtils';
import { DEFAULT_WALLPAPER_URL } from '../../../shared/constants/config';

// 预解码和缓存背景图片
const preloadImage = (url) => {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }

    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = (e) => {
      console.error("Failed to preload image:", url, e);
      resolve(null);
    };
    img.src = url;
  });
};

export function DashboardLayout(props) {
  const [activeTab, setActiveTab] = useState('home');
  const [previousTab, setPreviousTab] = useState('home');
  const [slideDirection, setSlideDirection] = useState('none');
  const [isAnimating, setIsAnimating] = useState(false);
  const [wallpaper, setWallpaper] = useState(null);
  const [cachedWallpapers, setCachedWallpapers] = useState({});
  const theme = useTheme();

  const contentRefs = useRef({
    home: React.createRef(),
    today: React.createRef(),
    library: React.createRef(),
    profile: React.createRef()
  });

  // Touch handling for swipe navigation
  const touchStart = useRef(null);
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    touchStart.current = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    };
  };

  const onTouchEnd = (e) => {
    if (!touchStart.current) return;

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    };

    const diffX = touchStart.current.x - touchEnd.x;
    const diffY = touchStart.current.y - touchEnd.y;
    const absDiffX = Math.abs(diffX);
    const absDiffY = Math.abs(diffY);

    if (absDiffX > minSwipeDistance && absDiffX > absDiffY) {
      const currentIndex = TABS.indexOf(activeTab);
      
      if (diffX > 0) {
        // Swiped Left -> Go Next
        if (currentIndex < TABS.length - 1) {
          handleTabChange(TABS[currentIndex + 1]);
        }
      } else {
        // Swiped Right -> Go Prev
        if (currentIndex > 0) {
          handleTabChange(TABS[currentIndex - 1]);
        }
      }
    }
    touchStart.current = null;
  };

  const TABS = ['home', 'today', 'library', 'profile'];

  // 预加载和解码所有壁纸
  useEffect(() => {
    const loadAllWallpapers = async () => {
      let homeWallStored = localStorage.getItem('star-vocab-wallpaper-home');
      let sysWallStored = localStorage.getItem('star-vocab-wallpaper-system');

      // Clear legacy default wallpapers
      if (sysWallStored && (sysWallStored.includes('logo512.png') || /alphacoders\.com/i.test(sysWallStored))) {
        localStorage.removeItem('star-vocab-wallpaper-system');
        sysWallStored = null;
      }
      if (homeWallStored && (homeWallStored.includes('logo512.png') || /alphacoders\.com/i.test(homeWallStored))) {
        localStorage.removeItem('star-vocab-wallpaper-home');
        homeWallStored = null;
      }

      const homeWall = homeWallStored || DEFAULT_WALLPAPER_URL;
      const sysWall = sysWallStored || DEFAULT_WALLPAPER_URL;

      if (!sysWallStored) {
        localStorage.setItem('star-vocab-wallpaper-system', sysWall);
        window.dispatchEvent(new Event('wallpaper-changed'));
      }

      // 设置当前壁纸 - 立即设置，避免加载延迟
      const currentWallpaper = activeTab === 'home' ? (homeWall || sysWall) : (sysWall || homeWall);
      setWallpaper(currentWallpaper);

      const wallpapersToPreload = [homeWall, sysWall].filter(Boolean);

      const preloaded = {};
      for (const url of wallpapersToPreload) {
        if (url && !cachedWallpapers[url]) {
          const loadedUrl = await preloadImage(url);
          if (loadedUrl) {
            preloaded[url] = loadedUrl;
          }
        }
      }

      if (Object.keys(preloaded).length > 0) {
        setCachedWallpapers(prev => ({ ...prev, ...preloaded }));
      }
    };

    loadAllWallpapers();
  }, [activeTab]);

  useEffect(() => {
    const onWallChange = () => {
      const homeWall = localStorage.getItem('star-vocab-wallpaper-home');
      const sysWall = localStorage.getItem('star-vocab-wallpaper-system');
      const currentWallpaper = activeTab === 'home' ? (homeWall || sysWall) : (sysWall || homeWall);
      setWallpaper(currentWallpaper);
    };
    window.addEventListener('wallpaper-changed', onWallChange);
    return () => {
      window.removeEventListener('wallpaper-changed', onWallChange);
    };
  }, [activeTab]);

  const handleTabChange = (newTab) => {
    if (newTab === activeTab || isAnimating) return;

    const oldIndex = TABS.indexOf(activeTab);
    const newIndex = TABS.indexOf(newTab);

    setPreviousTab(activeTab);
  
    setSlideDirection(newIndex > oldIndex ? 'right' : 'left');
    setIsAnimating(true);
    setActiveTab(newTab);
    setTimeout(() => {
      setIsAnimating(false);
    }, 300);
  };

  // 渲染所有内容视图，但控制显示和动画
  const renderAllContent = () => {
    const getViewAnimationClass = (tabName) => {
      if (!isAnimating) return '';

      // 如果是当前页，应用进场动画
      if (activeTab === tabName) {
        // 如果去右边的Tab (right)，意味着整体左移，新页从右边进来
        return slideDirection === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left';
      }

      // 如果是旧页，应用出场动画
      if (previousTab === tabName) {
        // 如果去右边的Tab (right)，旧页向左移出
        return slideDirection === 'right' ? 'animate-slide-out-left' : 'animate-slide-out-right';
      }

      return '';
    };

    const getViewStyle = (tabName) => {
      const isActive = activeTab === tabName;
      const isPrev = isAnimating && previousTab === tabName;

      if (isActive || isPrev) {
        return {
          opacity: 1,
          pointerEvents: isActive ? 'auto' : 'none', // 只有当前页可点击
          zIndex: isActive ? 10 : 10, // 同层级，靠位置区分
          display: 'block',
          transform: 'translateX(0)' // 默认位置，动画会覆盖它
        };
      } else {
        return {
          opacity: 0,
          pointerEvents: 'none',
          zIndex: 0,
          display: 'none'
        };
      }
    };

    return (
      <>
        {/* Home View - 只在激活或动画中渲染 */}
        {(activeTab === 'home' || (isAnimating && previousTab === 'home')) && (
          <div
            ref={contentRefs.current.home}
            className={`absolute inset-0 pt-safe-top ${getViewAnimationClass('home')}`}
            style={getViewStyle('home')}
          >
            <HomeView
              {...props}
              onStartGame={props.onStartGame}
              onNavigateToLibrary={() => handleTabChange('library')}
            />
          </div>
        )}

        {/* Today View - 只在激活或动画中渲染 */}
        {(activeTab === 'today' || (isAnimating && previousTab === 'today')) && (
          <div
            ref={contentRefs.current.today}
            className={`absolute inset-0 pt-safe-top ${getViewAnimationClass('today')}`}
            style={getViewStyle('today')}
          >
            <TodayView {...props} />
          </div>
        )}

        {/* Library View - 只在激活或动画中渲染 */}
        {(activeTab === 'library' || (isAnimating && previousTab === 'library')) && (
          <div
            ref={contentRefs.current.library}
            className={`absolute inset-0 pt-safe-top ${getViewAnimationClass('library')}`}
            style={getViewStyle('library')}
          >
            <LibraryView {...props} />
          </div>
        )}

        {/* Profile View - 只在激活或动画中渲染 */}
        {(activeTab === 'profile' || (isAnimating && previousTab === 'profile')) && (
          <div
            ref={contentRefs.current.profile}
            className={`absolute inset-0 pt-safe-top ${getViewAnimationClass('profile')}`}
            style={getViewStyle('profile')}
          >
            <ProfileView {...props} />
          </div>
        )}
      </>
    );
  };

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden z-[20]"
      style={{
        backgroundImage: wallpaper ? `url(${wallpaper})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* 主内容区 - 所有视图同时存在，通过 opacity/transform 控制显示 */}
      <div 
        className="flex-1 overflow-hidden relative z-10"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {renderAllContent()}
      </div>

      {/* 底部导航栏 (Glassmorphism) */}
      <div
        className="glass-panel border-b-0 rounded-t-3xl pb-safe pt-2 z-50 relative transition-colors duration-500"
        style={{
          borderColor: withOpacity((Array.isArray(theme.contrast) && theme.contrast.length > 0 ? theme.contrast[0] : theme.primary), 0.2),
          boxShadow: `0 -8px 32px ${withOpacity((Array.isArray(theme.contrast) && theme.contrast.length > 0 ? theme.contrast[0] : theme.primary), 0.06)}`
        }}
      >
        <div className="flex justify-around items-center h-16">
          <NavButton
            icon={Home}
            label="主页"
            isActive={activeTab === 'home'}
            onClick={() => handleTabChange('home')}
            activeColor={theme.primary}
          />
          <NavButton
            icon={Calendar}
            label="今日"
            isActive={activeTab === 'today'}
            onClick={() => handleTabChange('today')}
            activeColor={theme.primary}
          />
          <NavButton
            icon={Book}
            label="词库"
            isActive={activeTab === 'library'}
            onClick={() => handleTabChange('library')}
            activeColor={theme.primary}
          />
          <NavButton
            icon={User}
            label="我的"
            isActive={activeTab === 'profile'}
            onClick={() => handleTabChange('profile')}
            activeColor={theme.primary}
          />
        </div>
      </div>
    </div>
  );
}

function NavButton({ icon: Icon, label, isActive, onClick, activeColor }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-16 space-y-1 transition-colors duration-200 ${isActive ? '' : 'text-gray-400 hover:text-gray-200'
        }`}
      style={{ color: isActive ? activeColor : undefined }}
    >
      <Icon className={`w-6 h-6 transition-transform ${isActive ? 'scale-110' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
      <span className={`text-[10px] font-medium ${isActive ? 'font-bold' : ''}`}>{label}</span>
    </button>
  );
}
