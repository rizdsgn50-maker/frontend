/* ============================================
   TOURING MAPS APP - MAIN JAVASCRIPT
   Aplikasi Peta Hybrid untuk Komunitas Touring/Mendaki Privat (Invite-Only)
   ============================================ */

/* ============================================
   SECTION 1: GLOBAL CONFIG & CONSTANTS
   ============================================ */

// Mapbox Access Token - GANTI DENGAN TOKEN ANDA
const MAPBOX_TOKEN = 'pk.eyJhIjoicmlzZHNnbjUwIiwiYSI6ImNtMjR6bnZkaTAycjAycHBkajkyZXdhMmoifQ.dY_Z0a7mJFnc4vWVkw4wQQ';

// Kode akses grup default untuk testing
const DEFAULT_GROUP_CODES = ['TOURING123', 'MENDAKI456'];

// Koordinat pusat regional (Jawa-Bali)
const REGION_CENTER = {
    lat: -6.8962,
    lng: 109.2675
};

// Batas region (Jawa Barat - Jawa Timur - Bali)
const REGION_BOUNDS = [
    [104.5, -8.5],  // Southwest
    [115.5, -5.0]   // Northeast
];

// Zoom levels
const ZOOM_LEVELS = {
    REGIONAL: 7,
    CITY: 12,
    STREET: 15
};

// Proximity trigger distance (dalam meter)
const PROXIMITY_THRESHOLD = 500;

/* ============================================
   SECTION 2: DATA SIMULASI - SPBU LOCATIONS
   ============================================ */

const SPBU_LOCATIONS = [
    {
        id: 1,
        name: 'SPBU Cirebon',
        lat: -6.7044,
        lng: 108.4686,
        address: 'Jl. Siliwangi, Cirebon'
    },
    {
        id: 2,
        name: 'SPBU Bandung Utara',
        lat: -6.8500,
        lng: 107.6136,
        address: 'Jl. Pasteur, Bandung'
    },
    {
        id: 3,
        name: 'SPBU Yogyakarta',
        lat: -7.7956,
        lng: 110.3695,
        address: 'Jl. Malioboro, Yogyakarta'
    },
    {
        id: 4,
        name: 'SPBU Surabaya Timur',
        lat: -7.2575,
        lng: 112.7521,
        address: 'Jl. Ahmad Yani, Surabaya'
    },
    {
        id: 5,
        name: 'SPBU Ubud Bali',
        lat: -8.5069,
        lng: 110.3085,
        address: 'Jl. Raya Ubud, Bali'
    }
];

/* ============================================
   SECTION 3: DUMMY FACILITIES (ANIMASI PROXIMITY)
   ============================================ */

const FACILITIES = [
    {
        id: 'hospital-bandung',
        type: 'hospital',
        name: 'Rumah Sakit Hasan Sadikin',
        lat: -6.8957,
        lng: 107.6069
    },
    {
        id: 'airport-yogya',
        type: 'airport',
        name: 'Bandara Yogyakarta International',
        lat: -7.9750,
        lng: 110.4547
    },
    {
        id: 'station-surabaya',
        type: 'station',
        name: 'Stasiun Surabaya Gubeng',
        lat: -7.2530,
        lng: 112.7611
    },
    {
        id: 'hospital-bali',
        type: 'hospital',
        name: 'RSUP Sanglah Denpasar',
        lat: -8.6705,
        lng: 115.2126
    }
];

/* ============================================
   SECTION 4: STATE MANAGEMENT
   ============================================ */

const APP_STATE = {
    // User Authentication
    isAuthenticated: false,
    currentUser: null,
    groupCode: null,
    
    // Geolocation
    userLocation: null,
    userSpeed: 0,
    userHeading: 0,
    
    // Map & Layers
    map: null,
    currentStyle: 'dark-v11',
    is3DEnabled: true,
    
    // Markers & Sources
    userMarker: null,
    spbuMarkers: [],
    proximityAnimations: {},
    
    // Direction & Navigation
    directions: null,
    currentRoute: null,
    
    // Real-time Socket
    socket: null,
    circleMembers: {},
    
    // Geolocation Watch ID
    geolocationWatchId: null,
    
    // Offline Mode
    isOfflineMode: false
};

