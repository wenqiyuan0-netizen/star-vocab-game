import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../../infrastructure/supabaseClient';
import { useAuth } from '../../features/auth/contexts/AuthContext';

export const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    level: 1,
    totalXP: 0,
    checkInDates: [],
    dailyStats: null,
    dailyPlan: null,
    settings: {},
    name: '',
    avatar: null
  });
  const [loading, setLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) {
        setProfile({
            level: 1,
            totalXP: 0,
            checkInDates: [],
            dailyStats: null,
            dailyPlan: null,
            settings: {},
            name: '',
            avatar: null
        });
        return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading profile:', error);
      }

      if (data) {
        setProfile({
          level: data.level || 1,
          totalXP: data.total_xp || 0,
          checkInDates: data.check_in_dates || [],
          dailyStats: data.daily_stats || null,
          dailyPlan: data.daily_plan || null,
          settings: data.settings || {},
          name: data.username || (user.email ? user.email.split('@')[0] : 'Star Explorer'),
          avatar: data.avatar_url
        });
      }
    } catch (err) {
      console.error('Error in loadProfile:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`public:profiles:${user.id}`)
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, 
        (payload) => {
          console.log('Profile updated via realtime:', payload);
          const newData = payload.new;
          setProfile(prev => ({
            ...prev,
            level: newData.level !== undefined ? newData.level : prev.level,
            totalXP: newData.total_xp !== undefined ? newData.total_xp : prev.totalXP,
            checkInDates: newData.check_in_dates !== undefined ? newData.check_in_dates : prev.checkInDates,
            dailyStats: newData.daily_stats !== undefined ? newData.daily_stats : prev.dailyStats,
            dailyPlan: newData.daily_plan !== undefined ? newData.daily_plan : prev.dailyPlan,
            settings: newData.settings !== undefined ? newData.settings : prev.settings,
            name: newData.username !== undefined ? newData.username : prev.name,
            avatar: newData.avatar_url !== undefined ? newData.avatar_url : prev.avatar
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const updateProfile = useCallback(async (updates) => {
    if (!user) return;
    
    // Optimistic update
    setProfile(prev => ({ ...prev, ...updates }));

    try {
        // Map frontend keys to DB keys if necessary
        const dbUpdates = {};
        if (updates.level !== undefined) dbUpdates.level = updates.level;
        if (updates.totalXP !== undefined) dbUpdates.total_xp = updates.totalXP;
        if (updates.checkInDates !== undefined) dbUpdates.check_in_dates = updates.checkInDates;
        if (updates.dailyStats !== undefined) dbUpdates.daily_stats = updates.dailyStats;
        if (updates.dailyPlan !== undefined) dbUpdates.daily_plan = updates.dailyPlan;
        if (updates.settings !== undefined) dbUpdates.settings = updates.settings;
        if (updates.name !== undefined) dbUpdates.username = updates.name;
        if (updates.avatar !== undefined) dbUpdates.avatar_url = updates.avatar;

        const { error } = await supabase
            .from('profiles')
            .update(dbUpdates)
            .eq('id', user.id);

        if (error) throw error;
    } catch (err) {
        console.error('Error updating profile:', err);
        // Revert or reload on error? For now just log.
        loadProfile(); 
    }
  }, [user, loadProfile]);

  return (
    <ProfileContext.Provider value={{ profile, updateProfile, loading, refreshProfile: loadProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}
