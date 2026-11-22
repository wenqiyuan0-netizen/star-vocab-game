import React, { useState } from 'react';
import { BookOpen, Download, X, ChevronRight, Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../../shared/hooks/useTheme';
import { useI18n } from '../../../shared/i18n';
import { withOpacity, generateGenderColors } from '../../../utils/colorUtils';

const PRESET_LIBRARIES = [
  {
    id: 'goethe-a1',
    nameKey: 'preset.a1',
    descKey: 'preset.a1.desc',
    level: 'A1',
    wordCount: 555,
    file: '/dictionaries/goethe-a1.txt'
  },
  {
    id: 'goethe-a2',
    nameKey: 'preset.a2',
    descKey: 'preset.a2.desc',
    level: 'A2',
    wordCount: 1310,
    file: '/dictionaries/goethe-a2.txt'
  },
  {
    id: 'goethe-b1',
    nameKey: 'preset.b1',
    descKey: 'preset.b1.desc',
    level: 'B1',
    wordCount: 2863,
    file: '/dictionaries/goethe-b1.txt'
  },
  {
    id: 'goethe-all',
    nameKey: 'preset.all',
    descKey: 'preset.all.desc',
    level: 'A1-B1',
    wordCount: 3933,
    file: '/dictionaries/goethe-all.txt'
  }
];

export function PresetLibrarySelector({ onImport, onDelete, onClose, importedLibraries = [] }) {
  const theme = useTheme();
  const { t } = useI18n();
  const libraries = PRESET_LIBRARIES.map(l => ({ ...l, name: t(l.nameKey), description: t(l.descKey) }));
  const [loading, setLoading] = useState(false);
  const [selectedLibrary, setSelectedLibrary] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // 要删除的词库信息

  // 生成性别颜色和形容词颜色
  const colors = React.useMemo(() => {
    const genderColors = generateGenderColors(theme, false); // false for dark colors (on light bg)
    return {
      a1: genderColors.der,    // A1 -> Der (Masculine)
      a2: genderColors.die,    // A2 -> Die (Feminine)
      b1: genderColors.das,    // B1 -> Das (Neuter)
      all: theme.primary       // All -> Adjective (Primary)
    };
  }, [theme]);

  const getLibraryColor = (level) => {
    switch (level) {
      case 'A1': return colors.a1;
      case 'A2': return colors.a2;
      case 'B1': return colors.b1;
      case 'A1-B1': return colors.all;
      default: return theme.secondary;
    }
  };

  const handleImport = async (library) => {
    setLoading(true);
    setSelectedLibrary(library.id);

    try {
      const response = await fetch(library.file);
      if (!response.ok) {
        throw new Error(t('preset.loadFail'));
      }

      const text = await response.text();

      // 调用父组件的导入函数，传递词库ID
      onImport(text, library.name, library.id);

      // 短暂延迟后关闭弹窗
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error('导入失败:', error);
      alert(t('preset.importFail', { msg: error.message }));
    } finally {
      setLoading(false);
      setSelectedLibrary(null);
    }
  };

  const handleDeleteClick = (library) => {
    setConfirmDelete(library);
  };

  const confirmDeleteAction = () => {
    if (confirmDelete) {
      onDelete(confirmDelete.id, confirmDelete.name);
      setConfirmDelete(null);
      onClose();
    }
  };

  // 预计算样式变量，确保可见性
  // 用户要求：高可见度，白色偏主题色背景
  const textColor = theme.text;
  const textSubColor = withOpacity(theme.text, 0.65);

  return createPortal(
    <>
    <div className="layer-scrim" onClick={onClose} aria-hidden="true" />
    <div className="layer-modal flex items-center justify-center p-4 pointer-events-none">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('preset.title')}
        className="card-elevated animate-card-pop pointer-events-auto w-full max-w-2xl rounded-[28px] p-4 sm:p-6"
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className="p-1.5 sm:p-2 rounded-lg"
              style={{ backgroundColor: withOpacity(theme.primary, 0.1) }}
            >
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: theme.primary }} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold" style={{ color: textColor }}>{t('preset.title')}</h2>
              <p className="text-xs sm:text-sm" style={{ color: textSubColor }}>{t('preset.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="icon-btn w-9 h-9"
            style={{ color: textSubColor }}
            aria-label={t('download.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 词库列表 */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto overflow-x-hidden custom-scrollbar pr-1 sm:pr-2">
          {libraries.map((library) => {
            const isLoading = loading && selectedLibrary === library.id;
            const isImported = importedLibraries.includes(library.id);
            const levelColor = getLibraryColor(library.level);

            return (
              <div
                key={library.id}
                className="card-surface p-3 sm:p-4 rounded-2xl transition-all hover:-translate-y-0.5"
                style={isLoading ? { borderColor: levelColor } : undefined}
              >
                <div className="flex items-center justify-between gap-2 sm:gap-4">
                  <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                    {/* 等级标签 */}
                    <div
                      className="flex-shrink-0 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg font-bold text-xs sm:text-sm shadow-sm"
                      style={{
                        backgroundColor: levelColor,
                        color: '#ffffff'
                      }}
                    >
                      {library.level}
                    </div>

                    {/* 词库信息 */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm sm:text-lg font-semibold truncate" style={{ color: textColor }}>
                        {library.name}
                        {isImported && (
                          <span className="hidden sm:inline-block ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-600 border border-green-200">
                            {t('preset.imported')}
                          </span>
                        )}
                      </h3>
                      <p className="text-xs sm:text-sm truncate" style={{ color: textSubColor }}>
                        {library.description}
                      </p>
                      <p className="text-[10px] sm:text-xs mt-0.5 sm:mt-1" style={{ color: withOpacity(textColor, 0.5) }}>
                        {t('preset.count', { n: library.wordCount })}
                        {isImported && (
                          <span className="sm:hidden ml-2 text-[10px] px-1.5 py-0 rounded-full bg-green-100 text-green-600 border border-green-200">
                            {t('preset.imported')}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* 导入/删除按钮 */}
                  <div className="flex-shrink-0 ml-1 sm:ml-4">
                    {isLoading ? (
                      <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm" style={{ color: theme.primary }}>
                        <div
                          className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-ping"
                          style={{ backgroundColor: theme.primary }}
                        />
                        <span className="hidden sm:inline">{t('preset.importing')}</span>
                      </div>
                    ) : isImported ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(library);
                        }}
                        className="flex items-center gap-1 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium transition hover:opacity-80 text-xs sm:text-base"
                        style={{
                          backgroundColor: '#fee2e2',
                          color: '#ef4444'
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="whitespace-nowrap">{t('preset.remove')}</span>
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleImport(library);
                        }}
                        className="flex items-center gap-1 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium transition hover:opacity-90 shadow-sm text-xs sm:text-base"
                        style={{
                          backgroundColor: levelColor,
                          color: '#ffffff'
                        }}
                      >
                        <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="whitespace-nowrap">{t('preset.import')}</span>
                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 hidden sm:block" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 提示信息 */}
        <div 
          className="mt-6 p-4 rounded-lg border"
          style={{ 
            backgroundColor: withOpacity(theme.primary, 0.05),
            borderColor: withOpacity(theme.primary, 0.1)
          }}
        >
          <p className="text-sm" style={{ color: textSubColor }}>
            {t('preset.tip')}
          </p>
        </div>
      </div>

      {/* 删除确认对话框 */}
      {confirmDelete && (
        <div className="layer-modal pointer-events-auto flex items-center justify-center p-4" style={{ background: 'var(--scrim)', zIndex: 95 }}>
          <div role="alertdialog" aria-modal="true" className="card-elevated animate-card-pop w-full max-w-md rounded-[28px] p-6">
            <h3 className="text-xl font-bold mb-4" style={{ color: textColor }}>{t('preset.removeTitle', { name: confirmDelete.name })}</h3>
            <p className="mb-6" style={{ color: textSubColor }}>
              {t('preset.removeBody1')}<span className="font-bold text-red-500">{t('preset.removeBodyEm')}</span>{t('preset.removeBody2')}
              <br />
              <br />
              <span className="font-bold text-green-600">{t('preset.removeKeep')}</span>{t('preset.removeKeep2')}
              <br />
              <br />
              {t('preset.removeConfirmQ')}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg transition hover:bg-black/5"
                style={{ color: textSubColor }}
              >
                {t('preset.cancel')}
              </button>
              <button
                onClick={confirmDeleteAction}
                className="px-4 py-2 rounded-lg text-white font-medium hover:opacity-90 transition shadow-sm"
                style={{ backgroundColor: '#ef4444' }}
              >
                {t('preset.confirmRemove')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>,
    document.body
  );
}