/* ============================================
   SECTION 5: UTILITY FUNCTIONS
   ============================================ */

/**
 * Haversine Formula - Hitung jarak antara 2 koordinat (dalam km)
 * @param {number} lat1 - Latitude user
 * @param {number} lon1 - Longitude user
 * @param {number} lat2 - Latitude target
 * @param {number} lon2 - Longitude target
 * @returns {number} Jarak dalam kilometer
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius bumi dalam km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Jarak dalam km
    
    return distance;
}

/**
 * Format jarak untuk display (km atau meter)
 * @param {number} distanceKm - Jarak dalam km
 * @returns {string} String format jarak
 */
function formatDistance(distanceKm) {
    if (distanceKm < 1) {
        return Math.round(distanceKm * 1000) + ' m';
    }
    return distanceKm.toFixed(1) + ' km';
}

/**
 * Tampilkan/sembunyikan elemen dengan class
 * @param {string} elementId - ID elemen
 * @param {boolean} show - True untuk tampil, false untuk sembunyikan
 */
function toggleElement(elementId, show) {
    const element = document.getElementById(elementId);
    if (element) {
        if (show) {
            element.classList.remove('hidden');
        } else {
            element.classList.add('hidden');
        }
    }
}

/**
 * Delay promise untuk setTimeout
 * @param {number} ms - Milliseconds
 * @returns {Promise}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/* ============================================
   SECTION 6: LOGIN AUTHENTICATION
   ============================================ */

/**
 * Initialize login form handler
 */
function initializeLogin() {
    const loginForm = document.getElementById('loginForm');
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const groupCode = document.getElementById('groupCode').value.toUpperCase();
        const userName = document.getElementById('userName').value.trim();
        
        // Validasi kode akses (dummy validation)
        if (!DEFAULT_GROUP_CODES.includes(groupCode)) {
            alert('❌ Kode akses salah! Hubungi admin grup Anda.');
            return;
        }
        
        if (userName.length < 3) {
            alert('❌ Nama minimal 3 karakter!');
            return;
        }
        
        // Set authentication
        APP_STATE.isAuthenticated = true;
        APP_STATE.currentUser = userName;
        APP_STATE.groupCode = groupCode;
        
        // Simpan ke localStorage
        localStorage.setItem('user_name', userName);
        localStorage.setItem('group_code', groupCode);
        
        // Tampilkan loading
        toggleElement('loadingSpinner', false);
        
        // Sembunyikan login modal
        const loginModal = document.getElementById('loginModal');
        loginModal.classList.add('hidden');
        
        // Tampilkan map container
        const mapContainer = document.getElementById('mapContainer');
        mapContainer.classList.remove('hidden');
        
        // Initialize aplikasi
        await initializeMap();
        initializeGeolocation();
        initializeEventListeners();
        initializeBottomSheet();
        initializeSocketIO();
        
        console.log(`✅ User "${userName}" login berhasil ke grup "${groupCode}"`);
    });
    
    // Check localStorage untuk auto-login (optional)
    const savedUser = localStorage.getItem('user_name');
    const savedCode = localStorage.getItem('group_code');
    
    if (savedUser && savedCode) {
        document.getElementById('userName').value = savedUser;
        document.getElementById('groupCode').value = savedCode;
    }
}

/* ============================================
   SECTION 7: MAPBOX INITIALIZATION
   ============================================ */

/**
 * Initialize Mapbox GL JS dengan konfigurasi
 */
async function initializeMap() {
    // Set Mapbox token
    mapboxgl.accessToken = MAPBOX_TOKEN;
    
    // Create map instance
    APP_STATE.map = new mapboxgl.Map({
        container: 'map',
        style: `mapbox://styles/mapbox/${APP_STATE.currentStyle}`,
        center: [REGION_CENTER.lng, REGION_CENTER.lat],
        zoom: ZOOM_LEVELS.REGIONAL,
        bearing: 0,
        pitch: 30,  // Pitch 3D default
        maxBounds: REGION_BOUNDS,
        maxZoom: 18,
        minZoom: 5
    });
    
    // Wait untuk map loaded
    return new Promise((resolve) => {
        APP_STATE.map.on('load', () => {
            console.log('✅ Mapbox GL JS loaded successfully');
            
            // Enable 3D Extrusion untuk buildings
            enable3DBuildingExtrusion();
            
            // Enable 3D Terrain
            enable3DTerrain();
            
            // Add geocoder untuk search
            addGeocoderControl();
            
            // Add directions control
            addDirectionsControl();
            
            // Hide loading spinner
            toggleElement('loadingSpinner', true);
            
            resolve();
        });
    });
}

