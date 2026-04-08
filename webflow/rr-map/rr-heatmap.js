// R&R Contracting - Service Area Heatmap
// Layers: 1) State highlighting 2) Job density heatmap 3) Metro labels
// NO project names, addresses, or clickable pins - heatmap only

(function() {
  mapboxgl.accessToken = "pk.eyJ1IjoibWJ1cmxpbnNvbiIsImEiOiI4bjdrV2lNIn0.CS5vqafA7WiXnOXc1P85CA";

  var isMobile = window.innerWidth < 768;

  var map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mburlinson/cl2i3y87n005f14pgk4is3gex",
    center: [-76.8, 39.0],
    zoom: isMobile ? 5.5 : 6.5,
    scrollZoom: false,
    attributionControl: false
  });

  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

  // Heatmap data points - weighted by job density
  // Coordinates only - no project names or addresses
  var heatPoints = [
    [-76.6122, 39.2904, 18],  // Baltimore metro
    [-76.6019, 39.4015, 4],   // Baltimore County
    [-77.1528, 39.0840, 1],   // Rockville
    [-76.9314, 39.2037, 1],   // Howard County
    [-76.5488, 38.9529, 5],   // Anne Arundel County
    [-76.8614, 38.9690, 2],   // Lanham
    [-76.8372, 39.2401, 1],   // Columbia
    [-77.0476, 39.3540, 1],   // Brookeville
    [-76.7319, 38.9429, 1],   // Bowie
    [-76.7446, 39.1063, 2],   // Fort Meade
    [-76.9633, 38.9231, 1],   // Mount Rainier
    [-77.1005, 38.9848, 1],   // Bethesda
    [-76.7135, 39.2127, 1],   // Elkridge
    [-76.5778, 39.2286, 1],   // Masonville
    [-77.0945, 39.0346, 1],   // North Bethesda/Strathmore
    [-77.0369, 38.9072, 12],  // Washington DC
    [-76.9988, 38.8759, 2],   // Navy Yard DC
    [-77.0585, 38.9322, 1],   // Cleveland Park DC
    [-77.0153, 38.9387, 1],   // Soldiers Home DC
    [-77.0231, 38.8983, 1],   // G Street DC
    [-77.0236, 38.8978, 1],   // F Street DC
    [-77.0469, 38.8048, 3],   // Alexandria VA
    [-77.1711, 38.8462, 1],   // Falls Church VA
    [-77.3064, 38.8462, 1],   // Fairfax County VA
    [-75.3785, 40.6259, 4],   // Bethlehem PA
    [-75.1327, 40.1932, 3],   // Horsham PA
    [-76.6009, 40.1532, 1],   // Elizabethtown PA
    [-75.2838, 40.2415, 1],   // Lansdale PA
    [-75.4902, 40.6084, 1],   // Allentown PA
    [-75.1812, 41.0032, 1],   // East Stroudsburg PA
    [-75.0086, 40.2132, 1],   // Richboro PA
    [-75.3557, 39.9606, 1],   // Chester PA
    [-76.0994, 39.8930, 1],   // Susquehanna PA
    [-75.5466, 39.6837, 2],   // New Castle DE
    [-75.1052, 39.9259, 1],   // Camden NJ
    [-74.1724, 40.7357, 1],   // Newark NJ
  ];

  // Metro label markers - service area anchors (no job data shown)
  var metroLabels = [
    { name: "Baltimore", coords: [-76.6122, 39.2904] },
    { name: "Washington, D.C.", coords: [-77.0369, 38.9072] },
    { name: "Annapolis", coords: [-76.4922, 38.9784] },
    { name: "Frederick", coords: [-77.4105, 39.4143] },
    { name: "Philadelphia", coords: [-75.1652, 39.9526] },
    { name: "Wilmington", coords: [-75.5398, 39.7391] }
  ];

  // Service area states
  var serviceStates = ["Maryland", "Virginia", "Pennsylvania", "Delaware", "New Jersey", "District of Columbia"];

  map.on("load", function() {

    // --- LAYER 1: State Highlighting ---
    map.addSource("states", {
      type: "geojson",
      data: "https://docs.mapbox.com/mapbox-gl-js/assets/us_states.geojson"
    });

    map.addLayer({
      id: "state-fills",
      type: "fill",
      source: "states",
      paint: {
        "fill-color": "#d12327",
        "fill-opacity": 0.08
      },
      filter: ["in", "STATE_NAME"].concat(serviceStates)
    });

    map.addLayer({
      id: "state-borders",
      type: "line",
      source: "states",
      paint: {
        "line-color": "#d12327",
        "line-width": 1.5,
        "line-opacity": 0.4
      },
      filter: ["in", "STATE_NAME"].concat(serviceStates)
    });

    // --- LAYER 2: Job Density Heatmap ---
    var geojsonPoints = {
      type: "FeatureCollection",
      features: heatPoints.map(function(p) {
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [p[0], p[1]] },
          properties: { weight: p[2] }
        };
      })
    };

    map.addSource("job-heat", {
      type: "geojson",
      data: geojsonPoints
    });

    map.addLayer({
      id: "job-heatmap",
      type: "heatmap",
      source: "job-heat",
      paint: {
        // Weight by job count
        "heatmap-weight": [
          "interpolate", ["linear"], ["get", "weight"],
          1, 0.5,
          5, 0.8,
          10, 0.95,
          18, 1
        ],
        // Intensity increases with zoom
        "heatmap-intensity": [
          "interpolate", ["linear"], ["zoom"],
          5, 1.0,
          9, 1.8
        ],
        // Color ramp: transparent → brand red
        "heatmap-color": [
          "interpolate", ["linear"], ["heatmap-density"],
          0, "rgba(0,0,0,0)",
          0.1, "rgba(209,35,39,0.12)",
          0.3, "rgba(209,35,39,0.30)",
          0.5, "rgba(209,35,39,0.50)",
          0.7, "rgba(209,35,39,0.70)",
          0.9, "rgba(209,35,39,0.85)",
          1, "rgba(209,35,39,0.95)"
        ],
        // Radius in pixels
        "heatmap-radius": [
          "interpolate", ["linear"], ["zoom"],
          5, 30,
          7, 50,
          9, 65
        ],
        // Fade out at high zoom
        "heatmap-opacity": [
          "interpolate", ["linear"], ["zoom"],
          7, 0.95,
          10, 0.7
        ]
      }
    });

    // --- LAYER 3: Metro Labels ---
    metroLabels.forEach(function(metro) {
      var el = document.createElement("div");
      el.className = "rr-metro-label";
      el.innerHTML = '<span class="rr-metro-dot"></span>' + metro.name;

      new mapboxgl.Marker({ element: el, anchor: "left" })
        .setLngLat(metro.coords)
        .addTo(map);
    });
  });
})();
