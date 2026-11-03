/**
 * Environment configuration loader
 * Loads environment variables from meta tags or window.config
 */

// Load environment variables from meta tags or window config
window.env = window.env || {};

// Try to load from meta tags
const metaTags = document.querySelectorAll('meta[name^="supabase-"], meta[name^="api-"]');
metaTags.forEach(meta => {
    const metaName = meta.getAttribute('name');
    let name, value;
    
    if (metaName.startsWith('supabase-')) {
        // Convert meta name to env key: supabase-url -> SUPABASE_URL, supabase-anon-key -> SUPABASE_ANON_KEY
        name = 'SUPABASE_' + metaName.replace('supabase-', '').toUpperCase().replace(/-/g, '_');
        value = meta.getAttribute('content');
    } else if (metaName.startsWith('api-')) {
        // Convert meta name to env key: api-url -> API_URL
        name = metaName.toUpperCase().replace(/-/g, '_');
        value = meta.getAttribute('content');
    }
    
    if (name && value) {
        window.env[name] = value;
    }
});

// Try to load from window.config if available
if (typeof window.config !== 'undefined') {
    window.env.SUPABASE_URL = window.config.SUPABASE_URL || window.env.SUPABASE_URL || '';
    window.env.SUPABASE_ANON_KEY = window.config.SUPABASE_ANON_KEY || window.env.SUPABASE_ANON_KEY || '';
}

// Log configuration status (for debugging - only in development)
// Never log full keys or URLs in production
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const urlLength = window.env.SUPABASE_URL ? window.env.SUPABASE_URL.length : 0;
    const keyLength = window.env.SUPABASE_ANON_KEY ? window.env.SUPABASE_ANON_KEY.length : 0;
    console.log('Environment configuration:', {
        SUPABASE_URL: window.env.SUPABASE_URL ? `✅ Configured (${urlLength} chars)` : '❌ Not configured',
        SUPABASE_ANON_KEY: window.env.SUPABASE_ANON_KEY ? `✅ Configured (${keyLength} chars)` : '❌ Not configured'
    });
}

// Trigger custom event when env is loaded
window.dispatchEvent(new CustomEvent('env-loaded', { detail: window.env }));