/**
 * Enable 3D Building Extrusion
 * Menampilkan bangunan dengan efek 3D extruded di area urban
 */
function enable3DBuildingExtrusion() {
    // Query untuk layers yang ada
    const layers = APP_STATE.map.getStyle().layers;
    const buildingLayerId = layers.find(layer => layer['source-layer'] === 'building')?.id;
    
    if (buildingLayerId) {
        console.log('🏢 3D Building extrusion already enabled');
        return;
    }
    
    // Jika belum ada, add building layer dengan 3D extrusion
    APP_STATE.map.addLayer(
        {
            id: 'building-3d',
            source: 'composite',
            'source-layer': 'building',
            type: 'fill-extrusion',
            paint: {
                'fill-extrusion-color': '#888',
                'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'height']],
                'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'min_height']],
                'fill-extrusion-opacity': 0.6
            }
        },
        'waterway-label'
    );
    
    console.log('🏢 3D Building extrusion enabled');
}

/**
 * Enable 3D Terrain (Topografi/Kontur bumi)
 * Menampilkan relief tanah untuk area pegunungan
 */
function enable3DTerrain() {
    // Add terrain source dari Mapbox Terrain Tileset
    APP_STATE.map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-v2',
        tileSize: 512,
        maxZoom: 14
    });
    
    // Set terrain
    APP_STATE.map.setTerrain({
        source: 'mapbox-dem',
        exaggeration: 1.5  // Tingkat exaggeration untuk lebih dramatis
    });
    
    console.log('🏔️ 3D Terrain enabled with exaggeration');
}

/**
 * Add Mapbox GL Geocoder control untuk pencarian alamat
 */
function addGeocoderControl() {
    const geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl: mapboxgl,
        countries: ['ID'],  // Filter hanya Indonesia
        proximity: [REGION_CENTER.lng, REGION_CENTER.lat],
        bbox: REGION_BOUNDS,
        placeholder: 'Cari alamat atau lokasi...',
        limit: 5
    });
    
    // Inject ke container khusus
    const geocoderContainer = document.getElementById('geocoder');
    geocoderContainer.appendChild(geocoder.onAdd(APP_STATE.map));
    
    // Listen untuk result selection
    geocoder.on('result', (event) => {
        console.log('🔍 Geocoder result:', event.result);
        // Result otomatis pan ke lokasi
    });
    
    console.log('🔍 Geocoder control added');
}

/**
 * Add Mapbox GL Directions control
 * Untuk routing dan navigasi dari user ke destination
 */
function addDirectionsControl() {
    // Directions plugin
    const directions = new MapboxDirections({
        accessToken: mapboxgl.accessToken,
        profile: 'mapbox/driving',  // Profil driving (bis/mobil)
        interactive: true,
        controls: {
            inputs: true,
            instructions: true,
            profile: false  // Sembunyikan profile selector
        },
        alternatives: true,
        geometries: 'geojson'
    });
    
    // Container untuk directions panel
    const directionsPanel = document.getElementById('directionsPanel');
    
    // Listen untuk route updates
    directions.on('route', (event) => {
        const routes = event.route;
        if (routes.length > 0) {
            const route = routes[0];
            console.log('🛣️ Route calculated:', {
                distance: (route.distance / 1000).toFixed(1) + ' km',
                duration: (route.duration / 60).toFixed(0) + ' menit'
            });
            APP_STATE.currentRoute = route;
        }
    });
    
    // Store untuk later use
    APP_STATE.directions = directions;
    
    console.log('🛣️ Directions control ready');
}

/* ============================================
   SECTION 8: GEOLOCATION & GPS TRACKING
   ============================================ */

