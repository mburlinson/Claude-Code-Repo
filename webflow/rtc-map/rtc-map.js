/* ============================================
   RTC Interactive Map — JavaScript
   Hosted on GitHub, served via jsDelivr CDN
   ============================================ */

(function() {
  'use strict';

  // ==========================================
  // CONFIGURATION
  // ==========================================

  mapboxgl.accessToken = 'pk.eyJ1IjoibWJ1cmxpbnNvbiIsImEiOiI4bjdrV2lNIn0.CS5vqafA7WiXnOXc1P85CA';

  // Building footprint overlay (PNG with transparent background)
  var OVERLAY_URL = 'https://cdn.prod.website-files.com/698a40b1d4f260473b1b221a/69b6f9a433e9bca539e6267c_4_RTC%20overlay%20(1).png';

  // Overlay image dimensions: 2325 x 2330 (nearly square)
  var IMG_WIDTH = 2325;
  var IMG_HEIGHT = 2330;

  // Geo-calibrated overlay position (aligned with Mapbox buildings)
  var MAP_CENTER = [-77.35924, 38.95692];
  var LNG_SPAN = 0.01260;
  var COS_LAT = Math.cos(MAP_CENTER[1] * Math.PI / 180);
  var LAT_SPAN = LNG_SPAN * COS_LAT * (IMG_HEIGHT / IMG_WIDTH);

  var BOUNDS = {
    west:  MAP_CENTER[0] - LNG_SPAN / 2,
    east:  MAP_CENTER[0] + LNG_SPAN / 2,
    south: MAP_CENTER[1] - LAT_SPAN / 2,
    north: MAP_CENTER[1] + LAT_SPAN / 2
  };

  // Category colors and labels
  var LABELS = {
    shop: 'Shop',
    dine: 'Dine',
    entertainment: 'Entertainment',
    services: 'Services'
  };

  // SVG pin icons (data URIs)
  var PIN_SVGS = {
    shop: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 35'%3E%3Cpath fill='%230278d4' d='M26.83,13.92c0,10.12-12.92,20.4-12.92,20.4S1,24,1,13.92a12.92,12.92,0,1,1,25.83,0'/%3E%3Cpath fill='%23fff' d='M19,20c-.06-.54-.1-1.08-.15-1.62-.08-.81-.15-1.62-.23-2.43s-.17-1.86-.26-2.79c0-.51-.09-1-.14-1.54a.49.49,0,0,0-.55-.48h-1.2v-.24c0-.46,0-.93,0-1.38a2.54,2.54,0,0,0-5,.15c0,.36,0,.72,0,1.07v.41H10.15a.51.51,0,0,0-.53.49c0,.15,0,.29,0,.44-.08.93-.17,1.85-.25,2.77s-.15,1.63-.23,2.44S8.94,19.12,8.84,20a.54.54,0,0,0,.58.62h9C18.84,20.65,19,20.43,19,20ZM12.36,9.6a1.58,1.58,0,0,1,3.13.14c0,.46,0,.92,0,1.39H12.35C12.35,10.61,12.31,10.1,12.36,9.6Z'/%3E%3C/svg%3E",
    dine: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 35'%3E%3Cpath fill='%23df4661' d='M26.83,13.92c0,10.12-12.92,20.4-12.92,20.4S1,24,1,13.92a12.92,12.92,0,1,1,25.83,0'/%3E%3Cpath fill='%23fff' d='M18.75,12.68v3.21a1.4,1.4,0,0,1-.25.89.26.26,0,0,0,0,.15c.05.74.11,1.47.17,2.2.07,1,.15,1.94.22,2.91l.06.65a1.36,1.36,0,0,1-1.08,1.46,1.33,1.33,0,0,1-1.58-1,3.36,3.36,0,0,1,0-.95c.08-1,.17-2,.25-3,.07-.74.13-1.48.19-2.22,0-.07,0-.13-.07-.17A2,2,0,0,1,15.5,15.6a5.13,5.13,0,0,1-.35-1.73A9,9,0,0,1,16,9.63a3.59,3.59,0,0,1,.88-1.2,1,1,0,0,1,1.2-.25,1.16,1.16,0,0,1,.66,1.13Z'/%3E%3Cpath fill='%23fff' d='M10,15.36H9.42a1.06,1.06,0,0,1-1.14-1.12V8.47q0-.36.3-.39a.43.43,0,0,1,.51.3,1,1,0,0,1,0,.24c0,1.18,0,2.36,0,3.54a.57.57,0,0,0,.36.58.55.55,0,0,0,.75-.45,1.62,1.62,0,0,0,0-.22V8.56a.42.42,0,0,1,.45-.47.39.39,0,0,1,.38.37,1.09,1.09,0,0,1,0,.18v3.42a1.32,1.32,0,0,0,0,.28.55.55,0,0,0,.6.43.57.57,0,0,0,.5-.53V8.58a.45.45,0,0,1,.57-.49.29.29,0,0,1,.27.25.62.62,0,0,1,0,.19v5.68a1,1,0,0,1-.76,1.1,1.86,1.86,0,0,1-.34,0h-.6c0,.18,0,.35,0,.52l.42,4.78c.06.73.13,1.47.2,2.2a1.27,1.27,0,0,1-1.09,1.29,1.47,1.47,0,0,1-1.11-.25,1.13,1.13,0,0,1-.48-1c.08-1.09.19-2.19.28-3.28s.17-1.94.25-2.91Q9.93,16,10,15.36Z'/%3E%3C/svg%3E",
    entertainment: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 35'%3E%3Cpath fill='%2301b2a9' d='M26.83,13.92c0,10.12-12.92,20.4-12.92,20.4S1,24,1,13.92a12.92,12.92,0,1,1,25.83,0'/%3E%3Cpath fill='%23fff' d='M16.79,15.2c.21.66.43,1.32.64,2,.27.84.55,1.68.82,2.52a.5.5,0,0,1,0,.27c-.07.22-.31.27-.52.12l-1.69-1.23-2-1.49a.16.16,0,0,0-.22,0L10.17,20l-.11.07a.32.32,0,0,1-.39,0,.33.33,0,0,1-.1-.38c.09-.3.19-.59.29-.89.38-1.17.76-2.34,1.15-3.52a.14.14,0,0,0-.07-.2L7.2,12.41C7,12.29,7,12.13,7.08,12a.55.55,0,0,1,.23-.17.66.66,0,0,1,.2,0l4.49,0c.12,0,.16,0,.19-.15l1.4-4.34a.49.49,0,0,1,.17-.25.3.3,0,0,1,.46.2l.35,1.07,1.08,3.35a.15.15,0,0,0,.17.12l4.5,0h.16a.31.31,0,0,1,.17.58l-1.73,1.25-2,1.47Z'/%3E%3C/svg%3E",
    services: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 35'%3E%3Cpath fill='%23fdda24' d='M26.83,13.92c0,10.12-12.92,20.4-12.92,20.4S1,24,1,13.92a12.92,12.92,0,1,1,25.83,0'/%3E%3Cpath fill='%23fff' d='M13,9.25a1.1,1.1,0,0,1,.41-1.31,1,1,0,0,1,1.11,0,1.09,1.09,0,0,1,.37,1.29l.22.06A3.8,3.8,0,0,1,17.79,12,5.48,5.48,0,0,1,18,13.54a17.18,17.18,0,0,0,.12,2.27A4.72,4.72,0,0,0,18.39,17a1.91,1.91,0,0,0,.15.28.43.43,0,0,0,.38.22.76.76,0,0,1,.65,1.15A.73.73,0,0,1,19,19H9a.88.88,0,0,1-.52-.13A.79.79,0,0,1,8.19,18a.67.67,0,0,1,.63-.54.63.63,0,0,0,.59-.45,4.2,4.2,0,0,0,.28-1.15,20,20,0,0,0,.14-2.57,4.43,4.43,0,0,1,.73-2.47,3.79,3.79,0,0,1,2.29-1.58Z'/%3E%3Cpath fill='%23fff' d='M13.91,20.93a1.05,1.05,0,0,1-.92-1.5.13.13,0,0,1,.13-.07h1.6a.19.19,0,0,1,.12.07A1.05,1.05,0,0,1,13.91,20.93Z'/%3E%3C/svg%3E"
  };

  // ==========================================
  // SHOP DATA — from Webflow CMS Collection List
  // ==========================================
  var SHOPS = [];
  (function() {
    var container = document.getElementById('rtc-shop-data');
    if (!container) {
      console.error('RTC Map: #rtc-shop-data container not found.');
      return;
    }
    container.querySelectorAll('[data-slug]').forEach(function(el) {
      var lat = parseFloat(el.getAttribute('data-lat'));
      var lng = parseFloat(el.getAttribute('data-lng'));
      if (isNaN(lat) || isNaN(lng)) return;
      SHOPS.push({
        name: el.getAttribute('data-name') || '',
        slug: el.getAttribute('data-slug') || '',
        place: el.getAttribute('data-place') || '',
        type: (el.getAttribute('data-type') || 'shop').toLowerCase(),
        lat: lat,
        lng: lng,
        address: el.getAttribute('data-address') || '',
        phone: el.getAttribute('data-phone') || '',
        website: el.getAttribute('data-website') || ''
      });
    });
  })();

  // ==========================================
  // STATE
  // ==========================================
  var map;
  var markers = [];
  var activeFilter = 'all';
  var activePopup = null;

  // ==========================================
  // INITIALIZE MAP
  // ==========================================
  function initMap() {
    map = new mapboxgl.Map({
      container: 'rtc-mapbox',
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-77.35830, 38.95830],
      zoom: 16.4,
      minZoom: 15,
      maxZoom: 20,
      attributionControl: false
    });

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('style.load', function() {
      map.addSource('building-overlay', {
        type: 'image',
        url: OVERLAY_URL,
        coordinates: [
          [BOUNDS.west, BOUNDS.north],
          [BOUNDS.east, BOUNDS.north],
          [BOUNDS.east, BOUNDS.south],
          [BOUNDS.west, BOUNDS.south]
        ]
      });

      map.addLayer({
        id: 'building-overlay-layer',
        type: 'raster',
        source: 'building-overlay',
        paint: { 'raster-opacity': 0.75 }
      });

      // Constrain panning
      var padLng = LNG_SPAN * 0.15;
      var padLat = LAT_SPAN * 0.15;
      map.setMaxBounds([
        [BOUNDS.west - padLng, BOUNDS.south - padLat],
        [BOUNDS.east + padLng, BOUNDS.north + padLat]
      ]);

      addMarkers();
    });
  }

  // ==========================================
  // MARKERS
  // ==========================================
  function addMarkers() {
    SHOPS.forEach(function(shop) {
      var lngLat = [shop.lng, shop.lat];
      var el = document.createElement('div');
      el.className = 'rtc-marker';
      el.setAttribute('data-type', shop.type);
      el.setAttribute('data-slug', shop.slug);
      el.style.backgroundImage = 'url("' + PIN_SVGS[shop.type] + '")';
      el.style.backgroundSize = 'contain';
      el.style.backgroundRepeat = 'no-repeat';

      var marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(lngLat)
        .addTo(map);

      el.addEventListener('click', function(e) {
        e.stopPropagation();
        openPopup(shop, lngLat);
        highlightSidebarItem(shop.slug);
      });

      markers.push({ marker: marker, el: el, shop: shop });
    });
  }

  // ==========================================
  // POPUPS
  // ==========================================
  function openPopup(shop, lngLat) {
    if (activePopup) activePopup.remove();

    var phoneHtml = shop.phone && shop.phone !== 'Coming Soon'
      ? '<p class="rtc-popup-phone">' + escapeHtml(shop.phone) + '</p>'
      : '';

    var addressHtml = shop.address
      ? '<p class="rtc-popup-address">' + escapeHtml(shop.address) + '</p>'
      : '';

    var html = '<div class="rtc-popup">' +
      '<span class="rtc-popup-type ' + shop.type + '">' + LABELS[shop.type] + '</span>' +
      '<h4>' + escapeHtml(shop.name) + '</h4>' +
      addressHtml +
      phoneHtml +
      '<a href="/shops/' + shop.slug + '" class="rtc-popup-link">View Details</a>' +
      '</div>';

    activePopup = new mapboxgl.Popup({ offset: [0, -28], maxWidth: '280px' })
      .setLngLat(lngLat)
      .setHTML(html)
      .addTo(map);
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ==========================================
  // SIDEBAR
  // ==========================================
  function buildSidebar() {
    var list = document.getElementById('rtc-sidebar-list');
    var groups = { shop: [], dine: [], entertainment: [], services: [] };

    SHOPS.forEach(function(s) {
      if (groups[s.type]) groups[s.type].push(s);
    });

    Object.keys(groups).forEach(function(key) {
      groups[key].sort(function(a, b) { return a.name.localeCompare(b.name); });
    });

    var order = ['shop', 'dine', 'entertainment', 'services'];
    var html = '';

    order.forEach(function(type) {
      if (groups[type].length === 0) return;
      html += '<p class="rtc-sidebar-group-title">' + LABELS[type] + ' (' + groups[type].length + ')</p>';
      groups[type].forEach(function(shop) {
        html += '<div class="rtc-sidebar-item" data-slug="' + shop.slug + '" data-type="' + shop.type + '" data-name="' + escapeHtml(shop.name).toLowerCase() + '">' +
          '<span class="rtc-sidebar-dot ' + shop.type + '"></span>' +
          '<span class="rtc-sidebar-name">' + escapeHtml(shop.name) + '</span>' +
          '</div>';
      });
    });

    list.innerHTML = html;
    document.getElementById('rtc-shop-count').textContent = SHOPS.length + ' locations';

    list.querySelectorAll('.rtc-sidebar-item').forEach(function(item) {
      item.addEventListener('click', function() {
        var slug = this.getAttribute('data-slug');
        var found = markers.find(function(m) { return m.shop.slug === slug; });
        if (found) {
          var lngLat = found.marker.getLngLat();
          map.flyTo({ center: lngLat, zoom: 18, duration: 800 });
          setTimeout(function() {
            openPopup(found.shop, [lngLat.lng, lngLat.lat]);
          }, 400);
          highlightSidebarItem(slug);
        }
      });
    });
  }

  function highlightSidebarItem(slug) {
    document.querySelectorAll('.rtc-sidebar-item').forEach(function(el) {
      el.classList.toggle('active', el.getAttribute('data-slug') === slug);
    });
  }

  // ==========================================
  // FILTERS
  // ==========================================
  function setupFilters() {
    document.querySelectorAll('.rtc-filter-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var filter = this.getAttribute('data-filter');
        activeFilter = filter;

        document.querySelectorAll('.rtc-filter-btn').forEach(function(b) {
          b.classList.toggle('active', b.getAttribute('data-filter') === filter);
        });

        markers.forEach(function(m) {
          var visible = (filter === 'all' || m.shop.type === filter);
          m.el.classList.toggle('hidden', !visible);
        });

        document.querySelectorAll('.rtc-sidebar-item').forEach(function(item) {
          var type = item.getAttribute('data-type');
          var visible = (filter === 'all' || type === filter);
          item.classList.toggle('filtered-out', !visible);
        });

        document.querySelectorAll('.rtc-sidebar-group-title').forEach(function(title) {
          var next = title.nextElementSibling;
          var hasVisible = false;
          while (next && !next.classList.contains('rtc-sidebar-group-title')) {
            if (!next.classList.contains('filtered-out')) hasVisible = true;
            next = next.nextElementSibling;
          }
          title.style.display = hasVisible ? '' : 'none';
        });

        if (activePopup) { activePopup.remove(); activePopup = null; }
      });
    });
  }

  // ==========================================
  // SEARCH
  // ==========================================
  function setupSearch() {
    var searchInput = document.getElementById('rtc-search');
    searchInput.addEventListener('input', function() {
      var query = this.value.toLowerCase().trim();

      document.querySelectorAll('.rtc-sidebar-item').forEach(function(item) {
        var name = item.getAttribute('data-name');
        var type = item.getAttribute('data-type');
        var matchesSearch = !query || name.indexOf(query) !== -1;
        var matchesFilter = (activeFilter === 'all' || type === activeFilter);
        item.classList.toggle('filtered-out', !(matchesSearch && matchesFilter));
      });

      document.querySelectorAll('.rtc-sidebar-group-title').forEach(function(title) {
        var next = title.nextElementSibling;
        var hasVisible = false;
        while (next && !next.classList.contains('rtc-sidebar-group-title')) {
          if (!next.classList.contains('filtered-out')) hasVisible = true;
          next = next.nextElementSibling;
        }
        title.style.display = hasVisible ? '' : 'none';
      });

      markers.forEach(function(m) {
        var nameMatch = !query || m.shop.name.toLowerCase().indexOf(query) !== -1;
        var typeMatch = (activeFilter === 'all' || m.shop.type === activeFilter);
        m.el.classList.toggle('hidden', !(nameMatch && typeMatch));
      });
    });
  }

  // ==========================================
  // BOOT
  // ==========================================
  buildSidebar();
  setupFilters();
  setupSearch();
  initMap();

})();
