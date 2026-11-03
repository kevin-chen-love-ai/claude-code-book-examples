/**
 * Authentication module using Supabase Auth
 * Supports email/password, Google, and GitHub login
 */

// Use API_URL from window (set by blog.js or other modules)
// Don't declare const API_URL to avoid conflicts with other modules
if (!window.API_URL) {
    window.API_URL = window.env?.API_URL || 'http://localhost:8000';
}

// Supabase configuration - will be initialized after env.js loads
let SUPABASE_URL = '';
let SUPABASE_ANON_KEY = '';
let supabaseClient = null;
let isInitializingClient = false;

// Function to initialize Supabase client - ensure single instance
async function initSupabaseClient() {
    // If already initialized, return existing client
    if (supabaseClient) {
        return true;
    }

    // If currently initializing, return false (will use existing when ready)
    if (isInitializingClient) {
        return false;
    }

    isInitializingClient = true;

    try {
        // First try direct meta tags (most reliable)
        const urlMeta = document.querySelector('meta[name="supabase-url"]');
        const keyMeta = document.querySelector('meta[name="supabase-anon-key"]');

        if (urlMeta) SUPABASE_URL = urlMeta.getAttribute('content') || '';
        if (keyMeta) SUPABASE_ANON_KEY = keyMeta.getAttribute('content') || '';

        // Then try to get from window.env (loaded by env.js) as fallback
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            SUPABASE_URL = window.env?.SUPABASE_URL || SUPABASE_URL || '';
            SUPABASE_ANON_KEY = window.env?.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY || '';
        }
        
        // If no Supabase config, silently fail (for pages that don't need auth)
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            isInitializingClient = false;
            return false;
        }

        // Wait for window.supabase to be available (if not yet loaded)
        if (SUPABASE_URL && SUPABASE_ANON_KEY && !window.supabase) {
            // Wait a bit for Supabase JS to load (max 2 seconds)
            let waitCount = 0;
            while (!window.supabase && waitCount < 20) {
                await new Promise(resolve => setTimeout(resolve, 100));
                waitCount++;
            }
        }

        // Initialize Supabase client if we have both URL and key
        if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase && !supabaseClient) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                storage: window.localStorage,
                autoRefreshToken: true,
                persistSession: true
            });
            console.log('✅ Supabase client initialized');
            isInitializingClient = false;
            return true;
        }

        if (SUPABASE_URL && SUPABASE_ANON_KEY && !window.supabase) {
            console.warn('⚠️ Supabase JS library not loaded. Check if CDN script is loaded.');
        } else {
            console.warn('⚠️ Supabase not initialized. URL:', SUPABASE_URL ? '✅' : '❌', 'Key:', SUPABASE_ANON_KEY ? '✅' : '❌');
        }
        isInitializingClient = false;
        return false;
    } catch (error) {
        console.error('Error initializing Supabase client:', error);
        isInitializingClient = false;
        return false;
    }
}

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.listeners = [];
        this.supabaseClient = null;
        // Delay init to ensure env.js has loaded
        setTimeout(() => this.init(), 200);
    }

    async init() {
        // Always use global supabaseClient if available (single instance)
        if (supabaseClient) {
            this.supabaseClient = supabaseClient;
        } else {
            // Try to initialize Supabase client if not already done
            if (typeof initSupabaseClient === 'function') {
                await initSupabaseClient();
            }

            // Use global supabaseClient after initialization
            if (supabaseClient) {
                this.supabaseClient = supabaseClient;
            }
        }

        if (!this.supabaseClient) {
            // Only log in development
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.warn('Supabase not initialized. Please configure SUPABASE_URL and SUPABASE_ANON_KEY');
            }
            return;
        }

        // Check if user is already logged in (with error handling)
        try {
            const { data: { session }, error } = await this.supabaseClient.auth.getSession();
            if (error) {
                // Silently handle session errors (network issues, etc.)
                return;
            }
            if (session) {
                this.currentUser = session.user;
                this.notifyListeners();
            }
        } catch (error) {
            // Silently handle session errors (network issues, etc.)
            // Don't log to avoid console spam for pages that don't need auth
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                // Only log in development
                console.warn('Supabase session check failed (this is OK if network is unavailable):', error.message);
            }
        }

        // Listen for auth state changes (with error handling)
        try {
            this.supabaseClient.auth.onAuthStateChange((event, session) => {
                try {
                    if (event === 'SIGNED_IN') {
                        this.currentUser = session?.user || null;
                        this.notifyListeners();
                    } else if (event === 'SIGNED_OUT') {
                        this.currentUser = null;
                        this.notifyListeners();
                    }
                    if (event === 'TOKEN_REFRESHED' && session) {
                        this.currentUser = session.user;
                        this.notifyListeners();
                    }
                } catch (error) {
                    // Silently handle auth state change errors (network issues, etc.)
                    // Don't log to avoid console spam
                }
            });
        } catch (error) {
            // Silently handle auth listener setup errors
            // This allows pages to work even if Supabase has network issues
        }
    }

    // Register with email and password
    async register(email, password, fullName = '') {
        try {
            if (!this.supabaseClient) {
                await this.init();
            }

            if (!this.supabaseClient) {
                throw new Error('Supabase not initialized. Please configure SUPABASE_URL and SUPABASE_ANON_KEY');
            }

            const { data, error } = await this.supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName
                    },
                    emailRedirectTo: window.location.origin + '/login.html'
                }
            });

            if (error) throw error;

            return {
                success: true,
                user: data.user,
                session: data.session,
                needsEmailConfirmation: !data.session && data.user === null
            };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: error.message };
        }
    }

    // Login with email and password
    async login(email, password) {
        try {
            // Wait for Supabase client to be initialized
            if (!this.supabaseClient) {
                await this.init();
            }

            // If still not initialized, wait a bit more and try again
            if (!this.supabaseClient) {
                // Try to initialize Supabase client
                await initSupabaseClient();
                await this.init();
            }

            // If still not initialized after all attempts
            if (!this.supabaseClient) {
                throw new Error('Authentication system is initializing. Please wait a moment and try again.');
            }

            const { data, error } = await this.supabaseClient.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                if (error.message && (
                    error.message.toLowerCase().includes('email not confirmed') ||
                    error.message.toLowerCase().includes('email_not_confirmed') ||
                    error.message.toLowerCase().includes('confirmation')
                )) {
                    throw new Error('Please check your email and confirm your account before logging in. Click the confirmation link in your email.');
                }
                throw error;
            }

            this.currentUser = data.user;
            return { success: true, user: data.user, session: data.session };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    }

    // Login with Google
    async loginWithGoogle() {
        try {
            if (!this.supabaseClient) {
                await this.init();
            }

            if (!this.supabaseClient) {
                throw new Error('Supabase not initialized. Please configure SUPABASE_URL and SUPABASE_ANON_KEY');
            }

            const { data, error } = await this.supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + window.location.pathname
                }
            });

            if (error) throw error;
            return { success: true, url: data.url };
        } catch (error) {
            console.error('Google login error:', error);
            return { success: false, error: error.message };
        }
    }

    // Login with GitHub
    async loginWithGitHub() {
        try {
            if (!this.supabaseClient) {
                await this.init();
            }

            if (!this.supabaseClient) {
                throw new Error('Supabase not initialized. Please configure SUPABASE_URL and SUPABASE_ANON_KEY');
            }

            const { data, error } = await this.supabaseClient.auth.signInWithOAuth({
                provider: 'github',
                options: {
                    redirectTo: window.location.origin + window.location.pathname
                }
            });

            if (error) throw error;
            return { success: true, url: data.url };
        } catch (error) {
            console.error('GitHub login error:', error);
            return { success: false, error: error.message };
        }
    }

    // Logout
    async logout() {
        try {
            if (!this.supabaseClient) {
                await this.init();
            }

            if (!this.supabaseClient) {
                throw new Error('Supabase not initialized. Please configure SUPABASE_URL and SUPABASE_ANON_KEY');
            }

            const { error } = await this.supabaseClient.auth.signOut();
            if (error) throw error;

            // Clear current user and notify listeners
            this.currentUser = null;
            this.notifyListeners();

            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            // Even if there's an error, clear current user locally
            this.currentUser = null;
            this.notifyListeners();
            return { success: false, error: error.message };
        }
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.currentUser !== null;
    }

    // Get access token
    async getAccessToken() {
        if (!this.supabaseClient) {
            await this.init();
        }
        if (!this.supabaseClient) {
            console.warn('Supabase client not available');
            return null;
        }

        try {
            const { data: { session }, error } = await this.supabaseClient.auth.getSession();

            if (error) {
                console.error('Error getting session:', error);
                return null;
            }

            if (!session) {
                console.warn('No active session found');
                return null;
            }

            // Check if session is expired
            if (session.expires_at && session.expires_at < Date.now() / 1000) {
                console.warn('Session expired, attempting to refresh...');
                const { data: { session: refreshedSession }, error: refreshError } = await this.supabaseClient.auth.refreshSession();

                if (refreshError || !refreshedSession) {
                    console.error('Failed to refresh session:', refreshError);
                    return null;
                }

                return refreshedSession.access_token;
            }

            return session.access_token || null;
        } catch (error) {
            console.error('Error in getAccessToken:', error);
            return null;
        }
    }

    // Add auth state listener
    onAuthStateChange(callback) {
        this.listeners.push(callback);
        // Immediately call if user is already loaded
        if (this.currentUser) {
            callback(this.currentUser);
        }
    }

    // Notify listeners
    notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback(this.currentUser);
            } catch (error) {
                console.error('Error in auth listener:', error);
            }
        });
    }
}

// Create global auth manager instance - delay to ensure env.js has loaded
let authManager = null;

// Function to initialize auth manager
async function initAuthManager() {
    if (!authManager) {
        // Initialize Supabase client first
        if (typeof initSupabaseClient === 'function') {
            await initSupabaseClient();
        }

        // Create auth manager
        authManager = new AuthManager();
        window.authManager = authManager;
        console.log('✅ AuthManager initialized');
    }
    return authManager;
}

// Initialize auth manager after DOM and scripts are ready
async function setupAuthManager() {
    // Try to initialize Supabase client first
    if (typeof initSupabaseClient === 'function') {
        await initSupabaseClient();
    }

    // Wait a bit for env.js to fully load
    setTimeout(async () => {
        if (!authManager) {
            await initAuthManager();
        }
    }, 300);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAuthManager);
} else {
    setupAuthManager();
}

// Also listen for env-loaded event
window.addEventListener('env-loaded', () => {
    setTimeout(setupAuthManager, 100);
});

// Make initAuthManager available globally
window.initAuthManager = initAuthManager;