/**
 * Initialize Geolocation API
 * Melacak posisi user secara real-time dengan watchPosition
 */
function initializeGeolocation() {
    // Check browser support
    if (!navigator.geolocation) {
        alert('⚠️ Geolocation tidak didukung oleh browser Anda');
        return;
    }
    
    const geoOptions = {
        enableHighAccuracy: true,  // Gunakan GPS akurat
        timeout: 10000,             // Timeout 10 detik
        maximumAge: 0               // Tidak cache lokasi
    };
    
    /**
     * Success callback - dipanggil setiap ada update lokasi
     */
    function onGeoSuccess(position) {
        const coords = position.coords;
        
        // Update app state
        APP_STATE.userLocation = {
            lat: coords.latitude,
            lng: coords.longitude,
            accuracy: coords.accuracy,
            altitude: coords.altitude,
            heading: coords.heading || 0
        };
        
        APP_STATE.userSpeed = coords.speed ? coords.speed * 3.6 : 0;  // Convert m/s ke km/h
        
        // Update UI speed display
        updateSpeedometerDisplay();
        
        // Update SPBU HUD otomatis
        updateSPBUHUD();
        
        // Check proximity triggers
        checkProximityTriggers();
        
        // Update user marker on map
        updateUserMarker();
        
        // Pan map ke user location
        if (APP_STATE.map) {
            APP_STATE.map.flyTo({
                center: [coords.longitude, coords.latitude],
                bearing: coords.heading || 0,
                pitch: 30,
                duration: 500,
                essential: true
            });
        }
    }
    
    /**
     * Error callback
     */
    function onGeoError(error) {
        console.error('❌ Geolocation error:', error.message);
        
        // Fallback ke dummy location
        if (error.code === error.PERMISSION_DENIED) {
            alert('⚠️ Izin geolocation ditolak. Aktifkan GPS untuk fitur real-time.');
        } else if (error.code === error.TIMEOUT) {
            console.warn('⏱️ GPS timeout, mencoba kembali...');
        }
    }
    
    // Start watching position
    APP_STATE.geolocationWatchId = navigator.geolocation.watchPosition(
        onGeoSuccess,
        onGeoError,
        geoOptions
    );
    
    console.log('📍 Geolocation watch started');
}

/**
 * Update user marker on map
 * Tampilkan dan animate marker lokasi user
 */
function updateUserMarker() {
    if (!APP_STATE.map || !APP_STATE.userLocation) return;
    
    const { lat, lng, heading } = APP_STATE.userLocation;
    
    // Create user marker jika belum ada
    if (!APP_STATE.userMarker) {
        const el = document.createElement('div');
        el.className = 'user-marker';
        el.innerHTML = '📍';
        el.style.fontSize = '24px';
        el.style.cursor = 'pointer';
        
        APP_STATE.userMarker = new mapboxgl.Marker(el, {
            rotationAlignment: 'map',
            pitchAlignment: 'viewport'
        })
            .setLngLat([lng, lat])
            .addTo(APP_STATE.map);
    } else {
        // Update existing marker
        APP_STATE.userMarker.setLngLat([lng, lat]);
    }
}

/* ============================================
   SECTION 9: SPBU HUD - REAL-TIME UPDATE
   ============================================ */

/**
 * Update SPBU HUD Card dengan SPBU terdekat
 * Gunakan Haversine formula untuk hitung jarak real-time
 */
function updateSPBUHUD() {
    if (!APP_STATE.userLocation) return;
    
    const { lat: userLat, lng: userLng } = APP_STATE.userLocation;
    
    // Hitung jarak ke semua SPBU
    let nearestSPBU = null;
    let minDistance = Infinity;
    
    SPBU_LOCATIONS.forEach(spbu => {
        const distance = calculateDistance(userLat, userLng, spbu.lat, spbu.lng);
        
        if (distance < minDistance) {
            minDistance = distance;
            nearestSPBU = { ...spbu, distance };
        }
    });
    
    // Update HUD UI
    if (nearestSPBU) {
        document.getElementById('spbuName').textContent = nearestSPBU.name;
        document.getElementById('spbuDistance').textContent = formatDistance(nearestSPBU.distance);
        document.getElementById('spbuStatus').textContent = nearestSPBU.address;
    }
}

