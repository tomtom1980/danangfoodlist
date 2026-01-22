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
    'Cháo': '1. chao.jpg',
    'Bánh mì': '2. Bánh mì heo quay.jpg',
    'Mì Quảng': '3. Mì Quảng.jpg',
    'Bánh xèo': '4. Bánh xèo.jpg',
    'Cao Lầu': '5. Cao Lầu.jpg',
    'Nem lui': '6. Nem lui.jpg',
    'Xôi': '7. Xôi mặn  Xôi ngọt.jpg',
    'Bánh Bèo/Nậm/Lọc': '8. Bánh Bèo, Bánh Nậm, & Bánh Bột Lọc.jpg',
    'Bún bò Huế': '9. Bún bò Huế.jpg',
    'Bún chả cá': '10. Bún chả cá.jpg',
    'Bún chả': '11. Bún chả.jpg',
    'Hủ tiếu Nam Vang': '12. Hủ tiếu Nam Vang.jpg',
    'Bún mắm': '13. Bún mắm.jpg',
    'Bò né': '14. Bò né.jpg',
    'Cháo Vịt': '15. Cháo Vịt.jpg',
    'Bánh Tráng Cuốn': '16. Bánh Tráng Cuốn Thịt Heo.jpg',
    'Phở': '17. Phở.jpg',
    'Cơm gà Tam Kỳ': '18. Cơm gà Tam Kỳ  Hội An.jpg',
    'Cơm gà': '19. Cơm gà.jpg',
    'Cơm tấm': '20. Cơm tấm.jpg',
    'Xôi gà xé': '21. Xôi gà xé.jpg',
    'Bánh tráng kẹp': '22. Bánh tráng kẹp A Ri.jpg',
    'Cơm niêu': '23. Cơm niêu cá kho  thịt kho trứng.jpg',
    'Lẩu': 'smallimages/24. Lẩu thái  bò  cá.jpg',
    'Bún thịt nướng': '25. Bún thịt nướng.jpg',
    'Bò lá lốt': '26. Bò lá lốt.jpg',
    'Bún riêu': '27. Bún riêu.jpg',
    'Bánh Canh': '28. Bánh Canh cá lóc.jpg',
    'Bánh Căn': 'smallimages/29. Bánh Căn.jpg',
    'Hải Sản': 'smallimages/30. Seafood.jpg',
    'Hải Sản Bình Dân': 'smallimages/31. Cheaper local seafood.jpg',
    'Vịt quay': 'smallimages/32. Vietnam-style roast duck with crispy skin.jpg',
    'Michelin Selected': 'michelinselected.jpg',
    'Cà Phê': 'Ca_Phe.jpg'
  };

  // State management
  let map = null;
  let activeFilters = new Set();
  let isFilterPanelOpen = false;
  let currentPopup = null;

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

    // Initialize all categories as active
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

      // Add fullscreen control
      map.addControl(new mapboxgl.FullscreenControl(), 'bottom-right');

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
          this._userMarker = null;
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
          const self = this;

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

                // Remove existing user marker if any
                if (self._userMarker) {
                  self._userMarker.remove();
                }

                // Create user location marker
                const markerEl = document.createElement('div');
                markerEl.className = 'user-location-marker';
                markerEl.innerHTML = `
                  <div class="user-location-dot"></div>
                  <div class="user-location-pulse"></div>
                `;

                self._userMarker = new mapboxgl.Marker({ element: markerEl })
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
          if (this._userMarker) {
            this._userMarker.remove();
          }
          this._container.parentNode.removeChild(this._container);
          this._map = undefined;
        }
      }
      map.addControl(new MobileGeolocationControl(), 'bottom-right');

      // Map load event
      map.on('load', function() {
        showMapLoading(false);
        addMapSources();
        addMapLayers();
        setupMapEvents();
        initializeFilterPanel();
        updateFilterCount();
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
      showRestaurantPopup(feature);
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

    // Close popup on map click (not on marker)
    map.on('click', function(e) {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['unclustered-point', 'clusters']
      });
      if (features.length === 0 && currentPopup) {
        currentPopup.remove();
        currentPopup = null;
      }
    });
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
   * Show restaurant popup
   */
  function showRestaurantPopup(feature) {
    const props = feature.properties;
    const coordinates = feature.geometry.coordinates.slice();

    // Close existing popup
    if (currentPopup) {
      currentPopup.remove();
    }

    // Find all categories for this restaurant
    const allCategories = findAllCategoriesForRestaurant(props.name);

    // Generate category badges HTML
    let categoryBadgesHTML = '';
    if (allCategories.length > 1) {
      // Multiple categories - show all as smaller badges
      categoryBadgesHTML = '<div class="popup-categories-multi">';
      allCategories.forEach(function(cat) {
        categoryBadgesHTML += `
          <div class="popup-category-badge popup-category-badge-small" style="background: linear-gradient(135deg, ${cat.color} 0%, ${adjustColor(cat.color, -15)} 100%)">
            ${cat.image ? `<img src="${cat.image}" alt="${cat.name}" class="popup-category-img">` : `<span class="popup-emoji">${cat.emoji}</span>`}
            ${cat.name}
          </div>
        `;
      });
      categoryBadgesHTML += '</div>';
    } else {
      // Single category - show normal badge
      const categoryImage = CATEGORY_IMAGES[props.category] || '';
      categoryBadgesHTML = `
        <div class="popup-category-badge" style="background: linear-gradient(135deg, ${props.categoryColor} 0%, ${adjustColor(props.categoryColor, -15)} 100%)">
          ${categoryImage ? `<img src="${categoryImage}" alt="${props.category}" class="popup-category-img">` : `<span class="popup-emoji">${props.categoryEmoji}</span>`}
          ${props.category}
        </div>
      `;
    }

    // Create popup HTML with enhanced design
    const popupHTML = `
      <div class="map-popup">
        <div class="popup-category-bar" style="background: linear-gradient(135deg, ${props.categoryColor} 0%, ${adjustColor(props.categoryColor, -20)} 100%)"></div>
        <div class="popup-content">
          ${categoryBadgesHTML}
          <h3 class="popup-name">${props.name}</h3>
          <div class="popup-info">
            <p class="popup-district">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              ${props.district}
            </p>
            ${props.rating > 0 ? `
            <p class="popup-rating">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span class="rating-value">${props.rating.toFixed(1)}</span>
              <span class="review-count">(${props.reviewCount.toLocaleString()} reviews)</span>
            </p>` : ''}
            ${props.openingHours && props.openingHours !== 'n/a' ? `
            <p class="popup-hours">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
              ${props.openingHours}
            </p>` : ''}
          </div>
          <div class="popup-actions">
            <a href="${props.mapsLink}" target="_blank" rel="noopener" class="popup-button popup-maps-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              Google Maps
            </a>
            <button class="popup-button popup-details-btn" onclick="openRestaurantFromMap('${props.category}', '${props.name.replace(/'/g, "\\'")}')">
              View Details
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    // Create and add popup
    currentPopup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: '320px',
      className: 'restaurant-popup'
    })
      .setLngLat(coordinates)
      .setHTML(popupHTML)
      .addTo(map);
  }

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
          Showing ${restaurantData.totalCount} of ${restaurantData.totalCount} restaurants
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
    const filteredFeatures = restaurantData.features.filter(feature =>
      activeFilters.has(feature.properties.categoryId)
    );

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
    const visibleCount = restaurantData.features.filter(f =>
      activeFilters.has(f.properties.categoryId)
    ).length;

    if (status) {
      status.textContent = `Showing ${visibleCount} of ${restaurantData.totalCount} restaurants`;
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
   * Open specific restaurant detail from map popup
   * Searches for the restaurant by name and opens its detail overlay
   */
  window.openRestaurantFromMap = function(categoryName, restaurantName) {
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

    // Search for the restaurant list item by name
    const allRestaurantItems = document.querySelectorAll('.restaurant-list-item');
    let foundCardId = null;

    for (const item of allRestaurantItems) {
      const nameEl = item.querySelector('.restaurant-item-name');
      if (nameEl && nameEl.textContent.trim() === restaurantName) {
        // Extract card ID from onclick attribute
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
