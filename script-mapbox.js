/**
 * DESEO - Plataforma de Micro-Deseos con Mapbox
 * Aplicación web interactiva para conectar personas con deseos y servicios
 * 
 * Funcionalidades principales:
 * - Mapa real de Mapbox con geolocalización
 * - Chat con IA para crear deseos
 * - Sistema de chat privado entre usuarios
 * - Calificación y comentarios
 * - Filtros y búsqueda
 */

// ===== FUNCIONES DE AUTENTICACIÓN (GLOBALES) =====

// Función para mostrar el modal de autenticación
function showAuthModal() {
    const authModal = document.getElementById('authModal');
    if (authModal) {
        authModal.style.display = 'flex';
    }
}

// Función para cerrar el modal de autenticación
function closeAuthModal() {
    const authModal = document.getElementById('authModal');
    if (authModal) {
        authModal.style.display = 'none';
    }
}

// Función para cambiar entre tabs de login/registro
function switchAuthTab(tab) {
    document.querySelectorAll('.auth-form').forEach(form => {
        form.style.display = 'none';
    });
    document.querySelectorAll('.auth-tab').forEach(t => {
        t.classList.remove('active');
    });

    if (tab === 'login') {
        const loginForm = document.getElementById('loginForm');
        const loginTab = document.querySelector('.auth-tab[onclick*="login"]');
        if (loginForm) loginForm.style.display = 'block';
        if (loginTab) loginTab.classList.add('active');
    } else {
        const registerForm = document.getElementById('registerForm');
        const registerTab = document.querySelector('.auth-tab[onclick*="register"]');
        if (registerForm) registerForm.style.display = 'block';
        if (registerTab) registerTab.classList.add('active');
    }
}

// Función para manejar login con email y contraseña
async function handleEmailLogin(event) {
    event.preventDefault();
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');

    if (!emailInput || !passwordInput) return;

    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        if (!window.firebaseAuth || !window.firebaseFunctions) {
            throw new Error('Firebase no está configurado o no se ha inicializado correctamente.');
        }
        
        const userCredential = await window.firebaseFunctions.signInWithEmailAndPassword(
            window.firebaseAuth, email, password
        );
        
        console.log('✅ Login exitoso:', userCredential.user);
        closeAuthModal();
        window.deseoApp.showNotification('¡Bienvenido!', 'success');
        
        emailInput.value = '';
        passwordInput.value = '';
        
    } catch (error) {
        console.error('❌ Error en login:', error);
        let errorMessage = 'Error en el login';
        
        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No existe una cuenta con este correo.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Contraseña incorrecta.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Correo inválido.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Demasiados intentos. Intenta más tarde.';
        } else {
            errorMessage = error.message;
        }
        
        window.deseoApp.showNotification(errorMessage, 'error');
    }
}

// Función para manejar registro con email y contraseña
async function handleEmailRegister(event) {
    event.preventDefault();
    const emailInput = document.getElementById('registerEmail');
    const passwordInput = document.getElementById('registerPassword');
    const nameInput = document.getElementById('registerName');

    if (!emailInput || !passwordInput || !nameInput) return;

    const email = emailInput.value;
    const password = passwordInput.value;
    const name = nameInput.value;
    
    try {
        if (!window.firebaseAuth || !window.firebaseFunctions) {
            throw new Error('Firebase no está configurado o no se ha inicializado correctamente.');
        }
        
        const userCredential = await window.firebaseFunctions.createUserWithEmailAndPassword(
            window.firebaseAuth, email, password
        );
        
        // Guardar datos adicionales del usuario en Firestore
        if (window.firebaseDB && userCredential.user) {
            await window.firebaseFunctions.addDoc(
                window.firebaseFunctions.collection(window.firebaseDB, window.firebaseCollections.users),
                {
                    uid: userCredential.user.uid,
                    email: userCredential.user.email,
                    fullName: name,
                    createdAt: new Date().toISOString(),
                    lastLogin: new Date().toISOString()
                }
            );
        }
        
        console.log('✅ Registro exitoso:', userCredential.user);
        closeAuthModal();
        window.deseoApp.showNotification('¡Cuenta creada exitosamente!', 'success');
        
        emailInput.value = '';
        passwordInput.value = '';
        nameInput.value = '';
        
    } catch (error) {
        console.error('❌ Error en registro:', error);
        let errorMessage = 'Error en el registro';
        
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'Ya existe una cuenta con este correo.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Correo inválido.';
        } else {
            errorMessage = error.message;
        }
        
        window.deseoApp.showNotification(errorMessage, 'error');
    }
}

// Función para manejar Google Sign-In
async function handleGoogleSignIn() {
    try {
        if (!window.firebaseAuth || !window.firebaseFunctions) {
            throw new Error('Firebase no está configurado o no se ha inicializado correctamente.');
        }
        
        const provider = new window.firebaseFunctions.GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        
        const result = await window.firebaseFunctions.signInWithPopup(
            window.firebaseAuth, provider
        );
        
        // Guardar datos del usuario en Firestore si es nuevo
        if (window.firebaseDB && result.additionalUserInfo.isNewUser) {
            await window.firebaseFunctions.addDoc(
                window.firebaseFunctions.collection(window.firebaseDB, window.firebaseCollections.users),
                {
                    uid: result.user.uid,
                    email: result.user.email,
                    fullName: result.user.displayName,
                    photoURL: result.user.photoURL,
                    createdAt: new Date().toISOString(),
                    lastLogin: new Date().toISOString(),
                    provider: 'google'
                }
            );
        }
        
        console.log('✅ Google Sign-In exitoso:', result.user);
        closeAuthModal();
        window.deseoApp.showNotification('¡Bienvenido con Google!', 'success');
        
    } catch (error) {
        console.error('❌ Error en Google Sign-In:', error);
        let errorMessage = 'Error en Google Sign-In';
        
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Inicio de sesión cancelado por el usuario.';
        } else if (error.code === 'auth/popup-blocked') {
            errorMessage = 'Popup bloqueado. Por favor, permite las ventanas emergentes para continuar.';
        } else if (error.code === 'auth/cancelled-popup-request') {
            errorMessage = 'La solicitud de popup fue cancelada. Intenta de nuevo.';
        } else {
            errorMessage = error.message;
        }
        
        window.deseoApp.showNotification(errorMessage, 'error');
    }
}

// Función para manejar logout
async function handleLogout() {
    try {
        if (!window.firebaseAuth || !window.firebaseFunctions) {
            throw new Error('Firebase no está configurado o no se ha inicializado correctamente.');
        }
        
        await window.firebaseFunctions.signOut(window.firebaseAuth);
        window.deseoApp.showNotification('Sesión cerrada exitosamente.', 'info');
        
    } catch (error) {
        console.error('❌ Error al cerrar sesión:', error);
        window.deseoApp.showNotification('Error al cerrar sesión: ' + error.message, 'error');
    }
}