/* ============================================
   SECTION 10: PROXIMITY TRIGGER ANIMATIONS
   ============================================ */

/**
 * Check proximity triggers
 * Jika user dekat fasilitas, trigger animasi khusus
 */
function checkProximityTriggers() {
    if (!APP_STATE.userLocation || !APP_STATE.map) return;
    
    const { lat: userLat, lng: userLng } = APP_STATE.userLocation;
    const thresholdKm = PROXIMITY_THRESHOLD / 1000;  // Convert meter ke km
    
    FACILITIES.forEach(facility => {
        const distance = calculateDistance(userLat, userLng, facility.lat, facility.lng);
        const isNear = distance < thresholdKm;
        const animationId = `anim-${facility.id}`;
        
        if (isNear && !APP_STATE.proximityAnimations[facility.id]) {
            // Trigger animasi jika belum di-trigger
            triggerFacilityAnimation(facility);
            APP_STATE.proximityAnimations[facility.id] = true;
        } else if (!isNear && APP_STATE.proximityAnimations[facility.id]) {
            // Sembunyikan animasi jika sudah jauh
            hideFacilityAnimation(facility);
            delete APP_STATE.proximityAnimations[facility.id];
        }
    });
}

/**
 * Trigger animasi khusus berdasarkan tipe fasilitas
 * @param {object} facility - Fasilitas data
 */
function triggerFacilityAnimation(facility) {
    if (!APP_STATE.map) return;
    
    const { type, lat, lng, name } = facility;
    const animationId = `source-${facility.id}`;
    const animationLayerId = `layer-${facility.id}`;
    
    console.log(`🎬 Trigger animation untuk ${type}: ${name}`);
    
    try {
        // Add source jika belum ada
        if (!APP_STATE.map.getSource(animationId)) {
            APP_STATE.map.addSource(animationId, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    },
                    properties: { type }
                }
            });
        }
        
        // Add layer dengan animasi berdasarkan tipe
        if (!APP_STATE.map.getLayer(animationLayerId)) {
            switch (type) {
                case 'hospital':
                    addHospitalAnimation(animationId, animationLayerId);
                    break;
                case 'airport':
                    addAirplaneAnimation(animationId, animationLayerId);
                    break;
                case 'station':
                    addTrainAnimation(animationId, animationLayerId);
                    break;
                default:
                    break;
            }
        }
    } catch (error) {
        console.warn('⚠️ Error triggering animation:', error);
    }
}

/**
 * Hospital animation - Sirine berkedip merah-biru
 */
function addHospitalAnimation(sourceId, layerId) {
    APP_STATE.map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
            'circle-radius': [
                'interpolate',
                ['linear'],
                ['get', 'animation-progress'],
                0, 15,
                1, 25
            ],
            'circle-color': [
                'step',
                ['get', 'animation-progress'],
                '#ff3333',  // Merah
                0.5, '#0099ff'  // Biru
            ],
            'circle-opacity': [
                'interpolate',
                ['linear'],
                ['get', 'animation-progress'],
                0, 1,
                1, 0.3
            ]
        }
    });
    
    // Animate dengan canvas/requestAnimationFrame
    animateCircle(sourceId);
}

/**
 * Airplane animation - Icon pesawat melintas
 */
function addAirplaneAnimation(sourceId, layerId) {
    // Load airplane image sebagai symbol
    const airplaneImage = '✈️';
    
    APP_STATE.map.addLayer({
        id: layerId,
        type: 'symbol',
        source: sourceId,
        layout: {
            'icon-image': 'airplane',
            'icon-size': 1.5,
            'icon-rotate': ['get', 'heading'],
            'icon-allow-overlap': true
        }
    });
    
    // Animate pesawat melingkar
    animateAirplane(sourceId);
}

/**
 * Train animation - Icon kereta melintas
 */
function addTrainAnimation(sourceId, layerId) {
    APP_STATE.map.addLayer({
        id: layerId,
        type: 'symbol',
        source: sourceId,
        layout: {
            'text-field': '🚂',
            'text-size': 24,
            'text-rotate': 0,
            'text-allow-overlap': true
        }
    });
    
    // Animate kereta bolak-balik
    animateTrain(sourceId);
}

