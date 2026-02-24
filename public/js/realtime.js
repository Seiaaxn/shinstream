/**
 * KitaNime Real-time Updates Module
 * Handles real-time data polling and UI updates for anime content
 * 
 * Features:
 * - 30-second polling interval for ongoing anime updates
 * - Toast notifications for new episodes
 * - Connection status indicator
 * - Visibility API for background optimization
 * - Category-aware data processing (ongoing, complete, movies, genres)
 */

(function () {
    'use strict';

    // Configuration
    const CONFIG = {
        POLL_INTERVAL: 30000, // 30 seconds
        POLL_INTERVAL_BACKGROUND: 60000, // 60 seconds when tab is hidden
        API_BASE: window.APP_CONFIG?.apiUrl || '/v1',
        NOTIFICATION_DURATION: 5000,
        MAX_NOTIFICATIONS: 3,
        STORAGE_KEY: 'kitanime_last_update'
    };

    // State management
    const state = {
        isOnline: navigator.onLine,
        isVisible: !document.hidden,
        lastUpdate: localStorage.getItem(CONFIG.STORAGE_KEY) || null,
        pollTimer: null,
        notifications: [],
        categories: {
            ongoing: [],
            complete: [],
            movies: [],
            genres: []
        }
    };

    // ==========================================================================
    // Category Mapping - Maps Otakudesu data to KitaNime categories
    // ==========================================================================

    const CATEGORY_PROCESSORS = {
        /**
         * Process ongoing anime data
         * Maps: title, slug, poster, current_episode, release_day, newest_release_date
         */
        ongoing: (data) => {
            if (!data?.ongoingAnimeData && !data?.anime) return [];
            const animeList = data.ongoingAnimeData || data.anime || data;

            if (!Array.isArray(animeList)) return [];

            return animeList.map(anime => ({
                id: anime.slug || anime.id,
                title: anime.title || anime.name,
                slug: sanitizeSlug(anime.slug),
                poster: anime.poster || anime.image || anime.thumbnail,
                current_episode: anime.current_episode || anime.episode || anime.latest_episode,
                release_day: anime.release_day || anime.day || '',
                newest_release_date: anime.newest_release_date || anime.updated_at || anime.release_date,
                category: 'ongoing',
                status: 'Ongoing'
            }));
        },

        /**
         * Process complete anime data
         * Maps: title, slug, poster, rating, total_episodes
         */
        complete: (data) => {
            if (!data?.completeAnimeData && !data?.anime) return [];
            const animeList = data.completeAnimeData || data.anime || data;

            if (!Array.isArray(animeList)) return [];

            return animeList.map(anime => ({
                id: anime.slug || anime.id,
                title: anime.title || anime.name,
                slug: sanitizeSlug(anime.slug),
                poster: anime.poster || anime.image || anime.thumbnail,
                rating: anime.rating || anime.score,
                total_episodes: anime.total_episodes || anime.episodes,
                category: 'complete',
                status: 'Complete'
            }));
        },

        /**
         * Process movies data
         * Maps: title, slug, poster, release_date, duration
         */
        movies: (data) => {
            if (!data?.movies && !data?.anime) return [];
            const movieList = data.movies || data.anime || data;

            if (!Array.isArray(movieList)) return [];

            return movieList.map(movie => ({
                id: movie.slug || movie.id,
                title: movie.title || movie.name,
                slug: sanitizeSlug(movie.slug),
                poster: movie.poster || movie.image || movie.thumbnail,
                release_date: movie.release_date || movie.date,
                duration: movie.duration,
                category: 'movie',
                status: 'Movie'
            }));
        },

        /**
         * Process genre list data
         * Maps: name, slug, count
         */
        genres: (data) => {
            if (!data?.genres && !Array.isArray(data)) return [];
            const genreList = data.genres || data;

            if (!Array.isArray(genreList)) return [];

            return genreList.map(genre => ({
                id: genre.slug || genre.id,
                name: genre.name || genre.title,
                slug: sanitizeSlug(genre.slug || genre.name),
                count: genre.count || genre.total || 0,
                category: 'genre'
            }));
        }
    };

    // ==========================================================================
    // Utility Functions
    // ==========================================================================

    function sanitizeSlug(slug) {
        if (!slug) return '';
        return slug.toString()
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    function formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'Baru saja';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} menit lalu`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam lalu`;
        return `${Math.floor(seconds / 86400)} hari lalu`;
    }

    function log(message, type = 'info') {
        const prefix = '[Realtime]';
        const timestamp = new Date().toLocaleTimeString();

        switch (type) {
            case 'error':
                console.error(`${prefix} ${timestamp}:`, message);
                break;
            case 'warn':
                console.warn(`${prefix} ${timestamp}:`, message);
                break;
            default:
                console.log(`${prefix} ${timestamp}:`, message);
        }
    }

    // ==========================================================================
    // API Functions
    // ==========================================================================

    async function fetchLatestUpdates(category = 'ongoing') {
        try {
            const endpoints = {
                ongoing: '/ongoing-anime/1',
                complete: '/complete-anime/1',
                movies: '/movies/1',
                genres: '/genres'
            };

            const endpoint = endpoints[category] || endpoints.ongoing;
            const url = `${CONFIG.API_BASE}${endpoint}`;

            log(`Fetching updates from: ${url}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            // Handle different response formats
            let processedData;
            if (data.status === 'Ok') {
                processedData = data.data || data;
            } else {
                processedData = data;
            }

            return {
                success: true,
                data: processedData,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            log(`Fetch failed: ${error.message}`, 'error');
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // ==========================================================================
    // Update Detection & Processing
    // ==========================================================================

    function processNewUpdates(category, newData) {
        const processor = CATEGORY_PROCESSORS[category];
        if (!processor) {
            log(`No processor for category: ${category}`, 'warn');
            return { hasNewItems: false, newItems: [] };
        }

        const processedData = processor(newData);
        const previousData = state.categories[category] || [];

        // Find new items by comparing slugs
        const previousSlugs = new Set(previousData.map(item => item.slug));
        const newItems = processedData.filter(item => !previousSlugs.has(item.slug));

        // Find updated episodes (for ongoing anime)
        const updatedItems = [];
        if (category === 'ongoing') {
            processedData.forEach(newItem => {
                const oldItem = previousData.find(p => p.slug === newItem.slug);
                if (oldItem && oldItem.current_episode !== newItem.current_episode) {
                    updatedItems.push({
                        ...newItem,
                        previousEpisode: oldItem.current_episode,
                        isUpdate: true
                    });
                }
            });
        }

        // Update stored state
        state.categories[category] = processedData;

        return {
            hasNewItems: newItems.length > 0 || updatedItems.length > 0,
            newItems: newItems,
            updatedItems: updatedItems,
            totalItems: processedData.length
        };
    }

    // ==========================================================================
    // UI Updates
    // ==========================================================================

    function updateConnectionStatus(isOnline) {
        const indicator = document.querySelector('.realtime-indicator');
        if (!indicator) return;

        if (isOnline) {
            indicator.classList.remove('offline');
            indicator.innerHTML = `
        <span class="realtime-dot"></span>
        <span>Live</span>
      `;
        } else {
            indicator.classList.add('offline');
            indicator.innerHTML = `
        <span class="realtime-dot"></span>
        <span>Offline</span>
      `;
        }
    }

    function showNewEpisodeToast(anime) {
        // Remove old toast if exists
        const existingToast = document.querySelector('.episode-toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'episode-toast';
        toast.innerHTML = `
      <img src="${anime.poster}" alt="${anime.title}" class="episode-toast-image" 
           onerror="this.src='https://placehold.co/60x80?text=No+Image'">
      <div class="episode-toast-content">
        <div class="episode-toast-title">${anime.title}</div>
        <div class="episode-toast-episode">${anime.current_episode} Tersedia!</div>
      </div>
      <button class="episode-toast-close" aria-label="Tutup">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

        // Make toast clickable to go to anime
        toast.addEventListener('click', (e) => {
            if (!e.target.closest('.episode-toast-close')) {
                window.location.href = `/anime/${anime.slug}`;
            }
        });

        // Close button
        toast.querySelector('.episode-toast-close').addEventListener('click', (e) => {
            e.stopPropagation();
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        });

        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto-hide after duration
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }
        }, CONFIG.NOTIFICATION_DURATION);
    }

    function updateAnimeGrid(category, items) {
        // Find the anime grid container
        const gridSelector = `.anime-grid[data-category="${category}"], .anime-grid`;
        const grid = document.querySelector(gridSelector);

        if (!grid || !items.length) return;

        log(`Updating ${category} grid with ${items.length} items`);

        // For now, we just refresh the page data
        // In a more complex implementation, we would update individual cards

        // Add visual indicator that update occurred
        grid.classList.add('updating');
        setTimeout(() => grid.classList.remove('updating'), 500);
    }

    // ==========================================================================
    // Skeleton Loading
    // ==========================================================================

    function createSkeletonCards(count = 6) {
        const skeletons = [];
        for (let i = 0; i < count; i++) {
            skeletons.push(`
        <div class="anime-card skeleton-wrapper">
          <div class="skeleton skeleton-card"></div>
          <div class="p-2">
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text short"></div>
          </div>
        </div>
      `);
        }
        return skeletons.join('');
    }

    function showSkeletonLoading(container) {
        if (!container) return;
        container.dataset.originalContent = container.innerHTML;
        container.innerHTML = createSkeletonCards(6);
    }

    function hideSkeletonLoading(container) {
        if (!container || !container.dataset.originalContent) return;
        container.innerHTML = container.dataset.originalContent;
        delete container.dataset.originalContent;
    }

    // ==========================================================================
    // Polling Logic
    // ==========================================================================

    async function poll() {
        if (!state.isOnline) {
            log('Skipping poll - offline');
            return;
        }

        log('Checking for updates...');

        try {
            // Fetch ongoing anime (primary category for real-time updates)
            const result = await fetchLatestUpdates('ongoing');

            if (result.success) {
                const updates = processNewUpdates('ongoing', result.data);

                if (updates.hasNewItems) {
                    log(`Found ${updates.newItems.length} new items, ${updates.updatedItems.length} updates`);

                    // Show notification for new episodes
                    if (updates.updatedItems.length > 0) {
                        updates.updatedItems.forEach(anime => {
                            showNewEpisodeToast(anime);
                        });
                    }

                    // Update UI
                    updateAnimeGrid('ongoing', state.categories.ongoing);
                }

                // Store last update time
                state.lastUpdate = result.timestamp;
                localStorage.setItem(CONFIG.STORAGE_KEY, result.timestamp);

                updateConnectionStatus(true);
            } else {
                log(`Poll failed: ${result.error}`, 'warn');
            }
        } catch (error) {
            log(`Poll error: ${error.message}`, 'error');
        }

        // Schedule next poll
        schedulePoll();
    }

    function schedulePoll() {
        if (state.pollTimer) {
            clearTimeout(state.pollTimer);
        }

        const interval = state.isVisible
            ? CONFIG.POLL_INTERVAL
            : CONFIG.POLL_INTERVAL_BACKGROUND;

        state.pollTimer = setTimeout(poll, interval);
        log(`Next poll in ${interval / 1000}s (${state.isVisible ? 'foreground' : 'background'})`);
    }

    function startPolling() {
        log('Starting real-time polling');
        poll();
    }

    function stopPolling() {
        if (state.pollTimer) {
            clearTimeout(state.pollTimer);
            state.pollTimer = null;
        }
        log('Stopped polling');
    }

    // ==========================================================================
    // Event Handlers
    // ==========================================================================

    function handleVisibilityChange() {
        state.isVisible = !document.hidden;

        if (state.isVisible) {
            log('Tab became visible - resuming updates');
            poll(); // Immediate poll when coming back
        } else {
            log('Tab hidden - reducing poll frequency');
            schedulePoll();
        }
    }

    function handleOnlineStatus() {
        state.isOnline = navigator.onLine;
        updateConnectionStatus(state.isOnline);

        if (state.isOnline) {
            log('Connection restored');
            poll();
        } else {
            log('Connection lost', 'warn');
        }
    }

    // ==========================================================================
    // PWA Support
    // ==========================================================================

    let deferredInstallPrompt = null;

    function initPWA() {
        // Listen for install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredInstallPrompt = e;
            showInstallPrompt();
        });

        // Track install
        window.addEventListener('appinstalled', () => {
            log('PWA installed');
            deferredInstallPrompt = null;
            hideInstallPrompt();
        });
    }

    function showInstallPrompt() {
        // Check if already dismissed
        if (localStorage.getItem('pwa_install_dismissed')) return;

        // Create prompt if not exists
        let prompt = document.querySelector('.pwa-install-prompt');
        if (!prompt) {
            prompt = document.createElement('div');
            prompt.className = 'pwa-install-prompt';
            prompt.innerHTML = `
        <button class="pwa-install-close" aria-label="Tutup">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div class="pwa-install-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </div>
        <div class="pwa-install-content">
          <div class="pwa-install-title">Install KitaNime</div>
          <div class="pwa-install-desc">Akses cepat tanpa browser</div>
        </div>
        <button class="pwa-install-btn">Install</button>
      `;

            // Install button handler
            prompt.querySelector('.pwa-install-btn').addEventListener('click', async () => {
                if (deferredInstallPrompt) {
                    deferredInstallPrompt.prompt();
                    const result = await deferredInstallPrompt.userChoice;
                    log(`PWA install result: ${result.outcome}`);
                    deferredInstallPrompt = null;
                }
                hideInstallPrompt();
            });

            // Close button handler
            prompt.querySelector('.pwa-install-close').addEventListener('click', () => {
                localStorage.setItem('pwa_install_dismissed', 'true');
                hideInstallPrompt();
            });

            document.body.appendChild(prompt);
        }

        // Show after delay
        setTimeout(() => {
            prompt.classList.add('show');
        }, 3000);
    }

    function hideInstallPrompt() {
        const prompt = document.querySelector('.pwa-install-prompt');
        if (prompt) {
            prompt.classList.remove('show');
        }
    }

    // ==========================================================================
    // Initialization
    // ==========================================================================

    function createConnectionIndicator() {
        const header = document.querySelector('header nav, header .container');
        if (!header) return;

        // Check if indicator already exists
        if (document.querySelector('.realtime-indicator')) return;

        const indicator = document.createElement('div');
        indicator.className = 'realtime-indicator';
        indicator.innerHTML = `
      <span class="realtime-dot"></span>
      <span>Live</span>
    `;

        // Find appropriate place to insert
        const searchContainer = header.querySelector('.flex-1.max-w-lg');
        if (searchContainer) {
            searchContainer.parentNode.insertBefore(indicator, searchContainer);
        }
    }

    function init() {
        log('Initializing KitaNime Realtime Module');

        // Create connection indicator
        createConnectionIndicator();

        // Initialize PWA
        initPWA();

        // Set up event listeners
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('online', handleOnlineStatus);
        window.addEventListener('offline', handleOnlineStatus);

        // Update initial connection status
        updateConnectionStatus(state.isOnline);

        // Start polling
        startPolling();

        log('Initialization complete');
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose API for external use
    window.KitaNimeRealtime = {
        poll,
        startPolling,
        stopPolling,
        getState: () => ({ ...state }),
        fetchUpdates: fetchLatestUpdates,
        showToast: showNewEpisodeToast
    };

})();
