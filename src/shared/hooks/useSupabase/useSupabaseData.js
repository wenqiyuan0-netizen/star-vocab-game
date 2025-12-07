import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../infrastructure/supabaseClient';
import { useAuth } from '../../../features/auth/contexts/AuthContext';
import { appWordToDbWord, dbWordToAppWord } from '../../../utils/supabaseUtils';
import { DEFAULT_WORDS } from '../../../logic/constants';

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
        .select('*')
        .eq('user_id', user.id);

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
      // Ensure gender is null if it's falsy (empty string, undefined, etc) to match DB unique constraint logic
      // if we want to be strict. BUT our DB constraint is (user_id, de, gender).
      // The fix we applied uses NULLS NOT DISTINCT, so 'word' and null are treated same.
      // We just need to ensure we send consistent data.
      const dbPayload = appWordToDbWord(word, user.id);

      const { data, error } = await supabase
        .from('user_words')
        .upsert(dbPayload, { onConflict: 'user_id, de, gender' })
        .select()
        .single();

      if (error) throw error;

      // Update local state with the returned data (especially useful for getting the new UUID)
      const newAppWord = dbWordToAppWord(data);
      setWords(prev => {
        // We match by ID if available, or by content if not
        const index = prev.findIndex(w => w.id === newAppWord.id || (w.de === newAppWord.de && w.gender === newAppWord.gender));
        if (index !== -1) {
          const newWords = [...prev];
          newWords[index] = { ...prev[index], ...newAppWord };
          return newWords;
        } else {
          return [...prev, newAppWord];
        }
      });

      return newAppWord;
    } catch (err) {
      console.error('Error syncing word:', err);
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

      const syncedWords = data.map(dbWordToAppWord);
      setWords(prev => {
        const contentMap = new Map(); // de|gender -> word
        const idMap = new Map();      // uuid -> word

        // Helper: is UUID? (Supabase UUIDs are 36 chars)
        const isUuid = (id) => id && id.length > 20; 

        // 1. Index local words
        prev.forEach(w => {
          if (isUuid(w.id)) {
            idMap.set(w.id, w);
          } else {
            // Temp ID or no ID - index by content to catch duplicates during merge
            contentMap.set(`${w.de}|${w.gender}`, w);
          }
        });

        // 2. Merge synced words
        syncedWords.forEach(w => {
          const key = `${w.de}|${w.gender}`;
          
          // If we have a local word with this content (temp ID), we replace it with the synced word
          if (contentMap.has(key)) {
            contentMap.delete(key); // Remove the temp/duplicate one
          }
          
          // If we have a local word with this ID, we update it
          // Or if it's a new word from server, we add it
          idMap.set(w.id, w);
        });

        // 3. Combine and return
        const combined = [
          ...idMap.values(),
          ...contentMap.values()
        ];
        
        return combined.sort((a, b) => a.de.localeCompare(b.de, 'de', { sensitivity: 'base' }));
      });
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
