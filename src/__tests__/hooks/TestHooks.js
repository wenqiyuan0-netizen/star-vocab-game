import React, { useEffect } from 'react';
import { useSettings } from '../../shared/hooks/useSettings';
import { useGameState } from '../../shared/hooks/useGameState';

function TestHooksIntegration() {
    const {
        settings,
        updateSettings: updateSettingsHook,
    } = useSettings(false);

    const {
        gameState,
        uiScore,
        uiLives,
        combo,
        maxCombo,
        message,
        addScore,
        loseLife,
        incrementCombo,
        resetCombo,
        changeGameState,
        showMessage,
        resetGame,
    } = useGameState();

    useEffect(() => {
        console.log('🎮 Both Hooks Loaded');
        console.log('Settings:', settings);
        console.log('Game State:', gameState);
    }, [settings, gameState]);

    return (
        <div style={{
            padding: '40px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            minHeight: '100vh',
            color: '#fff',
            fontFamily: 'Arial, sans-serif'
        }}>
            <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                borderRadius: '20px',
                padding: '30px',
                maxWidth: '1000px',
                margin: '0 auto',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
            }}>
                <h1 style={{ marginBottom: '30px' }}>🧪 Hooks集成测试</h1>

                {/* 消息显示 */}
                {message && (
                    <div style={{
                        background: 'rgba(76, 175, 80, 0.3)',
                        border: '2px solid rgba(76, 175, 80, 0.6)',
                        borderRadius: '10px',
                        padding: '15px',
                        marginBottom: '20px',
                        textAlign: 'center',
                        fontWeight: 'bold'
                    }}>
                        {message}
                    </div>
                )}

                {/* 两列布局 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

                    {/* 左列：useSettings */}
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '15px',
                        padding: '20px'
                    }}>
                        <h2 style={{ marginTop: 0, borderBottom: '2px solid rgba(255,255,255,0.3)', paddingBottom: '10px' }}>
                            ⚙️ useSettings
                        </h2>

                        <div style={{ marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '14px', opacity: 0.8 }}>当前设置</h3>
                            <table style={{ width: '100%', fontSize: '13px' }}>
                                <tbody>
                                    <tr><td>难度:</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{settings.difficulty}</td></tr>
                                    <tr><td>速度:</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{settings.speed?.toFixed(2)}</td></tr>
                                    <tr><td>maxOnScreen:</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{settings.maxOnScreen}</td></tr>
                                    <tr><td>spawnRate:</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{settings.spawnRate}ms</td></tr>
                                    <tr><td>每日新词:</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{settings.dailyNewLimit}</td></tr>
                                    <tr><td>每日复习:</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{settings.dailyReviewLimit}</td></tr>
                                    <tr><td>TTS模式:</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{settings.ttsMode}</td></tr>
                                </tbody>
                            </table>
                        </div>

                        <h3 style={{ fontSize: '14px', opacity: 0.8 }}>操作</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            <button onClick={() => updateSettingsHook({ difficulty: 1 })} style={smallButtonStyle}>难度=1</button>
                            <button onClick={() => updateSettingsHook({ difficulty: 5 })} style={smallButtonStyle}>难度=5</button>
                            <button onClick={() => updateSettingsHook({ difficulty: 10 })} style={smallButtonStyle}>难度=10</button>
                            <button onClick={() => updateSettingsHook({ dailyNewLimit: 5 })} style={smallButtonStyle}>新词=5</button>
                            <button onClick={() => updateSettingsHook({ dailyNewLimit: 20 })} style={smallButtonStyle}>新词=20</button>
                            <button onClick={() => updateSettingsHook({ ttsMode: 'word', speakDe: true, speakCn: true })} style={smallButtonStyle}>TTS: Word (De+Cn)</button>
                            <button onClick={() => updateSettingsHook({ ttsMode: 'sentence' })} style={smallButtonStyle}>TTS: Sentence (De)</button>
                            <button onClick={() => updateSettingsHook({ ttsMode: 'none' })} style={smallButtonStyle}>TTS: Off</button>
                        </div>
                    </div>

                    {/* 右列：useGameState */}
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '15px',
                        padding: '20px'
                    }}>
                        <h2 style={{ marginTop: 0, borderBottom: '2px solid rgba(255,255,255,0.3)', paddingBottom: '10px' }}>
                            🎮 useGameState
                        </h2>

                        <div style={{ marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '14px', opacity: 0.8 }}>当前状态</h3>
                            <table style={{ width: '100%', fontSize: '13px' }}>
                                <tbody>
                                    <tr><td>游戏状态:</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{gameState}</td></tr>
                                    <tr><td>分数:</td><td style={{ textAlign: 'right', fontWeight: 'bold', color: '#4CAF50' }}>{uiScore}</td></tr>
                                    <tr><td>生命值:</td><td style={{ textAlign: 'right', fontWeight: 'bold', color: '#F44336' }}>{uiLives}</td></tr>
                                    <tr><td>连击:</td><td style={{ textAlign: 'right', fontWeight: 'bold', color: '#FFD700' }}>{combo}x</td></tr>
                                    <tr><td>最大连击:</td><td style={{ textAlign: 'right', fontWeight: 'bold', color: '#FF9800' }}>{maxCombo}x</td></tr>
                                </tbody>
                            </table>
                        </div>

                        <h3 style={{ fontSize: '14px', opacity: 0.8 }}>操作</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '15px' }}>
                            <button onClick={() => addScore(100)} style={smallButtonStyle}>+100分</button>
                            <button onClick={() => addScore(500)} style={smallButtonStyle}>+500分</button>
                            <button onClick={() => loseLife()} style={{ ...smallButtonStyle, background: 'rgba(244, 67, 54, 0.3)' }}>-1生命</button>
                            <button onClick={() => {
                                const newCombo = incrementCombo();
                                addScore(100 + newCombo * 10);
                            }} style={{ ...smallButtonStyle, background: 'rgba(255, 215, 0, 0.3)' }}>连击+1</button>
                            <button onClick={resetCombo} style={smallButtonStyle}>重置连击</button>
                            <button onClick={() => showMessage('测试消息！', 3000)} style={smallButtonStyle}>显示消息</button>
                        </div>

                        <h3 style={{ fontSize: '14px', opacity: 0.8 }}>游戏状态切换</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            <button onClick={() => changeGameState('menu')} style={smallButtonStyle}>Menu</button>
                            <button onClick={() => changeGameState('playing')} style={{ ...smallButtonStyle, background: 'rgba(76, 175, 80, 0.3)' }}>Playing</button>
                            <button onClick={() => changeGameState('pause')} style={smallButtonStyle}>Pause</button>
                            <button onClick={() => changeGameState('win')} style={{ ...smallButtonStyle, background: 'rgba(255, 215, 0, 0.3)' }}>Win</button>
                            <button onClick={() => changeGameState('gameover')} style={{ ...smallButtonStyle, background: 'rgba(244, 67, 54, 0.3)' }}>Game Over</button>
                            <button onClick={() => resetGame(5)} style={{ ...smallButtonStyle, background: 'rgba(33, 150, 243, 0.3)' }}>重置游戏</button>
                        </div>
                    </div>
                </div>

                {/* 验证清单 */}
                <div style={{
                    marginTop: '30px',
                    background: 'rgba(76, 175, 80, 0.2)',
                    border: '2px solid rgba(76, 175, 80, 0.5)',
                    borderRadius: '10px',
                    padding: '20px'
                }}>
                    <h3 style={{ marginTop: 0 }}>✅ 测试验证清单</h3>
                    <ol style={{ fontSize: '14px', lineHeight: '1.8', paddingLeft: '25px' }}>
                        <li><strong>useSettings测试:</strong>
                            <ul style={{ marginTop: '5px' }}>
                                <li>点击"难度=10"，检查速度是否自动更新为2.90</li>
                                <li>点击"新词=20"，检查localStorage是否更新</li>
                                <li>点击"TTS: Word/Sentence"，检查ttsMode切换</li>
                                <li>刷新页面，检查设置是否持久化</li>
                            </ul>
                        </li>
                        <li><strong>useGameState测试:</strong>
                            <ul style={{ marginTop: '5px' }}>
                                <li>点击"+100分"多次，检查分数累加</li>
                                <li>点击"连击+1"多次，检查连击和最大连击</li>
                                <li>点击"-1生命"，检查生命值减少且连击重置</li>
                                <li>点击"Playing"，检查游戏状态切换</li>
                                <li>点击"重置游戏"，检查所有状态归零</li>
                            </ul>
                        </li>
                        <li><strong>协同测试:</strong>
                            <ul style={{ marginTop: '5px' }}>
                                <li>两个hooks互不干扰，独立运行</li>
                                <li>Console无错误</li>
                            </ul>
                        </li>
                    </ol>
                </div>

                {/* Debug信息 */}
                <details style={{
                    marginTop: '20px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '10px',
                    padding: '15px'
                }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>🔍 Debug信息（点击展开）</summary>
                    <div style={{ marginTop: '15px' }}>
                        <h4>Settings JSON:</h4>
                        <pre style={{
                            background: 'rgba(0, 0, 0, 0.5)',
                            padding: '10px',
                            borderRadius: '5px',
                            overflow: 'auto',
                            fontSize: '11px'
                        }}>
                            {JSON.stringify(settings, null, 2)}
                        </pre>

                        <h4 style={{ marginTop: '15px' }}>Game State:</h4>
                        <pre style={{
                            background: 'rgba(0, 0, 0, 0.5)',
                            padding: '10px',
                            borderRadius: '5px',
                            overflow: 'auto',
                            fontSize: '11px'
                        }}>
                            {JSON.stringify({ gameState, uiScore, uiLives, combo, maxCombo }, null, 2)}
                        </pre>
                    </div>
                </details>
            </div>
        </div >
    );
}

const smallButtonStyle = {
    background: 'rgba(255, 255, 255, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '8px',
    padding: '8px 12px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    transition: 'all 0.2s ease'
};

export default TestHooksIntegration;