// Función para actualizar el botón de autenticación en la UI
function updateAuthButton(user) {
    const authButton = document.getElementById('authButton');
    if (!authButton) return;
    
    if (user) {
        authButton.innerHTML = `<i class="fas fa-user"></i> ${user.displayName || user.email}`;
        authButton.onclick = handleLogout;
        authButton.title = 'Cerrar sesión';
    } else {
        authButton.innerHTML = '<i class="fas fa-user"></i> Iniciar Sesión';
        authButton.onclick = showAuthModal;
        authButton.title = 'Iniciar sesión';
    }
}

// ===== CONFIGURACIÓN DE MAPBOX (REQUIERE CONFIG.JS) =====
// La configuración se carga desde config.js
const MAPBOX_TOKEN = CONFIG.MAPBOX_TOKEN;
const MAP_CONFIG = CONFIG.MAP;

// Verificar si Mapbox GL JS está cargado
if (typeof mapboxgl === 'undefined') {
    console.error('Mapbox GL JS no está cargado');
    document.body.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; font-family: Arial, sans-serif;">
            <h1>Error de Carga</h1>
            <p>Mapbox GL JS no se pudo cargar. Verifica tu conexión a internet.</p>
            <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 20px; background: #6366f1; color: white; border: none; border-radius: 5px; cursor: pointer;">
                Recargar Página
            </button>
        </div>
    `;
    throw new Error("Mapbox GL JS not loaded"); // Detener la ejecución del script
}

// ===== ESTADO GLOBAL DE LA APLICACIÓN =====
class DeseoApp {
    constructor() {
        this.map = null;
        this.wishes = []; // Vuelve a ser 'wishes'
        this.markers = [];
        this.currentUser = { id: 'user1', name: 'Usuario Actual' };
        this.activeChat = null;
        this.userLocation = null;
        this.userLocationMarker = null;
        // ===== IA =====
        this.conversationHistory = [];
        this.userProfile = this.loadUserProfile();
        this.emotionalState = this.loadEmotionalState();
        this.gemini = null; // Se inicializará después
        this.filters = {
            maxPrice: 1000, // Filtro de precio para deseos
            category: '',
            distance: 10
        }; // Revertidos los filtros para deseos
        this.aiResponses = this.initializeAIResponses();
        this.exposeGetTopInterests();
        this.initializeApp();
    }

    // ===== INICIALIZACIÓN DE LA APLICACIÓN =====
    async initializeApp() {
        try {
            this.loadSavedTheme();
            await this.initializeMapbox();
            this.setupEventListeners();
            this.generateSampleWishes(); // Vuelve a generateSampleWishes
            this.renderWishesOnMap();    // Vuelve a renderWishesOnMap
            
            // Inicializar Gemini después de que todo esté cargado
            setTimeout(() => {
                this.gemini = this.initializeGeminiClient();
                console.log('Gemini client initialized:', !!this.gemini);
            }, 1000);
            
            this.showNotification('¡Bienvenido a Deseo! Explora deseos cerca de ti.', 'success');
        } catch (error) {
            console.error('Error inicializando la aplicación:', error);
            this.showNotification('Error al cargar el mapa. Verifica tu token de Mapbox.', 'error');
        }
    }

    // ===== INICIALIZACIÓN DE MAPBOX =====
    async initializeMapbox() {
        if (!isMapboxTokenConfigured()) {
            throw new Error('Token de Mapbox no configurado. Por favor, configura tu token en config.js');
        }

        // Configurar el token de Mapbox
        mapboxgl.accessToken = MAPBOX_TOKEN;

        // Crear el mapa
        this.map = new mapboxgl.Map({
            container: 'map',
            style: MAP_CONFIG.styles[MAP_CONFIG.defaultStyle],
            center: MAP_CONFIG.defaultCenter,
            zoom: MAP_CONFIG.defaultZoom,
            attributionControl: false
        });

        // Esperar a que el mapa se cargue
        await new Promise((resolve) => {
            this.map.on('load', resolve);
        });

        // Añadir controles de navegación
        this.map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        
        // Añadir control de geolocalización
        this.map.addControl(new mapboxgl.GeolocateControl({
            positionOptions: {
                enableHighAccuracy: true
            },
            trackUserLocation: true,
            showUserHeading: true
        }), 'top-right');

        // Configurar eventos del mapa
        this.setupMapEvents();
        
        // Intentar geolocalización automática al cargar
        this.autoLocateUser();
    }

    setupMapEvents() {
        // Evento cuando el usuario hace clic en el mapa
        this.map.on('click', (e) => {
            console.log('Click en coordenadas:', e.lngLat);
        });

        // Evento cuando el mapa se mueve
        this.map.on('moveend', () => {
            const center = this.map.getCenter();
            console.log('Centro del mapa:', center);
        });
    }

    // ===== CONFIGURACIÓN DE EVENT LISTENERS (DeseoApp) =====
    setupEventListeners() {
        // Botones principales
        document.getElementById('floatingCreateWishBtn').addEventListener('click', () => this.openCreateWishModal());
        document.getElementById('filterBtn').addEventListener('click', () => this.openFilterModal());
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

        // Sidebar - Búsqueda y filtros
        document.getElementById('wishSearchInput').addEventListener('input', (e) => {
            // Implementar lógica de búsqueda de deseos aquí
            console.log('Buscando deseos:', e.target.value);
            // this.filterWishesBySearch(e.target.value);
            this.renderWishListInSidebar();
            this.renderWishesOnMap();
        });
        document.getElementById('categoryFilterSidebar').addEventListener('change', () => this.applySidebarFilters());
        document.getElementById('priceFilterSidebar').addEventListener('input', (e) => {
            document.getElementById('priceValueSidebar').textContent = `$${e.target.value}`;
        });
        document.getElementById('applySidebarFiltersBtn').addEventListener('click', () => this.applySidebarFilters());

        // Modales - botones de cerrar (adaptados si los IDs cambiaron)
        document.getElementById('closeCreateModal').addEventListener('click', () => this.closeModal('createWishModal'));
        document.getElementById('closeChatModal').addEventListener('click', () => this.closeModal('privateChatModal'));
        document.getElementById('closeRatingModal').addEventListener('click', () => this.closeModal('ratingModal'));
        document.getElementById('closeFilterModal').addEventListener('click', () => this.closeModal('filterModal'));

        // Chat con IA
        document.getElementById('sendAiMessage').addEventListener('click', () => this.sendAIMessage());
        document.getElementById('aiChatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendAIMessage();
        });

        // Publicar deseo
        document.getElementById('publishWish').addEventListener('click', () => this.publishWish());

        // Tarjeta de detalles del deseo (botones de acción)
        document.getElementById('acceptWishBtnCard').addEventListener('click', () => this.acceptWishFromCard());
        document.getElementById('viewChatBtnCard').addEventListener('click', () => this.openPrivateChatForCurrentWish());

        // Chat privado
        document.getElementById('sendPrivateMessage').addEventListener('click', () => this.sendPrivateMessage());
        document.getElementById('privateChatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendPrivateMessage();
        });

        // Completar deseo
        document.getElementById('completeWishBtn').addEventListener('click', () => this.completeWish());

        // Calificación
        document.getElementById('fulfilledBtn').addEventListener('click', () => this.setFulfillmentStatus(true));
        document.getElementById('unfulfilledBtn').addEventListener('click', () => this.setFulfillmentStatus(false));
        document.getElementById('submitRating').addEventListener('click', () => this.submitRating());

        // Estrellas de calificación
        document.querySelectorAll('#starRating i').forEach((star, index) => {
            star.addEventListener('click', () => this.setStarRating(index + 1));
            star.addEventListener('mouseenter', () => this.highlightStars(index + 1));
        });
        document.getElementById('starRating').addEventListener('mouseleave', () => this.resetStarHighlight());

        // Filtros (del modal, si se sigue usando el modal de filtros avanzados)
        document.getElementById('priceFilter').addEventListener('input', (e) => {
            document.getElementById('priceValue').textContent = `$${e.target.value}`;
        });
        document.getElementById('applyFilters').addEventListener('click', () => this.applyFilters());

        // Cerrar modales al hacer click fuera
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    }

    // ===== CONTROLES DEL MAPA =====
    autoLocateUser() {
        if (navigator.geolocation) {
            // Mostrar indicador de carga
            this.showNotification('Obteniendo tu ubicación...', 'info');
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    this.userLocation = { lat: latitude, lng: longitude };
                    
                    // Centrar el mapa en la ubicación del usuario con animación suave
                    this.map.flyTo({
                        center: [longitude, latitude],
                        zoom: 14,
                        essential: true,
                        duration: 2000 // 2 segundos de animación
                    });
                    
                    // Agregar marcador de ubicación del usuario
                    this.addUserLocationMarker(longitude, latitude);
                    
                    this.showNotification('¡Ubicación encontrada! Mapa centrado en tu posición', 'success');
                },
                (error) => {
                    console.warn('No se pudo obtener ubicación automáticamente:', error);
                    // No mostrar error al usuario, simplemente usar ubicación por defecto
                    this.showNotification('Usando ubicación por defecto. Puedes usar el botón de ubicación para centrar el mapa en tu posición', 'info');
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000, // 10 segundos máximo
                    maximumAge: 300000 // Cache por 5 minutos
                }
            );
        } else {
            console.warn('Geolocalización no soportada por el navegador');
            this.showNotification('Geolocalización no disponible. Usando ubicación por defecto', 'info');
        }
    }

    locateUser() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    this.userLocation = { lat: latitude, lng: longitude };
                    
                    this.map.flyTo({
                        center: [longitude, latitude],
                        zoom: 15,
                        essential: true
                    });
                    
                    // Agregar/actualizar marcador de ubicación del usuario
                    this.addUserLocationMarker(longitude, latitude);
                    
                    this.showNotification('Ubicación encontrada', 'success');
                },
                (error) => {
                    console.error('Error obteniendo ubicación:', error);
                    this.showNotification('No se pudo obtener tu ubicación', 'error');
                }
            );
        } else {
            this.showNotification('Geolocalización no soportada', 'error');
        }
    }

    zoomIn() {
        const currentZoom = this.map.getZoom();
        this.map.zoomTo(currentZoom + 1);
    }

    zoomOut() {
        const currentZoom = this.map.getZoom();
        this.map.zoomTo(currentZoom - 1);
    }

    // ===== MARCADOR DE UBICACIÓN DEL USUARIO =====
    addUserLocationMarker(lng, lat) {
        // Remover marcador anterior si existe
        if (this.userLocationMarker) {
            this.userLocationMarker.remove();
        }

        // Crear elemento HTML para el marcador del usuario
        const userMarkerElement = document.createElement('div');
        userMarkerElement.className = 'user-location-marker';
        userMarkerElement.innerHTML = `
            <div class="user-marker-pulse"></div>
            <div class="user-marker-icon">
                <i class="fas fa-map-marker-alt"></i>
            </div>
        `;

        // Crear marcador de Mapbox
        this.userLocationMarker = new mapboxgl.Marker({
            element: userMarkerElement,
            anchor: 'center'
        })
        .setLngLat([lng, lat])
        .addTo(this.map);

        // Agregar popup informativo
        const popup = new mapboxgl.Popup({
            offset: 25,
            closeButton: false,
            closeOnClick: false
        })
        .setHTML(`
            <div class="user-location-popup">
                <h4>📍 Tu ubicación</h4>
                <p>Estás aquí</p>
            </div>
        `);

        this.userLocationMarker.setPopup(popup);
    }

    // ===== GENERACIÓN DE DATOS DE PRUEBA (ADAPTADO PARA DESEOS) =====
    generateSampleWishes() { // Renombrado de generateSampleStores a generateSampleWishes
        this.wishes = [
            {
                id: 'wish1',
                title: 'Comprar café en Starbucks',
                description: 'Necesito que alguien me compre un café grande de vainilla en Starbucks y me lo traiga a mi oficina.',
                price: 8,
                category: 'comida',
                coordinates: [-3.7038, 40.4168], // Madrid
                author: { id: 'user2', name: 'María García' },
                status: 'active',
                createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
            },
            {
                id: 'wish2',
                title: 'Pasear a mi perro',
                description: 'Busco alguien que pueda pasear a mi perro Golden Retriever por 30 minutos en el parque.',
                price: 15,
                category: 'servicios',
                coordinates: [-3.7138, 40.4268], // Madrid (cerca)
                author: { id: 'user3', name: 'Carlos López' },
                status: 'active',
                createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000)
            },
            {
                id: 'wish3',
                title: 'Llevar paquete a correos',
                description: 'Necesito que alguien lleve un paquete pequeño a la oficina de correos más cercana.',
                price: 12,
                category: 'servicios',
                coordinates: [-3.6938, 40.4068], // Madrid (cerca)
                author: { id: 'user4', name: 'Ana Martínez' },
                status: 'active',
                createdAt: new Date(Date.now() - 30 * 60 * 1000)
            },
            {
                id: 'wish4',
                title: 'Comprar ingredientes para cena',
                description: 'Necesito que alguien compre los ingredientes para hacer pasta: tomates, cebolla, ajo y queso parmesano.',
                price: 20,
                category: 'compras',
                coordinates: [-3.7238, 40.4368], // Madrid (cerca)
                author: { id: 'user5', name: 'Roberto Silva' },
                status: 'active',
                createdAt: new Date(Date.now() - 45 * 60 * 1000)
            },
            {
                id: 'wish5',
                title: 'Dar un paseo en bicicleta',
                description: 'Busco compañía para dar un paseo en bicicleta por el centro de la ciudad este fin de semana.',
                price: 25,
                category: 'entretenimiento',
                coordinates: [-3.6838, 40.3968], // Madrid (cerca)
                author: { id: 'user6', name: 'Laura Fernández' },
                status: 'active',
                createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000)
            }
        ];
    }

    // ===== RENDERIZADO DEL MAPA =====
    renderWishesOnMap() { // Renombrado de renderStoresOnMap a renderWishesOnMap
        // Limpiar marcadores existentes
        this.clearMarkers();

        this.wishes
            .filter(wish => wish.status === 'active') // Filtrar deseos activos
            .filter(wish => this.passesWishFilters(wish)) // Cambiado de passesStoreFilters a passesWishFilters
            .forEach(wish => {
                this.addWishMarker(wish); // Cambiado de addStoreMarker a addWishMarker
            });
    }

    clearMarkers() {
        this.markers.forEach(marker => marker.remove());
        this.markers = [];
    }

    addWishMarker(wish) { // Renombrado de addStoreMarker a addWishMarker
        // Crear elemento HTML para el marcador
        const markerElement = document.createElement('div');
        markerElement.className = 'wish-marker'; // Nueva clase para marcadores de deseos
        
        // Icono según categoría y precio
        const categoryIcon = this.getCategoryIcon(wish.category); // Usar la función de icono de categoría

        markerElement.innerHTML = `
            <i class="${categoryIcon}"></i>
            <span class="marker-price">$${wish.price}</span>
        `;

        // Crear marcador de Mapbox
        const marker = new mapboxgl.Marker({
            element: markerElement,
            anchor: 'bottom'
        })
            .setLngLat(wish.coordinates)
            .addTo(this.map);

        // Crear popup (simple, la tarjeta flotante es para detalles)
        const popup = new mapboxgl.Popup({
            offset: 25,
            closeButton: false,
            closeOnClick: false
        }).setHTML(this.createWishPopupHTML(wish)); // Cambiado de createStorePopupHTML a createWishPopupHTML

        marker.setPopup(popup);

        // Evento de clic en el marcador para mostrar la tarjeta de detalles del deseo
        markerElement.addEventListener('click', () => {
            this.showWishDetails(wish); // Mostrar detalles del deseo en la tarjeta flotante
        });

        this.markers.push(marker);
    }

    createWishPopupHTML(wish) { // Renombrado de createStorePopupHTML a createWishPopupHTML
        return `
            <div class="wish-marker-popup">
                <h3>${wish.title}</h3>
                <p>$${wish.price} • ${this.getCategoryName(wish.category)}</p>
            </div>
        `;
    }

    // ===== MODALES =====
    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
        document.body.style.overflow = 'auto';
    }

    // ===== CREAR DESEO CON IA =====
    openCreateWishModal() {
        this.openModal('createWishModal');
        this.resetAIChat();
    }

    resetAIChat() {
        const messagesContainer = document.getElementById('aiChatMessages');
        messagesContainer.innerHTML = `
            <div class="ai-message">
                <div class="ai-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="message-content">
                    <p>¡Hola! Soy tu asistente de deseos. Cuéntame qué te gustaría que alguien haga por ti y te ayudo a crear el deseo perfecto con un precio justo.</p>
                </div>
            </div>
        `;
        document.getElementById('wishPreview').style.display = 'none';
        document.getElementById('aiChatInput').value = '';
        this.conversationHistory = [];
    }

    sendAIMessage() {
        const input = document.getElementById('aiChatInput');
        const message = input.value.trim();
        
        if (!message) return;

        // Agregar mensaje del usuario
        this.addMessageToChat('user', message);
        input.value = '';

        // Actualizar perfil del usuario por análisis de texto
        this.updateProfileFromText(message);

        // Analizar estado emocional
        const emotionalState = this.analyzeEmotionalState(message);

        // Guardar en historial de conversación
        this.conversationHistory.push({ role: 'user', content: message });

        // Verificar si Gemini está disponible y configurado correctamente
        const geminiAvailable = CONFIG.AI && 
                               CONFIG.AI.GEMINI && 
                               CONFIG.AI.GEMINI.enabled && 
                               CONFIG.AI.GEMINI.apiKey && 
                               CONFIG.AI.GEMINI.apiKey !== 'PON_AQUI_TU_API_KEY_DE_GEMINI' &&
                               CONFIG.AI.GEMINI.apiKey.length > 10 &&
                               this.gemini;

        console.log('=== AI CHAT DEBUG ===');
        console.log('Message:', message);
        console.log('Gemini available:', geminiAvailable);
        console.log('Gemini config:', CONFIG.AI?.GEMINI);
        console.log('Gemini client:', !!this.gemini);
        console.log('Conversation history:', this.conversationHistory);

        if (geminiAvailable) {
            console.log('Using Gemini for AI response...');
            
            // Mostrar indicador de carga
            this.addTypingIndicator();
            
            this.generateGeminiResponse(message)
                .then((text) => {
                    // Remover indicador de typing
                    this.removeTypingIndicator();
                    
                    const aiText = text || 'Estoy aquí para ayudarte. ¿Puedes contarme un poco más?';
                    this.addMessageToChat('ai', aiText);
                    this.conversationHistory.push({ role: 'assistant', content: aiText });
                    this.maybeShowSuggestions();
                })
                .catch((error) => {
                    console.error('Gemini error, falling back to local AI:', error);
                    
                    // Remover indicador de typing
                    this.removeTypingIndicator();
                    
                    // Fallback local
                    const aiResponse = this.generateAIResponse(message);
                    this.addMessageToChat('ai', aiResponse.text);
                    if (aiResponse.wishData) {
                        this.showWishPreview(aiResponse.wishData);
                    }
                    this.maybeShowSuggestions();
                });
        } else {
            console.log('Using local AI fallback...');
            // Fallback inmediato
        setTimeout(() => {
            const aiResponse = this.generateAIResponse(message);
            this.addMessageToChat('ai', aiResponse.text);
            if (aiResponse.wishData) {
                this.showWishPreview(aiResponse.wishData);
            }
                this.maybeShowSuggestions();
            }, CONFIG.AI.responseDelay || 1000);
        }
    }

    addMessageToChat(sender, message) {
        const messagesContainer = document.getElementById('aiChatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `${sender}-message`;
        
        const avatar = sender === 'ai' ? 
            '<div class="ai-avatar"><i class="fas fa-robot"></i></div>' :
            '<div class="user-avatar"><i class="fas fa-user"></i></div>';

        // Formatear el mensaje para mejor legibilidad
        const formattedMessage = this.formatMessage(message);

        messageDiv.innerHTML = `
            ${avatar}
            <div class="message-content">
                ${formattedMessage}
            </div>
        `;

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    formatMessage(message) {
        if (!message) return '<p></p>';
        
        // Dividir en párrafos si hay saltos de línea
        const paragraphs = message.split('\n').filter(p => p.trim());
        
        if (paragraphs.length === 1) {
            return `<p>${this.escapeHtml(message)}</p>`;
        }
        
        // Si hay múltiples párrafos, formatearlos
        return paragraphs.map(p => `<p>${this.escapeHtml(p.trim())}</p>`).join('');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    generateAIResponse(userMessage) {
        const lowerMessage = userMessage.toLowerCase();
        
        // Verificar estado emocional
        if (this.emotionalState.current === 'negative') {
            return {
                text: "Entiendo que no estás pasando por un buen momento. ¿Hay algo en lo que pueda ayudarte o prefieres hablar de otra cosa?",
                wishData: null
            };
        }
        
        // Detectar tipo de deseo y generar respuesta más concisa
        if (lowerMessage.includes('café') || lowerMessage.includes('coffee') || lowerMessage.includes('bebida')) {
            return {
                text: "¡Perfecto! Un deseo de comida. Sugiero $8-12. ¿Qué tipo de café necesitas?",
                wishData: {
                    title: "Comprar café",
                    description: userMessage,
                    price: 10,
                    category: "comida"
                }
            };
        }
        
        if (lowerMessage.includes('perro') || lowerMessage.includes('mascota') || lowerMessage.includes('paseo')) {
            return {
                text: "¡Excelente! Servicio de mascotas. Sugiero $15-25. ¿Cuánto tiempo necesitas?",
                wishData: {
                    title: "Pasear mascota",
                    description: userMessage,
                    price: 20,
                    category: "servicios"
                }
            };
        }
        
        if (lowerMessage.includes('comprar') || lowerMessage.includes('tienda') || lowerMessage.includes('supermercado')) {
            return {
                text: "¡Genial! Deseo de compras. Sugiero $15-30. ¿Qué necesitas comprar?",
                wishData: {
                    title: "Comprar productos",
                    description: userMessage,
                    price: 20,
                    category: "compras"
                }
            };
        }
        
        if (lowerMessage.includes('llevar') || lowerMessage.includes('entregar') || lowerMessage.includes('paquete')) {
            return {
                text: "¡Perfecto! Servicio de entrega. Sugiero $10-20. ¿A dónde?",
                wishData: {
                    title: "Servicio de entrega",
                    description: userMessage,
                    price: 15,
                    category: "servicios"
                }
            };
        }
        
        // Respuesta genérica más concisa
        return {
            text: "Interesante deseo. ¿Podrías ser más específico sobre qué necesitas?",
            wishData: null
        };
    }

    // ===== GEMINI INTEGRATION (REST API) =====
    initializeGeminiClient() {
        try {
            const cfg = CONFIG.AI && CONFIG.AI.GEMINI;
            if (!cfg || !cfg.enabled || !cfg.apiKey) {
                console.log('Gemini config not available');
                return null;
            }
            
            // Verificar que la API key no sea el placeholder
            if (cfg.apiKey === 'PON_AQUI_TU_API_KEY_DE_GEMINI' || cfg.apiKey.length < 10) {
                console.log('Gemini API key not configured properly');
                return null;
            }
            
            console.log('Gemini REST API client initialized successfully');
            return {
                apiKey: cfg.apiKey,
                model: cfg.model,
                apiUrl: cfg.apiUrl
            };
        } catch (e) {
            console.warn('Gemini client not initialized:', e);
            return null;
        }
    }

    async generateGeminiResponse(userMessage) {
        try {
            const client = this.gemini;
            if (!client) {
                console.log('Gemini client not available');
                return null;
            }

            console.log('Generating Gemini response for:', userMessage);
            
            // Construir prompt con historial de conversación
            const historyText = this.conversationHistory.map(m => 
                `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`
            ).join('\n');
            
            const systemPrompt = `Eres un asistente de deseos. Responde en español de forma breve y directa (máximo 2-3 oraciones).
            Ayuda a crear deseos claros y sugiere precios justos. 
            Solo sugiere deseos cuando el usuario esté en un estado emocional positivo.
            Si el usuario parece triste o negativo, ofrece apoyo emocional en lugar de sugerir deseos.`;
            
            const fullPrompt = `${systemPrompt}\n\nHistorial de conversación:\n${historyText}\n\nMensaje actual del usuario: ${userMessage}`;

            console.log('Sending request to Gemini REST API...');
            
            // Usar la API REST directamente como sugiere la documentación
            const response = await fetch(`${client.apiUrl}/${client.model}:generateContent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-goog-api-key': client.apiKey
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: fullPrompt
                                }
                            ]
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
                const text = data.candidates[0].content.parts[0].text;
                console.log('Gemini response received:', text);
                return text;
            }
            
            console.log('No response text from Gemini');
            return null;
        } catch (e) {
            console.error('Gemini generation failed:', e);
            return null;
        }
    }

    // ===== USER PROFILE AND ANALYSIS =====
    loadUserProfile() {
        try {
            const raw = localStorage.getItem('deseo_user_profile');
            if (!raw) return { viajes: 0, comida: 0, ocio: 0, trabajo: 0, amor: 0, transporte: 0, servicios: 0, compras: 0 };
            const parsed = JSON.parse(raw);
            return Object.assign({ viajes: 0, comida: 0, ocio: 0, trabajo: 0, amor: 0, transporte: 0, servicios: 0, compras: 0 }, parsed);
        } catch {
            return { viajes: 0, comida: 0, ocio: 0, trabajo: 0, amor: 0, transporte: 0, servicios: 0, compras: 0 };
        }
    }

    saveUserProfile() {
        try {
            localStorage.setItem('deseo_user_profile', JSON.stringify(this.userProfile));
        } catch {}
    }

    // ===== EMOTIONAL STATE MANAGEMENT =====
    loadEmotionalState() {
        try {
            const raw = localStorage.getItem('deseo_emotional_state');
            return raw ? JSON.parse(raw) : {
                current: 'neutral',
                history: [],
                positiveCount: 0,
                negativeCount: 0,
                neutralCount: 0
            };
        } catch (e) {
            console.warn('Error loading emotional state:', e);
            return {
                current: 'neutral',
                history: [],
                positiveCount: 0,
                negativeCount: 0,
                neutralCount: 0
            };
        }
    }

    saveEmotionalState() {
        try {
            localStorage.setItem('deseo_emotional_state', JSON.stringify(this.emotionalState));
        } catch (e) {
            console.warn('Error saving emotional state:', e);
        }
    }

    analyzeEmotionalState(text) {
        const emotionalAnalysis = CONFIG.AI.EMOTIONAL_ANALYSIS;
        const words = text.toLowerCase().split(/\s+/);
        
        let positiveScore = 0;
        let negativeScore = 0;
        let neutralScore = 0;
        
        words.forEach(word => {
            if (emotionalAnalysis.positive.includes(word)) positiveScore++;
            if (emotionalAnalysis.negative.includes(word)) negativeScore++;
            if (emotionalAnalysis.neutral.includes(word)) neutralScore++;
        });
        
        // Determinar el estado emocional predominante
        let emotionalState = 'neutral';
        if (positiveScore > negativeScore && positiveScore > neutralScore) {
            emotionalState = 'positive';
        } else if (negativeScore > positiveScore && negativeScore > neutralScore) {
            emotionalState = 'negative';
        }
        
        // Actualizar el estado emocional
        this.emotionalState.current = emotionalState;
        this.emotionalState.history.push({
            text: text,
            state: emotionalState,
            timestamp: new Date().toISOString()
        });
        
        // Mantener solo los últimos 10 estados
        if (this.emotionalState.history.length > 10) {
            this.emotionalState.history = this.emotionalState.history.slice(-10);
        }
        
        // Actualizar contadores
        if (emotionalState === 'positive') this.emotionalState.positiveCount++;
        else if (emotionalState === 'negative') this.emotionalState.negativeCount++;
        else this.emotionalState.neutralCount++;
        
        this.saveEmotionalState();
        
        console.log('Emotional analysis:', {
            text: text,
            state: emotionalState,
            scores: { positive: positiveScore, negative: negativeScore, neutral: neutralScore }
        });
        
        return emotionalState;
    }

    updateProfileFromText(text) {
        if (!text) return;
        const matches = this.extractCategories(text);
        matches.forEach(cat => {
            if (this.userProfile[cat] === undefined) this.userProfile[cat] = 0;
            this.userProfile[cat] += 1;
        });
        this.saveUserProfile();
    }

    extractCategories(text) {
        const found = new Set();
        const lower = text.toLowerCase();
        const dict = (CONFIG.AI && CONFIG.AI.KEYWORDS) || {};
        Object.keys(dict).forEach(cat => {
            const words = dict[cat] || [];
            for (let i = 0; i < words.length; i++) {
                if (lower.includes(words[i])) { found.add(cat); break; }
            }
        });
        return Array.from(found);
    }

    getTopInterests() {
        const entries = Object.entries(this.userProfile || {});
        entries.sort((a, b) => b[1] - a[1]);
        return entries.slice(0, 3).map(([cat, count]) => ({ category: cat, count }));
    }

    // Exponer función globalmente
    exposeGetTopInterests() {
        window.getTopInterests = () => this.getTopInterests();
    }

    maybeShowSuggestions() {
        // Solo mostrar sugerencias si el estado emocional es positivo
        if (this.emotionalState.current !== 'positive') {
            console.log('Not showing suggestions due to emotional state:', this.emotionalState.current);
            return;
        }
        
        const top = this.getTopInterests().filter(item => item.count > 0);
        if (top.length === 0) return;
        const main = top[0].category;
        const suggestions = {
            viajes: 'Noto que te gustan los viajes, ¿quieres ver deseos relacionados con viajar?',
            comida: 'Veo que te interesa la comida, ¿te muestro deseos de comida cerca?',
            ocio: 'Te gusta el ocio. ¿Quieres ver actividades y entretenimiento cercanos?',
            trabajo: 'Parece que te interesan temas de trabajo. ¿Buscamos deseos de servicios profesionales?',
            amor: 'Veo interés en temas románticos. ¿Te muestro ideas de detalles y regalos?',
            transporte: 'Te interesa transporte. ¿Te muestro deseos de traslados cercanos?',
            servicios: 'Veo interés en servicios. ¿Quieres ver tareas que puedes solicitar o aceptar?',
            compras: 'Te interesan compras. ¿Te muestro deseos de compras y encargos?'
        };
        const text = suggestions[main];
        if (text) this.addMessageToChat('ai', text);
    }

    showWishPreview(wishData) {
        document.getElementById('previewTitle').textContent = wishData.title;
        document.getElementById('previewDescription').textContent = wishData.description;
        document.getElementById('previewPrice').textContent = `$${wishData.price}`;
        document.getElementById('previewCategory').textContent = this.getCategoryName(wishData.category);
        document.getElementById('wishPreview').style.display = 'block';
        
        // Guardar datos del deseo para publicación
        this.currentWishData = wishData;
    }

    publishWish() {
        if (!this.currentWishData) return;

        // Obtener ubicación actual del mapa
        const center = this.map.getCenter();
        const coordinates = [center.lng, center.lat];

        const newWish = {
            id: `wish${Date.now()}`,
            title: this.currentWishData.title,
            description: this.currentWishData.description,
            price: this.currentWishData.price,
            category: this.currentWishData.category,
            coordinates: coordinates,
            author: this.currentUser,
            status: 'active',
            createdAt: new Date()
        };

        this.wishes.push(newWish);
        this.renderWishesOnMap();
        this.closeModal('createWishModal');
        this.showNotification('¡Tu deseo ha sido publicado exitosamente!', 'success');
    }

    // ===== DETALLES DEL DESEO (TARJETA FLOTANTE) =====
    showWishDetails(wish) {
        if (!wish) return;

        const wishDetailsCard = document.getElementById('wishDetailsCard'); // Usar el ID correcto
        if (!wishDetailsCard) return;

        // Guardar el deseo actual para acciones futuras
        this.currentWish = wish;

        // Actualizar el contenido de la tarjeta con los detalles del deseo
        document.getElementById('wishDetailsCardLogo').src = this.getCategoryLogo(wish.category);
        document.getElementById('wishDetailsCardLogo').alt = wish.category;
        document.getElementById('wishDetailsCardTitle').textContent = wish.title;
        document.getElementById('wishDetailsCardCategoryPrice').textContent = `$${wish.price} • ${this.getCategoryName(wish.category)}`;
        document.getElementById('wishDetailsCardPrice').textContent = `$${wish.price}`;
        document.getElementById('wishDetailsCardDescription').textContent = wish.description;
        document.getElementById('wishDetailsCardAuthor').textContent = `Autor: ${wish.author ? wish.author.name : 'Anónimo'}`;

        // Mostrar u ocultar el botón de chatear/aceptar según el estado y si es el autor
        const acceptBtn = document.getElementById('acceptWishBtnCard');
        const viewChatBtn = document.getElementById('viewChatBtnCard');

        if (wish.status === 'active' && wish.author.id !== this.currentUser.id) {
            acceptBtn.style.display = 'block';
            viewChatBtn.style.display = 'none';
        } else if (wish.status === 'in_progress' && (wish.author.id === this.currentUser.id || wish.acceptedBy.id === this.currentUser.id)) {
            acceptBtn.style.display = 'none';
            viewChatBtn.style.display = 'block';
        } else {
            acceptBtn.style.display = 'none';
            viewChatBtn.style.display = 'none';
        }
        
        wishDetailsCard.classList.add('active');

        // Centrar el mapa en la ubicación del deseo
        this.map.flyTo({
            center: wish.coordinates,
            essential: true,
            duration: 900 // animación suave
        });
    }

    acceptWishFromCard() {
        if (!this.currentWish) return;
        this.acceptWish(this.currentWish.id);
        // Después de aceptar, la tarjeta de detalles debería actualizarse o cerrarse y abrir el chat
        document.getElementById('wishDetailsCard').classList.remove('active');
    }

    openPrivateChatForCurrentWish() {
        if (!this.currentWish) return;
        this.openPrivateChat(this.currentWish.id); // Reutilizar la función existente o adaptarla si es necesario
        document.getElementById('wishDetailsCard').classList.remove('active');
    }

    // ===== CHAT PRIVADO =====
    openPrivateChat(wishId) { // Modificar para aceptar un ID de deseo
        const wish = this.wishes.find(w => w.id === wishId);
        if (!wish) return;

        this.activeChat = {
            wishId: wish.id,
            otherUser: wish.author,
            messages: [
                {
                    sender: 'system',
                    message: `Has aceptado el deseo "${wish.title}" de ${wish.author.name}. ¡Coordina los detalles aquí!`,
                    timestamp: new Date()
                }
            ]
        };

        this.renderPrivateChatMessages();
        this.openModal('privateChatModal');
    }

    renderPrivateChatMessages() {
        const messagesContainer = document.getElementById('privateChatMessages');
        messagesContainer.innerHTML = '';

        this.activeChat.messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message ${msg.sender === this.currentUser.id ? 'sent' : ''}`;
            
            const avatar = msg.sender === 'system' ? 
                '<div class="ai-avatar"><i class="fas fa-info-circle"></i></div>' :
                msg.sender === this.currentUser.id ?
                '<div class="user-avatar"><i class="fas fa-user"></i></div>' :
                '<div class="ai-avatar"><i class="fas fa-user"></i></div>';

            messageDiv.innerHTML = `
                ${avatar}
                <div class="message-content">
                    <p>${msg.message}</p>
                    <small>${this.formatTime(msg.timestamp)}</small>
                </div>
            `;

            messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
    }

    sendPrivateMessage() {
        const input = document.getElementById('privateChatInput');
        const message = input.value.trim();
        
        if (!message || !this.activeChat) return;

        const newMessage = {
            sender: this.currentUser.id,
            message: message,
            timestamp: new Date()
        };

        this.activeChat.messages.push(newMessage);
        this.renderPrivateChatMessages();
        input.value = '';

        // Simular respuesta del otro usuario
        setTimeout(() => {
            const responses = [
                "Perfecto, ¿cuándo te parece bien?",
                "¡Excelente! ¿En qué lugar nos encontramos?",
                "De acuerdo, ¿tienes alguna preferencia especial?",
                "Perfecto, ¿cuál es tu número de teléfono?",
                "¡Genial! ¿A qué hora te conviene?"
            ];
            
            const response = responses[Math.floor(Math.random() * responses.length)];
            const replyMessage = {
                sender: this.activeChat.otherUser.id,
                message: response,
                timestamp: new Date()
            };

            this.activeChat.messages.push(replyMessage);
            this.renderPrivateChatMessages();
        }, 2000);
    }

    completeWish() {
        this.closeModal('privateChatModal');
        this.openRatingModal();
    }

    // ===== SISTEMA DE CALIFICACIÓN =====
    openRatingModal() {
        this.currentRating = {
            fulfilled: null,
            stars: 0,
            comment: ''
        };
        this.openModal('ratingModal');
    }

    setFulfillmentStatus(fulfilled) {
        this.currentRating.fulfilled = fulfilled;
        
        // Actualizar estilos de botones
        document.getElementById('fulfilledBtn').classList.toggle('active', fulfilled);
        document.getElementById('unfulfilledBtn').classList.toggle('active', !fulfilled);
    }

    setStarRating(rating) {
        this.currentRating.stars = rating;
        this.updateStarDisplay(rating);
    }

    highlightStars(rating) {
        this.updateStarDisplay(rating, true);
    }

    resetStarHighlight() {
        this.updateStarDisplay(this.currentRating.stars || 0);
    }

    updateStarDisplay(rating, isHighlight = false) {
        const stars = document.querySelectorAll('#starRating i');
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    }

    submitRating() {
        if (this.currentRating.fulfilled === null) {
            this.showNotification('Por favor selecciona si el deseo fue cumplido o no.', 'warning');
            return;
        }

        if (this.currentRating.stars === 0) {
            this.showNotification('Por favor califica con estrellas.', 'warning');
            return;
        }

        const comment = document.getElementById('ratingComment').value;
        this.currentRating.comment = comment;

        // Marcar deseo como completado
        if (this.currentWish) {
            this.currentWish.status = 'completed';
            this.currentWish.rating = this.currentRating;
        }

        this.closeModal('ratingModal');
        this.showNotification('¡Gracias por tu calificación! El deseo ha sido marcado como completado.', 'success');
        
        // Limpiar estado
        this.currentWish = null;
        this.activeChat = null;
        this.renderWishesOnMap();
    }

    // ===== FILTROS (ADAPTADO PARA DESEOS) =====
    openFilterModal() {
        // Adaptar para filtros de deseos si se usa un modal de filtros avanzados
        document.getElementById('priceFilter').value = this.filters.maxPrice;
        document.getElementById('priceValue').textContent = `$${this.filters.maxPrice}`;
        document.getElementById('categoryFilter').value = this.filters.category;
        document.getElementById('distanceFilter').value = this.filters.distance;
        this.openModal('filterModal');
    }

    applyFilters() {
        this.filters.maxPrice = parseInt(document.getElementById('priceFilter').value);
        this.filters.category = document.getElementById('categoryFilter').value;
        this.filters.distance = parseInt(document.getElementById('distanceFilter').value);

        this.renderWishesOnMap(); // Renderizar deseos con los nuevos filtros
        this.closeModal('filterModal');
        this.showNotification('Filtros aplicados correctamente.', 'success');
        this.renderWishListInSidebar(); // Actualizar la lista de deseos en el sidebar
    }

    applySidebarFilters() {
        this.filters.maxPrice = parseInt(document.getElementById('priceFilterSidebar').value);
        this.filters.category = document.getElementById('categoryFilterSidebar').value;
        // La distancia no se aplica directamente desde el sidebar para deseos aún, podría ser un filtro futuro
        // this.filters.distance = parseInt(document.getElementById('distanceFilter').value);

        this.renderWishesOnMap();
        this.renderWishListInSidebar();
        this.showNotification('Filtros de sidebar aplicados correctamente.', 'success');
    }

    passesWishFilters(wish) { // Renombrado de passesStoreFilters a passesWishFilters
        if (wish.price > this.filters.maxPrice) return false;
        if (this.filters.category && wish.category !== this.filters.category) return false;
        
        // Filtro de distancia (si el usuario tiene ubicación)
        if (this.userLocation && this.filters.distance) {
            const distance = this.calculateDistance(
                this.userLocation.lat, this.userLocation.lng,
                wish.coordinates[1], wish.coordinates[0]
            );
            if (distance > this.filters.distance) return false;
        }
        
        return true;
    }

    // ===== UTILIDADES =====
    getCategoryIcon(category) {
        // Helper para obtener ícono según la categoría (re-introducido y adaptado)
        switch (category) {
            case 'comida': return 'fas fa-utensils';
            case 'servicios': return 'fas fa-handshake';
            case 'compras': return 'fas fa-shopping-bag';
            case 'transporte': return 'fas fa-car';
            case 'entretenimiento': return 'fas fa-gamepad';
            default: return 'fas fa-map-marker-alt';
        }
    }

    getCategoryLogo(category) {
        // Helper para obtener un logo por categoría (si se usa en la tarjeta de detalles)
        switch (category) {
            case 'comida': return 'https://www.flaticon.es/svg/vstatic/svg/1046/1046788.svg?token=1646788';
            case 'servicios': return 'https://www.flaticon.es/svg/vstatic/svg/2923/2923946.svg?token=1646788';
            case 'compras': return 'https://www.flaticon.es/svg/vstatic/svg/3002/3002046.svg?token=1646788';
            case 'transporte': return 'https://www.flaticon.es/svg/vstatic/svg/2972/2972986.svg?token=1646788';
            case 'entretenimiento': return 'https://www.flaticon.es/svg/vstatic/svg/2917/2917714.svg?token=1646788';
            default: return 'https://www.flaticon.es/svg/vstatic/svg/3082/3082000.svg?token=1646788'; // Icono por defecto
        }
    }

    getCategoryName(category) {
        // Función para obtener el nombre de la categoría (ya existente)
        switch (category) {
            case 'comida': return 'Comida';
            case 'servicios': return 'Servicios';
            case 'compras': return 'Compras';
            case 'transporte': return 'Transporte';
            case 'entretenimiento': return 'Entretenimiento';
            default: return 'General';
        }
    }

    formatTime(date) {
        return date.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Radio de la Tierra en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 4000);
    }

    // ===== RESPUESTAS DE IA PREDEFINIDAS =====
    initializeAIResponses() {
        return {
            greetings: [
                "¡Hola! Soy tu asistente de deseos. ¿En qué puedo ayudarte hoy?",
                "¡Perfecto! Cuéntame qué necesitas y te ayudo a crear el deseo ideal.",
                "¡Excelente! Vamos a crear un deseo que alguien pueda cumplir fácilmente."
            ],
            priceSuggestions: {
                comida: "Para deseos de comida, sugiero entre $5-15 dependiendo de lo que necesites.",
                servicios: "Para servicios, el precio típico es $10-30 según la complejidad.",
                compras: "Para compras, considera $10-25 más el costo de los productos.",
                transporte: "Para transporte, $8-20 es un rango justo según la distancia.",
                entretenimiento: "Para entretenimiento, $15-40 es apropiado según la actividad."
            }
        };
    }

    // ===== TOGGLE DE TEMA =====
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('deseo-theme', newTheme);
        
        // Actualizar icono del botón
        const themeIcon = document.querySelector('#themeToggle i');
        if (newTheme === 'light') {
            themeIcon.className = 'fas fa-sun';
        } else {
            themeIcon.className = 'fas fa-moon';
        }
        
        this.showNotification(`Tema cambiado a ${newTheme === 'light' ? 'claro' : 'oscuro'}`, 'success');
    }

    // ===== CARGAR TEMA GUARDADO =====
    loadSavedTheme() {
        const savedTheme = localStorage.getItem('deseo-theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            const themeIcon = document.querySelector('#themeToggle i');
            if (savedTheme === 'light') {
                themeIcon.className = 'fas fa-sun';
            } else {
                themeIcon.className = 'fas fa-moon';
            }
        }
    }

    // ===== INDICADOR DE TYPING =====
    addTypingIndicator() {
        const messagesContainer = document.getElementById('aiChatMessages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'ai-message typing-message';
        typingDiv.innerHTML = `
            <div class="ai-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span>IA está escribiendo</span>
                    <div class="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        `;
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // ===== REMOVER INDICADOR DE TYPING =====
    removeTypingIndicator() {
        const typingMessage = document.querySelector('.typing-message');
        if (typingMessage) {
            typingMessage.remove();
        }
    }
}

