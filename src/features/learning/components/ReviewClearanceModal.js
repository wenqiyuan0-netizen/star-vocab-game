import React from 'react';
import { AlertTriangle, TrendingDown, Calendar, CheckCircle } from 'lucide-react';
import { useI18n } from '../../../shared/i18n';
import { useTheme } from '../../../shared/hooks/useTheme';
import { withOpacity } from '../../../utils/colorUtils';

export function ReviewClearanceModal({
    backlogInfo,
    onConfirm,
    onCancel
}) {
    const theme = useTheme();
    const { t } = useI18n();

    if (!backlogInfo || !backlogInfo.needsAdjustment) return null;

    const {
        backlogCount,
        threshold,
        originalNewLimit,
        originalReviewLimit,
        adaptedNewLimit,
        adaptedReviewLimit,
        estimatedDays,
        clearanceRatio
    } = backlogInfo;

    return (
        <div
            className="layer-modal flex items-center justify-center p-4"
            style={{ background: 'var(--scrim)', zIndex: 100 }}
            onClick={onCancel}
        >
            <div
                role="dialog"
                aria-modal="true"
                className="card-elevated animate-card-pop w-full max-w-md rounded-[28px] p-6"
                onClick={e => e.stopPropagation()}
            >
                {/* 标题 */}
                <div className="flex items-center gap-3 mb-6">
                    <div
                        className="p-3 rounded-xl"
                        style={{
                            backgroundColor: withOpacity(theme.accent, 0.15),
                            color: theme.accent
                        }}
                    >
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold" style={{ color: theme.text }}>
                            {t('clear.title')}
                        </h2>
                        <p className="text-sm" style={{ color: withOpacity(theme.text, 0.6) }}>
                            {t('clear.subtitle')}
                        </p>
                    </div>
                </div>

                {/* 积压情况 */}
                <div
                    className="rounded-xl p-4 mb-4"
                    style={{
                        backgroundColor: withOpacity(theme.primary, 0.08),
                        border: `1px solid ${withOpacity(theme.primary, 0.2)}`
                    }}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="w-4 h-4" style={{ color: theme.accent }} />
                        <span className="text-sm font-semibold" style={{ color: theme.text }}>
                            {t('clear.status')}
                        </span>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                            <span style={{ color: withOpacity(theme.text, 0.7) }}>{t('clear.backlog')}</span>
                            <span className="font-mono font-bold" style={{ color: theme.accent }}>
                                {t('clear.count', { n: backlogCount })}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span style={{ color: withOpacity(theme.text, 0.7) }}>{t('clear.normal')}</span>
                            <span className="font-mono" style={{ color: withOpacity(theme.text, 0.8) }}>
                                {t('clear.perDay', { n: originalReviewLimit })}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span style={{ color: withOpacity(theme.text, 0.7) }}>{t('clear.level')}</span>
                            <span className="font-mono" style={{ color: theme.accent }}>
                                {Math.round(backlogCount / threshold * 100)}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* 调整方案 */}
                <div
                    className="rounded-xl p-4 mb-4"
                    style={{
                        backgroundColor: withOpacity(theme.secondary, 0.08),
                        border: `1px solid ${withOpacity(theme.secondary, 0.2)}`
                    }}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4" style={{ color: theme.secondary }} />
                        <span className="text-sm font-semibold" style={{ color: theme.text }}>
                            {t('clear.suggest')}
                        </span>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span style={{ color: withOpacity(theme.text, 0.6) }}>{t('clear.reviewLimit')}</span>
                                <span className="font-mono">
                                    <span style={{ color: withOpacity(theme.text, 0.5) }}>{originalReviewLimit}</span>
                                    <span style={{ color: withOpacity(theme.text, 0.5) }} className="mx-1">→</span>
                                    <span style={{ color: theme.secondary }} className="font-bold">{adaptedReviewLimit}</span>
                                </span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: withOpacity(theme.text, 0.1) }}>
                                <div
                                    className="h-full transition-all duration-300"
                                    style={{
                                        width: `${clearanceRatio * 100}%`,
                                        backgroundColor: theme.secondary
                                    }}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span style={{ color: withOpacity(theme.text, 0.6) }}>{t('clear.newLimit')}</span>
                                <span className="font-mono">
                                    <span style={{ color: withOpacity(theme.text, 0.5) }}>{originalNewLimit}</span>
                                    <span style={{ color: withOpacity(theme.text, 0.5) }} className="mx-1">→</span>
                                    <span style={{ color: theme.primary }} className="font-bold">{adaptedNewLimit}</span>
                                </span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: withOpacity(theme.text, 0.1) }}>
                                <div
                                    className="h-full transition-all duration-300"
                                    style={{
                                        width: `${(1 - clearanceRatio) * 100}%`,
                                        backgroundColor: theme.primary
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 时间估算 */}
                <div
                    className="rounded-xl p-4 mb-6"
                    style={{
                        backgroundColor: withOpacity(theme.primary, 0.08),
                        border: `1px dashed ${withOpacity(theme.primary, 0.3)}`
                    }}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4" style={{ color: theme.primary }} />
                        <span className="text-sm font-semibold" style={{ color: theme.text }}>
                            {t('clear.eta')}
                        </span>
                    </div>
                    <div className="text-center py-2">
                        <span className="text-3xl font-bold font-mono" style={{ color: theme.primary }}>
                            {estimatedDays}
                        </span>
                        <span className="text-lg ml-2" style={{ color: withOpacity(theme.text, 0.7) }}>
                            {t('clear.days')}
                        </span>
                    </div>
                    <p className="text-xs text-center mt-2" style={{ color: withOpacity(theme.text, 0.5) }}>
                        {t('clear.restoreNote')}
                    </p>
                </div>

                {/* 按钮 */}
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-3 rounded-xl text-sm font-bold transition-all"
                        style={{
                            backgroundColor: withOpacity(theme.text, 0.1),
                            color: withOpacity(theme.text, 0.8),
                            border: `1px solid ${withOpacity(theme.text, 0.2)}`
                        }}
                    >
                        {t('clear.keep')}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-3 rounded-xl text-sm font-bold transition-all shadow-lg"
                        style={{
                            backgroundColor: theme.primary,
                            color: theme.roles?.buttonPrimaryText || '#ffffff',
                            border: `1px solid ${withOpacity(theme.primary, 0.5)}`
                        }}
                    >
                        {t('clear.enable')}
                    </button>
                </div>
            </div>
        </div>
    );
}
