/* Quantum Park — Neighborhood Map (Mapbox GL). Reads POIs from #qp-poi-data. */
(function() {
  'use strict';

  mapboxgl.accessToken = 'pk.eyJ1IjoibWJ1cmxpbnNvbiIsImEiOiI4bjdrV2lNIn0.CS5vqafA7WiXnOXc1P85CA';

  // Property anchor (Quantum Park) - exact coords from the legacy site dataset
  var PROPERTY = { name: 'Quantum Park', lat: 39.0110587, lng: -77.4711407 };

  // Category color palette. Add a new key here and the filter/legend/pins pick it up.
  var CAT_COLORS = {
    'Dining': '#df4661',
    'Shopping': '#0278d4',
    'Health': '#16a34a',
    'Entertainment': '#01b2a9',
    'Transportation': '#f59e0b',
    'Hotel': '#8b5cf6'
  };
  var DEFAULT_COLOR = '#64748b';

  function colorFor(cat) { return CAT_COLORS[cat] || DEFAULT_COLOR; }

  // Build a recolored teardrop pin as an SVG data URI.
  function pinSvg(color) {
    var c = encodeURIComponent(color);
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 35'%3E%3Cpath fill='" + c + "' d='M26.83,13.92c0,10.12-12.92,20.4-12.92,20.4S1,24,1,13.92a12.92,12.92,0,1,1,25.83,0'/%3E%3Ccircle fill='%23fff' cx='13.91' cy='13.6' r='5'/%3E%3C/svg%3E";
  }
  var ANCHOR_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 34 42'%3E%3Cpath fill='%2368a73b' d='M17,1C9.27,1,3,7.27,3,15c0,9.7,14,26,14,26s14-16.3,14-26C31,7.27,24.73,1,17,1z'/%3E%3Cpath fill='%23fff' d='M11,21V14l6-4 6 4v7h-4v-5h-4v5z'/%3E%3C/svg%3E";

  // Read POIs from the hidden Collection List
  var POIS = [];
  (function() {
    var container = document.getElementById('qp-poi-data');
    if (!container) { console.error('QP Map: #qp-poi-data container not found.'); return; }
    container.querySelectorAll('[data-lat]').forEach(function(el) {
      var lat = parseFloat(el.getAttribute('data-lat'));
      var lng = parseFloat(el.getAttribute('data-lng'));
      if (isNaN(lat) || isNaN(lng)) return;
      var name = el.getAttribute('data-name') || '';
      if (name === PROPERTY.name) return; // don't pin the property itself as a POI
      POIS.push({
        name: name,
        category: (el.getAttribute('data-category') || 'Other').trim() || 'Other',
        lat: lat, lng: lng,
        address: el.getAttribute('data-address') || '',
        slug: (el.getAttribute('data-slug') || name).toLowerCase().replace(/[^a-z0-9]+/g, '-')
      });
    });
  })();

  // Distinct categories present, ordered by the palette then any extras
  var CATEGORIES = (function() {
    var present = {};
    POIS.forEach(function(p) { present[p.category] = true; });
    var ordered = Object.keys(CAT_COLORS).filter(function(c) { return present[c]; });
    Object.keys(present).forEach(function(c) { if (ordered.indexOf(c) === -1) ordered.push(c); });
    return ordered;
  })();

  var map, markers = [], activeFilter = 'all', activePopup = null;

  function escapeHtml(str) { var d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

  function buildControls() {
    // Filter buttons
    var bar = document.getElementById('qp-filter-bar');
    var html = '<button class="qp-filter-btn active" data-filter="all">All</button>';
    CATEGORIES.forEach(function(c) {
      html += '<button class="qp-filter-btn" data-filter="' + escapeHtml(c) + '">' + escapeHtml(c) + '</button>';
    });
    bar.innerHTML = html;
    // Color the active state per category via inline style on click (set in setupFilters)
    // Legend
    var legend = document.getElementById('qp-legend');
    legend.innerHTML = CATEGORIES.map(function(c) {
      return '<div class="qp-legend-item"><div class="qp-legend-dot" style="background:' + colorFor(c) + '"></div>' + escapeHtml(c) + '</div>';
    }).join('');
  }

  function initMap() {
    map = new mapboxgl.Map({
      container: 'qp-mapbox',
      style: 'mapbox://styles/mapbox/light-v11',
      center: [PROPERTY.lng, PROPERTY.lat],
      zoom: 12.2,
      attributionControl: false
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    // Markers and fit-bounds don't depend on tiles loading — add them immediately
    // so pins never hinge on the 'load' event firing.
    addAnchor();
    addMarkers();
    fitToPois();
  }

  function addAnchor() {
    var el = document.createElement('div');
    el.className = 'qp-anchor';
    el.style.backgroundImage = 'url("' + ANCHOR_SVG + '")';
    new mapboxgl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([PROPERTY.lng, PROPERTY.lat])
      .setPopup(new mapboxgl.Popup({ offset: [0, -34] }).setHTML(
        '<div class="qp-popup"><span class="qp-popup-type" style="background:#68a73b">Quantum Park</span><h4>' +
        escapeHtml(PROPERTY.name) + '</h4><p class="qp-popup-address">22001 Loudoun County Parkway, Ashburn, VA</p></div>'))
      .addTo(map);
  }

  function addMarkers() {
    POIS.forEach(function(poi) {
      var lngLat = [poi.lng, poi.lat];
      var el = document.createElement('div');
      el.className = 'qp-marker';
      el.setAttribute('data-category', poi.category);
      el.style.backgroundImage = 'url("' + pinSvg(colorFor(poi.category)) + '")';
      var marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat(lngLat).addTo(map);
      el.addEventListener('click', function(e) { e.stopPropagation(); openPopup(poi, lngLat); highlightSidebarItem(poi.slug); });
      markers.push({ marker: marker, el: el, poi: poi });
    });
  }

  function fitToPois() {
    if (!POIS.length) return;
    var b = new mapboxgl.LngLatBounds([PROPERTY.lng, PROPERTY.lat], [PROPERTY.lng, PROPERTY.lat]);
    POIS.forEach(function(p) { b.extend([p.lng, p.lat]); });
    map.fitBounds(b, { padding: 60, maxZoom: 14, duration: 0 });
  }

  function openPopup(poi, lngLat) {
    if (activePopup) activePopup.remove();
    var addr = poi.address ? '<p class="qp-popup-address">' + escapeHtml(poi.address) + '</p>' : '';
    var dir = 'https://www.google.com/maps/dir/?api=1&destination=' + poi.lat + ',' + poi.lng;
    var html = '<div class="qp-popup">' +
      '<span class="qp-popup-type" style="background:' + colorFor(poi.category) + '">' + escapeHtml(poi.category) + '</span>' +
      '<h4>' + escapeHtml(poi.name) + '</h4>' + addr +
      '<a href="' + dir + '" target="_blank" rel="noopener" class="qp-popup-link">Directions</a></div>';
    activePopup = new mapboxgl.Popup({ offset: [0, -28], maxWidth: '280px' }).setLngLat(lngLat).setHTML(html).addTo(map);
  }

  function buildSidebar() {
    var list = document.getElementById('qp-sidebar-list');
    var groups = {};
    CATEGORIES.forEach(function(c) { groups[c] = []; });
    POIS.forEach(function(p) { (groups[p.category] = groups[p.category] || []).push(p); });
    Object.keys(groups).forEach(function(k) { groups[k].sort(function(a, b) { return a.name.localeCompare(b.name); }); });
    var html = '';
    CATEGORIES.forEach(function(cat) {
      if (!groups[cat] || !groups[cat].length) return;
      html += '<p class="qp-sidebar-group-title">' + escapeHtml(cat) + ' (' + groups[cat].length + ')</p>';
      groups[cat].forEach(function(poi) {
        html += '<div class="qp-sidebar-item" data-slug="' + poi.slug + '" data-category="' + escapeHtml(poi.category) + '" data-name="' + escapeHtml(poi.name).toLowerCase() + '">' +
          '<span class="qp-sidebar-dot" style="background:' + colorFor(poi.category) + '"></span>' +
          '<span class="qp-sidebar-name">' + escapeHtml(poi.name) + '</span></div>';
      });
    });
    list.innerHTML = html;
    document.getElementById('qp-poi-count').textContent = POIS.length + ' nearby locations';
    list.querySelectorAll('.qp-sidebar-item').forEach(function(item) {
      item.addEventListener('click', function() {
        var slug = this.getAttribute('data-slug');
        var found = markers.find(function(m) { return m.poi.slug === slug; });
        if (found) {
          var ll = found.marker.getLngLat();
          map.flyTo({ center: ll, zoom: 15, duration: 800 });
          setTimeout(function() { openPopup(found.poi, [ll.lng, ll.lat]); }, 400);
          highlightSidebarItem(slug);
        }
      });
    });
  }

  function highlightSidebarItem(slug) {
    document.querySelectorAll('.qp-sidebar-item').forEach(function(el) {
      el.classList.toggle('active', el.getAttribute('data-slug') === slug);
    });
  }

  function refreshGroupTitles() {
    document.querySelectorAll('.qp-sidebar-group-title').forEach(function(title) {
      var next = title.nextElementSibling, hasVisible = false;
      while (next && !next.classList.contains('qp-sidebar-group-title')) {
        if (!next.classList.contains('filtered-out')) hasVisible = true;
        next = next.nextElementSibling;
      }
      title.style.display = hasVisible ? '' : 'none';
    });
  }

  function setupFilters() {
    document.querySelectorAll('.qp-filter-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var filter = this.getAttribute('data-filter');
        activeFilter = filter;
        document.querySelectorAll('.qp-filter-btn').forEach(function(b) {
          var on = b.getAttribute('data-filter') === filter;
          b.classList.toggle('active', on);
          b.style.background = on && filter !== 'all' ? colorFor(filter) : '';
          b.style.color = on && filter !== 'all' ? '#fff' : '';
        });
        markers.forEach(function(m) { m.el.classList.toggle('hidden', !(filter === 'all' || m.poi.category === filter)); });
        document.querySelectorAll('.qp-sidebar-item').forEach(function(item) {
          item.classList.toggle('filtered-out', !(filter === 'all' || item.getAttribute('data-category') === filter));
        });
        refreshGroupTitles();
        if (activePopup) { activePopup.remove(); activePopup = null; }
      });
    });
  }

  function setupSearch() {
    document.getElementById('qp-search').addEventListener('input', function() {
      var q = this.value.toLowerCase().trim();
      document.querySelectorAll('.qp-sidebar-item').forEach(function(item) {
        var name = item.getAttribute('data-name'), cat = item.getAttribute('data-category');
        var ms = !q || name.indexOf(q) !== -1, mf = (activeFilter === 'all' || cat === activeFilter);
        item.classList.toggle('filtered-out', !(ms && mf));
      });
      refreshGroupTitles();
      markers.forEach(function(m) {
        var nm = !q || m.poi.name.toLowerCase().indexOf(q) !== -1, tm = (activeFilter === 'all' || m.poi.category === activeFilter);
        m.el.classList.toggle('hidden', !(nm && tm));
      });
    });
  }

  buildControls();
  buildSidebar();
  setupFilters();
  setupSearch();
  initMap();
})();
