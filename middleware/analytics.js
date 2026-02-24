const { inject } = require('@vercel/analytics');

/**
 * Vercel Analytics middleware untuk Express.js
 * Mengintegrasikan Vercel Analytics ke dalam aplikasi
 */
class VercelAnalytics {
  constructor() {
    this.isEnabled = process.env.NODE_ENV === 'production' && process.env.VERCEL && process.env.ENABLE_ANALYTICS === 'true';
    this.analyticsId = process.env.VERCEL_ANALYTICS_ID || 'prj_anime-stream-delta';
  }

  /**
   * Middleware untuk inject analytics script
   */
  middleware() {
    return (req, res, next) => {
      // Set analytics data untuk response
      res.locals.analytics = {
        enabled: this.isEnabled,
        id: this.analyticsId,
        script: this.getAnalyticsScript()
      };
      next();
    };
  }

  /**
   * Generate analytics script untuk injection ke HTML
   */
  getAnalyticsScript() {
    if (!this.isEnabled) {
      return '';
    }

    return `
    <script>
      window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    </script>
    <script defer src="https://cdn.vercel-insights.com/v1/script.js"></script>
    `;
  }

  /**
   * Track custom events
   */
  track(event, properties = {}) {
    if (!this.isEnabled) return;

    // Untuk server-side tracking, kita bisa menggunakan webhook atau API
    console.log('Analytics Event:', { event, properties });
    
    // Jika ada client-side tracking, kita bisa inject script
    return {
      event,
      properties,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Track page views
   */
  trackPageView(url, title) {
    return this.track('page_view', {
      url,
      title,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track user interactions
   */
  trackUserAction(action, properties = {}) {
    return this.track('user_action', {
      action,
      ...properties,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track anime-specific events
   */
  trackAnimeEvent(eventType, animeData) {
    return this.track('anime_event', {
      event_type: eventType,
      anime_title: animeData.title,
      anime_slug: animeData.slug,
      episode: animeData.episode,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track search events
   */
  trackSearch(query, resultsCount) {
    return this.track('search', {
      query,
      results_count: resultsCount,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track streaming events
   */
  trackStreaming(action, videoData) {
    return this.track('streaming', {
      action, // play, pause, complete, etc.
      video_title: videoData.title,
      video_duration: videoData.duration,
      timestamp: new Date().toISOString()
    });
  }
}

// Export singleton instance
const analytics = new VercelAnalytics();

module.exports = {
  analytics,
  analyticsMiddleware: analytics.middleware(),
  trackEvent: analytics.track.bind(analytics),
  trackPageView: analytics.trackPageView.bind(analytics),
  trackUserAction: analytics.trackUserAction.bind(analytics),
  trackAnimeEvent: analytics.trackAnimeEvent.bind(analytics),
  trackSearch: analytics.trackSearch.bind(analytics),
  trackStreaming: analytics.trackStreaming.bind(analytics)
};
  