/**
 * Animate circle (for hospital sirine)
 * Pulse effect dengan requestAnimationFrame
 */
function animateCircle(sourceId) {
    let progress = 0;
    let direction = 1;
    
    function updateAnimation() {
        progress += direction * 0.02;
        
        if (progress >= 1) direction = -1;
        if (progress <= 0) direction = 1;
        
        // Update feature properties
        const source = APP_STATE.map.getSource(sourceId);
        if (source && source.setData) {
            const data = source._data;
            data.properties['animation-progress'] = progress;
            source.setData(data);
        }
        
        requestAnimationFrame(updateAnimation);
    }
    
    updateAnimation();
}

/**
 * Animate airplane (circular orbit)
 */
function animateAirplane(sourceId) {
    const source = APP_STATE.map.getSource(sourceId);
    if (!source) return;
    
    const originalData = source._data;
    const centerLat = originalData.geometry.coordinates[1];
    const centerLng = originalData.geometry.coordinates[0];
    const radius = 0.05;  // Approximate degree radius
    
    let angle = 0;
    
    function updateAirplane() {
        angle += 2;  // Rotate speed
        
        const rad = angle * Math.PI / 180;
        const newLng = centerLng + radius * Math.cos(rad);
        const newLat = centerLat + radius * Math.sin(rad);
        
        const updatedData = {
            ...originalData,
            geometry: {
                type: 'Point',
                coordinates: [newLng, newLat]
            },
            properties: {
                ...originalData.properties,
                heading: angle
            }
        };
        
        source.setData(updatedData);
        
        if (APP_STATE.proximityAnimations[sourceId.split('-')[1]]) {
            requestAnimationFrame(updateAirplane);
        }
    }
    
    updateAirplane();
}

/**
 * Animate train (bolak-balik)
 */
function animateTrain(sourceId) {
    const source = APP_STATE.map.getSource(sourceId);
    if (!source) return;
    
    const originalData = source._data;
    const baseLng = originalData.geometry.coordinates[0];
    const baseLat = originalData.geometry.coordinates[1];
    const range = 0.02;
    
    let position = 0;
    let direction = 1;
    
    function updateTrain() {
        position += direction * 0.01;
        
        if (position >= range) direction = -1;
        if (position <= -range) direction = 1;
        
        const updatedData = {
            ...originalData,
            geometry: {
                type: 'Point',
                coordinates: [baseLng + position, baseLat]
            }
        };
        
        source.setData(updatedData);
        
        if (APP_STATE.proximityAnimations[sourceId.split('-')[1]]) {
            requestAnimationFrame(updateTrain);
        }
    }
    
    updateTrain();
}

/**
 * Hide facility animation
 */
function hideFacilityAnimation(facility) {
    const layerId = `layer-${facility.id}`;
    const sourceId = `source-${facility.id}`;
    
    try {
        if (APP_STATE.map.getLayer(layerId)) {
            APP_STATE.map.removeLayer(layerId);
        }
        if (APP_STATE.map.getSource(sourceId)) {
            APP_STATE.map.removeSource(sourceId);
        }
    } catch (error) {
        console.warn('⚠️ Error hiding animation:', error);
    }
}

/* ============================================
   SECTION 11: SPEEDOMETER DISPLAY
   ============================================ */

/**
 * Update speedometer display di bottom sheet
 */
function updateSpeedometerDisplay() {
    const speed = APP_STATE.userSpeed || 0;
    
    // Update speed number
    document.getElementById('speedValue').textContent = Math.round(speed);
    
    // Update speed bar fill (max 120 km/h)
    const maxSpeed = 120;
    const fillPercentage = Math.min((speed / maxSpeed) * 100, 100);
    document.getElementById('speedBar').style.width = fillPercentage + '%';
    
    // Change color berdasarkan speed
    const speedBar = document.getElementById('speedBar');
    if (speed < 30) {
        speedBar.style.background = 'linear-gradient(90deg, #4ecdc4, #00f2fe)';
    } else if (speed < 60) {
        speedBar.style.background = 'linear-gradient(90deg, #f5af19, #f5af19)';
    } else {
        speedBar.style.background = 'linear-gradient(90deg, #ff6b6b, #ff3333)';
    }
}

