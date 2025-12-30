import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../auth/contexts/AuthContext';
import { useListeningGameLogic } from './logic/useListeningGameLogic';
import { Hub } from './components/Hub';
import { GambleScreen } from './components/GambleScreen';
import { PracticeScreen } from './components/PracticeScreen';
import { DevTools } from './components/DevTools';

export function ListeningGame({ onExit, globalWordDb }) {
  const { user } = useAuth();
  const { 
    view, 
    loading, 
    wallet, 
    activeChallenge, 
    materials, 
    notification, 
    currentWordChallenge, 
    generationFailed,
    actions 
  } = useListeningGameLogic(user?.id, globalWordDb);

  if (loading) {
      return (
          <div className="h-full w-full flex items-center justify-center bg-slate-900 text-white">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
      );
  }

  const renderContent = () => {
      switch (view) {
          case 'hub':
              return (
                  <Hub 
                    onStart={() => actions.startChallenge(300, 'General')}
                    onEarn={actions.goToGamble}
                    onContinue={actions.goToPractice}
                    onMaterials={actions.goToMaterials}
                    hasActiveSession={!!activeChallenge}
                    wallet={wallet}
                    notification={notification}
                    onClearNotification={actions.clearNotification}
                  />
              );
          case 'gamble':
              return (
                  <GambleScreen 
                    wallet={wallet}
                    target={300}
                    challenge={currentWordChallenge}
                    onNext={actions.nextWord}
                    onSubmit={actions.submitResult}
                    hasWords={globalWordDb && globalWordDb.length > 0}
                    generationFailed={generationFailed}
                  />
              );
          case 'practice':
              return (
                  <PracticeScreen 
                    material={activeChallenge?.transcript}
                    onRedeem={actions.completeChallenge}
                  />
              );
          case 'materials':
              return (
                  <div className="p-8 text-white h-full overflow-y-auto">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold">材料库</h2>
                        <button onClick={actions.goToHub} className="text-sm underline opacity-70">返回</button>
                      </div>
                      <div className="grid gap-4">
                           {materials.length === 0 && <p className="text-gray-400">暂无归档材料。</p>}
                           {materials.map(m => (
                               <div key={m.id} className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                                   <h3 className="font-bold text-lg text-cyan-400">{m.title}</h3>
                                   <p className="text-xs text-gray-500 mt-1">{new Date(m.created_at).toLocaleString()}</p>
                                   <p className="text-sm text-gray-300 mt-2 line-clamp-2">{m.content}</p>
                               </div>
                           ))}
                       </div>
                  </div>
              );
          default:
              return <div className="p-8 text-white">Unknown View: {view}</div>;
      }
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-900 text-white animate-fade-in">
      {/* Header - Only show back button on Hub, or handle back navigation internally */}
      {view !== 'hub' && (
        <div className="absolute top-4 left-4 z-50">
             <button 
                onClick={actions.goToHub}
                className="p-2 rounded-full bg-black/20 hover:bg-white/10 transition-colors backdrop-blur-sm"
            >
                <ArrowLeft className="w-6 h-6" />
            </button>
        </div>
      )}

      {/* Global Back to Dashboard (only on Hub) */}
      {view === 'hub' && (
          <div className="p-4 flex items-center justify-between glass-panel rounded-none border-x-0 border-t-0">
            <button 
              onClick={onExit}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold">听说训练</h1>
            <div className="w-10" />
          </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative">
        {renderContent()}
      </div>

      <DevTools onRefresh={actions.refreshData} />
    </div>
  );
}
