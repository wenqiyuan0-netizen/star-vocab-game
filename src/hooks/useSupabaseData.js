import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { appWordToDbWord, dbWordToAppWord } from '../utils/supabaseUtils';
import { DEFAULT_WORDS } from '../logic/constants';

export function useSupabaseData() {
  const { user } = useAuth();
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // Fetch all words for the user
  const loadWords = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_words')
        .select('*');
      
      if (error) throw error;

      if (data && data.length > 0) {
        const appWords = data.map(dbWordToAppWord);
        // Sort by German word for consistency
        appWords.sort((a, b) => a.de.localeCompare(b.de, 'de', { sensitivity: 'base' }));
        setWords(appWords);
      } else {
        // No data in DB. 
        // Check if we should migrate local storage or use defaults.
        // For now, we just return empty list and let the consumer decide, 
        // OR we can handle migration here.
        setWords([]); 
      }
    } catch (err) {
      console.error('Error loading words:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [user]);

  // Sync a single word (Upsert)
  const syncWord = async (word) => {
    if (!user) return;
    try {
      const dbPayload = appWordToDbWord(word, user.id);
      
      // If the word has a temporary ID (not UUID) and we are syncing, 
      // we should probably query by (user_id, de, gender) to avoid duplicates
      // or just let Supabase handle the unique constraint if we didn't pass ID.
      // However, appWordToDbWord passes ID only if UUID. 
      // If it's not UUID, we omit ID, so Supabase creates a NEW row.
      // BUT we have a unique constraint on (user_id, de, gender).
      // So we should use onConflict.

      const { data, error } = await supabase
        .from('user_words')
        .upsert(dbPayload, { onConflict: 'user_id, de, gender' })
        .select()
        .single();

      if (error) throw error;

      // Update local state with the returned data (especially useful for getting the new UUID)
      const newAppWord = dbWordToAppWord(data);
      setWords(prev => {
        const index = prev.findIndex(w => w.de === newAppWord.de && w.gender === newAppWord.gender);
        if (index !== -1) {
          const newWords = [...prev];
          newWords[index] = { ...prev[index], ...newAppWord }; // Preserve any local-only props?
          return newWords;
        } else {
          return [...prev, newAppWord];
        }
      });
      
      return newAppWord;
    } catch (err) {
      console.error('Error syncing word:', err);
      // Don't block UI, just log
      return null;
    }
  };

  // Batch sync (for migration or bulk import)
  const syncWordsBatch = async (wordsToSync) => {
    if (!user || wordsToSync.length === 0) return;
    try {
      const payload = wordsToSync.map(w => appWordToDbWord(w, user.id));
      
      const { data, error } = await supabase
        .from('user_words')
        .upsert(payload, { onConflict: 'user_id, de, gender' })
        .select();

      if (error) throw error;

      // Refresh local state
      const syncedWords = data.map(dbWordToAppWord);
      // We should probably merge this with existing words state
      // For simplicity, let's just reload everything or intelligently merge
      // Reloading is safer to ensure consistency
      await loadWords();
      
      return syncedWords;
    } catch (err) {
      console.error('Error batch syncing:', err);
    }
  };

  const deleteWord = async (wordId) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('user_words')
        .delete()
        .eq('id', wordId);

      if (error) throw error;

      setWords(prev => prev.filter(w => w.id !== wordId));
    } catch (err) {
      console.error('Error deleting word:', err);
    }
  };

  const deleteWordsBatch = async (wordIds) => {
    if (!user || !Array.isArray(wordIds) || wordIds.length === 0) return;
    try {
      // Convert Set to Array if needed, though we expect array here
      const ids = Array.from(wordIds);
      
      const { error } = await supabase
        .from('user_words')
        .delete()
        .in('id', ids);

      if (error) throw error;

      setWords(prev => prev.filter(w => !ids.includes(w.id)));
    } catch (err) {
      console.error('Error deleting words batch:', err);
    }
  };

  return {
    words,
    setWords, // Allow local optimistic updates
    loading,
    error,
    initialized,
    loadWords,
    syncWord,
    syncWordsBatch,
    deleteWord,
    deleteWordsBatch
  };
}
