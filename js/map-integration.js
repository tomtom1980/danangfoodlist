/**
 * Da Nang Food Guide - Mapbox Integration
 * Interactive map with restaurant markers, popups, and category filtering
 */

(function() {
  'use strict';

  // Configuration
  const MAP_CONFIG = {
    center: [108.2022, 16.0544], // Da Nang coordinates [lng, lat]
    zoom: 13,
    minZoom: 10,
    maxZoom: 18,
    style: 'mapbox://styles/mapbox/streets-v12'
  };

  // Category images mapping - matches main page food card images
  const CATEGORY_IMAGES = {
    'Cháo': 'images/1. chao.jpg',
    'Bánh mì': 'images/2. Bánh mì heo quay.jpg',
    'Mì Quảng': 'images/3. Mì Quảng.jpg',
    'Bánh xèo': 'images/4. Bánh xèo.jpg',
    'Cao Lầu': 'images/5. Cao Lầu.jpg',
    'Nem lui': 'images/6. Nem lui.jpg',
    'Xôi': 'images/7. Xôi mặn  Xôi ngọt.jpg',
    'Bánh Bèo/Nậm/Lọc': 'images/8. Bánh Bèo, Bánh Nậm, & Bánh Bột Lọc.jpg',
    'Bún bò Huế': 'images/9. Bún bò Huế.jpg',
    'Bún chả cá': 'images/10. Bún chả cá.jpg',
    'Bún chả': 'images/11. Bún chả.jpg',
    'Hủ tiếu Nam Vang': 'images/12. Hủ tiếu Nam Vang.jpg',
    'Bún mắm': 'images/13. Bún mắm.jpg',
    'Bò né': 'images/14. Bò né.jpg',
    'Cháo Vịt': 'images/15. Cháo Vịt.jpg',
    'Bánh Tráng Cuốn': 'images/16. Bánh Tráng Cuốn Thịt Heo.jpg',
    'Phở': 'images/17. Phở.jpg',
    'Cơm gà Tam Kỳ': 'images/18. Cơm gà Tam Kỳ  Hội An.jpg',
    'Cơm gà': 'images/19. Cơm gà.jpg',
    'Cơm tấm': 'images/20. Cơm tấm.jpg',
    'Xôi gà xé': 'images/21. Xôi gà xé.jpg',
    'Bánh tráng kẹp': 'images/22. Bánh tráng kẹp A Ri.jpg',
    'Cơm niêu': 'images/23. Cơm niêu cá kho  thịt kho trứng.jpg',
    'Lẩu': 'images/24. Lẩu thái  bò  cá.jpg',
    'Bún thịt nướng': 'images/25. Bún thịt nướng.jpg',
    'Bò lá lốt': 'images/26. Bò lá lốt.jpg',
    'Bún riêu': 'images/27. Bún riêu.jpg',
    'Bánh Canh': 'images/28. Bánh Canh cá lóc.jpg',
    'Bánh Căn': 'images/29. Bánh Căn.jpg',
    'Hải Sản': 'images/30. Seafood.jpg',
    'Hải Sản Bình Dân': 'images/31. Cheaper local seafood.jpg',
    'Vịt quay': 'images/32. Vietnam-style roast duck with crispy skin.jpg',
    'Michelin Selected': 'images/michelinselected.jpg',
    'Cà Phê': 'images/Ca_Phe.jpg'
  };

  // State management
  let map = null;
  let activeFilters = new Set();
  let isFilterPanelOpen = false;
  let currentPopup = null;
  let showOpenNowOnly = false; // "Open Now" filter state
  let showTopPlacesOnly = false; // "Top 3 Places" filter state
  let topPlacesMapping = null; // Category -> top 3 restaurant names mapping (built on demand)
  let userLocation = null; // { lng, lat } when known
  let maxDistanceMeters = Infinity; // Distance filter (Infinity = no limit)

  // Distance options in meters (matching slider positions 0-5)
  const DISTANCE_OPTIONS = [300, 500, 1000, 2000, 3000, Infinity];
  const DISTANCE_LABELS = ['300m', '500m', '1km', '2km', '3km', 'Unlimited'];

  // User location marker reference (for auto-geolocation)
  let userLocationMarker = null;

  /**
   * Check if the device is mobile
   * @returns {boolean} True if mobile device
   */
  function isMobileDevice() {
    return window.innerWidth <= 767 ||
           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * @param {number} lat1 - Latitude of point 1
   * @param {number} lng1 - Longitude of point 1
   * @param {number} lat2 - Latitude of point 2
   * @param {number} lng2 - Longitude of point 2
   * @returns {number} Distance in meters
   */
  function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Check if a restaurant is within the max distance from user
   * @param {object} feature - GeoJSON feature
   * @returns {boolean} True if within distance or no distance filter active
   */
  function isWithinDistance(feature) {
    // No distance filter if no user location or unlimited distance
    if (!userLocation || maxDistanceMeters === Infinity) {
      return true;
    }

    const [lng, lat] = feature.geometry.coordinates;
    const distance = calculateDistance(userLocation.lat, userLocation.lng, lat, lng);
    return distance <= maxDistanceMeters;
  }

  /**
   * Build mapping of category names to their top 3 restaurant names
   * Parses the DOM to find restaurant list items in category modals
   * @returns {Map<string, Set<string>>} Map of category name to Set of top 3 restaurant names
   */
  function buildTopPlacesMapping() {
    const mapping = new Map();

    // Category modal ID to category name mapping (reverse of the map in openCategoryModal)
    const modalToCategory = {
      'chao-detail-modal': 'Cháo',
      'banhmi-detail-modal': 'Bánh mì',
      'miquang-detail-modal': 'Mì Quảng',
      'banhxeo-detail-modal': 'Bánh xèo',
      'caolau-detail-modal': 'Cao Lầu',
      'nemlui-detail-modal': 'Nem lui',
      'xoi-detail-modal': 'Xôi',
      'banhbeo-detail-modal': 'Bánh Bèo/Nậm/Lọc',
      'bunbohue-detail-modal': 'Bún bò Huế',
      'bunchaca-detail-modal': 'Bún chả cá',
      'buncha-detail-modal': 'Bún chả',
      'hutieu-detail-modal': 'Hủ tiếu Nam Vang',
      'bunmam-detail-modal': 'Bún mắm',
      'bone-detail-modal': 'Bò né',
      'chaovit-detail-modal': 'Cháo Vịt',
      'banhtrangcuon-detail-modal': 'Bánh Tráng Cuốn',
      'pho-detail-modal': 'Phở',
      'comgatamky-detail-modal': 'Cơm gà Tam Kỳ',
      'comga-detail-modal': 'Cơm gà',
      'comtam-detail-modal': 'Cơm tấm',
      'xoigaxe-detail-modal': 'Xôi gà xé',
      'banhtrangkep-detail-modal': 'Bánh tráng kẹp',
      'comnieu-detail-modal': 'Cơm niêu',
      'lau-detail-modal': 'Lẩu',
      'bunthitnuong-detail-modal': 'Bún thịt nướng',
      'bolalot-detail-modal': 'Bò lá lốt',
      'bunrieu-detail-modal': 'Bún riêu',
      'banhcanhcaloc-detail-modal': 'Bánh Canh',
      'banhcan-detail-modal': 'Bánh Căn',
      'seafood-detail-modal': 'Hải Sản',
      'localseafood-detail-modal': 'Hải Sản Bình Dân',
      'vitquay-detail-modal': 'Vịt quay',
      'michelin-detail-modal': 'Michelin Selected',
      'caphe-detail-modal': 'Cà Phê'
    };

    // Find all category modals and extract top 3 restaurants
    Object.entries(modalToCategory).forEach(function([modalId, categoryName]) {
      const modal = document.getElementById(modalId);
      if (!modal) return;

      // Find all restaurant list items within this modal
      const restaurantItems = modal.querySelectorAll('.restaurant-list-item');
      const topNames = new Set();

      // Get the first 3 restaurant names (data-index 0, 1, 2)
      restaurantItems.forEach(function(item) {
        const index = parseInt(item.getAttribute('data-index') || '999');
        if (index < 3) {
          const nameEl = item.querySelector('.restaurant-item-name');
          if (nameEl) {
            topNames.add(nameEl.textContent.trim());
          }
        }
      });

      if (topNames.size > 0) {
        mapping.set(categoryName, topNames);
      }
    });

    return mapping;
  }

  /**
   * Check if a restaurant is in the top 3 for its category
   * @param {object} feature - GeoJSON feature
   * @returns {boolean} True if in top 3 or no top 3 filter active
   */
  function isTopPlace(feature) {
    if (!showTopPlacesOnly) {
      return true;
    }

    // Build mapping on first use
    if (!topPlacesMapping) {
      topPlacesMapping = buildTopPlacesMapping();
    }

    const categoryName = feature.properties.category;
    const restaurantName = feature.properties.name;

    const topNames = topPlacesMapping.get(categoryName);
    if (!topNames) {
      // If we don't have top 3 data for this category, include it
      return true;
    }

    return topNames.has(restaurantName);
  }

  /**
   * Show the distance slider (called when user location is obtained)
   */
  function showDistanceSlider() {
    const container = document.getElementById('distance-slider-container');
    if (container) {
      container.classList.add('visible');
    }
  }

  /**
   * Automatically request user location on mobile devices
   * Called when the map loads on mobile
   */
  function autoRequestGeolocation() {
    if (!navigator.geolocation) {
      console.log('Geolocation not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      function(position) {
        const userLng = position.coords.longitude;
        const userLat = position.coords.latitude;

        // Store user location globally for distance filtering
        userLocation = { lng: userLng, lat: userLat };

        // Show distance slider now that we have location
        showDistanceSlider();

        // Remove existing user marker if any
        if (userLocationMarker) {
          userLocationMarker.remove();
        }

        // Create user location marker
        const markerEl = document.createElement('div');
        markerEl.className = 'user-location-marker';
        markerEl.innerHTML = `
          <div class="user-location-dot"></div>
          <div class="user-location-pulse"></div>
        `;

        userLocationMarker = new mapboxgl.Marker({ element: markerEl })
          .setLngLat([userLng, userLat])
          .addTo(map);

        // On mobile, fly to user location for better experience
        if (isMobileDevice()) {
          map.flyTo({
            center: [userLng, userLat],
            zoom: 14,
            essential: true
          });
        }

        // Apply filters with new location context
        applyFilters();

        console.log('Auto-geolocation successful:', userLat, userLng);
      },
      function(error) {
        // Silently fail for auto-geolocation - user can still use the manual button
        console.log('Auto-geolocation failed:', error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  /**
   * Update the distance value label
   * @param {number} index - Slider position (0-5)
   */
  function updateDistanceLabel(index) {
    const label = document.getElementById('distance-value');
    if (label) {
      label.textContent = DISTANCE_LABELS[index];
    }
  }

  /**
   * Check if a restaurant is currently open based on opening hours
   * Handles many formats: "06:00-22:00", "6AM-10PM", "6:00 AM - 10:00 PM daily",
   * split hours "10:00-14:00, 16:00-21:00", "24/7", etc.
   * @param {string} openingHours - Opening hours string
   * @returns {boolean} True if restaurant is open, false if closed or hours unknown
   */
  function isRestaurantOpen(openingHours) {
    // Handle missing or invalid data - treat as CLOSED (exclude from "Open Now" filter)
    if (!openingHours || openingHours === 'n/a' || openingHours.trim() === '') {
      return false;
    }

    try {
      // Get current time in Vietnam timezone (UTC+7) using reliable Intl API
      const now = new Date();

      // Use formatToParts for reliable timezone conversion
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
        weekday: 'short'
      });

      const parts = formatter.formatToParts(now);
      const currentHour = parseInt(parts.find(p => p.type === 'hour').value, 10);
      const currentMinute = parseInt(parts.find(p => p.type === 'minute').value, 10);
      const currentTimeInMinutes = currentHour * 60 + currentMinute;

      // Get day of week in Vietnam timezone
      const weekdayStr = parts.find(p => p.type === 'weekday').value.toLowerCase();
      const dayMap = { 'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 };
      const currentDay = dayMap[weekdayStr] !== undefined ? dayMap[weekdayStr] : new Date().getDay();

      // Normalize the string: replace unicode dashes with regular dash
      let normalized = openingHours
        .replace(/–/g, '-')  // en-dash
        .replace(/—/g, '-')  // em-dash
        .trim();

      // Handle 24/7 formats
      if (/24\/7|open\s*24/i.test(normalized)) {
        return true;
      }

      // Handle "Open-HH:MM" format (means "open until X", typically late night)
      const openUntilMatch = normalized.match(/open\s*-\s*(\d{1,2}):(\d{2})/i);
      if (openUntilMatch) {
        // Assume opens in evening (18:00) and closes at specified time next morning
        const closeHour = parseInt(openUntilMatch[1]);
        const closeMinute = parseInt(openUntilMatch[2]);
        const closeMinutes = closeHour * 60 + closeMinute;
        const openMinutes = 18 * 60; // Assume 6 PM opening
        // If current time is after 6 PM or before closing time, it's open
        if (currentTimeInMinutes >= openMinutes || currentTimeInMinutes < closeMinutes) {
          return true;
        }
        return false;
      }

      // Handle "midnight" keyword
      normalized = normalized.replace(/midnight/gi, '24:00');

      // Check for day-specific closures (e.g., "CLOSED MONDAYS", "Sun closed", "may close Thursdays")
      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const fullDayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

      // Match patterns like "CLOSED MONDAYS", "Sun closed", "close Thursdays", etc.
      const closedDayMatch = normalized.match(/closed?\s*(sun(?:day)?s?|mon(?:day)?s?|tue(?:sday)?s?|wed(?:nesday)?s?|thu(?:rsday)?s?|fri(?:day)?s?|sat(?:urday)?s?)/i) ||
                             normalized.match(/(sun(?:day)?s?|mon(?:day)?s?|tue(?:sday)?s?|wed(?:nesday)?s?|thu(?:rsday)?s?|fri(?:day)?s?|sat(?:urday)?s?)\s*closed?/i);
      if (closedDayMatch) {
        const matchedDay = closedDayMatch[1].toLowerCase().replace(/s$/, ''); // Remove trailing 's'
        const closedDay = dayNames.findIndex(d => matchedDay.startsWith(d)) !== -1
          ? dayNames.findIndex(d => matchedDay.startsWith(d))
          : fullDayNames.findIndex(d => matchedDay.startsWith(d.substring(0, 3)));
        if (closedDay >= 0 && closedDay === currentDay) {
          return false;
        }
      }

      // Parse time from various formats, returns minutes since midnight
      function parseTime(timeStr) {
        if (!timeStr) return null;

        timeStr = timeStr.trim().toUpperCase();

        // Handle "HH:MM AM/PM" or "H:MM AM/PM" or "HAM/PM" formats
        const ampmMatch = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
        if (ampmMatch) {
          let hour = parseInt(ampmMatch[1]);
          const minute = ampmMatch[2] ? parseInt(ampmMatch[2]) : 0;
          const isPM = ampmMatch[3].toUpperCase() === 'PM';

          if (isPM && hour !== 12) hour += 12;
          if (!isPM && hour === 12) hour = 0;

          return hour * 60 + minute;
        }

        // Handle "HH:MM" or "H:MM" 24-hour format
        const militaryMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        if (militaryMatch) {
          const hour = parseInt(militaryMatch[1]);
          const minute = parseInt(militaryMatch[2]);
          return hour * 60 + minute;
        }

        // Handle just hour with AM/PM like "6AM" or "10PM"
        const hourOnlyMatch = timeStr.match(/^(\d{1,2})(AM|PM)$/i);
        if (hourOnlyMatch) {
          let hour = parseInt(hourOnlyMatch[1]);
          const isPM = hourOnlyMatch[2].toUpperCase() === 'PM';

          if (isPM && hour !== 12) hour += 12;
          if (!isPM && hour === 12) hour = 0;

          return hour * 60;
        }

        return null;
      }

      // Check if current time is within a time range
      function isWithinRange(openMinutes, closeMinutes) {
        if (openMinutes === null || closeMinutes === null) return false;

        // Handle overnight hours (e.g., 20:00 - 06:00)
        if (closeMinutes <= openMinutes) {
          return currentTimeInMinutes >= openMinutes || currentTimeInMinutes < closeMinutes;
        }
        return currentTimeInMinutes >= openMinutes && currentTimeInMinutes < closeMinutes;
      }

      // Extract time ranges from the string
      // This regex matches patterns like "HH:MM-HH:MM" or "HAM-HPM" with various separators
      // Also handles variable closing times like "8:30/9:00 PM"
      const timeRangeRegex = /(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*[-–—]\s*(\d{1,2}(?::\d{2})?(?:\s*\/\s*\d{1,2}(?::\d{2})?)?\s*(?:AM|PM)?)/gi;

      let match;
      let foundAnyRange = false;

      while ((match = timeRangeRegex.exec(normalized)) !== null) {
        foundAnyRange = true;
        let openTime = match[1];
        let closeTime = match[2];

        // Handle variable closing times like "8:30/9:00 PM" - use the later time
        const variableClose = closeTime.match(/(\d{1,2}(?::\d{2})?)\s*\/\s*(\d{1,2}(?::\d{2})?)\s*(AM|PM)?/i);
        if (variableClose) {
          // Use the later closing time, preserve AM/PM
          const ampm = variableClose[3] || '';
          const time1 = parseTime(variableClose[1] + ' ' + ampm);
          const time2 = parseTime(variableClose[2] + ' ' + ampm);
          closeTime = ((time2 !== null && time1 !== null && time2 > time1) ? variableClose[2] : variableClose[1]) + ' ' + ampm;
        }

        const openMinutes = parseTime(openTime);
        let closeMinutes = parseTime(closeTime);

        // If close time seems too small (like "03:30" after "Open"), it might be AM next day
        if (closeMinutes !== null && closeMinutes < 360 && openMinutes !== null && openMinutes > closeMinutes) {
          // This is likely overnight, keep as is
        }

        if (isWithinRange(openMinutes, closeMinutes)) {
          return true;
        }
      }

      // If we found time ranges but none matched, restaurant is closed
      if (foundAnyRange) {
        return false;
      }

      // Couldn't parse - treat as closed (exclude from "Open Now" filter)
      return false;
    } catch (error) {
      console.error('Error parsing opening hours:', openingHours, error);
      // On error, treat as closed (exclude from "Open Now" filter)
      return false;
    }
  }

  // Wait for DOM and data to be ready
  document.addEventListener('DOMContentLoaded', function() {
    // Check if Mapbox is available
    if (typeof mapboxgl === 'undefined') {
      console.error('Mapbox GL JS not loaded');
      showMapError('Map library failed to load. Please refresh the page.');
      return;
    }

    // Check if access token is set
    if (!mapboxgl.accessToken || mapboxgl.accessToken === 'YOUR_MAPBOX_ACCESS_TOKEN') {
      console.error('Mapbox access token not configured');
      showMapError('Map requires configuration. Please set your Mapbox access token in the HTML file.');
      return;
    }

    // Check if restaurantData is available
    if (typeof restaurantData === 'undefined') {
      console.error('Restaurant data not loaded');
      showMapError('Failed to load restaurant data');
      return;
    }

    // Start with all categories selected (show all restaurants on load)
    restaurantData.categories.forEach(cat => activeFilters.add(cat.id));

    // Initialize map
    initializeMap();
  });

  /**
   * Initialize Mapbox map
   */
  function initializeMap() {
    const mapContainer = document.getElementById('restaurant-map');
    if (!mapContainer) {
      console.error('Map container not found');
      return;
    }

    // Show loading state
    showMapLoading(true);

    try {
      map = new mapboxgl.Map({
        container: 'restaurant-map',
        style: MAP_CONFIG.style,
        center: MAP_CONFIG.center,
        zoom: MAP_CONFIG.zoom,
        minZoom: MAP_CONFIG.minZoom,
        maxZoom: MAP_CONFIG.maxZoom,
        attributionControl: true
      });

      // Add navigation controls (zoom only, no compass)
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

      // Add fullscreen control - use .map-container so modal overlay works in fullscreen
      map.addControl(new mapboxgl.FullscreenControl({
        container: document.querySelector('.map-container')
      }), 'bottom-right');

      // Add custom Reset View control (above fullscreen)
      class ResetViewControl {
        onAdd(map) {
          this._map = map;
          this._container = document.createElement('div');
          this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
          this._container.innerHTML = `
            <button class="mapboxgl-ctrl-reset" type="button" title="Reset map view" aria-label="Reset map view">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
            </button>
          `;
          this._container.querySelector('button').addEventListener('click', () => {
            map.flyTo({
              center: MAP_CONFIG.center,
              zoom: MAP_CONFIG.zoom,
              essential: true
            });
          });
          return this._container;
        }
        onRemove() {
          this._container.parentNode.removeChild(this._container);
          this._map = undefined;
        }
      }
      map.addControl(new ResetViewControl(), 'bottom-right');

      // Add custom Geolocation control (mobile only - above reset)
      class MobileGeolocationControl {
        onAdd(map) {
          this._map = map;
          this._container = document.createElement('div');
          this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group mapboxgl-ctrl-geolocate-mobile';
          this._container.innerHTML = `
            <button class="mapboxgl-ctrl-geolocate-btn" type="button" title="Find my location" aria-label="Find my location">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v4m0 12v4m10-10h-4M6 12H2"/>
                <circle cx="12" cy="12" r="8"/>
              </svg>
            </button>
          `;

          const btn = this._container.querySelector('button');

          btn.addEventListener('click', function() {
            if (!navigator.geolocation) {
              alert('Geolocation is not supported by your browser');
              return;
            }

            // Show loading state
            btn.classList.add('loading');
            btn.disabled = true;

            navigator.geolocation.getCurrentPosition(
              function(position) {
                const userLng = position.coords.longitude;
                const userLat = position.coords.latitude;

                // Store user location globally for distance filtering
                userLocation = { lng: userLng, lat: userLat };

                // Show distance slider now that we have location
                showDistanceSlider();

                // Remove existing user marker if any (shared variable)
                if (userLocationMarker) {
                  userLocationMarker.remove();
                }

                // Create user location marker
                const markerEl = document.createElement('div');
                markerEl.className = 'user-location-marker';
                markerEl.innerHTML = `
                  <div class="user-location-dot"></div>
                  <div class="user-location-pulse"></div>
                `;

                userLocationMarker = new mapboxgl.Marker({ element: markerEl })
                  .setLngLat([userLng, userLat])
                  .addTo(map);

                // Fly to user location
                map.flyTo({
                  center: [userLng, userLat],
                  zoom: 15,
                  essential: true
                });

                // Reset button state
                btn.classList.remove('loading');
                btn.disabled = false;

                // Apply filters with new location context
                applyFilters();
              },
              function(error) {
                btn.classList.remove('loading');
                btn.disabled = false;

                let message = 'Unable to get your location';
                if (error.code === error.PERMISSION_DENIED) {
                  message = 'Location access denied. Please enable location permissions.';
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                  message = 'Location information unavailable.';
                } else if (error.code === error.TIMEOUT) {
                  message = 'Location request timed out.';
                }
                alert(message);
              },
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
              }
            );
          });

          return this._container;
        }
        onRemove() {
          if (userLocationMarker) {
            userLocationMarker.remove();
            userLocationMarker = null;
          }
          this._container.parentNode.removeChild(this._container);
          this._map = undefined;
        }
      }
      map.addControl(new MobileGeolocationControl(), 'bottom-right');

      // Map load event
      map.on('load', function() {
        showMapLoading(false);

        // Hide POI layers to keep map clean (we show our own restaurant markers)
        hidePOILayers();

        addMapSources();
        addMapLayers();
        setupMapEvents();
        initializeFilterPanel();
        updateFilterCount();
        // Apply initial filter state (important when starting with empty activeFilters)
        applyFilters();

        // On mobile, automatically request user location for distance filtering
        if (isMobileDevice()) {
          // Small delay to let the map settle before requesting location
          setTimeout(autoRequestGeolocation, 500);
        }
      });

      // Error handling
      map.on('error', function(e) {
        console.error('Map error:', e);
        showMapError('Map failed to load. Please refresh the page.');
      });

    } catch (error) {
      console.error('Map initialization error:', error);
      showMapError('Map initialization failed.');
    }
  }

  /**
   * Hide POI (Points of Interest) layers from the map
   * This removes shop icons, restaurant icons, landmarks, etc. to keep the map clean
   * while still showing colorful streets, parks, and water features
   */
  function hidePOILayers() {
    const style = map.getStyle();
    if (!style || !style.layers) return;

    // Find and hide all POI-related layers
    style.layers.forEach(function(layer) {
      const layerId = layer.id;

      // Hide POI labels (shops, restaurants, landmarks, attractions, etc.)
      if (layerId.startsWith('poi-') ||
          layerId.includes('poi') ||
          layerId === 'place-label' ||
          layerId.includes('attraction') ||
          layerId.includes('shop') ||
          layerId.includes('restaurant') ||
          layerId.includes('food') ||
          layerId.includes('cafe') ||
          layerId.includes('bar') ||
          layerId.includes('hotel') ||
          layerId.includes('lodging') ||
          layerId.includes('museum') ||
          layerId.includes('landmark')) {

        // Check if layer exists before trying to modify it
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', 'none');
        }
      }
    });

    console.log('POI layers hidden for cleaner map display');
  }

  /**
   * Add data sources to map
   */
  function addMapSources() {
    // Add restaurant GeoJSON source with clustering
    map.addSource('restaurants', {
      type: 'geojson',
      data: restaurantData,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
      clusterProperties: {
        // Count per category for cluster coloring
        sum: ['+', 1]
      }
    });

    // Add unclustered source for filtering
    map.addSource('restaurants-unclustered', {
      type: 'geojson',
      data: getFilteredData()
    });
  }

  /**
   * Add map layers
   */
  function addMapLayers() {
    // Cluster circles layer
    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'restaurants',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#F5A623',   // <= 10: golden
          10, '#E84A27', // <= 30: vermillion
          30, '#2D5A45'  // > 30: jade
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          20,  // <= 10
          10, 25, // <= 30
          30, 35  // > 30
        ],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#fff'
      }
    });

    // Cluster count labels
    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'restaurants',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 14
      },
      paint: {
        'text-color': '#ffffff'
      }
    });

    // Individual restaurant markers (unclustered)
    map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'restaurants',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['get', 'categoryColor'],
        'circle-radius': 10,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    });

    // Add hover effect layer
    map.addLayer({
      id: 'unclustered-point-hover',
      type: 'circle',
      source: 'restaurants',
      filter: ['==', ['get', 'id'], ''],
      paint: {
        'circle-color': ['get', 'categoryColor'],
        'circle-radius': 14,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#fff',
        'circle-opacity': 0.9
      }
    });
  }

  /**
   * Setup map event handlers
   */
  function setupMapEvents() {
    // Click on cluster to zoom in
    map.on('click', 'clusters', function(e) {
      const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      const clusterId = features[0].properties.cluster_id;

      map.getSource('restaurants').getClusterExpansionZoom(clusterId, function(err, zoom) {
        if (err) return;
        map.easeTo({
          center: features[0].geometry.coordinates,
          zoom: zoom
        });
      });
    });

    // Click on individual marker to show popup
    map.on('click', 'unclustered-point', function(e) {
      const feature = e.features[0];
      const coordinates = feature.geometry.coordinates.slice();

      // Get map container dimensions to calculate offset
      const mapContainer = document.querySelector('.map-container');
      const containerHeight = mapContainer.offsetHeight;
      const containerWidth = mapContainer.offsetWidth;

      // Calculate pixel offset to position marker so popup has room
      // Offset marker slightly up and left to give popup space (popup appears to right/below by default)
      const popupHeight = 300; // Approximate popup height
      const popupWidth = 340;  // Approximate popup width

      // Determine offset based on where the click is relative to center
      let offsetX = 0;
      let offsetY = 0;

      // If click is in right half, offset marker left so popup fits on right
      if (e.point.x > containerWidth / 2) {
        offsetX = popupWidth / 2 + 20;
      } else {
        offsetX = -(popupWidth / 2 + 20);
      }

      // If click is in bottom half, offset marker up so popup fits below
      if (e.point.y > containerHeight / 2) {
        offsetY = popupHeight / 2 + 20;
      } else {
        offsetY = -(popupHeight / 3);
      }

      // Fly to the marker location with offset, then show popup
      map.flyTo({
        center: coordinates,
        offset: [offsetX, offsetY],
        duration: 300,
        essential: true
      });

      // Show popup after map finishes moving
      map.once('moveend', function() {
        // Recalculate click point after map moved (marker is now offset from center)
        const newPoint = map.project(coordinates);
        showRestaurantPopup(feature, newPoint);
      });
    });

    // Hover effects on markers
    map.on('mouseenter', 'unclustered-point', function(e) {
      map.getCanvas().style.cursor = 'pointer';
      const feature = e.features[0];
      map.setFilter('unclustered-point-hover', ['==', ['get', 'id'], feature.properties.id]);
    });

    map.on('mouseleave', 'unclustered-point', function() {
      map.getCanvas().style.cursor = '';
      map.setFilter('unclustered-point-hover', ['==', ['get', 'id'], '']);
    });

    // Hover effects on clusters
    map.on('mouseenter', 'clusters', function() {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'clusters', function() {
      map.getCanvas().style.cursor = '';
    });

    // Note: Popup close on map click is not needed since we now use a modal overlay
    // The modal has its own close handlers (backdrop click, close button, escape key)
  }

  /**
   * Find all categories for a restaurant by name
   */
  function findAllCategoriesForRestaurant(restaurantName) {
    const categories = [];
    const seenCategories = new Set();

    restaurantData.features.forEach(function(feature) {
      if (feature.properties.name === restaurantName && !seenCategories.has(feature.properties.category)) {
        seenCategories.add(feature.properties.category);
        categories.push({
          name: feature.properties.category,
          color: feature.properties.categoryColor,
          emoji: feature.properties.categoryEmoji,
          image: CATEGORY_IMAGES[feature.properties.category] || ''
        });
      }
    });

    return categories;
  }

  /**
   * Show restaurant modal (animated overlay) at click position
   */
  function showRestaurantPopup(feature, clickPoint) {
    const props = feature.properties;

    // Close existing popup if any (cleanup)
    if (currentPopup) {
      currentPopup.remove();
      currentPopup = null;
    }

    // Find all categories for this restaurant
    const allCategories = findAllCategoriesForRestaurant(props.name);

    // Get modal elements
    const backdrop = document.getElementById('restaurant-modal-backdrop');
    const modal = document.getElementById('restaurant-modal');
    const categoryBar = document.getElementById('modal-category-bar');
    const categoriesContainer = document.getElementById('modal-categories-container');
    const nameEl = document.getElementById('modal-restaurant-name');
    const districtEl = document.getElementById('modal-district');
    const ratingEl = document.getElementById('modal-rating');
    const hoursEl = document.getElementById('modal-hours');
    const mapsLink = document.getElementById('modal-maps-link');
    const detailsBtn = document.getElementById('modal-details-btn');

    if (!backdrop) return;

    // Set category bar color
    categoryBar.style.background = `linear-gradient(135deg, ${props.categoryColor} 0%, ${adjustColor(props.categoryColor, -20)} 100%)`;

    // Generate category badges HTML (using CSS colors for readability)
    let categoryBadgesHTML = '';
    if (allCategories.length > 1) {
      // Multiple categories - show all as smaller badges
      categoryBadgesHTML = '<div class="modal-categories-multi">';
      allCategories.forEach(function(cat) {
        categoryBadgesHTML += `
          <div class="modal-category-badge">
            ${cat.image ? `<img src="${cat.image}" alt="${cat.name}" class="modal-category-img">` : `<span class="modal-emoji">${cat.emoji}</span>`}
            ${cat.name}
          </div>
        `;
      });
      categoryBadgesHTML += '</div>';
    } else {
      // Single category - show normal badge
      const categoryImage = CATEGORY_IMAGES[props.category] || '';
      categoryBadgesHTML = `
        <div class="modal-category-badge">
          ${categoryImage ? `<img src="${categoryImage}" alt="${props.category}" class="modal-category-img">` : `<span class="modal-emoji">${props.categoryEmoji}</span>`}
          ${props.category}
        </div>
      `;
    }

    // Populate modal content
    categoriesContainer.innerHTML = categoryBadgesHTML;
    nameEl.textContent = props.name;
    districtEl.querySelector('span').textContent = props.district;

    // Rating - show/hide based on data
    if (props.rating > 0) {
      ratingEl.style.display = 'flex';
      ratingEl.querySelector('.rating-value').textContent = props.rating.toFixed(1);
      ratingEl.querySelector('.review-count').textContent = `(${props.reviewCount.toLocaleString()} reviews)`;
    } else {
      ratingEl.style.display = 'none';
    }

    // Opening hours - show/hide based on data
    if (props.openingHours && props.openingHours !== 'n/a') {
      hoursEl.style.display = 'flex';
      hoursEl.querySelector('span').textContent = props.openingHours;
    } else {
      hoursEl.style.display = 'none';
    }

    // Set Google Maps link
    mapsLink.href = props.mapsLink;

    // Set up View Details button click handler
    detailsBtn.onclick = function() {
      closeRestaurantModal();
      openRestaurantFromMap(props.category, props.name, props.mapsLink);
    };

    // Store current restaurant data for reference
    backdrop.dataset.category = props.category;
    backdrop.dataset.restaurantName = props.name;

    // Position modal near the click point
    if (clickPoint && modal) {
      const mapContainerEl = document.querySelector('.map-container');
      const mapRect = mapContainerEl.getBoundingClientRect();

      // Check if we're in fullscreen mode
      const isFullscreen = document.fullscreenElement ||
                          document.webkitFullscreenElement ||
                          document.mozFullScreenElement ||
                          document.msFullscreenElement;

      // Modal dimensions (approximate)
      const modalWidth = 320;
      const modalHeight = 280;
      const offset = 15; // Gap between marker and popup

      let left, top;
      let containerWidth, containerHeight;

      // In both modes, clickPoint is relative to the map element
      // Use container dimensions for positioning
      if (isFullscreen) {
        containerWidth = window.innerWidth;
        containerHeight = window.innerHeight;
      } else {
        containerWidth = mapRect.width;
        containerHeight = mapRect.height;
      }

      const clickX = clickPoint.x;
      const clickY = clickPoint.y;

      // Decide horizontal positioning: prefer right, then left, then center
      if (clickX + offset + modalWidth < containerWidth - 20) {
        left = clickX + offset;
      } else if (clickX - offset - modalWidth > 20) {
        left = clickX - offset - modalWidth;
      } else {
        left = Math.max(20, (containerWidth - modalWidth) / 2);
      }

      // Decide vertical positioning: prefer below, then above, then center
      if (clickY + offset + modalHeight < containerHeight - 20) {
        top = clickY + offset;
      } else if (clickY - offset - modalHeight > 20) {
        top = clickY - offset - modalHeight;
      } else {
        top = Math.max(20, Math.min(clickY - modalHeight / 2, containerHeight - modalHeight - 20));
      }

      // Apply position
      modal.style.left = left + 'px';
      modal.style.top = top + 'px';
      modal.style.right = 'auto';
      modal.style.bottom = 'auto';
    }

    // Show modal with animation
    backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Set up modal close handlers
    setupModalCloseHandlers();
  }

  /**
   * Close restaurant modal with animation
   */
  function closeRestaurantModal() {
    const backdrop = document.getElementById('restaurant-modal-backdrop');
    if (backdrop) {
      backdrop.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  /**
   * Setup modal close event handlers
   */
  function setupModalCloseHandlers() {
    const backdrop = document.getElementById('restaurant-modal-backdrop');
    const closeBtn = document.getElementById('restaurant-modal-close');
    const modal = document.getElementById('restaurant-modal');

    // Close button click
    if (closeBtn) {
      closeBtn.onclick = function(e) {
        e.stopPropagation();
        closeRestaurantModal();
      };
    }

    // Backdrop click (outside modal)
    if (backdrop) {
      backdrop.onclick = function(e) {
        if (e.target === backdrop) {
          closeRestaurantModal();
        }
      };
    }

    // Escape key press
    document.addEventListener('keydown', handleModalEscapeKey);
  }

  /**
   * Handle escape key to close modal
   */
  function handleModalEscapeKey(e) {
    if (e.key === 'Escape') {
      const backdrop = document.getElementById('restaurant-modal-backdrop');
      if (backdrop && backdrop.classList.contains('active')) {
        closeRestaurantModal();
        document.removeEventListener('keydown', handleModalEscapeKey);
      }
    }
  }

  // Expose closeRestaurantModal to global scope for potential external use
  window.closeRestaurantModal = closeRestaurantModal;

  /**
   * Initialize filter panel
   */
  function initializeFilterPanel() {
    const filterContainer = document.getElementById('map-filter-container');
    if (!filterContainer) return;

    // Generate filter options HTML
    let optionsHTML = `
      <div class="filter-quick-actions">
        <button class="filter-quick-btn" id="filter-all-btn">Select All</button>
        <button class="filter-quick-btn" id="filter-none-btn">Clear All</button>
      </div>
      <div class="filter-divider"></div>
      <div class="filter-options-list">
    `;

    // Sort categories alphabetically by name
    const sortedCategories = [...restaurantData.categories].sort((a, b) =>
      a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' })
    );

    sortedCategories.forEach(cat => {
      const categoryImage = CATEGORY_IMAGES[cat.name] || '';
      optionsHTML += `
        <label class="filter-option">
          <input type="checkbox" value="${cat.id}" ${activeFilters.has(cat.id) ? 'checked' : ''}>
          <span class="filter-color" style="background: ${cat.color}"></span>
          ${categoryImage ? `<img src="${categoryImage}" alt="${cat.name}" class="filter-category-img">` : `<span class="filter-emoji">${cat.emoji}</span>`}
          <span class="filter-name">${cat.name}</span>
          <span class="filter-count">${cat.count}</span>
        </label>
      `;
    });

    optionsHTML += '</div>';

    const filterPanel = filterContainer.querySelector('.map-filter-panel');
    if (filterPanel) {
      filterPanel.innerHTML = `
        <div class="filter-header">
          <span>Filter by Category</span>
          <button class="filter-close-btn" id="filter-close-btn">&times;</button>
        </div>
        ${optionsHTML}
        <div class="filter-status" id="filter-status">
          Loading...
        </div>
      `;
    }

    // Setup filter event handlers
    setupFilterEvents();
  }

  /**
   * Setup filter event handlers
   */
  function setupFilterEvents() {
    // Toggle button
    const toggleBtn = document.getElementById('filter-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleFilterPanel);
    }

    // Close button
    const closeBtn = document.getElementById('filter-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeFilterPanel);
    }

    // All button
    const allBtn = document.getElementById('filter-all-btn');
    if (allBtn) {
      allBtn.addEventListener('click', function() {
        restaurantData.categories.forEach(cat => activeFilters.add(cat.id));
        updateFilterCheckboxes();
        applyFilters();
      });
    }

    // None button
    const noneBtn = document.getElementById('filter-none-btn');
    if (noneBtn) {
      noneBtn.addEventListener('click', function() {
        activeFilters.clear();
        updateFilterCheckboxes();
        applyFilters();
      });
    }

    // Category checkboxes
    const checkboxes = document.querySelectorAll('.filter-option input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', function() {
        const categoryId = parseInt(this.value);
        if (this.checked) {
          activeFilters.add(categoryId);
        } else {
          activeFilters.delete(categoryId);
        }
        applyFilters();
      });
    });

    // Open Now toggle button
    const openNowBtn = document.getElementById('open-now-btn');
    if (openNowBtn) {
      openNowBtn.addEventListener('click', function() {
        showOpenNowOnly = !showOpenNowOnly;
        this.classList.toggle('active', showOpenNowOnly);
        this.setAttribute('aria-pressed', showOpenNowOnly);
        applyFilters();
      });
    }

    // Top 3 Places toggle button
    const topPlacesBtn = document.getElementById('top-places-btn');
    if (topPlacesBtn) {
      topPlacesBtn.addEventListener('click', function() {
        showTopPlacesOnly = !showTopPlacesOnly;
        this.classList.toggle('active', showTopPlacesOnly);
        this.setAttribute('aria-pressed', showTopPlacesOnly);
        applyFilters();
      });
    }

    // Distance slider
    const distanceSlider = document.getElementById('distance-slider');
    if (distanceSlider) {
      distanceSlider.addEventListener('input', function() {
        const index = parseInt(this.value);
        maxDistanceMeters = DISTANCE_OPTIONS[index];
        updateDistanceLabel(index);
        applyFilters();
      });
    }

    // Click outside to close
    document.addEventListener('click', function(e) {
      const filterContainer = document.getElementById('map-filter-container');
      if (filterContainer && !filterContainer.contains(e.target) && isFilterPanelOpen) {
        closeFilterPanel();
      }
    });

    // Mobile bottom sheet drag handle
    setupMobileBottomSheet();
  }

  /**
   * Setup mobile bottom sheet behavior
   */
  function setupMobileBottomSheet() {
    const panel = document.querySelector('.map-filter-panel');
    if (!panel) return;

    let startY = 0;
    let currentY = 0;

    panel.addEventListener('touchstart', function(e) {
      if (e.target.closest('.filter-options-list')) return;
      startY = e.touches[0].clientY;
    });

    panel.addEventListener('touchmove', function(e) {
      if (e.target.closest('.filter-options-list')) return;
      currentY = e.touches[0].clientY;
      const diff = currentY - startY;
      if (diff > 0) {
        panel.style.transform = `translateY(${diff}px)`;
      }
    });

    panel.addEventListener('touchend', function(e) {
      if (e.target.closest('.filter-options-list')) return;
      const diff = currentY - startY;
      panel.style.transform = '';
      if (diff > 100) {
        closeFilterPanel();
      }
      startY = 0;
      currentY = 0;
    });
  }

  /**
   * Toggle filter panel
   */
  function toggleFilterPanel() {
    if (isFilterPanelOpen) {
      closeFilterPanel();
    } else {
      openFilterPanel();
    }
  }

  /**
   * Open filter panel
   */
  function openFilterPanel() {
    const panel = document.querySelector('.map-filter-panel');
    const toggleBtn = document.getElementById('filter-toggle-btn');
    if (panel) {
      panel.classList.add('open');
      isFilterPanelOpen = true;
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');

      // Reset scroll position to top and force content visibility
      requestAnimationFrame(function() {
        const optionsList = panel.querySelector('.filter-options-list');
        if (optionsList) {
          optionsList.scrollTop = 0;
        }
        // Trigger a reflow to ensure content is rendered
        panel.scrollTop = 0;
      });
    }
  }

  /**
   * Close filter panel
   */
  function closeFilterPanel() {
    const panel = document.querySelector('.map-filter-panel');
    const toggleBtn = document.getElementById('filter-toggle-btn');
    if (panel) {
      panel.classList.remove('open');
      isFilterPanelOpen = false;
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * Update filter checkboxes to match state
   */
  function updateFilterCheckboxes() {
    const checkboxes = document.querySelectorAll('.filter-option input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      const categoryId = parseInt(checkbox.value);
      checkbox.checked = activeFilters.has(categoryId);
    });
  }

  /**
   * Apply filters to map
   */
  function applyFilters() {
    if (!map || !map.getSource('restaurants')) return;

    // Get filtered data
    const filteredData = getFilteredData();

    // Update source
    map.getSource('restaurants').setData(filteredData);

    // Update count display
    updateFilterCount();
  }

  /**
   * Get filtered GeoJSON data
   */
  function getFilteredData() {
    const filteredFeatures = restaurantData.features.filter(feature => {
      // Must match selected category
      const matchesCategory = activeFilters.has(feature.properties.categoryId);
      if (!matchesCategory) return false;

      // If "Top 3 Places" filter is enabled, check if restaurant is in top 3
      if (!isTopPlace(feature)) {
        return false;
      }

      // If "Open Now" filter is enabled, check if restaurant is open
      if (showOpenNowOnly) {
        const isOpen = isRestaurantOpen(feature.properties.openingHours);
        if (!isOpen) return false;
      }

      // If distance filter is enabled (user location known), check distance
      if (!isWithinDistance(feature)) {
        return false;
      }

      return true;
    });

    return {
      type: 'FeatureCollection',
      features: filteredFeatures
    };
  }

  /**
   * Update filter count display
   */
  function updateFilterCount() {
    const status = document.getElementById('filter-status');
    const toggleCount = document.getElementById('filter-toggle-count');

    // Count unique restaurants matching all active filters
    // Use Set with mapsLink to deduplicate restaurants that appear in multiple categories
    const uniqueRestaurants = new Set();

    restaurantData.features.forEach(f => {
      // Must match category
      if (!activeFilters.has(f.properties.categoryId)) return;

      // Check top 3 filter
      if (!isTopPlace(f)) return;

      // Check open now filter
      if (showOpenNowOnly && !isRestaurantOpen(f.properties.openingHours)) return;

      // Check distance filter
      if (!isWithinDistance(f)) return;

      // Add to set using mapsLink as unique identifier (same physical location)
      uniqueRestaurants.add(f.properties.mapsLink);
    });

    const visibleCount = uniqueRestaurants.size;

    // Calculate unique total count (excluding duplicates across categories)
    const allUniqueRestaurants = new Set();
    restaurantData.features.forEach(f => {
      allUniqueRestaurants.add(f.properties.mapsLink);
    });
    const uniqueTotalCount = allUniqueRestaurants.size;

    // Build status text
    if (status) {
      let filterText = '';
      if (showTopPlacesOnly) filterText += ' top 3';
      if (showOpenNowOnly) filterText += ' open';
      if (userLocation && maxDistanceMeters !== Infinity) {
        const distLabel = maxDistanceMeters >= 1000
          ? `${maxDistanceMeters / 1000}km`
          : `${maxDistanceMeters}m`;
        filterText += ` within ${distLabel}`;
      }
      status.textContent = `Showing ${visibleCount}${filterText} of ${uniqueTotalCount} restaurants`;
    }
    if (toggleCount) {
      toggleCount.textContent = visibleCount;
    }
  }

  /**
   * Show map loading state
   */
  function showMapLoading(show) {
    const loading = document.getElementById('map-loading');
    if (loading) {
      loading.style.display = show ? 'flex' : 'none';
    }
  }

  /**
   * Show map error message
   */
  function showMapError(message) {
    const container = document.getElementById('restaurant-map');
    const loading = document.getElementById('map-loading');
    if (loading) loading.style.display = 'none';
    if (container) {
      container.innerHTML = `
        <div class="map-error">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>${message}</p>
        </div>
      `;
    }
  }

  /**
   * Open category detail modal (called from popup)
   * Maps category names to modal IDs and opens the corresponding detail modal
   */
  window.openCategoryModal = function(categoryName) {
    // Map category names to modal IDs based on actual HTML structure
    const modalMap = {
      // Porridge
      'Cháo': 'chao-detail-modal',
      // Sandwiches
      'Bánh mì': 'banhmi-detail-modal',
      // Noodles
      'Mì Quảng': 'miquang-detail-modal',
      'Bánh xèo': 'banhxeo-detail-modal',
      'Cao Lầu': 'caolau-detail-modal',
      'Nem lui': 'nemlui-detail-modal',
      'Xôi': 'xoi-detail-modal',
      'Bánh Bèo/Nậm/Lọc': 'banhbeo-detail-modal',
      'Bún bò Huế': 'bunbohue-detail-modal',
      'Bún chả cá': 'bunchaca-detail-modal',
      'Hủ tiếu Nam Vang': 'hutieu-detail-modal',
      'Bún mắm': 'bunmam-detail-modal',
      'Bò né': 'bone-detail-modal',
      'Bánh Tráng Cuốn': 'banhtrangcuon-detail-modal',
      'Phở': 'pho-detail-modal',
      'Cơm gà Tam Kỳ': 'comgatamky-detail-modal',
      'Cơm tấm': 'comtam-detail-modal',
      'Xôi gà xé': 'xoigaxe-detail-modal',
      'Bánh tráng kẹp': 'banhtrangkep-detail-modal',
      'Cơm niêu': 'comnieu-detail-modal',
      'Lẩu': 'lau-detail-modal',
      'Bún thịt nướng': 'bunthitnuong-detail-modal',
      'Bò lá lốt': 'bolalot-detail-modal',
      'Bún riêu': 'bunrieu-detail-modal',
      'Bánh Canh': 'banhcanhcaloc-detail-modal',
      'Hải Sản': 'seafood-detail-modal',
      'Hải Sản Bình Dân': 'localseafood-detail-modal',
      'Vịt quay': 'vitquay-detail-modal',
      'Michelin Selected': 'michelin-detail-modal',
      'Cà Phê': 'caphe-detail-modal',
      // Additional mappings for potential variations
      'Bánh Căn': 'banhcan-detail-modal'
    };

    const modalId = modalMap[categoryName];

    // Close popup first
    if (currentPopup) {
      currentPopup.remove();
      currentPopup = null;
    }

    // Check if openFoodDetail function exists and modal ID is found
    if (modalId && typeof openFoodDetail === 'function') {
      openFoodDetail(modalId);
    } else if (modalId) {
      // Fallback: try to find and show the modal directly
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
      } else {
        console.warn('Modal not found:', modalId);
        // Fall back to scrolling to categories section
        scrollToCategory(categoryName);
      }
    } else {
      console.warn('No modal mapping found for category:', categoryName);
      // Fall back to scrolling to categories section
      scrollToCategory(categoryName);
    }
  };

  /**
   * Normalize string for comparison (handle Vietnamese characters, whitespace, etc.)
   */
  function normalizeString(str) {
    if (!str) return '';
    return str
      .trim()
      .toLowerCase()
      .normalize('NFC') // Normalize unicode
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Open specific restaurant detail from map popup
   * Searches for the restaurant by name and opens its detail overlay
   */
  window.openRestaurantFromMap = function(categoryName, restaurantName, mapsLink) {
    // Close popup first
    if (currentPopup) {
      currentPopup.remove();
      currentPopup = null;
    }

    // Exit fullscreen mode if active
    if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }

    // Search for the restaurant list item
    const allRestaurantItems = document.querySelectorAll('.restaurant-list-item');
    let foundCardId = null;
    const normalizedSearchName = normalizeString(restaurantName);

    // First try: exact match by normalized name
    for (const item of allRestaurantItems) {
      const nameEl = item.querySelector('.restaurant-item-name');
      if (nameEl) {
        const itemName = normalizeString(nameEl.textContent);
        if (itemName === normalizedSearchName) {
          const onclick = item.getAttribute('onclick');
          if (onclick) {
            const match = onclick.match(/openRestaurantDetail\(['"]([^'"]+)['"]\)/);
            if (match) {
              foundCardId = match[1];
              break;
            }
          }
        }
      }
    }

    // Second try: match by Google Maps link (most reliable)
    if (!foundCardId && mapsLink) {
      for (const item of allRestaurantItems) {
        const linkEl = item.querySelector('.restaurant-item-maps');
        if (linkEl && linkEl.href === mapsLink) {
          const onclick = item.getAttribute('onclick');
          if (onclick) {
            const match = onclick.match(/openRestaurantDetail\(['"]([^'"]+)['"]\)/);
            if (match) {
              foundCardId = match[1];
              break;
            }
          }
        }
      }
    }

    // Third try: partial/fuzzy match by name (contains)
    if (!foundCardId) {
      for (const item of allRestaurantItems) {
        const nameEl = item.querySelector('.restaurant-item-name');
        if (nameEl) {
          const itemName = normalizeString(nameEl.textContent);
          // Check if either contains the other (handles slight variations)
          if (itemName.includes(normalizedSearchName) || normalizedSearchName.includes(itemName)) {
            const onclick = item.getAttribute('onclick');
            if (onclick) {
              const match = onclick.match(/openRestaurantDetail\(['"]([^'"]+)['"]\)/);
              if (match) {
                foundCardId = match[1];
                break;
              }
            }
          }
        }
      }
    }

    if (foundCardId && typeof openRestaurantDetail === 'function') {
      // Open the specific restaurant detail
      openRestaurantDetail(foundCardId);
    } else if (foundCardId) {
      // Fallback: try to find and show the detail overlay directly
      const overlay = document.getElementById('detail-' + foundCardId);
      if (overlay) {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        const panel = overlay.querySelector('.restaurant-detail-panel');
        if (panel) panel.scrollTop = 0;
      } else {
        console.warn('Restaurant detail overlay not found:', foundCardId);
        // Fall back to category modal
        openCategoryModal(categoryName);
      }
    } else {
      console.warn('Restaurant not found:', restaurantName, 'in category:', categoryName);
      // Fall back to opening the category modal
      openCategoryModal(categoryName);
    }
  };

  /**
   * Scroll to category section (fallback when modal not available)
   */
  window.scrollToCategory = function(categoryName) {
    // Map category names to section IDs based on actual HTML structure
    const sectionMap = {
      // Michelin & Coffee section
      'Michelin Selected': 'michelin',
      'Cà Phê': 'michelin',
      // Bánh mì & Street Snacks section
      'Bánh mì': 'banh-mi',
      'Bánh xèo': 'banh-mi',
      'Bánh tráng kẹp': 'banh-mi',
      'Bánh Căn': 'banh-mi',
      // Noodle Soups & Bún section
      'Phở': 'noodles',
      'Mì Quảng': 'noodles',
      'Bún bò Huế': 'noodles',
      'Bún chả cá': 'noodles',
      'Bún chả': 'noodles',
      'Bún mắm': 'noodles',
      'Bún thịt nướng': 'noodles',
      'Bún riêu': 'noodles',
      'Hủ tiếu Nam Vang': 'noodles',
      'Cao Lầu': 'noodles',
      'Bánh Canh': 'noodles',
      // Rice Dishes & Cơm section
      'Cơm gà': 'rice',
      'Cơm gà Tam Kỳ': 'rice',
      'Cơm tấm': 'rice',
      'Cơm niêu': 'rice',
      'Xôi': 'rice',
      'Xôi gà xé': 'rice',
      // Cháo & Comfort Food section (porridge)
      'Cháo': 'porridge',
      'Cháo Vịt': 'porridge',
      'Bánh Bèo/Nậm/Lọc': 'porridge',
      'Bánh Tráng Cuốn': 'porridge',
      // Grilled & BBQ section
      'Nem lui': 'grilled',
      'Bò né': 'grilled',
      'Bò lá lốt': 'grilled',
      // Seafood & Hot Pot section
      'Hải Sản': 'seafood',
      'Hải Sản Bình Dân': 'seafood',
      'Lẩu': 'seafood',
      // Roast Duck section
      'Vịt quay': 'duck'
    };

    const sectionId = sectionMap[categoryName] || 'categories';

    // Find the section
    const section = document.getElementById(sectionId) ||
                    document.querySelector('.categories');

    if (section) {
      // Scroll to section
      section.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  /**
   * Reset map view to initial position
   */
  window.resetMapView = function() {
    if (map) {
      map.flyTo({
        center: MAP_CONFIG.center,
        zoom: MAP_CONFIG.zoom,
        essential: true
      });
    }
  };

  /**
   * Adjust color brightness for gradient effects
   * @param {string} hex - Hex color code (e.g., '#E84A27')
   * @param {number} percent - Percentage to adjust (-100 to 100, negative = darker)
   * @returns {string} Adjusted hex color
   */
  function adjustColor(hex, percent) {
    // Remove # if present
    hex = hex.replace(/^#/, '');

    // Parse hex to RGB
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    // Adjust brightness
    r = Math.min(255, Math.max(0, Math.round(r + (r * percent / 100))));
    g = Math.min(255, Math.max(0, Math.round(g + (g * percent / 100))));
    b = Math.min(255, Math.max(0, Math.round(b + (b * percent / 100))));

    // Convert back to hex
    const toHex = (n) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

})();
