/**
 * Slot Machine - Three Lucky Selections
 * Vertical strip animation with smooth scroll - simulates real slot machine
 */

(function () {
    'use strict';

    var CATEGORY_IMAGES = {
        'Cháo': 'images/1. chao.jpg',
        'Bánh mì': 'images/2. Bánh mì heo quay.jpg',
        'Mì Quảng': 'images/3. Mì Quảng.jpg',
        'Bánh xèo': 'images/4. Bánh xèo.jpg',
        'Bánh Xèo': 'images/4. Bánh xèo.jpg',
        'Cao Lầu': 'images/5. Cao Lầu.jpg',
        'Nem lụi': 'images/6. Nem lui.jpg',
        'Xôi': 'images/7. Xôi mặn  Xôi ngọt.jpg',
        'Bánh Bèo/Nậm/Lọc': 'images/8. Bánh Bèo, Bánh Nậm, & Bánh Bột Lọc.jpg',
        'Bún bò Huế': 'images/9. Bún bò Huế.jpg',
        'Bún chả cá': 'images/10. Bún chả cá.jpg',
        'Bún chả': 'images/11. Bún chả.jpg',
        'Hủ tiếu Nam Vang': 'images/12. Hủ tiếu Nam Vang.jpg',
        'Bún mắm': 'images/13. Bún mắm.jpg',
        'Bò né': 'images/14. Bò né.jpg',
        'Cháo vịt': 'images/15. Cháo Vịt.jpg',
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

    var ALL_FOOD_IMAGES = Object.values(CATEGORY_IMAGES);

    function waitForData(callback) {
        if (typeof restaurantData !== 'undefined' && document.readyState === 'complete') {
            callback();
        } else {
            setTimeout(function () { waitForData(callback); }, 100);
        }
    }

    waitForData(initSlotMachine);

    var slotMachineInitialized = false;
    var currentSlotRestaurants = [null, null, null];
    var isSpinning = false;

    function getCategoryImage(categoryName) {
        if (!categoryName) return 'images/17. Phở.jpg';
        if (CATEGORY_IMAGES[categoryName]) return CATEGORY_IMAGES[categoryName];
        var lowerName = categoryName.toLowerCase();
        for (var key in CATEGORY_IMAGES) {
            if (key.toLowerCase() === lowerName) return CATEGORY_IMAGES[key];
        }
        return 'images/17. Phở.jpg';
    }

    function initSlotMachine() {
        if (slotMachineInitialized) return;
        slotMachineInitialized = true;
        console.log('Slot Machine initialized');

        setTimeout(function () {
            spinSlotMachine();
        }, 1500);

        document.addEventListener('filtersChanged', function () {
            setTimeout(function () {
                spinSlotMachine();
            }, 150);
        });
    }

    function findAllCategoriesForRestaurant(mapsLink) {
        var categories = [];
        var seenCategories = {};
        if (typeof restaurantData === 'undefined') return categories;

        restaurantData.features.forEach(function (feature) {
            if (feature.properties.mapsLink === mapsLink) {
                var catName = feature.properties.category;
                if (!seenCategories[catName]) {
                    seenCategories[catName] = true;
                    categories.push({
                        name: catName,
                        id: feature.properties.categoryId,
                        image: getCategoryImage(catName)
                    });
                }
            }
        });
        return categories;
    }

    function getFilterCount() {
        var filterBtn = document.querySelector('.filter-btn');
        if (filterBtn) {
            var countEl = filterBtn.querySelector('.filter-count');
            if (countEl) {
                var countText = countEl.textContent.replace(/"/g, '').trim();
                var count = parseInt(countText, 10);
                if (!isNaN(count)) return count;
            }
        }
        if (window.mapFilteredData && window.mapFilteredData.features) {
            return window.mapFilteredData.features.length;
        }
        return -1;
    }

    function getFilteredRestaurants() {
        if (window.mapFilteredData && window.mapFilteredData.features) {
            var seenMapsLinks = new Set();
            var filtered = [];
            window.mapFilteredData.features.forEach(function (feature) {
                if (!seenMapsLinks.has(feature.properties.mapsLink)) {
                    seenMapsLinks.add(feature.properties.mapsLink);
                    filtered.push(feature);
                }
            });
            return filtered;
        }

        var activeFilters = window.mapActiveFilters || new Set();
        var showOpenNow = window.mapShowOpenNowOnly || false;
        var showTopPlaces = window.mapShowTopPlacesOnly || false;

        var categoryIds;
        if (activeFilters && activeFilters.size > 0) {
            categoryIds = activeFilters;
        } else {
            categoryIds = new Set();
            for (var i = 1; i <= 35; i++) { categoryIds.add(i); }
        }

        var seenMapsLinks = new Set();
        var filtered = [];
        if (typeof restaurantData === 'undefined') return filtered;

        restaurantData.features.forEach(function (feature) {
            var props = feature.properties;
            if (!categoryIds.has(props.categoryId)) return;
            if (showOpenNow && typeof isRestaurantOpen === 'function') {
                if (!isRestaurantOpen(props.openingHours)) return;
            }
            if (showTopPlaces && props.quality !== undefined) {
                if (props.quality > 3) return;
            }
            if (!seenMapsLinks.has(props.mapsLink)) {
                seenMapsLinks.add(props.mapsLink);
                filtered.push(feature);
            }
        });
        return filtered;
    }

    function selectRandomRestaurants(count) {
        var filtered = getFilteredRestaurants();
        var selected = [];
        var usedIndices = new Set();

        while (selected.length < count && selected.length < filtered.length) {
            var idx = Math.floor(Math.random() * filtered.length);
            if (!usedIndices.has(idx)) {
                usedIndices.add(idx);
                selected.push(filtered[idx]);
            }
        }
        return selected;
    }

    /**
     * Create vertical strip for seamless scrolling spin
     * First 10 images are duplicated at end for seamless loop
     */
    function createSpinningStrip() {
        var html = '<div class="spin-strip">';
        // Select 10 random images
        var images = [];
        for (var i = 0; i < 10; i++) {
            images.push(ALL_FOOD_IMAGES[Math.floor(Math.random() * ALL_FOOD_IMAGES.length)]);
        }
        // Create first set
        for (var j = 0; j < 10; j++) {
            html += '<div class="spin-item" style="background-image: url(\'' + images[j] + '\');"></div>';
        }
        // Duplicate same images for seamless loop
        for (var k = 0; k < 10; k++) {
            html += '<div class="spin-item" style="background-image: url(\'' + images[k] + '\');"></div>';
        }
        html += '</div>';
        return html;
    }

    function startSpinning(slotId) {
        var card = document.getElementById('slot-card-' + slotId);
        if (!card) return;

        card.innerHTML = createSpinningStrip();
        card.className = 'slot-card spinning';
    }

    function renderSlotCard(feature, slotId) {
        var card = document.getElementById('slot-card-' + slotId);
        if (!card) return;

        currentSlotRestaurants[slotId - 1] = feature;

        if (!feature) {
            card.className = 'slot-card empty-dark';
            card.innerHTML = '';
            return;
        }

        var props = feature.properties;
        var allCategories = findAllCategoriesForRestaurant(props.mapsLink);
        var bgImage = allCategories.length > 0 ? allCategories[0].image : getCategoryImage(props.category);

        var categoryBadgesHTML = '<div class="slot-categories-row">';
        var maxShow = 4;
        allCategories.slice(0, maxShow).forEach(function (cat) {
            categoryBadgesHTML += '<span class="slot-category-tag">' + cat.name + '</span>';
        });
        if (allCategories.length > maxShow) {
            categoryBadgesHTML += '<span class="slot-category-tag">+' + (allCategories.length - maxShow) + '</span>';
        }
        categoryBadgesHTML += '</div>';

        var ratingHTML = '';
        if (props.rating > 0) {
            ratingHTML = '<p class="modal-rating">' +
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">' +
                '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' +
                '</svg>' +
                '<span class="rating-value">' + parseFloat(props.rating).toFixed(1) + '</span>' +
                '<span class="review-count">(' + (props.reviewCount || 0).toLocaleString() + ')</span>' +
                '</p>';
        }

        var districtHTML = '<p class="modal-district">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>' +
            '</svg><span>' + (props.district || '') + '</span></p>';

        var hoursHTML = '';
        if (props.openingHours && props.openingHours !== 'n/a') {
            hoursHTML = '<p class="modal-hours">' +
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>' +
                '</svg><span>' + props.openingHours + '</span></p>';
        }

        var mapsLink = props.mapsLink || '#';

        card.className = 'slot-card reveal';
        card.innerHTML =
            '<div class="slot-card-image" style="background-image: url(\'' + bgImage + '\');"></div>' +
            '<div class="slot-card-content">' +
            categoryBadgesHTML +
            '<div class="slot-text-content">' +
            '<h3 class="slot-restaurant-name">' + props.name + '</h3>' +
            '<div class="slot-info">' + districtHTML + ratingHTML + hoursHTML + '</div>' +
            '</div>' +
            '<div class="slot-actions">' +
            '<a href="' + mapsLink + '" target="_blank" rel="noopener" class="slot-btn slot-btn-maps">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>Maps</a>' +
            '<button class="slot-btn slot-btn-details" onclick="openSlotRestaurantDetail(' + slotId + ')">' +
            'Details<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M5 12h14M12 5l7 7-7 7"/></svg></button>' +
            '</div></div>';

        // Fit long restaurant names to one line
        setTimeout(function() {
            fitRestaurantName(card);
        }, 50);
    }

    /**
     * Fit restaurant name to single line by reducing font-size if needed
     */
    function fitRestaurantName(card) {
        if (!card) return;
        var nameEl = card.querySelector('.slot-restaurant-name');
        if (!nameEl) return;

        // Only apply on mobile
        if (window.innerWidth > 480) return;

        // Reset font size first
        nameEl.style.fontSize = '';
        
        // Get container width
        var containerWidth = nameEl.parentElement.clientWidth || 250;
        
        // Start with base font size and reduce if text overflows
        var fontSize = 16; // 1rem = 16px base
        var minFontSize = 11; // Don't go smaller than this
        
        nameEl.style.whiteSpace = 'nowrap';
        nameEl.style.overflow = 'hidden';
        
        // Reduce font size until text fits or we hit minimum
        while (nameEl.scrollWidth > containerWidth && fontSize > minFontSize) {
            fontSize -= 0.5;
            nameEl.style.fontSize = fontSize + 'px';
        }
        
        // If still doesn't fit, add ellipsis
        if (nameEl.scrollWidth > containerWidth) {
            nameEl.style.textOverflow = 'ellipsis';
        }
    }

    function spinSlotMachine() {
        if (isSpinning) return;

        var filterCount = getFilterCount();
        console.log('Filter count:', filterCount);

        // When filter count is 0 (user cleared all filters), show empty cards and don't spin
        if (filterCount === 0) {
            console.log('Filter count is 0 - showing empty cards');
            for (var k = 1; k <= 3; k++) {
                var emptyCard = document.getElementById('slot-card-' + k);
                if (emptyCard) {
                    emptyCard.className = 'slot-card empty-dark';
                    emptyCard.innerHTML = '';
                    currentSlotRestaurants[k - 1] = null;
                }
            }
            return;
        }

        var filtered = getFilteredRestaurants();

        if (filtered.length === 0) {
            console.log('No restaurants - not spinning');
            for (var m = 1; m <= 3; m++) {
                var emptyCard2 = document.getElementById('slot-card-' + m);
                if (emptyCard2) {
                    emptyCard2.className = 'slot-card empty-dark';
                    emptyCard2.innerHTML = '';
                    currentSlotRestaurants[m - 1] = null;
                }
            }
            return;
        }

        console.log('Spinning slot machine with', filtered.length, 'restaurants');
        isSpinning = true;

        currentSlotRestaurants = [null, null, null];
        var pendingRestaurants = selectRandomRestaurants(3);

        // Start spinning all reels
        for (var i = 1; i <= 3; i++) {
            startSpinning(i);
        }

        // Staggered reveal
        var delays = [1800, 2400, 3000];
        for (var j = 0; j < 3; j++) {
            (function (idx, restaurant) {
                setTimeout(function () {
                    renderSlotCard(restaurant, idx + 1);
                    if (idx === 2) isSpinning = false;
                }, delays[idx]);
            })(j, pendingRestaurants[j] || null);
        }
    }

    window.spinSlotMachine = spinSlotMachine;

    window.openSlotRestaurantDetail = function (slotId) {
        var feature = currentSlotRestaurants[slotId - 1];
        if (!feature) return;

        var props = feature.properties;
        console.log('Opening restaurant detail for slot', slotId, ':', props.name);

        if (typeof window.openRestaurantFromMap === 'function') {
            window.openRestaurantFromMap(props.category, props.name, props.mapsLink);
        } else {
            window.open(props.mapsLink, '_blank');
        }
    };

})();
