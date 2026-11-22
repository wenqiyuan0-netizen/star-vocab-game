import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from "../../../infrastructure/supabaseClient";
import { CLOUD_CONFIGURED } from "../../../shared/constants/config";

const GUEST_KEY = 'star_vocab_guest_mode'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(CLOUD_CONFIGURED)
  // Guest mode: play fully locally without an account. Offline builds are always guest.
  const [isGuest, setIsGuest] = useState(() => {
    if (!CLOUD_CONFIGURED) return true
    try { return localStorage.getItem(GUEST_KEY) === '1' } catch { return false }
  })

  const enterGuest = () => {
    try { localStorage.setItem(GUEST_KEY, '1') } catch { }
    setIsGuest(true)
  }

  const exitGuest = () => {
    if (!CLOUD_CONFIGURED) return
    try { localStorage.removeItem(GUEST_KEY) } catch { }
    setIsGuest(false)
  }

  useEffect(() => {
    if (!CLOUD_CONFIGURED) return
    // Never hang on a paused / unreachable backend: fall through after 6s
    const fallback = setTimeout(() => setLoading(false), 6000)
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(fallback)
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }).catch(() => { clearTimeout(fallback); setLoading(false) })

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => { clearTimeout(fallback); subscription.unsubscribe() }
  }, [])

  // Auth functions
  const signUp = (email, password, metaData = {}) => {
    return supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: metaData
      }
    })
  }

  const signIn = (email, password) => {
    return supabase.auth.signInWithPassword({ email, password })
  }

  const signOut = async () => {
    if (!user) { exitGuest(); return }
    try {
      // 1. Clear all app-specific local storage to prevent data leakage between accounts
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('space_vocab_') || key.startsWith('star_vocab_') || key === 'sb-access-token' || key === 'sb-refresh-token')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      
      // 2. Sign out from Supabase
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  const value = {
    signUp,
    signIn,
    signOut,
    user,
    session,
    loading,
    isGuest: isGuest && !user,
    enterGuest,
    exitGuest,
    cloudEnabled: CLOUD_CONFIGURED
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
