/**
 * Blog management module
 * Supports Markdown rendering and image galleries
 */

// Markdown renderer (using marked.js or similar)
// Declare API_URL on window to share across scripts
// Support both meta tag (api-url) and window.env.API_URL
window.API_URL = window.env?.API_URL || 'http://localhost:8000';
const API_URL = window.API_URL;

class BlogManager {
    constructor() {
        this.posts = [];
        this.currentPost = null;
        // Memory cache for blog posts (1 day TTL)
        this.cache = new Map();
        this.CACHE_TTL = 24 * 60 * 60 * 1000; // 1 day in milliseconds
    }
    
    // Generate cache key from request parameters
    _getCacheKey(skip, limit, tag, publishedOnly) {
        return `posts_${skip}_${limit}_${tag || 'null'}_${publishedOnly}`;
    }
    
    // Check if cache entry is still valid
    _isCacheValid(cacheEntry) {
        if (!cacheEntry) return false;
        const now = Date.now();
        return (now - cacheEntry.timestamp) < this.CACHE_TTL;
    }
    
    // Get cached posts
    _getCachedPosts(cacheKey) {
        const cacheEntry = this.cache.get(cacheKey);
        if (this._isCacheValid(cacheEntry)) {
            console.log('📦 Loading posts from cache:', cacheKey);
            return cacheEntry.data;
        }
        // Remove expired cache entry
        if (cacheEntry) {
            this.cache.delete(cacheKey);
            console.log('🗑️ Removed expired cache entry:', cacheKey);
        }
        return null;
    }
    
    // Store posts in cache
    _setCachedPosts(cacheKey, posts) {
        this.cache.set(cacheKey, {
            data: posts,
            timestamp: Date.now()
        });
        console.log('💾 Cached posts:', cacheKey, `(${posts.length} posts)`);
    }
    
    // Clear all cache (useful for testing or manual refresh)
    clearCache() {
        this.cache.clear();
        console.log('🧹 Cache cleared');
    }

    // Get access token for authenticated requests
    async getAuthHeaders() {
        const token = await window.authManager?.getAccessToken();
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        return headers;
    }

    // Fetch all posts (with caching)
    async getPosts(skip = 0, limit = 10, tag = null, publishedOnly = true) {
        try {
            // Generate cache key
            const cacheKey = this._getCacheKey(skip, limit, tag, publishedOnly);
            
            // Try to get from cache first
            const cachedPosts = this._getCachedPosts(cacheKey);
            if (cachedPosts !== null) {
                this.posts = cachedPosts;
                return cachedPosts;
            }
            
            // Cache miss or expired - fetch from API
            // Backend API uses 'published' not 'published_only'
            let url = `${API_URL}/api/posts?published=${publishedOnly}`;
            // Note: Backend doesn't support skip/limit yet, but we include for future compatibility
            if (skip > 0) {
                url += `&skip=${skip}`;
            }
            if (limit !== 10) {
                url += `&limit=${limit}`;
            }
            if (tag) {
                url += `&tag=${encodeURIComponent(tag)}`;
            }

            console.log('🌐 Fetching posts from API:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                // Add timeout
                signal: AbortSignal.timeout(10000) // 10 seconds timeout
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', response.status, errorText);
                throw new Error(`Failed to fetch posts: ${response.statusText}`);
            }

            const posts = await response.json();
            console.log('✅ Posts loaded successfully from API:', posts.length);
            
            // Store in cache
            this._setCachedPosts(cacheKey, posts);
            
            this.posts = posts;
            return posts;
        } catch (error) {
            console.error('Error fetching posts:', error);
            
            // Provide helpful error messages
            if (error.name === 'AbortError' || error.message.includes('timeout')) {
                throw new Error('Request timeout. Please check if the backend service is running on port 8000.');
            } else if (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION') || error.message.includes('NetworkError') || error.name === 'TypeError') {
                // Check if it's a connection error
                const isConnectionError = !error.message || 
                    error.message.includes('Failed to fetch') || 
                    error.message.includes('ERR_CONNECTION') ||
                    error.message.includes('NetworkError') ||
                    error.name === 'TypeError';
                
                if (isConnectionError) {
                    throw new Error('Cannot connect to backend server. Please make sure the backend service is running on http://localhost:8000');
                }
            }
            
            throw error;
        }
    }

    // Get single post (with caching)
    async getPost(postId) {
        try {
            const cacheKey = `post_${postId}`;
            
            // Try to get from cache first
            const cachedPost = this._getCachedPosts(cacheKey);
            if (cachedPost !== null) {
                this.currentPost = cachedPost;
                return cachedPost;
            }
            
            // Cache miss or expired - fetch from API
            console.log('🌐 Fetching post from API:', postId);
            const response = await fetch(`${API_URL}/api/posts/${postId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch post: ${response.statusText}`);
            }

            const post = await response.json();
            console.log('✅ Post loaded successfully from API:', postId);
            
            // Store in cache
            this._setCachedPosts(cacheKey, post);
            
            this.currentPost = post;
            return post;
        } catch (error) {
            console.error('Error fetching post:', error);
            throw error;
        }
    }

    // Create new post
    async createPost(postData) {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${API_URL}/api/posts`, {
                method: 'POST',
                headers,
                body: JSON.stringify(postData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to create post');
            }

            const post = await response.json();
            
            // Clear cache when creating a new post (to refresh the list)
            this.clearCache();
            console.log('🧹 Cache cleared after creating new post');
            
            return post;
        } catch (error) {
            console.error('Error creating post:', error);
            throw error;
        }
    }

    // Update post
    async updatePost(postId, postData) {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${API_URL}/api/posts/${postId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(postData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to update post');
            }

            const post = await response.json();
            
            // Clear cache for this specific post and all post lists
            const postCacheKey = `post_${postId}`;
            this.cache.delete(postCacheKey);
            
            // Clear all post list caches (since the post might have changed)
            for (const key of this.cache.keys()) {
                if (key.startsWith('posts_')) {
                    this.cache.delete(key);
                }
            }
            console.log('🧹 Cache cleared after updating post');
            
            return post;
        } catch (error) {
            console.error('Error updating post:', error);
            throw error;
        }
    }

    // Delete post
    async deletePost(postId) {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${API_URL}/api/posts/${postId}`, {
                method: 'DELETE',
                headers
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to delete post');
            }

            // Clear cache for this specific post and all post lists
            const postCacheKey = `post_${postId}`;
            this.cache.delete(postCacheKey);
            
            // Clear all post list caches (since a post was deleted)
            for (const key of this.cache.keys()) {
                if (key.startsWith('posts_')) {
                    this.cache.delete(key);
                }
            }
            console.log('🧹 Cache cleared after deleting post');
            
            return true;
        } catch (error) {
            console.error('Error deleting post:', error);
            throw error;
        }
    }

    // Render Markdown content
    renderMarkdown(markdown) {
        // If marked.js is available, use it
        if (window.marked) {
            return window.marked.parse(markdown);
        }
        
        // Otherwise, basic HTML conversion (very basic)
        return markdown
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>')
            .replace(/\n/gim, '<br>');
    }

    // Format date
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

// Create global blog manager instance
const blogManager = new BlogManager();
window.blogManager = blogManager;

// Debug: Log that blogManager is initialized
console.log('✅ BlogManager initialized and available at window.blogManager');

