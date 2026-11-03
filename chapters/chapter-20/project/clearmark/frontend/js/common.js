// Common JavaScript functions
function loadHeader() {
    fetch('components/header.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('header-placeholder').innerHTML = data;
            updateActiveNav();
            updateUserStatus();
        })
        .catch(error => console.error('Error loading header:', error));
}

// Update user status in header
async function updateUserStatus() {
    const navActions = document.querySelector('.nav-actions');
    if (!navActions) {
        // Retry if nav-actions not found yet
        setTimeout(updateUserStatus, 100);
        return;
    }

    // Wait for auth manager to be ready
    if (typeof window.authManager === 'undefined') {
        // Try to initialize if not already done
        if (typeof window.initAuthManager === 'function') {
            window.initAuthManager();
        }
        
        // Wait for auth manager to initialize
        for (let i = 0; i < 20; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (window.authManager) break;
        }
    }

    const authManager = window.authManager;
    
    // Check if user is logged in by checking Supabase session directly
    let currentUser = null;
    if (authManager && authManager.currentUser) {
        currentUser = authManager.currentUser;
    } else if (window.authManager && window.authManager.supabaseClient) {
        // Try to get session from authManager's supabaseClient
        try {
            const { data: { session } } = await window.authManager.supabaseClient.auth.getSession();
            if (session && session.user) {
                currentUser = session.user;
                // Update authManager if available
                if (authManager) {
                    authManager.currentUser = currentUser;
                }
            }
        } catch (error) {
            console.error('Error checking session:', error);
        }
    } else if (window.authManager && window.authManager.supabaseClient) {
        // Use authManager's supabaseClient (already initialized)
        try {
            const { data: { session } } = await window.authManager.supabaseClient.auth.getSession();
            if (session && session.user) {
                currentUser = session.user;
            }
        } catch (error) {
            console.error('Error checking session:', error);
        }
    } else if (supabaseClient) {
        // Use global supabaseClient if available
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session && session.user) {
                currentUser = session.user;
            }
        } catch (error) {
            console.error('Error checking session:', error);
        }
    }

    if (currentUser) {
        const userName = currentUser.user_metadata?.full_name || currentUser.email || 'User';
        const userInitial = userName.charAt(0).toUpperCase();
        
        navActions.innerHTML = `
            <div class="user-menu">
                <div class="user-name-wrapper">
                    <div class="user-avatar-icon">${userInitial}</div>
                    <span class="user-name-text">${userName}</span>
                    <svg class="user-name-arrow" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="user-dropdown">
                    <a href="profile.html" class="dropdown-item">
                        <svg class="dropdown-item-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="8" cy="6" r="3" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M3 14C3 11.5 5.5 10 8 10C10.5 10 13 11.5 13 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                        <span>Profile</span>
                    </a>
                    <a href="admin.html" class="dropdown-item">
                        <svg class="dropdown-item-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M6 2V14M10 2V14M2 6H14M2 10H14" stroke="currentColor" stroke-width="1.5"/>
                        </svg>
                        <span>Admin</span>
                    </a>
                    <a href="#" id="logoutBtn" class="dropdown-item">
                        <svg class="dropdown-item-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 2H4C3.44772 2 3 2.44772 3 3V13C3 13.5523 3.44772 14 4 14H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            <path d="M10 5L13 8L10 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M13 8H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                        <span>Sign Out</span>
                    </a>
                </div>
            </div>
        `;
        
        // Dropdown show/hide logic - only hide when mouse leaves both menu and dropdown
        const userMenu = navActions.querySelector('.user-menu');
        const dropdown = navActions.querySelector('.user-dropdown');
        let isMouseInMenu = false;
        let isMouseInDropdown = false;
        
        const checkAndHideDropdown = () => {
            // Only hide if mouse is not in either menu or dropdown
            if (!isMouseInMenu && !isMouseInDropdown) {
                dropdown.style.opacity = '0';
                dropdown.style.transform = 'translateY(-8px)';
                dropdown.style.pointerEvents = 'none';
                setTimeout(() => {
                    if (!isMouseInMenu && !isMouseInDropdown) {
                        dropdown.style.display = 'none';
                    }
                }, 200);
            }
        };
        
        const showDropdown = () => {
            dropdown.style.display = 'block';
            dropdown.style.opacity = '1';
            dropdown.style.transform = 'translateY(0)';
            dropdown.style.pointerEvents = 'auto';
        };
        
        // Track mouse state for menu
        userMenu.addEventListener('mouseenter', () => {
            isMouseInMenu = true;
            showDropdown();
        });
        
        userMenu.addEventListener('mouseleave', () => {
            isMouseInMenu = false;
            // Only hide if mouse is also not in dropdown
            setTimeout(checkAndHideDropdown, 50); // Small delay to allow mouse to move to dropdown
        });
        
        // Track mouse state for dropdown
        dropdown.addEventListener('mouseenter', () => {
            isMouseInDropdown = true;
            showDropdown();
        });
        
        dropdown.addEventListener('mouseleave', () => {
            isMouseInDropdown = false;
            // Only hide if mouse is also not in menu
            setTimeout(checkAndHideDropdown, 50); // Small delay to allow mouse to move to menu
        });

        // Add logout handler
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (authManager && authManager.logout) {
                    await authManager.logout();
                } else if (authManager && authManager.supabaseClient) {
                    await authManager.supabaseClient.auth.signOut();
                } else if (supabaseClient) {
                    await supabaseClient.auth.signOut();
                }
                window.location.href = 'index.html';
            });
        }
    } else {
        // User not logged in
        navActions.innerHTML = `
            <a href="login.html" class="btn btn-outline">Sign In</a>
            <a href="register.html" class="btn btn-primary">Sign Up</a>
        `;
    }
}

function loadFooter() {
    // Add cache busting to ensure fresh content
    const timestamp = new Date().getTime();
    fetch(`components/footer.html?t=${timestamp}`)
        .then(response => response.text())
        .then(data => {
            document.getElementById('footer-placeholder').innerHTML = data;
        })
        .catch(error => console.error('Error loading footer:', error));
}

function updateActiveNav() {
    const currentPage = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href && href.includes(currentPage) || (currentPage === 'index' && href === 'index.html')) {
            link.classList.add('active');
        }
    });
}

// Notification function - used across all pages
function showNotification(message, type = 'info') {
    // Remove existing notification if any
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add styles if not already in the page
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 24px;
                border-radius: 8px;
                color: white;
                font-size: 14px;
                font-weight: 500;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                animation: slideIn 0.3s ease-out;
                max-width: 400px;
            }
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            .notification-info {
                background-color: #3b82f6;
            }
            .notification-success {
                background-color: #10b981;
            }
            .notification-error {
                background-color: #ef4444;
            }
            .notification-warning {
                background-color: #f59e0b;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 3-5 seconds
    const duration = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, duration);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('header-placeholder')) {
        loadHeader();
    }
    if (document.getElementById('footer-placeholder')) {
        loadFooter();
    }
    
    // Listen for auth state changes and update header
    if (window.authManager && typeof window.authManager.onAuthStateChange === 'function') {
        window.authManager.onAuthStateChange(() => {
            updateUserStatus();
        });
    }
    
    // Also update user status after a delay to ensure auth is initialized
    setTimeout(() => {
        updateUserStatus();
    }, 500);
    
    // Update user status when auth state changes (via Supabase client in authManager)
    if (window.authManager && window.authManager.supabaseClient) {
        window.authManager.supabaseClient.auth.onAuthStateChange(() => {
            updateUserStatus();
        });
    }
});