// ===== INICIALIZACIÓN DE LA APLICACIÓN Y FIREBASE AUTH LISTENER =====
document.addEventListener('DOMContentLoaded', () => {
    // Verificar si CONFIG está disponible
    if (typeof CONFIG === 'undefined') {
        console.error('CONFIG no está disponible. Verifica que config.js se cargue antes que script-mapbox.js');
        // No detener la ejecución aquí, ya que las funciones globales deben seguir disponibles
    }

    // Verificar si Mapbox GL JS está cargado
    if (typeof mapboxgl === 'undefined') {
        console.error('Mapbox GL JS no está cargado');
        // Renderizar un mensaje de error o fallback si Mapbox no está disponible
        document.body.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; font-family: Arial, sans-serif;">
                <h1>Error de Carga</h1>
                <p>Mapbox GL JS no se pudo cargar. Verifica tu conexión a internet.</p>
                <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 20px; background: #6366f1; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Recargar Página
                </button>
            </div>
        `;
        return; // Detener la ejecución del script de la aplicación si Mapbox no está
    }

    // Inicializar la aplicación principal
    window.deseoApp = new DeseoApp();

    // Escuchar cambios de estado de autenticación de Firebase
    // Este listener se adjunta una vez que el DOM está listo y firebaseAuth debería estar inicializado.
    if (window.firebaseAuth && window.firebaseFunctions) {
        window.firebaseFunctions.onAuthStateChanged(window.firebaseAuth, (user) => {
            if (user) {
                console.log('👤 Usuario autenticado:', user);
                updateAuthButton(user);
            } else {
                console.log('👤 Usuario no autenticado');
                updateAuthButton(null);
            }
        });
    } else {
        console.log('⚠️ Firebase Auth no disponible. Algunas funcionalidades pueden estar limitadas.');
        // Asegurarse de que el botón de autenticación muestre el estado correcto incluso sin Firebase activo
        updateAuthButton(null);
    }
    
    // Inicializar la lista de deseos en el sidebar
    window.deseoApp.renderWishListInSidebar(); // Cambiado de updateStoreList

    // Inicializar listeners de filtros del sidebar
    document.getElementById('priceFilterSidebar').addEventListener('input', (e) => {
        document.getElementById('priceValueSidebar').textContent = `$${e.target.value}`;
    });

    // Asegurarse de que el rango de precio se inicialice correctamente en el sidebar
    const priceFilterSidebar = document.getElementById('priceFilterSidebar');
    const priceValueSidebar = document.getElementById('priceValueSidebar');
    if (priceFilterSidebar && priceValueSidebar) {
        priceValueSidebar.textContent = `$${priceFilterSidebar.value}`;
    }

console.log('🗺️ Deseo App con Mapbox cargada exitosamente!');
console.log('📱 Plataforma de micro-deseos con mapa real');
console.log('🤖 IA simulada activa');
console.log('🗺️ Mapa interactivo de Mapbox funcionando');
console.log('💬 Sistema de chat implementado');
console.log('⭐ Sistema de calificaciones activo');
    console.log('🔥 Sistema de autenticación implementado');
});