/* ============================================
   SECTION 12: BOTTOM SHEET INTERACTION
   ============================================ */

/**
 * Initialize bottom sheet swipe interaction
 */
function initializeBottomSheet() {
    const bottomSheet = document.getElementById('bottomSheet');
    const handle = document.querySelector('.bottom-sheet-handle');
    
    let startY = 0;
    let currentY = 0;
    let isSwipeActive = false;
    
    // Touch start
    handle.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        isSwipeActive = true;
        bottomSheet.style.transition = 'none';
    });
    
    // Touch move
    handle.addEventListener('touchmove', (e) => {
        if (!isSwipeActive) return;
        
        currentY = e.touches[0].clientY - startY;
        const maxHeight = window.innerHeight * 0.5;  // Max 50% screen
        
        // Limit drag
        if (currentY > 0) {
            bottomSheet.style.transform = `translateY(${Math.min(currentY, maxHeight)}px)`;
        }
    });
    
    // Touch end
    handle.addEventListener('touchend', () => {
        bottomSheet.style.transition = 'all var(--transition-normal)';
        
        if (currentY > 50) {
            // Snap down
            bottomSheet.style.transform = 'translateY(250px)';
        } else {
            // Snap up
            bottomSheet.style.transform = 'translateY(0)';
        }
        
        isSwipeActive = false;
    });
}

/* ============================================
   SECTION 13: EVENT LISTENERS (FAB BUTTONS)
   ============================================ */

/**
 * Initialize semua event listeners untuk tombol UI
 */
function initializeEventListeners() {
    // Compass Button - Reset orientation
    document.getElementById('compassBtn').addEventListener('click', () => {
        if (!APP_STATE.map) return;
        
        APP_STATE.map.flyTo({
            bearing: 0,
            pitch: 30,
            duration: 600
        });
        
        console.log('🧭 Reset compass to 0°');
    });
    
    // Layer Switcher Button - Toggle 3D City / 3D Terrain
    document.getElementById('layerBtn').addEventListener('click', () => {
        if (!APP_STATE.map) return;
        
        APP_STATE.is3DEnabled = !APP_STATE.is3DEnabled;
        
        if (APP_STATE.is3DEnabled) {
            // Enable 3D dengan pitch tinggi
            APP_STATE.map.flyTo({
                pitch: 60,
                duration: 600
            });
            console.log('🎨 3D Layer enabled (pitch 60°)');
        } else {
            // Disable 3D dengan pitch 0
            APP_STATE.map.flyTo({
                pitch: 0,
                duration: 600
            });
            console.log('🎨 3D Layer disabled (pitch 0°)');
        }
    });
    
    // Locate Button - Find me / Re-center
    document.getElementById('locateBtn').addEventListener('click', () => {
        if (!APP_STATE.map || !APP_STATE.userLocation) return;
        
        const { lat, lng, heading } = APP_STATE.userLocation;
        
        APP_STATE.map.flyTo({
            center: [lng, lat],
            bearing: heading || 0,
            pitch: 30,
            zoom: ZOOM_LEVELS.STREET,
            duration: 800
        });
        
        console.log('📍 Re-centered to user location');
    });
}

/* ============================================
   SECTION 14: SOCKET.IO INTEGRATION (PLACEHOLDER)
   ============================================ */

/**
 * Initialize Socket.IO untuk real-time share location
 * Placeholder untuk integrasi backend Node.js
 */
