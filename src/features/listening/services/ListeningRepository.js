
import { listeningDB, STORES_CONST } from './ListeningDB';
import { supabase } from '../../../infrastructure/supabaseClient';

class ListeningRepository {
    // --- RPC Wrappers (Cloud Sync) ---

    async getRemoteWallet(userId) {
        if (!supabase) return null;
        const { data, error } = await supabase
            .from('listening_wallet')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
            console.error("Error fetching remote wallet:", error);
            return null;
        }
        return data || { balance: 0, penalty_multiplier: 1.0 };
    }

    async getActiveRemoteChallenge(userId) {
        if (!supabase) return null;
        const { data, error } = await supabase
            .from('listening_challenges')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error("Error fetching active challenge:", error);
            return null;
        }
        return data;
    }

    async getRemoteMaterials(userId) {
        if (!supabase) return null;
        const { data, error } = await supabase
            .from('listening_materials')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
            
        if (error) {
            console.error("Error fetching materials:", error);
            return [];
        }
        return data;
    }

    async submitReviewRPC(wordId, rating, timeSpent, charsEarned) {
        if (!supabase) return null;
        const { data, error } = await supabase.rpc('submit_listening_review', {
            p_word_id: wordId,
            p_rating: rating,
            p_time_spent: timeSpent,
            p_chars_earned: charsEarned
        });
        if (error) throw error;
        return data;
    }

    async startChallengeRPC(cost, transcript, audioUrl) {
        if (!supabase) return null;
        const { data, error } = await supabase.rpc('start_listening_challenge', {
            p_cost: cost,
            p_transcript: transcript,
            p_audio_url: audioUrl
        });
        if (error) throw error;
        return data;
    }

    async completeChallengeRPC(challengeId, title, duration) {
        if (!supabase) return null;
        const { data, error } = await supabase.rpc('complete_listening_challenge', {
            p_challenge_id: challengeId,
            p_title: title,
            p_duration: duration
        });
        if (error) throw error;
        return data;
    }

    async checkExpiryRPC() {
        if (!supabase) return null;
        const { data, error } = await supabase.rpc('check_listening_challenge_expiry');
        if (error) {
            console.error("Error checking expiry:", error);
            return null;
        }
        return data;
    }

    // --- Debug RPCs ---
    async debugAddBalance(amount) {
        if (!supabase) return null;
        const { data, error } = await supabase.rpc('debug_add_balance', { p_amount: amount });
        if (error) throw error;
        return data;
    }

    async debugExpireChallenge() {
        if (!supabase) return null;
        const { data, error } = await supabase.rpc('debug_force_expire_challenge');
        if (error) throw error;
        return data;
    }

    async debugResetPenalty() {
        if (!supabase) return null;
        const { data, error } = await supabase.rpc('debug_reset_penalty');
        if (error) throw error;
        return data;
    }

    // --- Sessions (Now mostly for Local Cache / Offline robustness) ---

    async createSession(userId, config) {
        const sessionId = crypto.randomUUID();
        const now = Date.now();
        
        const session = {
            id: sessionId,
            userId,
            status: 'active', // active, completed, expired
            startTime: now,
            lastActiveTime: now,
            config, // { targetChars, riskTier }
            stats: {
                charsEarned: 0,
                score: 0,
                streak: 0,
                mistakes: 0
            },
            updatedAt: now
        };

        // Initialize empty event log
        const eventLog = {
            sessionId,
            events: []
        };

        const db = await listeningDB.getDB();
        const tx = db.transaction([STORES_CONST.SESSIONS, STORES_CONST.EVENTS], 'readwrite');
        
        await Promise.all([
            new Promise((resolve, reject) => {
                const req = tx.objectStore(STORES_CONST.SESSIONS).add(session);
                req.onsuccess = resolve;
                req.onerror = reject;
            }),
            new Promise((resolve, reject) => {
                const req = tx.objectStore(STORES_CONST.EVENTS).add(eventLog);
                req.onsuccess = resolve;
                req.onerror = reject;
            })
        ]);

        return session;
    }

    async getSession(sessionId) {
        return await listeningDB.get(STORES_CONST.SESSIONS, sessionId);
    }

    async getActiveSession(userId) {
        // Find session where userId matches and status is active
        // IndexedDB query might be limited, so we might need to filter manually if compound index not available
        // We have userId index.
        const sessions = await listeningDB.getAll(STORES_CONST.SESSIONS, 'userId', userId);
        // Sort by startTime desc
        sessions.sort((a, b) => b.startTime - a.startTime);
        return sessions.find(s => s.status === 'active') || null;
    }

    async updateSession(session) {
        session.updatedAt = Date.now();
        return await listeningDB.put(STORES_CONST.SESSIONS, session);
    }

    async endSession(sessionId, status = 'completed') {
        const session = await this.getSession(sessionId);
        if (session) {
            session.status = status;
            session.updatedAt = Date.now();
            await listeningDB.put(STORES_CONST.SESSIONS, session);
            return session;
        }
        return null;
    }

    async expireSession(sessionId, userId) {
        const session = await this.getSession(sessionId);
        if (!session || session.status !== 'active') return null;

        // Mark as expired
        session.status = 'expired';
        session.updatedAt = Date.now();
        await listeningDB.put(STORES_CONST.SESSIONS, session);

        // Apply Penalty to Wallet
        // Rule: "下次字数收益折半" -> Set penaltyMultiplier to 0.5
        // Or if we track specific penalty flags. Design doc says "penaltyMultiplier".
        const wallet = await this.getWallet(userId);
        wallet.penaltyMultiplier = 0.5;
        wallet.lastPenaltyAt = Date.now();
        await this.updateWallet(userId, wallet);

        return { session, wallet };
    }

    // --- Events ---

    async appendEvent(sessionId, event) {
        const db = await listeningDB.getDB();
        const tx = db.transaction([STORES_CONST.EVENTS], 'readwrite');
        const store = tx.objectStore(STORES_CONST.EVENTS);

        return new Promise((resolve, reject) => {
            const getReq = store.get(sessionId);
            getReq.onsuccess = () => {
                const data = getReq.result;
                if (data) {
                    data.events.push({
                        ...event,
                        timestamp: Date.now()
                    });
                    const putReq = store.put(data);
                    putReq.onsuccess = () => resolve(true);
                    putReq.onerror = () => reject(putReq.error);
                } else {
                    reject(new Error("Event log not found for session " + sessionId));
                }
            };
            getReq.onerror = () => reject(getReq.error);
        });
    }

    async getEvents(sessionId) {
        const data = await listeningDB.get(STORES_CONST.EVENTS, sessionId);
        return data ? data.events : [];
    }

    // --- Wallet ---

    async getWallet(userId) {
        let wallet = await listeningDB.get(STORES_CONST.WALLET, userId);
        if (!wallet) {
            wallet = {
                userId,
                balance: 0, // Word count balance
                penaltyMultiplier: 1.0,
                updatedAt: Date.now()
            };
            await listeningDB.put(STORES_CONST.WALLET, wallet);
        }
        return wallet;
    }

    async updateWallet(userId, updates) {
        const wallet = await this.getWallet(userId);
        const newWallet = { ...wallet, ...updates, updatedAt: Date.now() };
        await listeningDB.put(STORES_CONST.WALLET, newWallet);
        return newWallet;
    }

    // --- Materials ---

    async createMaterial(material) {
        // material should have id, userId, content, etc.
        if (!material.id) material.id = crypto.randomUUID();
        material.createdAt = Date.now();
        await listeningDB.put(STORES_CONST.MATERIALS, material);
        return material;
    }

    async getMaterials(userId) {
        return await listeningDB.getAll(STORES_CONST.MATERIALS, 'userId', userId);
    }
    
    async getMaterial(id) {
        return await listeningDB.get(STORES_CONST.MATERIALS, id);
    }

    // --- Progress ---
    
    async getProgress(materialId, userId) {
        // We need to find by materialId AND userId. 
        // We have materialId index.
        const progresses = await listeningDB.getAll(STORES_CONST.PROGRESS, 'materialId', materialId);
        const progress = progresses.find(p => p.userId === userId);
        
        if (!progress) {
             // Return a default structure (not saved yet)
             return {
                 id: crypto.randomUUID(),
                 materialId,
                 userId,
                 litSegmentIds: [],
                 isFullyRedeemed: false,
                 totalPracticeSec: 0,
                 updatedAt: Date.now()
             };
        }
        return progress;
    }

    async saveProgress(progress) {
        progress.updatedAt = Date.now();
        await listeningDB.put(STORES_CONST.PROGRESS, progress);
    }
}

export const listeningRepo = new ListeningRepository();
