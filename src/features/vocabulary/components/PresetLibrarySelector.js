import React, { useState } from 'react';
import { BookOpen, Download, X, ChevronRight, Trash2 } from 'lucide-react';
import { useTheme } from '../../../shared/hooks/useTheme';
import { withOpacity, mixColors, generateGenderColors } from '../../../utils/colorUtils';

const PRESET_LIBRARIES = [
  {
    id: 'goethe-a1',
    name: 'Goethe A1 词汇',
    description: '歌德学院 A1 等级词汇表',
    level: 'A1',
    wordCount: 555,
    file: '/dictionaries/goethe-a1.txt'
  },
  {
    id: 'goethe-a2',
    name: 'Goethe A2 词汇',
    description: '歌德学院 A2 等级词汇表',
    level: 'A2',
    wordCount: 1310,
    file: '/dictionaries/goethe-a2.txt'
  },
  {
    id: 'goethe-b1',
    name: 'Goethe B1 词汇',
    description: '歌德学院 B1 等级词汇表',
    level: 'B1',
    wordCount: 2863,
    file: '/dictionaries/goethe-b1.txt'
  },
  {
    id: 'goethe-all',
    name: 'Goethe 全部词汇',
    description: '歌德学院 A1-B1 全部词汇（已去重）',
    level: 'A1-B1',
    wordCount: 3933,
    file: '/dictionaries/goethe-all.txt'
  }
];

export function PresetLibrarySelector({ onImport, onDelete, onClose, importedLibraries = [] }) {
  const theme = useTheme();
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
        throw new Error('无法加载词汇文件');
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
      alert(`导入失败: ${error.message}`);
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
  const modalBg = mixColors('#ffffff', theme.primary, 0.05); // 白色混入5%主题色
  const cardBg = mixColors('#ffffff', theme.primary, 0.02); // 卡片更白一点
  const textColor = '#1f2937'; // 强制深色文本 (Gray 800)
  const textSubColor = '#4b5563'; // 强制次级文本 (Gray 600)
  const borderColor = withOpacity(theme.primary, 0.2);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md transition-colors duration-300"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
    >
      <div 
        className="glass-panel w-full max-w-2xl rounded-2xl p-4 sm:p-6 shadow-2xl animate-fade-in"
        style={{ 
          backgroundColor: withOpacity(modalBg, 0.95), // 高不透明度
          borderColor: borderColor,
          boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
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
              <h2 className="text-lg sm:text-xl font-bold" style={{ color: textColor }}>导入预设词库</h2>
              <p className="text-xs sm:text-sm" style={{ color: textSubColor }}>选择一个词库快速开始学习</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 transition rounded-lg hover:bg-black/5"
            style={{ color: textSubColor }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 词库列表 */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto overflow-x-hidden custom-scrollbar pr-1 sm:pr-2">
          {PRESET_LIBRARIES.map((library) => {
            const isLoading = loading && selectedLibrary === library.id;
            const isImported = importedLibraries.includes(library.id);
            const levelColor = getLibraryColor(library.level);

            return (
              <div
                key={library.id}
                className={`glass-panel p-3 sm:p-4 rounded-xl transition-all border ${
                  isLoading
                    ? 'shadow-lg'
                    : 'hover:scale-[1.01] hover:shadow-md'
                }`}
                style={{
                  backgroundColor: withOpacity(cardBg, 0.8),
                  borderColor: isLoading ? levelColor : withOpacity(theme.primary, 0.1),
                }}
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
                            已导入
                          </span>
                        )}
                      </h3>
                      <p className="text-xs sm:text-sm truncate" style={{ color: textSubColor }}>
                        {library.description}
                      </p>
                      <p className="text-[10px] sm:text-xs mt-0.5 sm:mt-1" style={{ color: withOpacity(textColor, 0.5) }}>
                        共 {library.wordCount} 个单词
                        {isImported && (
                          <span className="sm:hidden ml-2 text-[10px] px-1.5 py-0 rounded-full bg-green-100 text-green-600 border border-green-200">
                            已导入
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
                        <span className="hidden sm:inline">导入中...</span>
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
                        <span className="whitespace-nowrap">移除</span>
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
                        <span className="whitespace-nowrap">导入</span>
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
            💡 提示：导入的单词会自动去重，已存在的单词不会重复添加。
          </p>
        </div>
      </div>

      {/* 删除确认对话框 */}
      {confirmDelete && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-md transition-colors duration-300"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
        >
          <div 
            className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl animate-fade-in"
            style={{ 
              backgroundColor: withOpacity(modalBg, 0.98),
              borderColor: borderColor
            }}
          >
            <h3 className="text-xl font-bold mb-4" style={{ color: textColor }}>移除 {confirmDelete.name}</h3>
            <p className="mb-6" style={{ color: textSubColor }}>
              此操作将移除所有<span className="font-bold text-red-500">从未复习过</span>的单词。
              <br />
              <br />
              <span className="font-bold text-green-600">已经开始学习的单词会被保留</span>，不会丢失进度。
              <br />
              <br />
              确定要移除吗？
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg transition hover:bg-black/5"
                style={{ color: textSubColor }}
              >
                取消
              </button>
              <button
                onClick={confirmDeleteAction}
                className="px-4 py-2 rounded-lg text-white font-medium hover:opacity-90 transition shadow-sm"
                style={{ backgroundColor: '#ef4444' }}
              >
                确认移除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
