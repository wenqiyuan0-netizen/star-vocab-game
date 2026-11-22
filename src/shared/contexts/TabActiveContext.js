import { createContext, useContext } from 'react';

/**
 * Dashboard tabs stay mounted after their first visit (instant switching), so
 * anything a hidden tab renders through a portal (modals) or listens to
 * globally (keyboard) must check whether its tab is the active one.
 */
export const TabActiveContext = createContext(true);

export const useTabActive = () => useContext(TabActiveContext);