function initializeSocketIO() {
    // TODO: Ganti dengan URL backend Anda
    const BACKEND_URL = 'http://localhost:3000';
    
    /**
     * KOMENTAR PLACEHOLDER UNTUK IMPLEMENTASI SOCKET.IO
     * 
     * 1. Connect ke Socket.IO server
     *    APP_STATE.socket = io(BACKEND_URL, {
     *        auth: {
     *            token: 'jwt_token_dari_server',
     *            groupCode: APP_STATE.groupCode,
     *            userName: APP_STATE.currentUser
     *        }
     *    });
     * 
     * 2. Emit lokasi user ke server setiap N detik
     *    setInterval(() => {
     *        if (APP_STATE.userLocation && APP_STATE.socket) {
     *            APP_STATE.socket.emit('location:update', {
     *                lat: APP_STATE.userLocation.lat,
     *                lng: APP_STATE.userLocation.lng,
     *                speed: APP_STATE.userSpeed,
     *                heading: APP_STATE.userLocation.heading,
     *                timestamp: Date.now()
     *            });
     *        }
     *    }, 5000);  // Update setiap 5 detik
     * 
     * 3. Listen untuk lokasi anggota lain
     *    APP_STATE.socket.on('members:update', (members) => {
     *        updateCircleMembers(members);
     *    });
     * 
     * 4. Real-time marker avatar untuk teman
     *    Render marker dengan avatar berdasarkan data yang diterima
     *    Update position dengan smooth animation
     * 
     * 5. Disconnect handling
     *    APP_STATE.socket.on('disconnect', () => {
     *        console.warn('⚠️ Disconnected from server');
     *        APP_STATE.isOfflineMode = true;
     *    });
     */
    
    console.log('📡 Socket.IO placeholder initialized (ready untuk backend integration)');
}

/**
 * Update circle members list di bottom sheet
 * Fungsi placeholder untuk real-time members
 */
function updateCircleMembers(members) {
    const membersList = document.getElementById('membersList');
    membersList.innerHTML = '';  // Clear existing
    
    members.forEach(member => {
        const memberEl = document.createElement('div');
        memberEl.className = 'member-item';
        memberEl.innerHTML = `
            <div class="member-avatar" style="background: ${member.color || '#666'}">
                ${member.avatar || '👤'}
            </div>
            <div class="member-info">
                <div class="member-name">${member.name}</div>
                <div class="member-status ${member.isOnline ? 'online' : ''}">
                    ${member.isOnline ? '🟢 Online' : '⚪ Offline'} • ${member.distance || '--'} km
                </div>
            </div>
        `;
        membersList.appendChild(memberEl);
    });
}

/* ============================================
   SECTION 15: OFFLINE MODE (PLACEHOLDER)
   ============================================ */

/**
 * OFFLINE MODE - KOMENTAR PLACEHOLDER
 * 
 * Implementasi untuk offline functionality:
 * 
 * 1. Cache Map Tiles (Mapbox Offline Manager)
 *    - Download area tertentu untuk offline access
 *    - Use Mapbox Offline Manager SDK
 *    - Store tiles di localStorage / IndexedDB
 * 
 * 2. GPS continues working
 *    - navigator.geolocation tetap berfungsi tanpa internet
 *    - Update UI dengan posisi lokal
 * 
 * 3. Static Route Files
 *    - Load .gpx atau .geojson files sebagai panduan emergency
 *    - Parse dan render di peta
 *    - Provide offline navigation dengan stored tiles
 * 
 * 4. Fallback UI
 *    - Tampilkan "OFFLINE MODE" indicator
 *    - Disable features yang membutuhkan internet
 *    - Keep GPS tracking & local route active
 */

/**
 * Check internet connectivity
 * @returns {Promise<boolean>}
 */
async function checkInternetConnection() {
    try {
        const response = await fetch('https://api.mapbox.com/style/static/mapbox/streets-v12,attribution=false/0,0,1/400x300@2x', {
            method: 'HEAD',
            mode: 'no-cors'
        });
        return true;
    } catch (error) {
        return false;
    }
}

/* ============================================
   SECTION 16: APP INITIALIZATION
   ============================================ */

/**
 * Main app initialization
 */
function initializeApp() {
    console.log('🚀 Touring Maps App v1.0 initializing...');
    
    // Check online status
    window.addEventListener('online', () => {
        console.log('✅ Connection restored');
        APP_STATE.isOfflineMode = false;
    });
    
    window.addEventListener('offline', () => {
        console.warn('⚠️ Connection lost - switching to offline mode');
        APP_STATE.isOfflineMode = true;
    });
    
    // Initialize login
    initializeLogin();
    
    // Hide loading spinner initially
    toggleElement('loadingSpinner', true);
}

// Start app ketika DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
