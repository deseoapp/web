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
        this.availableProfiles = [];
        this.profileMarkers = [];
        this.currentUser = null; // Inicialmente null, se establecerá con Clerk
        this.activeChat = null;
        this.userLocation = null;
        this.userLocationMarker = null;
        // ===== FIREBASE =====
        this.firebase = null;
        this.database = null;
        this.wishesRef = null;
        // ===== IA =====
        this.conversationHistory = [];
        this.userProfile = this.loadUserProfile();
        this.emotionalState = this.loadEmotionalState();
        this.gemini = null; // Se inicializará después
        this.filters = {
            maxPrice: 1000000, // Filtro de precio para deseos (COP)
            category: '',
            distance: 10
        }; // Revertidos los filtros para deseos
        // Cache para perfiles completos de Firebase, clave: userId
        this.userProfilesCache = {};
        
        // Carrusel móvil
        this.currentSlide = 0;
        this.totalSlides = 0;
        this.aiResponses = this.initializeAIResponses();
        
        // Alerta de chats sin responder
        this.unreadChatsCount = 0;
        this.unreadChatsListener = null;
        
        // Notificación de mensajes nuevos
        this.newMessagesCount = 0;
        this.newMessagesListener = null;
        this.allMessages = new Map(); // Cache de mensajes para comparar nuevos
        
        this.exposeGetTopInterests();
        this.initializeApp();
    }

    // ===== MANEJO DE AUTENTICACIÓN CON CLERK =====
    async handleClerkSignIn(user) {
        console.log('Clerk Sign In - User:', user);
        this.currentUser = {
            id: user.id,
            name: user.fullName || (user.emailAddresses && user.emailAddresses[0] && user.emailAddresses[0].emailAddress) || 'Usuario',
            email: (user.emailAddresses && user.emailAddresses[0] && user.emailAddresses[0].emailAddress) || '',
            profileImageUrl: user.imageUrl || user.profileImageUrl || 'https://www.gravatar.com/avatar/?d=mp&f=y'
        };
        
        // Guardar datos de usuario en localStorage para que estén disponibles en otras páginas
        localStorage.setItem('deseo_user', JSON.stringify(this.currentUser));
        sessionStorage.setItem('deseo_user', JSON.stringify(this.currentUser));
        console.log('✅ Datos de usuario guardados en localStorage y sessionStorage');
        
        // Verificar si el perfil está completo
        await this.checkProfileCompletion();
        
        this.showNotification(`¡Bienvenido, ${this.currentUser.name}!`, 'success');
        // Cerrar el modal de autenticación si está abierto
        const authContainer = document.getElementById('authContainer');
        if (authContainer) {
            authContainer.classList.remove('active');
        }
        this.updateAuthUI(); // Actualizar la UI de tu app (e.g., botón de login/logout, mostrar datos de usuario)
    }

    handleClerkSignOut() {
        console.log('Clerk Sign Out');
        this.currentUser = null;
        
        // Limpiar datos de autenticación
        localStorage.removeItem('deseo_user');
        sessionStorage.removeItem('deseo_user');
        console.log('✅ Datos de usuario eliminados de localStorage y sessionStorage');
        
        this.showNotification('Sesión cerrada exitosamente.', 'info');
        this.updateAuthUI();
    }

    // ===== MODAL DE AUTENTICACIÓN =====
    showAuthModal() {
        console.log('Mostrando modal de autenticación...');
        
        // Crear modal de autenticación
        const modal = document.createElement('div');
        modal.className = 'auth-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2><i class="fas fa-lock"></i> Iniciar Sesión</h2>
                        <button class="close-btn" onclick="this.closest('.auth-modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <p>Para contactar con este servicio, necesitas iniciar sesión o registrarte.</p>
                        <div class="auth-options">
                            <button class="btn btn-primary" onclick="this.closest('.auth-modal').remove(); window.location.href='#auth'">
                                <i class="fas fa-sign-in-alt"></i>
                                Iniciar Sesión / Registrarse
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Interacciones de fotos (thumbnails, prev/next, gestos)
        try {
            const mainPhotoEl = modal.querySelector('#tinderMainPhoto');
            const thumbEls = Array.from(modal.querySelectorAll('.thumbs .thumb'));
            let currentIndex = 0;

            const setActiveIndex = (idx) => {
                if (!displayProfile.photos || displayProfile.photos.length === 0) return;
                currentIndex = (idx + displayProfile.photos.length) % displayProfile.photos.length;
                const src = displayProfile.photos[currentIndex];
                if (mainPhotoEl && typeof src === 'string') {
                    mainPhotoEl.src = src;
                }
                thumbEls.forEach((t, i) => t.classList.toggle('active', i === currentIndex));
            };

            thumbEls.forEach((thumb, idx) => {
                thumb.addEventListener('click', (e) => {
                    e.stopPropagation();
                    setActiveIndex(idx);
                });
            });

            const prevBtn = modal.querySelector('#tinderPrevPhoto');
            const nextBtn = modal.querySelector('#tinderNextPhoto');
            if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); setActiveIndex(currentIndex - 1); });
            if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); setActiveIndex(currentIndex + 1); });

            let startX = 0;
            let isTouching = false;
            const onTouchStart = (e) => { isTouching = true; startX = e.touches ? e.touches[0].clientX : e.clientX; };
            const onTouchEnd = (e) => {
                if (!isTouching) return;
                const endX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
                const delta = endX - startX;
                if (Math.abs(delta) > 40) {
                    if (delta < 0) setActiveIndex(currentIndex + 1); else setActiveIndex(currentIndex - 1);
                }
                isTouching = false;
            };
            if (mainPhotoEl) {
                mainPhotoEl.addEventListener('touchstart', onTouchStart, { passive: true });
                mainPhotoEl.addEventListener('touchend', onTouchEnd);
                mainPhotoEl.addEventListener('mousedown', onTouchStart);
                mainPhotoEl.addEventListener('mouseup', onTouchEnd);
            }

            setActiveIndex(0);
        } catch (err) { console.warn('Photo interactions init failed:', err); }

        // Agregar estilos
        const style = document.createElement('style');
        style.textContent = `
            .auth-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: modalFadeIn 0.3s ease;
            }
            .auth-modal .modal-overlay {
                background: rgba(0, 0, 0, 0.7);
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 2rem;
                backdrop-filter: blur(5px);
            }
            .auth-modal .modal-content {
                background: var(--background);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-lg);
                box-shadow: var(--shadow-lg);
                max-width: 400px;
                width: 90%;
                animation: modalSlideIn 0.2s ease-out;
            }
            .auth-modal .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1rem 1.5rem;
                border-bottom: 1px solid var(--border-color);
            }
            .auth-modal .modal-header h2 {
                font-size: 1.25rem;
                font-weight: 700;
                color: var(--text-primary);
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .auth-modal .modal-header h2 i {
                color: var(--primary-color);
            }
            .auth-modal .close-btn {
                background: none;
                border: none;
                font-size: 1.5rem;
                color: var(--text-light);
                cursor: pointer;
                padding: 0.5rem;
                border-radius: 50%;
                transition: var(--transition);
            }
            .auth-modal .close-btn:hover {
                background: var(--hover-bg);
                color: var(--text-primary);
            }
            .auth-modal .modal-body {
                padding: 1.5rem;
                text-align: center;
            }
            .auth-modal .modal-body p {
                color: var(--text-secondary);
                margin-bottom: 1.5rem;
                line-height: 1.5;
            }
            .auth-modal .auth-options {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            .auth-modal .btn {
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: 500;
                transition: all 0.2s ease;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                background: var(--primary-color);
                color: white;
            }
            .auth-modal .btn:hover {
                background: var(--primary-hover);
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(modal);
    }

    // ===== VERIFICACIÓN DE PERFIL COMPLETO =====
    async checkProfileCompletion() {
        try {
            // Solo verificar perfil si el usuario está autenticado
            if (!this.currentUser) {
                console.log('Usuario no autenticado - permitir navegación libre');
                return;
            }

            console.log('Usuario autenticado - verificando perfil completo...');

            // Asegurar que Firebase esté inicializado antes de verificar el perfil
            if (!this.database) {
                console.log('🔍 Firebase no inicializado, inicializando...');
                await this.initializeFirebase();
                
                // Esperar un poco para que Firebase se inicialice
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Verificar si el perfil está completo en Firebase
            const isProfileComplete = await this.isUserProfileComplete();
            
            if (!isProfileComplete) {
                console.log('Perfil incompleto, mostrando modal de completar perfil...');
                this.showProfileCompletionModal();
            } else {
                console.log('Perfil completo ✅');
            }
            
        } catch (error) {
            console.error('Error verificando perfil:', error);
            // En caso de error, solo mostrar modal si el usuario está autenticado
            if (this.currentUser) {
                this.showProfileCompletionModal();
            }
        }
    }

    async isUserProfileComplete() {
        try {
            if (!this.database) {
                console.warn('Firebase no disponible');
                return false;
            }

            const userRef = this.database.ref(`users/${this.currentUser.id}`);
            const snapshot = await userRef.once('value');
            const userData = snapshot.val();

            if (!userData) {
                console.log('Usuario no encontrado en Firebase');
                return false;
            }

            // Verificar si tiene perfil completo
            if (!userData.profileComplete) {
                console.log('Perfil no marcado como completo');
                return false;
            }

            // Verificar campos requeridos
            const profile = userData.profile;
            if (!profile) {
                console.log('No hay datos de perfil');
                return false;
            }

            const requiredFields = ['nickname', 'description', 'age', 'photos', 'sexualPoses'];
            const hasAllFields = requiredFields.every(field => {
                const value = profile[field];
                if (field === 'photos') {
                    return value && Object.keys(value).length >= 3;
                }
                if (field === 'sexualPoses') {
                    return value && value.length >= 1;
                }
                return value && value.toString().trim() !== '';
            });

            console.log('Verificación de perfil:', {
                hasAllFields,
                profile: profile,
                requiredFields: requiredFields.map(field => ({
                    field,
                    hasValue: !!profile[field],
                    value: profile[field]
                }))
            });

            return hasAllFields;

        } catch (error) {
            console.error('Error verificando perfil en Firebase:', error);
            return false;
        }
    }

    showProfileCompletionModal() {
        // Prevenir múltiples modales
        const existingModal = document.querySelector('.profile-completion-modal');
        if (existingModal) {
            console.log('Modal ya existe, no crear otra');
            return;
        }

        // Crear modal de completar perfil
        const modal = document.createElement('div');
        modal.className = 'profile-completion-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2><i class="fas fa-user-plus"></i> Completa tu perfil</h2>
                    </div>
                    <div class="modal-body">
                        <p class="modal-description">Para acceder a todas las funcionalidades de la plataforma</p>
                        <div class="profile-requirements">
                            <div class="requirement-item">
                                <i class="fas fa-user"></i>
                                <span>Información básica</span>
                            </div>
                            <div class="requirement-item">
                                <i class="fas fa-camera"></i>
                                <span>3-6 fotos de perfil</span>
                            </div>
                            <div class="requirement-item">
                                <i class="fas fa-heart"></i>
                                <span>Poses favoritas</span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-primary" id="completeProfileBtn">
                            <i class="fas fa-check"></i>
                            Completar registro
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Agregar estilos usando el diseño del sitio
        const style = document.createElement('style');
        style.textContent = `
            .profile-completion-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: modalFadeIn 0.3s ease;
            }
            @keyframes modalFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .profile-completion-modal .modal-overlay {
                background: transparent;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 2rem;
            }
            .profile-completion-modal .modal-content {
                background: var(--background);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-lg);
                box-shadow: var(--shadow-lg);
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                animation: modalSlideIn 0.2s ease-out;
            }
            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-20px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            .profile-completion-modal .modal-header {
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 1rem 1.5rem;
                border-bottom: 1px solid var(--border-color);
            }
            .profile-completion-modal .modal-header h2 {
                font-size: 1.25rem;
                font-weight: 700;
                color: var(--text-primary);
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .profile-completion-modal .modal-header h2 i {
                color: var(--primary-color);
            }
            .profile-completion-modal .modal-body {
                padding: 1.5rem;
            }
            .profile-completion-modal .modal-description {
                color: var(--text-secondary);
                margin-bottom: 1.5rem;
                font-size: 0.9rem;
                line-height: 1.5;
            }
            .profile-completion-modal .profile-requirements {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            .profile-completion-modal .requirement-item {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1rem;
                background: var(--background-secondary);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-sm);
                transition: var(--transition);
            }
            .profile-completion-modal .requirement-item:hover {
                background: var(--hover-bg);
                border-color: var(--primary-color);
            }
            .profile-completion-modal .requirement-item i {
                color: var(--primary-color);
                font-size: 1.2rem;
                min-width: 20px;
            }
            .profile-completion-modal .requirement-item span {
                color: var(--text-primary);
                font-size: 0.9rem;
                line-height: 1.4;
            }
            .profile-completion-modal .modal-actions {
                display: flex;
                justify-content: center;
                margin-top: 24px;
                padding-top: 20px;
                border-top: 1px solid var(--border-color);
            }
            .profile-completion-modal .btn-primary {
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: 500;
                transition: all 0.2s ease;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                background: var(--primary-color);
                color: white;
            }
            .profile-completion-modal .btn-primary:hover {
                background: var(--primary-hover);
            }
            @media (max-width: 640px) {
                .profile-completion-modal .modal-content {
                    margin: 1rem;
                    max-width: none;
                }
                .profile-completion-modal .btn-primary {
                    width: 100%;
                    justify-content: center;
                }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(modal);

        // Event listeners - Usar event delegation para mayor confiabilidad
        modal.addEventListener('click', (e) => {
            console.log('🔍 Click detectado en modal:', e.target);
            
            // Verificar si es el botón o un elemento dentro del botón
            if (e.target.id === 'completeProfileBtn' || 
                e.target.closest('#completeProfileBtn') || 
                e.target.classList.contains('btn-primary') ||
                e.target.closest('.btn-primary')) {
                
                e.preventDefault();
                e.stopPropagation();
                console.log('✅ Botón de completar perfil clickeado - Redirigiendo...');
                
                // Cerrar modal primero
                this.closeProfileModal(modal, style);
                
                // Redirigir después de un pequeño delay
                setTimeout(() => {
                    window.location.href = 'profile-complete.html';
                }, 100);
            }
        });
        
        // También agregar event listener directo como backup
        setTimeout(() => {
            const completeBtn = document.getElementById('completeProfileBtn');
            if (completeBtn) {
                console.log('✅ Agregando event listener directo al botón');
                completeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('✅ Botón clickeado directamente - Redirigiendo...');
                    this.closeProfileModal(modal, style);
                    setTimeout(() => {
                        window.location.href = 'profile-complete.html';
                    }, 100);
                });
            }
        }, 100);

        // Modal persistente - no se puede cerrar con ESC o click fuera
    }
    
    closeProfileModal(modal, style) {
        try {
            if (modal && modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
            if (style && style.parentNode) {
                style.parentNode.removeChild(style);
            }
        } catch (error) {
            console.error('Error cerrando modal:', error);
        }
    }

    updateAuthUI() {
        console.log('⚙️ updateAuthUI called.');
        const authButton = document.getElementById('authButton');
        if (!authButton) {
            console.log('⚠️ authButton not found in updateAuthUI.');
            return;
        }
        
        // Limpiar onclick previo para evitar múltiples listeners
        authButton.onclick = null;

        if (this.currentUser) {
            console.log('User is signed in. Updating authButton for logout.');
            authButton.innerHTML = `<img src="${this.currentUser.profileImageUrl}" alt="${this.currentUser.name}" class="user-avatar-small"> ${this.currentUser.name}`;
            authButton.onclick = () => window.Clerk.signOut(); 
            authButton.title = 'Cerrar sesión';
        } else {
            console.log('User is signed out. Updating authButton for sign in.');
            authButton.innerHTML = '<i class="fas fa-user"></i> Iniciar Sesión';
            // El onclick ahora se maneja en setupEventListeners
            // authButton.onclick = () => this.showAuthUI(); 
            authButton.title = 'Iniciar sesión';
        }
    }

    async showAuthUI() {
        console.log('🚀 showAuthUI called.');
        
        if (!window.Clerk) {
            console.warn('❌ Clerk SDK not available. Waiting for it to load...');
            this.showNotification('Cargando sistema de autenticación...', 'info');
            
            // Intentar esperar un poco más para que Clerk se cargue
            setTimeout(() => {
                if (window.Clerk) {
                    console.log('✅ Clerk SDK now available, retrying...');
                    this.showAuthUI();
                } else {
                    console.error('❌ Clerk SDK still not available after retry');
                    this.showNotification('Error: Sistema de autenticación no disponible', 'error');
                }
            }, 2000);
            return;
        }
        
        console.log('✅ Clerk available. Opening sign-in...');
        
        try {
            // Asegurar que Clerk esté completamente cargado
            if (typeof window.Clerk.load === 'function') {
                try {
                    await window.Clerk.load();
                } catch (e) {
                    console.warn('⚠️ Clerk.load() lanzó un aviso, continuando:', e);
                }
            }
            
            // Usar openSignIn() que maneja su propio modal y evita conflictos de DOM
            if (typeof window.Clerk.openSignIn === 'function') {
                console.log('✅ Abriendo modal de sign-in con Clerk...');
                window.Clerk.openSignIn();
            } else {
                throw new Error('Clerk.openSignIn no está disponible');
            }
            
        } catch (error) {
            console.error('❌ Error opening Clerk sign-in:', error);
            this.showNotification('Error al abrir el formulario de autenticación', 'error');
        }
    }

    // ===== INICIALIZACIÓN DE LA APLICACIÓN =====
    async initializeApp() {
        try {
            this.loadSavedTheme();
            await this.initializeMapbox();
            this.setupEventListeners();
            this.initializeFirebase();
            this.initializeUnreadChatsAlert();
            this.initializeNewMessagesNotification();
            
            // Limpiar chats con IDs incorrectos al inicializar
            setTimeout(() => {
                this.cleanupInvalidChats();
            }, 2000);
            
            // Solo generar deseos de muestra si Firebase no está habilitado
            if (!CONFIG.FIREBASE.enabled) {
            this.generateSampleWishes();
            }
            
            this.renderWishesOnMap();
            
            setTimeout(() => {
                this.gemini = this.initializeGeminiClient();
                console.log('Gemini client initialized:', !!this.gemini);
            }, 1000);
            
            // La UI de autenticación se actualizará cuando Clerk se cargue y detecte el estado.
            // this.updateAuthUI(); // Eliminamos esta llamada duplicada.

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

        // Aplicar el estilo del mapa según el tema actual
        if (this.currentTheme) {
            this.updateMapStyle(this.currentTheme);
        }

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
        console.log('🔧 Setting up event listeners...');
        
        // Botones principales con verificaciones defensivas
        const floatingAvailabilityBtn = document.getElementById('floatingAvailabilityBtn');
        if (floatingAvailabilityBtn) {
            floatingAvailabilityBtn.addEventListener('click', () => this.openAvailabilityModal());
        } else {
            console.warn('⚠️ floatingAvailabilityBtn not found');
        }

        const filterBtn = document.getElementById('filterBtn');
        if (filterBtn) {
            filterBtn.addEventListener('click', () => this.openFilterModal());
        } else {
            console.warn('⚠️ filterBtn not found');
        }

        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        } else {
            console.warn('⚠️ themeToggle not found');
        }

        // Toggle del sidebar para ocultar/mostrar el menú
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => this.toggleSidebarMenu());
        } else {
            console.warn('⚠️ sidebarToggle not found');
        }

        const authButton = document.getElementById('authButton');
        if (authButton) {
            authButton.addEventListener('click', () => {
                if (this.currentUser) {
                    window.Clerk.signOut();
                } else {
                    this.showAuthUI();
                }
            });
        } else {
            console.warn('⚠️ authButton not found');
        }

        // Sidebar - Búsqueda y filtros con verificaciones defensivas
        const wishSearchInput = document.getElementById('wishSearchInput');
        if (wishSearchInput) {
            wishSearchInput.addEventListener('input', (e) => {
                console.log('Buscando deseos:', e.target.value);
                this.renderAvailableProfilesInSidebar();
                this.renderWishesOnMap();
            });
        } else {
            console.warn('⚠️ wishSearchInput not found');
        }

        const categoryFilterSidebar = document.getElementById('categoryFilterSidebar');
        if (categoryFilterSidebar) {
            categoryFilterSidebar.addEventListener('change', () => this.applySidebarFilters());
        } else {
            console.warn('⚠️ categoryFilterSidebar not found');
        }

        const priceFilterSidebar = document.getElementById('priceFilterSidebar');
        if (priceFilterSidebar) {
            priceFilterSidebar.addEventListener('input', (e) => {
                const priceValueSidebar = document.getElementById('priceValueSidebar');
                if (priceValueSidebar) {
                    priceValueSidebar.textContent = `$${e.target.value}`;
                }
            });
        } else {
            console.warn('⚠️ priceFilterSidebar not found');
        }

        const applySidebarFiltersBtn = document.getElementById('applySidebarFiltersBtn');
        if (applySidebarFiltersBtn) {
            applySidebarFiltersBtn.addEventListener('click', () => this.applySidebarFilters());
        } else {
            console.warn('⚠️ applySidebarFiltersBtn not found');
        }

        // Modales - botones de cerrar con verificaciones defensivas
        const closeCreateModal = document.getElementById('closeCreateModal');
        if (closeCreateModal) {
            closeCreateModal.addEventListener('click', () => this.closeModal('createWishModal'));
        } else {
            console.warn('⚠️ closeCreateModal not found');
        }

        const closeChatModal = document.getElementById('closeChatModal');
        if (closeChatModal) {
            closeChatModal.addEventListener('click', () => this.closeModal('privateChatModal'));
        } else {
            console.warn('⚠️ closeChatModal not found');
        }

        const closeRatingModal = document.getElementById('closeRatingModal');
        if (closeRatingModal) {
            closeRatingModal.addEventListener('click', () => this.closeModal('ratingModal'));
        } else {
            console.warn('⚠️ closeRatingModal not found');
        }

        const closeFilterModal = document.getElementById('closeFilterModal');
        if (closeFilterModal) {
            closeFilterModal.addEventListener('click', () => this.closeModal('filterModal'));
        } else {
            console.warn('⚠️ closeFilterModal not found');
        }

        // Chat con IA con verificaciones defensivas
        const sendAiMessage = document.getElementById('sendAiMessage');
        if (sendAiMessage) {
            sendAiMessage.addEventListener('click', () => this.sendAIMessage());
        } else {
            console.warn('⚠️ sendAiMessage not found');
        }

        const aiChatInput = document.getElementById('aiChatInput');
        if (aiChatInput) {
            aiChatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendAIMessage();
        });
        } else {
            console.warn('⚠️ aiChatInput not found');
        }

        // Publicar deseo con verificación defensiva
        const publishWish = document.getElementById('publishWish');
        if (publishWish) {
            publishWish.addEventListener('click', () => this.publishWish());
        } else {
            console.warn('⚠️ publishWish not found');
        }

        // Tarjeta de detalles del deseo (botones de acción) con verificaciones defensivas
        const acceptWishBtnCard = document.getElementById('acceptWishBtnCard');
        if (acceptWishBtnCard) {
            acceptWishBtnCard.addEventListener('click', () => this.acceptWishFromCard());
        } else {
            console.warn('⚠️ acceptWishBtnCard not found');
        }

        const viewChatBtnCard = document.getElementById('viewChatBtnCard');
        if (viewChatBtnCard) {
            viewChatBtnCard.addEventListener('click', () => this.openPrivateChatForCurrentWish());
        } else {
            console.warn('⚠️ viewChatBtnCard not found');
        }

        // Chat privado con verificaciones defensivas
        const sendPrivateMessage = document.getElementById('sendPrivateMessage');
        if (sendPrivateMessage) {
            sendPrivateMessage.addEventListener('click', () => this.sendPrivateMessage());
        } else {
            console.warn('⚠️ sendPrivateMessage not found');
        }

        const privateChatInput = document.getElementById('privateChatInput');
        if (privateChatInput) {
            privateChatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendPrivateMessage();
        });
        } else {
            console.warn('⚠️ privateChatInput not found');
        }

        // Completar deseo con verificación defensiva
        const completeWishBtn = document.getElementById('completeWishBtn');
        if (completeWishBtn) {
            completeWishBtn.addEventListener('click', () => this.completeWish());
        } else {
            console.warn('⚠️ completeWishBtn not found');
        }

        // Calificación con verificaciones defensivas
        const fulfilledBtn = document.getElementById('fulfilledBtn');
        if (fulfilledBtn) {
            fulfilledBtn.addEventListener('click', () => this.setFulfillmentStatus(true));
        } else {
            console.warn('⚠️ fulfilledBtn not found');
        }

        const unfulfilledBtn = document.getElementById('unfulfilledBtn');
        if (unfulfilledBtn) {
            unfulfilledBtn.addEventListener('click', () => this.setFulfillmentStatus(false));
        } else {
            console.warn('⚠️ unfulfilledBtn not found');
        }

        const submitRating = document.getElementById('submitRating');
        if (submitRating) {
            submitRating.addEventListener('click', () => this.submitRating());
        } else {
            console.warn('⚠️ submitRating not found');
        }

        // Estrellas de calificación con verificación defensiva
        const starRating = document.getElementById('starRating');
        if (starRating) {
            const stars = starRating.querySelectorAll('i');
            stars.forEach((star, index) => {
            star.addEventListener('click', () => this.setStarRating(index + 1));
            star.addEventListener('mouseenter', () => this.highlightStars(index + 1));
        });
            starRating.addEventListener('mouseleave', () => this.resetStarHighlight());
        } else {
            console.warn('⚠️ starRating not found');
        }

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
                priceFormatted: '$8',
                category: 'comida',
                location: { lat: 40.4168, lng: -3.7038 }, // Madrid
                author: { id: 'user2', name: 'María García' },
                status: 'active',
                createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
            },
            {
                id: 'wish2',
                title: 'Pasear a mi perro',
                description: 'Busco alguien que pueda pasear a mi perro Golden Retriever por 30 minutos en el parque.',
                price: 15,
                priceFormatted: '$15',
                category: 'servicios',
                location: { lat: 40.4268, lng: -3.7138 }, // Madrid (cerca)
                author: { id: 'user3', name: 'Carlos López' },
                status: 'active',
                createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000)
            },
            {
                id: 'wish3',
                title: 'Llevar paquete a correos',
                description: 'Necesito que alguien lleve un paquete pequeño a la oficina de correos más cercana.',
                price: 12,
                priceFormatted: '$12',
                category: 'servicios',
                location: { lat: 40.4068, lng: -3.6938 }, // Madrid (cerca)
                author: { id: 'user4', name: 'Ana Martínez' },
                status: 'active',
                createdAt: new Date(Date.now() - 30 * 60 * 1000)
            },
            {
                id: 'wish4',
                title: 'Comprar ingredientes para cena',
                description: 'Necesito que alguien compre los ingredientes para hacer pasta: tomates, cebolla, ajo y queso parmesano.',
                price: 20,
                priceFormatted: '$20',
                category: 'compras',
                location: { lat: 40.4368, lng: -3.7238 }, // Madrid (cerca)
                author: { id: 'user5', name: 'Roberto Silva' },
                status: 'active',
                createdAt: new Date(Date.now() - 45 * 60 * 1000)
            },
            {
                id: 'wish5',
                title: 'Dar un paseo en bicicleta',
                description: 'Busco compañía para dar un paseo en bicicleta por el centro de la ciudad este fin de semana.',
                price: 25,
                priceFormatted: '$25',
                category: 'entretenimiento',
                location: { lat: 40.3968, lng: -3.6838 }, // Madrid (cerca)
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
            .setLngLat([wish.location.lng, wish.location.lat])
            .addTo(this.map);

        // Crear popup (simple, la tarjeta flotante es para detalles)
        const popup = new mapboxgl.Popup({
            offset: 25,
            closeButton: false,
            closeOnClick: false
        }).setHTML(this.createWishPopupHTML(wish)); // Cambiado de createStorePopupHTML a createWishPopupHTML

        marker.setPopup(popup);

        // Evento de clic en el marcador para mostrar detalles del perfil
        markerElement.addEventListener('click', () => {
            this.showProfileDetails(wish); // Mostrar detalles del perfil en modal tipo Tinder
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

    // ===== MODAL DE DISPONIBILIDAD =====
    openAvailabilityModal() {
        this.openModal('availabilityModal');
        this.setupAvailabilityModal();
    }

    setupAvailabilityModal() {
        // Prevenir múltiples event listeners
        if (this.availabilityModalSetup) {
            console.log('Modal de disponibilidad ya configurado');
            return;
        }
        this.availabilityModalSetup = true;

        const toggle = document.getElementById('availabilityToggle');
        const categorySelection = document.getElementById('categorySelection');
        const categoryCards = document.querySelectorAll('.category-card');
        const saveBtn = document.getElementById('saveAvailability');

        // Verificar si el usuario ya está disponible
        this.checkCurrentAvailabilityStatus();

        // Manejar toggle de disponibilidad
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    categorySelection.style.display = 'block';
                } else {
                    categorySelection.style.display = 'none';
                }
            });
        }

        // Manejar selección de categorías
        categoryCards.forEach(card => {
            card.addEventListener('click', () => {
                // Remover selección anterior
                categoryCards.forEach(c => c.classList.remove('selected'));
                // Seleccionar nueva categoría
                card.classList.add('selected');
            });
        });

        // Manejar botón guardar
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveAvailabilityStatus();
            });
        }

        // Manejar cancelar
        const cancelBtn = document.getElementById('cancelAvailability');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeModal('availabilityModal');
            });
        }
    }

    // ===== NUEVA FUNCIÓN UNIFICADA PARA GUARDAR DISPONIBILIDAD =====
    async saveAvailabilityStatus() {
        const saveBtn = document.getElementById('saveAvailability');
        
        // Función para restaurar el botón
        const restoreButton = () => {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Guardar';
            }
        };
        
        try {
            console.log('🔍 [DEBUG] saveAvailabilityStatus iniciado');
            
            // Verificar autenticación
            if (!this.currentUser) {
                console.log('❌ Usuario no autenticado');
                this.showAuthModal();
                restoreButton();
                return;
            }

            const toggle = document.getElementById('availabilityToggle');
            const isAvailable = toggle.checked;
            console.log('🔍 [DEBUG] Estado del switch:', isAvailable);

            // Deshabilitar botón para prevenir múltiples envíos
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
            }

            // Timeout de seguridad de 10 segundos
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('Timeout: La operación tardó demasiado'));
                }, 10000);
            });

            // Ejecutar la operación con timeout
            await Promise.race([
                isAvailable ? this.setUserAvailable() : this.setUserUnavailable(),
                timeoutPromise
            ]);

            // Cerrar modal y mostrar notificación
            this.closeModal('availabilityModal');
            const message = isAvailable ? '¡Disponibilidad marcada exitosamente!' : '¡Ya no estás disponible!';
            this.showNotification(message, 'success');

            console.log('✅ saveAvailabilityStatus completado exitosamente');

        } catch (error) {
            console.error('❌ Error guardando estado de disponibilidad:', error);
            const errorMessage = error.message.includes('Timeout') ? 
                'La operación tardó demasiado. Inténtalo de nuevo.' : 
                'Error al guardar disponibilidad';
            this.showNotification(errorMessage, 'error');
        } finally {
            // Restaurar botón siempre
            restoreButton();
        }
    }

    async setUserAvailable() {
        console.log('🔍 [DEBUG] setUserAvailable iniciado');
        
        // Verificar si ya está disponible para evitar duplicados
        const existingProfile = this.availableProfiles.find(profile => profile.userId === this.currentUser.id);
        if (existingProfile) {
            console.log('⚠️ Usuario ya está disponible');
            throw new Error('Ya estás marcado como disponible');
        }

        // Obtener datos del formulario
        const selectedCategory = document.querySelector('.category-card.selected');
        if (!selectedCategory) {
            console.log('❌ No se seleccionó categoría');
            throw new Error('Por favor selecciona una categoría');
        }

        // Crear objeto de disponibilidad
        const availabilityData = {
            userId: this.currentUser.id,
            userName: this.currentUser.name,
            userEmail: this.currentUser.email,
            userProfileImage: this.currentUser.profileImageUrl,
            category: selectedCategory.dataset.category,
            location: this.userLocation,
            isAvailable: true,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        };

        console.log('🔍 [DEBUG] Datos de disponibilidad:', availabilityData);

        // Guardar en Firebase
        const newProfileRef = await this.saveAvailabilityToFirebase(availabilityData);
        
        // Agregar localmente con el ID de Firebase
        const newProfile = {
            id: newProfileRef.key,
            ...availabilityData
        };
        this.availableProfiles.push(newProfile);
        
        // Actualizar UI inmediatamente
        this.renderAvailableProfilesOnMap();
        this.renderAvailableProfilesInSidebar();
        this.updateAvailabilityFabState();
        
        console.log('✅ setUserAvailable completado exitosamente');
    }

    async setUserUnavailable() {
        console.log('🔍 [DEBUG] setUserUnavailable iniciado');
        
        // Buscar el perfil del usuario en la lista de disponibles
        const existingProfile = this.availableProfiles.find(profile => profile.userId === this.currentUser.id);
        if (!existingProfile) {
            console.log('⚠️ Usuario no está marcado como disponible');
            throw new Error('No estás marcado como disponible');
        }

        console.log('🔍 [DEBUG] Perfil encontrado para eliminar:', existingProfile.id);

        // Eliminar de Firebase
        await this.removeAvailabilityFromFirebase(existingProfile.id);

        // Eliminar localmente también
        const localIndex = this.availableProfiles.findIndex(profile => profile.userId === this.currentUser.id);
        if (localIndex !== -1) {
            this.availableProfiles.splice(localIndex, 1);
            console.log('✅ Perfil eliminado localmente');
        }

        // Actualizar UI inmediatamente
        this.renderAvailableProfilesOnMap();
        this.renderAvailableProfilesInSidebar();
        this.updateAvailabilityFabState();
        
        console.log('✅ setUserUnavailable completado exitosamente');
    }

    async submitAvailability() {
        // Esta función se mantiene para compatibilidad pero ahora redirige a la nueva función
        console.log('⚠️ submitAvailability está deprecado, usando saveAvailabilityStatus');
        await this.saveAvailabilityStatus();
    }

    async saveAvailabilityToFirebase(availabilityData) {
        try {
            if (!this.database) {
                throw new Error('Firebase no disponible');
            }

            // Guardar en la colección de perfiles disponibles
            const availabilityRef = this.database.ref('availableProfiles').push();
            await availabilityRef.set(availabilityData);

            console.log('✅ Disponibilidad guardada en Firebase');
            return availabilityRef;
        } catch (error) {
            console.error('❌ Error guardando disponibilidad:', error);
            throw error;
        }
    }

    // ===== FUNCIONES PARA MANEJAR DISPONIBILIDAD =====
    checkCurrentAvailabilityStatus() {
        if (!this.currentUser) return;

        const existingProfile = this.availableProfiles.find(profile => profile.userId === this.currentUser.id);
        const toggle = document.getElementById('availabilityToggle');
        const categorySelection = document.getElementById('categorySelection');

        if (existingProfile) {
            // Usuario ya está disponible
            console.log('🔍 [DEBUG] Usuario ya está disponible, configurando UI');
            toggle.checked = true;
            categorySelection.style.display = 'block';
            
            // Preseleccionar la categoría actual si existe
            const currentCategory = existingProfile.category;
            if (currentCategory) {
                const categoryCard = document.querySelector(`[data-category="${currentCategory}"]`);
                if (categoryCard) {
                    // Remover selección anterior
                    document.querySelectorAll('.category-card').forEach(c => c.classList.remove('selected'));
                    // Seleccionar categoría actual
                    categoryCard.classList.add('selected');
                }
            }
        } else {
            // Usuario no está disponible
            console.log('🔍 [DEBUG] Usuario no está disponible, configurando UI');
            toggle.checked = false;
            categorySelection.style.display = 'none';
        }
    }

    async markAsUnavailable() {
        try {
            console.log('🔍 [DEBUG] Iniciando markAsUnavailable...');
            
            if (!this.currentUser) {
                console.log('❌ Usuario no autenticado');
                this.showAuthModal();
                return;
            }

            console.log('🔍 [DEBUG] Usuario actual:', this.currentUser.id);
            console.log('🔍 [DEBUG] Perfiles disponibles actuales:', this.availableProfiles.length);

            // Buscar el perfil del usuario en la lista de disponibles
            const existingProfile = this.availableProfiles.find(profile => profile.userId === this.currentUser.id);
            console.log('🔍 [DEBUG] Perfil existente encontrado:', existingProfile);
            
            if (!existingProfile) {
                console.log('❌ No se encontró perfil disponible');
                this.showNotification('No estás marcado como disponible', 'warning');
                return;
            }

            console.log('🔍 [DEBUG] ID del perfil a eliminar:', existingProfile.id);

            // Deshabilitar botón para prevenir múltiples clics
            const markUnavailableBtn = document.getElementById('markUnavailable');
            if (markUnavailableBtn) {
                markUnavailableBtn.disabled = true;
                markUnavailableBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
            }

            // Eliminar de Firebase
            console.log('🔍 [DEBUG] Eliminando de Firebase...');
            await this.removeAvailabilityFromFirebase(existingProfile.id);

            // Eliminar localmente también
            console.log('🔍 [DEBUG] Eliminando localmente...');
            const localIndex = this.availableProfiles.findIndex(profile => profile.userId === this.currentUser.id);
            if (localIndex !== -1) {
                this.availableProfiles.splice(localIndex, 1);
                console.log('✅ Perfil eliminado localmente');
            }

            // Actualizar UI inmediatamente
            this.renderAvailableProfilesOnMap();
            this.renderAvailableProfilesInSidebar();

            // Cerrar modal y mostrar notificación
            this.closeModal('availabilityModal');
            this.showNotification('¡Ya no estás disponible!', 'success');

            console.log('✅ markAsUnavailable completado exitosamente');

        } catch (error) {
            console.error('❌ Error marcándose como no disponible:', error);
            this.showNotification('Error al actualizar disponibilidad', 'error');
            
            // Restaurar botón en caso de error
            const markUnavailableBtn = document.getElementById('markUnavailable');
            if (markUnavailableBtn) {
                markUnavailableBtn.disabled = false;
                markUnavailableBtn.innerHTML = '<i class="fas fa-times"></i> No Disponible';
            }
        }
    }

    async removeAvailabilityFromFirebase(profileId) {
        try {
            console.log('🔍 [DEBUG] removeAvailabilityFromFirebase iniciado');
            console.log('🔍 [DEBUG] profileId:', profileId);
            
            if (!this.database) {
                console.log('❌ Firebase no disponible');
                throw new Error('Firebase no disponible');
            }

            console.log('🔍 [DEBUG] Firebase disponible, procediendo a eliminar...');

            // Eliminar de la colección de perfiles disponibles
            const profileRef = this.database.ref(`availableProfiles/${profileId}`);
            console.log('🔍 [DEBUG] Referencia creada:', profileRef.toString());
            
            await profileRef.remove();
            console.log('✅ Disponibilidad eliminada de Firebase exitosamente');
            
        } catch (error) {
            console.error('❌ Error eliminando disponibilidad:', error);
            console.error('🔍 [DEBUG] Error details:', error.message);
            console.error('🔍 [DEBUG] Error code:', error.code);
            throw error;
        }
    }

    // ===== CARGAR PERFILES DISPONIBLES =====
    async loadAvailableProfiles() {
        try {
            console.log('🔍 [DEBUG] loadAvailableProfiles iniciado');
            
            if (!this.database) {
                console.warn('Firebase no disponible para cargar perfiles');
                return;
            }

            // Limpiar array antes de cargar
            this.availableProfiles = [];
            console.log('🧹 Array de perfiles limpiado antes de cargar');

            console.log('🔍 Cargando perfiles disponibles...');
            
            const profilesRef = this.database.ref('availableProfiles');
            const snapshot = await profilesRef.once('value');
            const profilesData = snapshot.val();

            console.log('🔍 [DEBUG] Datos de Firebase:', profilesData);

            if (profilesData) {
                // Convertir a array y agregar IDs
                const profilesArray = Object.keys(profilesData).map(key => ({
                    id: key,
                    ...profilesData[key]
                }));
                
                console.log('🔍 [DEBUG] Perfiles con IDs:', profilesArray);
                
                // Filtrar solo los disponibles
                const availableProfiles = profilesArray.filter(profile => profile.isAvailable);
                console.log(`✅ ${availableProfiles.length} perfiles disponibles cargados`);
                
                // Limpiar duplicados por userId
                const uniqueProfiles = availableProfiles.reduce((acc, profile) => {
                    if (!acc.find(p => p.userId === profile.userId)) {
                        acc.push(profile);
                    } else {
                        console.log('⚠️ Duplicado encontrado y eliminado:', profile.userName, 'userId:', profile.userId);
                    }
                    return acc;
                }, []);
                
                this.availableProfiles = uniqueProfiles;
                console.log(`🧹 Después de limpiar duplicados: ${this.availableProfiles.length} perfiles únicos`);
                
                // Debug: Mostrar detalles de cada perfil
                this.availableProfiles.forEach((profile, index) => {
                    console.log(`🔍 Perfil ${index + 1}:`, {
                        id: profile.id,
                        userId: profile.userId,
                        userName: profile.userName,
                        category: profile.category,
                        isAvailable: profile.isAvailable
                    });
                });
                
                this.renderAvailableProfilesOnMap();
                this.renderAvailableProfilesInSidebar();
                this.updateAvailabilityFabState();
            } else {
                console.log('No hay perfiles disponibles');
                this.availableProfiles = [];
                this.renderAvailableProfilesOnMap();
                this.renderAvailableProfilesInSidebar();
                this.updateAvailabilityFabState();
            }

        } catch (error) {
            console.error('❌ Error cargando perfiles disponibles:', error);
        }
    }

    async renderAvailableProfilesOnMap() {
        // Limpiar marcadores existentes
        this.clearProfileMarkers();

        // Crear marcadores para cada perfil disponible
        for (const profile of this.availableProfiles) {
            if (profile.location && profile.location.lat && profile.location.lng) {
                await this.createProfileMarker(profile);
            }
        }

        // Actualizar estado visual del FAB según disponibilidad del usuario
        this.updateAvailabilityFabState();
    }

    async createProfileMarker(profile) {
        // Obtener datos completos del perfil desde Firebase (con cache) - misma lógica que navbar
        let userProfile = this.userProfilesCache && this.userProfilesCache[profile.userId] ? this.userProfilesCache[profile.userId] : null;
        if (!userProfile && this.database) {
            try {
                const userRef = this.database.ref(`users/${profile.userId}/profile`);
                const snapshot = await userRef.once('value');
                userProfile = snapshot.val();
                if (!userProfile) {
                    const userRootRef = this.database.ref(`users/${profile.userId}`);
                    const userRootSnapshot = await userRootRef.once('value');
                    userProfile = userRootSnapshot.val();
                }
                if (userProfile && this.userProfilesCache) {
                    this.userProfilesCache[profile.userId] = userProfile;
                }
            } catch (error) {
                console.warn('Error fetching profile for marker:', error);
            }
        }

        // Normalizar datos: soportar posibles nombres alternativos - misma lógica que navbar
        const nickname = userProfile?.nickname || userProfile?.alias || userProfile?.apodo || profile.userName || 'Usuario';
        
        // Procesar foto principal: usar la misma lógica que en navbar
        let mainPhoto = profile.userProfileImage;
        if (userProfile) {
            const photos = Array.isArray(userProfile.photos) ? userProfile.photos : (Array.isArray(userProfile.fotos) ? userProfile.fotos : []);
            if (photos.length > 0) {
                const toImageSrc = (input) => {
                    if (!input) return null;
                    let value = input;
                    if (typeof input === 'object') {
                        if (typeof input.url === 'string') value = input.url;
                        else if (typeof input.src === 'string') value = input.src;
                        else if (typeof input.base64 === 'string') value = input.base64;
                        else if (Array.isArray(input) && input.length > 0) value = input[0];
                        else return null;
                    }
                    if (typeof value !== 'string') return null;
                    if (value.startsWith('data:image/')) return value;
                    if (value.startsWith('http') || value.startsWith('https')) return value;
                    if (value.length > 100 && !value.includes('http')) return `data:image/jpeg;base64,${value}`;
                    return null;
                };
                const processed = photos.map(toImageSrc).filter((src) => typeof src === 'string' && src.length > 0);
                if (processed.length > 0) mainPhoto = processed[0];
            }
        }
        
        // Asegurar que la imagen sea consistente con la del navbar
        if (!mainPhoto) {
            mainPhoto = 'https://www.gravatar.com/avatar/?d=mp&f=y';
        }

        // Crear elemento personalizado para el marcador
        const markerElement = document.createElement('div');
        markerElement.className = 'custom-profile-marker';
        markerElement.innerHTML = `
            <div class="marker-container">
                <img src="${mainPhoto}" 
                     alt="${nickname}" class="marker-avatar">
                <div class="marker-alias">${nickname}</div>
                <div class="marker-category">${this.getCategoryName(profile.category)}</div>
            </div>
        `;

        const marker = new mapboxgl.Marker(markerElement)
        .setLngLat([profile.location.lng, profile.location.lat])
        .addTo(this.map);

        // Agregar ID del perfil al marcador para referencia
        marker.profileId = profile.id;

        // Evento click para mostrar detalles
        markerElement.addEventListener('click', () => {
            this.showProfileDetails(profile);
        });

        this.profileMarkers.push(marker);
    }

    getCategoryColor(category) {
        const colors = {
            'escort': '#e91e63',
            'gigolo': '#2196f3',
            'masajes': '#4caf50',
            'trans': '#9c27b0',
            'chat': '#ff9800',
            'live': '#f44336'
        };
        return colors[category] || '#60c48e';
    }

    getCategoryName(category) {
        const names = {
            'escort': 'Escort',
            'gigolo': 'Gigolo',
            'masajes': 'Masajes',
            'trans': 'Trans',
            'chat': 'Chat',
            'live': 'Live'
        };
        return names[category] || category;
    }

    // ===== Actualizar estado visual del botón flotante de disponibilidad =====
    updateAvailabilityFabState() {
        const btn = document.getElementById('floatingAvailabilityBtn');
        if (!btn) return;
        const isAvailable = !!(this.currentUser && this.availableProfiles && this.availableProfiles.some(p => p.userId === this.currentUser.id));
        btn.classList.toggle('available', isAvailable);
        const icon = btn.querySelector('i');
        if (icon) icon.className = 'fas fa-power-off';
        btn.title = isAvailable ? 'Disponible (clic para cambiar)' : 'No disponible (clic para cambiar)';
    }

    clearProfileMarkers() {
        this.profileMarkers.forEach(marker => marker.remove());
        this.profileMarkers = [];
    }

    async updateProfileMarker(profile) {
        const existingMarker = this.profileMarkers.find(marker => marker.profileId === profile.id);
        if (existingMarker) {
            existingMarker.remove();
            const index = this.profileMarkers.indexOf(existingMarker);
            this.profileMarkers.splice(index, 1);
        }
        await this.createProfileMarker(profile);
    }

    removeProfileMarker(profileId) {
        const marker = this.profileMarkers.find(m => m.profileId === profileId);
        if (marker) {
            marker.remove();
            const index = this.profileMarkers.indexOf(marker);
            this.profileMarkers.splice(index, 1);
        }
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

    // ===== MODAL TIPO TINDER PARA PERFILES =====
    async showProfileDetails(profile) {
        if (!profile) return;

        console.log('🎯 showProfileDetails llamado con:', profile);

        // Verificar si el usuario está autenticado
        if (!this.currentUser) {
            console.log('Usuario no autenticado - mostrando modal de autenticación');
            this.showAuthModal();
            return;
        }

        // Obtener datos completos del usuario desde Firebase (con cache)
        let userProfile = this.userProfilesCache && this.userProfilesCache[profile.userId] ? this.userProfilesCache[profile.userId] : null;
        try {
            if (!userProfile && this.database) {
                console.log('🔍 Buscando perfil del usuario:', profile.userId);
                // Buscar en users/{userId}/profile donde se guarda el perfil completo
                const userRef = this.database.ref(`users/${profile.userId}/profile`);
                const snapshot = await userRef.once('value');
                userProfile = snapshot.val();
                console.log('📊 Datos obtenidos de Firebase (users/{userId}/profile):', userProfile);
                
                // Si no se encuentra en /profile, intentar en la raíz del usuario
                if (!userProfile) {
                    console.log('🔍 No se encontró en /profile, buscando en users/{userId}');
                    const userRootRef = this.database.ref(`users/${profile.userId}`);
                    const userRootSnapshot = await userRootRef.once('value');
                    userProfile = userRootSnapshot.val();
                    console.log('📊 Datos obtenidos de Firebase (users/{userId}):', userProfile);
                }
                // Guardar en cache
                if (userProfile && this.userProfilesCache) {
                    this.userProfilesCache[profile.userId] = userProfile;
                }
            } else {
                console.warn('⚠️ Firebase database no disponible');
            }
        } catch (error) {
            console.error('❌ Error obteniendo perfil del usuario:', error);
        }

        // Normalizar datos: soportar posibles nombres alternativos según data.json
        const nickname = userProfile?.nickname || userProfile?.alias || userProfile?.apodo || profile.userName || 'Usuario';
        const description = userProfile?.description || userProfile?.descripcion || 'Descripción no disponible';
        const age = userProfile?.age || userProfile?.edad || 'No especificada';
        
        // Procesar fotos: verificar si son base64 o URLs
        let photos = [];
        if (Array.isArray(userProfile?.photos) && userProfile.photos.length > 0) {
            photos = userProfile.photos;
        } else if (Array.isArray(userProfile?.fotos) && userProfile.fotos.length > 0) {
            photos = userProfile.fotos;
        } else if (profile.userProfileImage) {
            photos = [profile.userProfileImage];
        }
        
        // Convertir fotos a formato correcto (base64 o URL)
        const toImageSrc = (input) => {
            if (!input) return null;
            let value = input;
            // Manejar objetos comunes { url, src, base64 }
            if (typeof input === 'object') {
                if (typeof input.url === 'string') value = input.url;
                else if (typeof input.src === 'string') value = input.src;
                else if (typeof input.base64 === 'string') value = input.base64;
                else if (Array.isArray(input) && input.length > 0) value = input[0];
                else return null;
            }
            if (typeof value !== 'string') return null;
            // Si ya es base64, usarlo directamente
            if (value.startsWith('data:image/')) return value;
            // Si es URL, usarla directamente
            if (value.startsWith('http') || value.startsWith('https')) return value;
            // Si parece base64 sin prefijo, agregarlo
            if (value.length > 100 && !value.includes('http')) return `data:image/jpeg;base64,${value}`;
            return null;
        };

        const processedPhotos = photos
            .map(toImageSrc)
            .filter((src) => typeof src === 'string' && src.length > 0);
        
        const favoritePoses = Array.isArray(userProfile?.sexualPoses) && userProfile.sexualPoses.length > 0
            ? userProfile.sexualPoses
            : (Array.isArray(userProfile?.favoritePoses) ? userProfile.favoritePoses : (Array.isArray(userProfile?.poses) ? userProfile.poses : (Array.isArray(userProfile?.posesFavoritas) ? userProfile.posesFavoritas : [])));

        console.log('🔧 Datos normalizados:', {
            nickname,
            description,
            age,
            processedPhotos,
            favoritePoses
        });

        const displayProfile = {
            ...profile,
            userName: nickname,
            userProfileImage: processedPhotos[0] || profile.userProfileImage,
            description,
            age,
            favoritePoses,
            photos: processedPhotos
        };

        console.log('🎯 Perfil final para mostrar:', displayProfile);

        // Crear modal tipo Tinder
        const modal = document.createElement('div');
        modal.className = 'tinder-profile-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content tinder-card">
                    <div class="tinder-header">
                        <button class="close-btn" onclick="this.closest('.tinder-profile-modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="tinder-photos">
                        <img src="${displayProfile.userProfileImage || 'https://www.gravatar.com/avatar/?d=mp&f=y'}" 
                             alt="${displayProfile.userName}" class="main-photo" id="tinderMainPhoto">
                        ${displayProfile.photos && displayProfile.photos.length > 1 ? `
                        <div class="photo-nav">
                            <button class="nav-btn prev" id="tinderPrevPhoto"><i class="fas fa-chevron-left"></i></button>
                            <button class="nav-btn next" id="tinderNextPhoto"><i class="fas fa-chevron-right"></i></button>
                        </div>
                        ` : ''}
                        ${displayProfile.photos && displayProfile.photos.length > 1 ? `
                        <div class="thumbs">
                            ${displayProfile.photos.slice(0, 6).map((p, idx) => `
                                <img src="${p}" alt="foto ${idx+1}" class="thumb ${idx===0 ? 'active' : ''}" data-src="${p}">
                            `).join('')}
                        </div>
                        ` : ''}
                    </div>
                    <div class="tinder-info">
                        <div class="profile-name">
                            <h2>${displayProfile.userName || 'Usuario'}</h2>
                            <span class="category-badge ${displayProfile.category}">${this.getCategoryName(displayProfile.category)}</span>
                        </div>
                        <div class="profile-details">
                            <p class="profile-description">${displayProfile.description}</p>
                            <div class="profile-stats">
                                <div class="stat-item">
                                    <i class="fas fa-map-marker-alt"></i>
                                    <span>Ubicación cercana</span>
                                </div>
                                <div class="stat-item">
                                    <i class="fas fa-clock"></i>
                                    <span>Disponible ahora</span>
                                </div>
                                <div class="stat-item">
                                    <i class="fas fa-birthday-cake"></i>
                                    <span>Edad: ${displayProfile.age}</span>
                                </div>
                                <div class="stat-item">
                                    <i class="fas fa-tag"></i>
                                    <span>${this.getCategoryName(displayProfile.category)}</span>
                                </div>
                            </div>
                            ${displayProfile.favoritePoses && displayProfile.favoritePoses.length > 0 ? `
                                <div class="favorite-poses">
                                    <h4><i class="fas fa-heart"></i> Poses Favoritas</h4>
                                    <div class="poses-tags">
                                        ${displayProfile.favoritePoses.map(pose => `<span class="pose-tag">${this.getSexualPoseName(pose)}</span>`).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="tinder-actions">
                        <button class="action-btn pass-btn" onclick="this.closest('.tinder-profile-modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                        <button class="action-btn contact-btn" onclick="window.deseoApp.contactProfile('${profile.userId}')">
                            <i class="fas fa-comment"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Agregar estilos
        const style = document.createElement('style');
        style.textContent = `
            .tinder-profile-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: modalFadeIn 0.3s ease;
                background: rgba(0, 0, 0, 0.8);
            }
            .tinder-card {
                width: 90%;
                max-width: 420px;
                height: 85vh;
                background: var(--background-secondary);
                border-radius: 24px;
                overflow: hidden;
                position: relative;
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.4);
                display: flex;
                flex-direction: column;
            }
            .tinder-header {
                position: absolute;
                top: 16px;
                right: 16px;
                z-index: 10;
            }
            .tinder-header .close-btn {
                background: rgba(0, 0, 0, 0.6);
                border: none;
                color: white;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 1.3rem;
                transition: all 0.2s ease;
            }
            .tinder-header .close-btn:hover {
                background: rgba(0, 0, 0, 0.8);
                transform: scale(1.1);
            }
            .tinder-photos {
                height: 55%;
                position: relative;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            .main-photo {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .thumbs {
                position: absolute;
                bottom: 12px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                gap: 8px;
                padding: 8px 12px;
                background: rgba(0,0,0,0.4);
                border-radius: 16px;
                max-width: 90%;
                overflow-x: auto;
                backdrop-filter: blur(10px);
            }
            .thumbs .thumb {
                width: 52px;
                height: 52px;
                border-radius: 10px;
                object-fit: cover;
                cursor: pointer;
                border: 3px solid transparent;
                transition: all 0.2s ease;
            }
            .thumbs .thumb.active {
                border-color: var(--primary-color);
                transform: scale(1.05);
            }
            .photo-nav {
                position: absolute;
                top: 50%;
                left: 0;
                right: 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0 12px;
                transform: translateY(-50%);
                pointer-events: none;
            }
            .photo-nav .nav-btn {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: none;
                background: rgba(0,0,0,0.5);
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                pointer-events: auto;
                transition: all 0.2s ease;
                font-size: 1.1rem;
            }
            .photo-nav .nav-btn:hover {
                background: rgba(0,0,0,0.7);
                transform: scale(1.1);
            }
            .tinder-info {
                padding: 24px;
                height: 45%;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                background: var(--background-secondary);
            }
            .profile-name {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 16px;
            }
            .profile-name h2 {
                color: var(--text-primary);
                font-size: 1.6rem;
                margin: 0;
                font-weight: 700;
            }
            .category-badge {
                padding: 6px 14px;
                border-radius: 24px;
                font-size: 0.85rem;
                font-weight: 600;
                color: white;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .category-badge.escort { background: linear-gradient(135deg, #e91e63, #c2185b); }
            .category-badge.gigolo { background: linear-gradient(135deg, #2196f3, #1976d2); }
            .category-badge.masajes { background: linear-gradient(135deg, #4caf50, #388e3c); }
            .category-badge.trans { background: linear-gradient(135deg, #9c27b0, #7b1fa2); }
            .category-badge.chat { background: linear-gradient(135deg, #ff9800, #f57c00); }
            .category-badge.live { background: linear-gradient(135deg, #f44336, #d32f2f); }
            .category-badge.comida { background: linear-gradient(135deg, #ff5722, #e64a19); }
            .category-badge.servicios { background: linear-gradient(135deg, #607d8b, #455a64); }
            .category-badge.compras { background: linear-gradient(135deg, #795548, #5d4037); }
            .category-badge.transporte { background: linear-gradient(135deg, #3f51b5, #303f9f); }
            .category-badge.entretenimiento { background: linear-gradient(135deg, #9c27b0, #7b1fa2); }
            .profile-description {
                color: var(--text-secondary);
                line-height: 1.6;
                margin-bottom: 20px;
                font-size: 1rem;
            }
            .profile-stats {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
                margin-bottom: 20px;
            }
            .stat-item {
                display: flex;
                align-items: center;
                gap: 10px;
                color: var(--text-secondary);
                font-size: 0.9rem;
                padding: 8px 12px;
                background: var(--background-tertiary);
                border-radius: 12px;
            }
            .stat-item i {
                color: var(--primary-color);
                width: 18px;
                font-size: 1rem;
            }
            .tinder-actions {
                display: flex;
                justify-content: center;
                gap: 24px;
                padding: 20px 0 0 0;
                border-top: 1px solid var(--border-color);
            }
            .action-btn {
                width: 64px;
                height: 64px;
                border-radius: 50%;
                border: none;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.6rem;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            }
            .action-btn:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
            }
            .pass-btn {
                background: linear-gradient(135deg, #ff4757, #ff3742);
                color: white;
            }
            .contact-btn {
                background: linear-gradient(135deg, #10b981, #059669);
                color: white;
                box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
            }
            .contact-btn:hover {
                background: linear-gradient(135deg, #059669, #047857);
                transform: translateY(-2px);
                box-shadow: 0 6px 12px rgba(16, 185, 129, 0.4);
            }
            .favorite-poses {
                margin-top: 16px;
            }
            .favorite-poses h4 {
                color: var(--text-primary);
                font-size: 1rem;
                margin-bottom: 10px;
                font-weight: 600;
            }
            .poses-tags {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            .pose-tag {
                background: linear-gradient(135deg, #10b981, #059669);
                color: white;
                padding: 6px 12px;
                border-radius: 16px;
                font-size: 0.8rem;
                font-weight: 500;
                box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
            }
            @keyframes modalFadeIn {
                from {
                    opacity: 0;
                    transform: scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(modal);

        // Interacciones de fotos: thumbs, prev/next, gestos
        try {
            const mainPhotoEl = modal.querySelector('#tinderMainPhoto');
            const thumbEls = Array.from(modal.querySelectorAll('.thumbs .thumb'));
            let currentIndex = 0;

            const setActiveIndex = (idx) => {
                if (!displayProfile.photos || displayProfile.photos.length === 0) return;
                currentIndex = (idx + displayProfile.photos.length) % displayProfile.photos.length;
                const src = displayProfile.photos[currentIndex];
                if (mainPhotoEl && typeof src === 'string') {
                    mainPhotoEl.src = src;
                }
                thumbEls.forEach((t, i) => t.classList.toggle('active', i === currentIndex));
            };

            thumbEls.forEach((thumb, idx) => {
                thumb.addEventListener('click', (e) => {
                    e.stopPropagation();
                    setActiveIndex(idx);
                });
            });

            const prevBtn = modal.querySelector('#tinderPrevPhoto');
            const nextBtn = modal.querySelector('#tinderNextPhoto');
            if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); setActiveIndex(currentIndex - 1); });
            if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); setActiveIndex(currentIndex + 1); });

            let startX = 0;
            let isTouching = false;
            const onTouchStart = (e) => { isTouching = true; startX = e.touches ? e.touches[0].clientX : e.clientX; };
            const onTouchEnd = (e) => {
                if (!isTouching) return;
                const endX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
                const delta = endX - startX;
                if (Math.abs(delta) > 40) {
                    if (delta < 0) setActiveIndex(currentIndex + 1); else setActiveIndex(currentIndex - 1);
                }
                isTouching = false;
            };
            if (mainPhotoEl) {
                mainPhotoEl.addEventListener('touchstart', onTouchStart, { passive: true });
                mainPhotoEl.addEventListener('touchend', onTouchEnd);
                mainPhotoEl.addEventListener('mousedown', onTouchStart);
                mainPhotoEl.addEventListener('mouseup', onTouchEnd);
            }
            setActiveIndex(0);
        } catch (err) { console.warn('Photo interactions init failed:', err); }
    }

    async contactProfile(userId) {
        console.log('Contactando usuario:', userId);
        
        try {
            // Verificar que el usuario esté autenticado
            if (!this.currentUser || !this.currentUser.id) {
                this.showNotification('Debes iniciar sesión para contactar usuarios', 'error');
                return;
            }

            // No permitir contactarse a sí mismo
            if (userId === this.currentUser.id) {
                this.showNotification('No puedes contactarte a ti mismo', 'error');
                return;
            }

            // Crear o obtener ID del chat
            const chatId = await this.createOrGetChat(userId);
            
            // LÓGICA CORREGIDA:
            // El usuario actual (que presiona "Contactar") es el CLIENTE
            // El usuario contactado (que está en el mapa) es el PROVEEDOR
            // Por lo tanto, el usuario actual va a chat-client.html
            // Y el usuario contactado debe ir a chat-provider.html cuando abra el chat
            
            window.location.href = `chat-client.html?chatId=${chatId}&userId=${userId}`;

        } catch (error) {
            console.error('❌ Error contactando usuario:', error);
            this.showNotification('Error al contactar usuario', 'error');
        }
    }

    async createOrGetChat(userId) {
        if (!this.database) {
            throw new Error('Firebase no inicializado');
        }

        // Validar que tenemos los IDs necesarios
        if (!this.currentUser || !this.currentUser.id) {
            throw new Error('Usuario actual no válido');
        }
        
        if (!userId) {
            throw new Error('ID de usuario contactado no válido');
        }

        console.log('🔍 [DEBUG] currentUser.id:', this.currentUser.id);
        console.log('🔍 [DEBUG] userId:', userId);

        // Crear ID único para el chat usando strings para evitar NaN
        const currentUserId = String(this.currentUser.id);
        const contactUserId = String(userId);
        
        // Ordenar IDs para crear un ID único consistente
        const sortedIds = [currentUserId, contactUserId].sort();
        const chatId = `chat_${sortedIds[0]}_${sortedIds[1]}`;
        
        console.log('🔍 [DEBUG] chatId generado:', chatId);
        
        try {
            // Verificar si el chat ya existe
            const chatRef = this.database.ref(`chats/${chatId}`);
            const snapshot = await chatRef.once('value');
            
            if (!snapshot.exists()) {
                console.log('📝 Creando nuevo chat:', chatId);
                
                // Obtener información del usuario contactado
                let contactUserInfo = {
                    id: contactUserId,
                    name: 'Usuario',
                    type: 'contacted'
                };
                
                try {
                    const userRef = this.database.ref(`users/${contactUserId}`);
                    const userSnapshot = await userRef.once('value');
                    const userData = userSnapshot.val();
                    
                    if (userData && userData.name) {
                        contactUserInfo.name = userData.name;
                    }
                } catch (error) {
                    console.warn('⚠️ No se pudo obtener información del usuario contactado:', error);
                }
                
                // Crear nuevo chat
                const chatData = {
                    id: chatId,
                    participants: {
                        [currentUserId]: {
                            id: currentUserId,
                            name: this.currentUser.name || 'Usuario',
                            role: 'client', // Quien presiona "Contactar" es el CLIENTE
                            type: 'contacting'
                        },
                        [contactUserId]: {
                            ...contactUserInfo,
                            role: 'provider' // Quien es contactado es el PROVEEDOR
                        }
                    },
                    createdAt: new Date().toISOString(),
                    lastMessage: null,
                    status: 'active'
                };
                
                await chatRef.set(chatData);
                console.log('✅ Chat creado exitosamente');
                
                // Crear mensaje inicial del sistema
                const systemMessage = {
                    id: `msg_${Date.now()}`,
                    senderId: 'system',
                    senderName: 'Sistema',
                    message: `Chat iniciado entre ${this.currentUser.name || 'Usuario'} y ${contactUserInfo.name}.`,
                    timestamp: new Date().toISOString(),
                    type: 'system'
                };
                
                await chatRef.child('messages').child(systemMessage.id).set(systemMessage);
                
                // Notificar al usuario contactado
                await this.notifyUserContacted(contactUserId, chatId);
            } else {
                console.log('✅ Chat existente encontrado:', chatId);
            }
            
            return chatId;
            
        } catch (error) {
            console.error('❌ Error creando/obteniendo chat:', error);
            throw error;
        }
    }

    async determineUserType(userId) {
        // LÓGICA CORREGIDA:
        // El usuario actual (que presiona "Contactar") es siempre el CLIENTE
        // El usuario contactado (que está en el mapa) es siempre el PROVEEDOR
        // Esta función ya no es necesaria, pero la mantenemos por compatibilidad
        
        try {
            // Obtener información del usuario contactado para verificar que existe
            const userRef = this.database.ref(`users/${userId}`);
            const snapshot = await userRef.once('value');
            const userData = snapshot.val();
            
            if (userData) {
                console.log('✅ Usuario contactado encontrado:', userData.name);
                // El usuario contactado es el proveedor
                return 'provider';
            } else {
                console.warn('⚠️ Usuario contactado no encontrado');
                return 'provider'; // Por defecto asumir que es proveedor
            }
        } catch (error) {
            console.error('❌ Error determinando tipo de usuario:', error);
            return 'provider'; // Por defecto asumir que es proveedor
        }
    }

    async notifyUserContacted(userId, chatId) {
        try {
            // Crear notificación para el usuario contactado
            const notificationRef = this.database.ref(`notifications/${userId}`);
            const notification = {
                id: `notif_${Date.now()}`,
                type: 'chat_request',
                title: 'Nuevo contacto',
                message: `${this.currentUser.name} quiere contactarte`,
                chatId: chatId,
                senderId: this.currentUser.id,
                senderName: this.currentUser.name,
                timestamp: new Date().toISOString(),
                read: false
            };
            
            await notificationRef.push().set(notification);
            
            console.log('✅ Notificación enviada al usuario contactado');
            
        } catch (error) {
            console.error('❌ Error enviando notificación:', error);
        }
    }

    // Función para limpiar chats con IDs incorrectos (NaN)
    async cleanupInvalidChats() {
        if (!this.database) return;

        try {
            console.log('🧹 Limpiando chats con IDs incorrectos...');
            
            const chatsRef = this.database.ref('chats');
            const snapshot = await chatsRef.once('value');
            const chatsData = snapshot.val();
            
            if (chatsData) {
                const invalidChats = Object.keys(chatsData).filter(chatId => 
                    chatId.includes('NaN') || chatId.includes('undefined') || chatId.includes('null')
                );
                
                console.log(`🔍 Encontrados ${invalidChats.length} chats con IDs incorrectos:`, invalidChats);
                
                // Eliminar chats inválidos
                for (const invalidChatId of invalidChats) {
                    await chatsRef.child(invalidChatId).remove();
                    console.log(`🗑️ Chat eliminado: ${invalidChatId}`);
                }
                
                if (invalidChats.length > 0) {
                    console.log(`✅ Limpieza completada: ${invalidChats.length} chats eliminados`);
                } else {
                    console.log('✅ No se encontraron chats con IDs incorrectos');
                }
            }
            
        } catch (error) {
            console.error('❌ Error limpiando chats inválidos:', error);
        }
    }

    // ===== FUNCIÓN PARA IR AL MAPA DESDE SIDEBAR =====
    focusOnProfileMarker(profile) {
        if (!profile || !profile.location) {
            console.warn('Perfil sin ubicación válida');
            return;
        }

        // Centrar el mapa en la ubicación del perfil
        this.map.flyTo({
            center: [profile.location.lng, profile.location.lat],
            zoom: 16,
            essential: true,
            duration: 1500
        });

        // Agregar animación de pulso al marcador
        const marker = this.profileMarkers.find(m => m.profileId === profile.id);
        if (marker) {
            const markerElement = marker.getElement();
            if (markerElement) {
                markerElement.classList.add('pulse-animation');
                setTimeout(() => {
                    markerElement.classList.remove('pulse-animation');
                }, 3000);
            }
        }

        this.showNotification(`Centrando en ${profile.userName}`, 'info');
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

    // ===== RENDERIZAR LISTA DE PERFILES DISPONIBLES EN SIDEBAR =====
    async renderAvailableProfilesInSidebar() {
        // Prevenir múltiples renderizados simultáneos
        if (this.isRenderingSidebar) {
            console.log('⚠️ [DEBUG] Renderizado ya en progreso, saltando...');
            return;
        }
        this.isRenderingSidebar = true;

        const wishList = document.getElementById('wishList');
        if (!wishList) {
            console.warn('wishList element not found');
            this.isRenderingSidebar = false;
            return;
        }

        // Limpiar la lista actual
        wishList.innerHTML = '';

        // Debug: Mostrar estado actual del array
        console.log(`🔍 [DEBUG] availableProfiles.length: ${this.availableProfiles.length}`);
        console.log(`🔍 [DEBUG] availableProfiles content:`, this.availableProfiles.map(p => ({ id: p.id, userId: p.userId, userName: p.userName })));

        // Eliminar duplicados por userId antes de renderizar
        const uniqueProfiles = this.availableProfiles.reduce((acc, profile) => {
            const existing = acc.find(p => p.userId === profile.userId);
            if (!existing) {
                acc.push(profile);
            } else {
                console.log(`⚠️ [DEBUG] Duplicado encontrado en renderizado: ${profile.userName} (userId: ${profile.userId})`);
            }
            return acc;
        }, []);

        console.log(`🔍 [DEBUG] Perfiles únicos para renderizar: ${uniqueProfiles.length} de ${this.availableProfiles.length}`);

        // Renderizar cada perfil disponible
        for (const profile of uniqueProfiles) {
            // Obtener datos completos del perfil desde Firebase (con cache)
            let userProfile = this.userProfilesCache && this.userProfilesCache[profile.userId] ? this.userProfilesCache[profile.userId] : null;
            if (!userProfile && this.database) {
                try {
                    const userRef = this.database.ref(`users/${profile.userId}/profile`);
                    const snapshot = await userRef.once('value');
                    userProfile = snapshot.val();
                    if (!userProfile) {
                        const userRootRef = this.database.ref(`users/${profile.userId}`);
                        const userRootSnapshot = await userRootRef.once('value');
                        userProfile = userRootSnapshot.val();
                    }
                    if (userProfile && this.userProfilesCache) {
                        this.userProfilesCache[profile.userId] = userProfile;
                    }
                } catch (error) {
                    console.warn('Error fetching profile for sidebar:', error);
                }
            }

            // Normalizar datos: soportar posibles nombres alternativos según data.json
            const nickname = userProfile?.nickname || userProfile?.alias || userProfile?.apodo || profile.userName || 'Usuario';
            // Procesar foto principal: usar la misma lógica que en showProfileDetails
            let mainPhoto = profile.userProfileImage;
            if (userProfile) {
                const photos = Array.isArray(userProfile.photos) ? userProfile.photos : (Array.isArray(userProfile.fotos) ? userProfile.fotos : []);
                if (photos.length > 0) {
                    const toImageSrc = (input) => {
                        if (!input) return null;
                        let value = input;
                        if (typeof input === 'object') {
                            if (typeof input.url === 'string') value = input.url;
                            else if (typeof input.src === 'string') value = input.src;
                            else if (typeof input.base64 === 'string') value = input.base64;
                            else if (Array.isArray(input) && input.length > 0) value = input[0];
                            else return null;
                        }
                        if (typeof value !== 'string') return null;
                        if (value.startsWith('data:image/')) return value;
                        if (value.startsWith('http') || value.startsWith('https')) return value;
                        if (value.length > 100 && !value.includes('http')) return `data:image/jpeg;base64,${value}`;
                        return null;
                    };
                    const processed = photos.map(toImageSrc).filter((src) => typeof src === 'string' && src.length > 0);
                    if (processed.length > 0) mainPhoto = processed[0];
                }
            }
            
            // Asegurar que la imagen sea consistente con la del mapa
            if (!mainPhoto) {
                mainPhoto = 'https://www.gravatar.com/avatar/?d=mp&f=y';
            }

            const profileItem = document.createElement('div');
            profileItem.className = 'wish-item profile-item';
            profileItem.innerHTML = `
                <div class="wish-logo">
                    <img src="${mainPhoto || 'https://www.gravatar.com/avatar/?d=mp&f=y'}" 
                         alt="${nickname}" class="profile-avatar-small">
                </div>
                <div class="wish-info">
                    <h3>${nickname}</h3>
                    <p><span class="category-badge ${profile.category}">${this.getCategoryName(profile.category)}</span> • Disponible</p>
                </div>
                <div class="wish-actions">
                    <i class="fas fa-heart"></i>
                </div>
            `;
            
            // Añadir evento de clic para ir al mapa
            profileItem.addEventListener('click', () => {
                this.focusOnProfileMarker(profile);
            });
            
            wishList.appendChild(profileItem);
        }

        console.log(`✅ Rendered ${uniqueProfiles.length} unique profiles in sidebar (from ${this.availableProfiles.length} total)`);
        
        // Renderizar carrusel móvil
        this.renderMobileCarousel(uniqueProfiles);
        
        // Liberar el flag de renderizado
        this.isRenderingSidebar = false;
    }

    // ===== CARRUSEL MÓVIL =====
    renderMobileCarousel(profiles) {
        // Asegurar que exista el contenedor overlay en móvil
        let overlay = document.getElementById('mobileCarouselOverlay');
        if (!overlay) {
            const mapArea = document.querySelector('.map-area');
            let overlays = mapArea && mapArea.querySelector('.mobile-overlays');
            if (!overlays && mapArea) {
                overlays = document.createElement('div');
                overlays.className = 'mobile-overlays';
                mapArea.appendChild(overlays);
            }
            if (overlays) {
                overlays.insertAdjacentHTML('beforeend', `
                    <div class="mobile-carousel overlay" id="mobileCarouselOverlay">
                        <div class="carousel-container">
                            <div class="carousel-track" id="carouselTrack"></div>
                            <div class="carousel-controls">
                                <button class="carousel-btn prev-btn" id="prevBtn">
                                    <i class="fas fa-chevron-left"></i>
                                </button>
                                <div class="carousel-indicators" id="carouselIndicators"></div>
                                <button class="carousel-btn next-btn" id="nextBtn">
                                    <i class="fas fa-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `);
            }
        }

        const carouselTrack = document.getElementById('carouselTrack');
        const carouselIndicators = document.getElementById('carouselIndicators');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        // Si los elementos aún no existen (por timing), reintentar una vez después de un breve delay
        if (!carouselTrack || !carouselIndicators || !prevBtn || !nextBtn) {
            console.warn('Elementos del carrusel móvil no encontrados aún. Reintentando...');
            clearTimeout(this._carouselRetryTimer);
            this._carouselRetryTimer = setTimeout(() => {
                this.renderMobileCarousel(profiles);
            }, 300);
            return;
        }

        // Limpiar carrusel
        carouselTrack.innerHTML = '';
        carouselIndicators.innerHTML = '';

        if (profiles.length === 0) {
            carouselTrack.innerHTML = `
                <div class="carousel-slide">
                    <div class="carousel-profile">
                        <div class="carousel-profile-info">
                            <div class="carousel-profile-name">No hay perfiles disponibles</div>
                            <div class="carousel-profile-category">Intenta más tarde</div>
                        </div>
                    </div>
                </div>
            `;
            // Estado base
            this.currentSlide = 0;
            this.totalSlides = 0;
            this.updateCarouselButtons();
            return;
        }

        // Crear slides del carrusel
        profiles.forEach((profile, index) => {
            // Obtener foto principal usando la misma lógica que navbar/mapa
            let mainPhoto = profile.userProfileImage;
            try {
                const userProfile = this.userProfilesCache && this.userProfilesCache[profile.userId] ? this.userProfilesCache[profile.userId] : null;
                if (userProfile) {
                    const photos = Array.isArray(userProfile.photos) ? userProfile.photos : (Array.isArray(userProfile.fotos) ? userProfile.fotos : []);
                    if (photos.length > 0) {
                        const toImageSrc = (input) => {
                            if (!input) return null;
                            let value = input;
                            if (typeof input === 'object') {
                                if (typeof input.url === 'string') value = input.url;
                                else if (typeof input.src === 'string') value = input.src;
                                else if (typeof input.base64 === 'string') value = input.base64;
                                else if (Array.isArray(input) && input.length > 0) value = input[0];
                                else return null;
                            }
                            if (typeof value !== 'string') return null;
                            if (value.startsWith('data:image/')) return value;
                            if (value.startsWith('http') || value.startsWith('https')) return value;
                            if (value.length > 100 && !value.includes('http')) return `data:image/jpeg;base64,${value}`;
                            return null;
                        };
                        const processed = photos.map(toImageSrc).filter((src) => typeof src === 'string' && src.length > 0);
                        if (processed.length > 0) mainPhoto = processed[0];
                    }
                }
            } catch (e) { /* noop */ }
            if (!mainPhoto) mainPhoto = 'https://www.gravatar.com/avatar/?d=mp&f=y';

            const slide = document.createElement('div');
            slide.className = 'carousel-slide';
            slide.innerHTML = `
                <div class="carousel-profile" data-profile-id="${profile.id}">
                    <img src="${mainPhoto}" 
                         alt="${profile.userName}" class="carousel-profile-avatar">
                    <div class="carousel-profile-info">
                        <div class="carousel-profile-name">${profile.userName || 'Usuario'}</div>
                        <div class="carousel-profile-category">${this.getCategoryName(profile.category)}</div>
                        <div class="carousel-profile-status">
                            <i></i>
                            <span>Disponible ahora</span>
                        </div>
                    </div>
                </div>
            `;
            
            // Agregar evento de clic para mostrar detalles
            slide.addEventListener('click', () => {
                this.showProfileDetails(profile);
            });
            
            carouselTrack.appendChild(slide);
        });

        // Crear indicadores
        profiles.forEach((_, index) => {
            const indicator = document.createElement('div');
            indicator.className = `carousel-indicator ${index === 0 ? 'active' : ''}`;
            indicator.addEventListener('click', () => {
                this.goToSlide(index);
            });
            carouselIndicators.appendChild(indicator);
        });

        // Evitar listeners duplicados en controles
        if (!this._carouselControlsBound) {
            this.setupCarouselControls(profiles.length);
            this._carouselControlsBound = true;
        }
        
        // Inicializar estado del carrusel
        this.currentSlide = 0;
        this.totalSlides = profiles.length;
        this.goToSlide(0);
    }

    setupCarouselControls(totalSlides) {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        if (!prevBtn || !nextBtn) return;

        prevBtn.addEventListener('click', () => {
            this.previousSlide();
        });

        nextBtn.addEventListener('click', () => {
            this.nextSlide();
        });

        // Actualizar estado inicial de los botones
        this.updateCarouselButtons();
        
        // Agregar soporte para gestos táctiles
        this.setupCarouselTouchEvents();
    }

    goToSlide(slideIndex) {
        const carouselTrack = document.getElementById('carouselTrack');
        const indicators = document.querySelectorAll('.carousel-indicator');
        
        if (!carouselTrack || slideIndex < 0 || slideIndex >= this.totalSlides) return;

        this.currentSlide = slideIndex;
        carouselTrack.style.transform = `translateX(-${slideIndex * 100}%)`;

        // Actualizar indicadores
        indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === slideIndex);
        });

        this.updateCarouselButtons();

        // Mover el mapa al perfil correspondiente
        try {
            const slideEl = carouselTrack.children[slideIndex];
            if (slideEl) {
                const profileEl = slideEl.querySelector('.carousel-profile');
                const profileId = profileEl && profileEl.getAttribute('data-profile-id');
                const profile = this.availableProfiles.find(p => p.id === profileId);
                if (profile && profile.location) {
                    this.focusOnProfileMarker(profile);
                }
            }
        } catch (e) { console.warn('No se pudo centrar el mapa en el slide actual:', e); }
    }

    nextSlide() {
        if (this.currentSlide < this.totalSlides - 1) {
            this.goToSlide(this.currentSlide + 1);
        }
    }

    previousSlide() {
        if (this.currentSlide > 0) {
            this.goToSlide(this.currentSlide - 1);
        }
    }

    updateCarouselButtons() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        if (!prevBtn || !nextBtn) return;

        prevBtn.disabled = this.currentSlide === 0;
        nextBtn.disabled = this.currentSlide === this.totalSlides - 1;
    }

    setupCarouselTouchEvents() {
        const carouselTrack = document.getElementById('carouselTrack');
        if (!carouselTrack) return;

        let startX = 0;
        let startY = 0;
        let isDragging = false;
        let currentX = 0;

        const onTouchStart = (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isDragging = true;
            carouselTrack.style.transition = 'none';
        };

        const onTouchMove = (e) => {
            if (!isDragging) return;
            
            currentX = e.touches[0].clientX;
            const diffX = currentX - startX;
            const diffY = Math.abs(e.touches[0].clientY - startY);
            
            // Solo procesar si el movimiento horizontal es mayor que el vertical
            if (Math.abs(diffX) > diffY) {
                const deltaPercent = (diffX / carouselTrack.clientWidth) * 100;
                const basePercent = -this.currentSlide * 100;
                carouselTrack.style.transform = `translateX(${basePercent + deltaPercent}%)`;
            }
        };

        const onTouchEnd = () => {
            if (!isDragging) return;
            
            isDragging = false;
            carouselTrack.style.transition = 'transform 0.3s ease';
            
            const diffX = currentX - startX;
            const threshold = carouselTrack.clientWidth * 0.15; // 15% del ancho
            
            if (Math.abs(diffX) > threshold) {
                if (diffX > 0 && this.currentSlide > 0) {
                    this.previousSlide();
                } else if (diffX < 0 && this.currentSlide < this.totalSlides - 1) {
                    this.nextSlide();
                } else {
                    this.goToSlide(this.currentSlide);
                }
            } else {
                this.goToSlide(this.currentSlide);
            }
        };

        // Escuchas pasivos para evitar bloquear scroll
        carouselTrack.addEventListener('touchstart', onTouchStart, { passive: true });
        carouselTrack.addEventListener('touchmove', onTouchMove, { passive: true });
        carouselTrack.addEventListener('touchend', onTouchEnd, { passive: true });
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
        this.renderAvailableProfilesInSidebar(); // Actualizar la lista de deseos en el sidebar
    }

    applySidebarFilters() {
        this.filters.maxPrice = parseInt(document.getElementById('priceFilterSidebar').value);
        this.filters.category = document.getElementById('categoryFilterSidebar').value;
        // La distancia no se aplica directamente desde el sidebar para deseos aún, podría ser un filtro futuro
        // this.filters.distance = parseInt(document.getElementById('distanceFilter').value);

        this.renderWishesOnMap();
        this.renderAvailableProfilesInSidebar();
        this.showNotification('Filtros de sidebar aplicados correctamente.', 'success');
    }

    passesWishFilters(wish) { // Renombrado de passesStoreFilters a passesWishFilters
        if (wish.price > this.filters.maxPrice) return false;
        if (this.filters.category && wish.category !== this.filters.category) return false;
        
        // Filtro de distancia (si el usuario tiene ubicación)
        if (this.userLocation && this.filters.distance) {
            const distance = this.calculateDistance(
                this.userLocation.lat, this.userLocation.lng,
                wish.location.lat, wish.location.lng
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
        // Función para obtener el nombre de la categoría (actualizada con todas las categorías)
        switch (category) {
            case 'comida': return 'Comida';
            case 'servicios': return 'Servicios';
            case 'compras': return 'Compras';
            case 'transporte': return 'Transporte';
            case 'entretenimiento': return 'Entretenimiento';
            case 'escort': return 'Escort';
            case 'gigolo': return 'Gigolo';
            case 'masajes': return 'Masajes';
            case 'trans': return 'Trans';
            case 'chat': return 'Chat';
            case 'live': return 'Live';
            default: return 'General';
        }
    }

    // Mapear IDs de poses sexuales a nombres de visualización
    getSexualPoseName(poseId) {
        const poseMap = {
            'missionary': 'Misionero',
            'cowgirl': 'Vaquera',
            'doggy': 'Perrito',
            'spooning': 'Cucharita',
            'reverse_cowgirl': 'Vaquera Inversa',
            'standing': 'De Pie',
            'lotus': 'Loto',
            'scissors': 'Tijeras',
            'butterfly': 'Mariposa',
            'reverse_spooning': 'Cucharita Inversa',
            'crab': 'Cangrejo',
            'wheelbarrow': 'Carretilla',
            'pretzel': 'Pretzel',
            'yab_yum': 'Yab Yum',
            'bridge': 'Puente',
            'spread_eagle': 'Águila Extendida',
            'reverse_spread': 'Águila Inversa',
            'side_by_side': 'Lado a Lado',
            'kneeling': 'Arrodillados',
            'lotus_standing': 'Loto de Pie'
        };
        return poseMap[poseId] || poseId;
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
        
        // Actualizar estilo del mapa según el tema
        this.updateMapStyle(newTheme);
        
        this.showNotification(`Tema cambiado a ${newTheme === 'light' ? 'claro' : 'oscuro'}`, 'success');
    }

    // ===== ACTUALIZAR ESTILO DEL MAPA =====
    updateMapStyle(theme) {
        if (!this.map) {
            console.warn('⚠️ Map not initialized, cannot update style');
        return;
    }

        try {
            const mapStyle = theme === 'light' ? 'mapbox://styles/mapbox/light-v11' : 'mapbox://styles/mapbox/dark-v11';
            this.map.setStyle(mapStyle);
            console.log(`✅ Map style updated to ${theme} theme`);
        } catch (error) {
            console.error('❌ Error updating map style:', error);
        }
    }

    // ===== TOGGLE DEL SIDEBAR MENU =====
    toggleSidebarMenu() {
        console.log('🔄 Toggling sidebar menu...');
        const mainNav = document.querySelector('.main-nav');
        const sidebarToggle = document.getElementById('sidebarToggle');
        
        if (mainNav && sidebarToggle) {
            const isHidden = mainNav.classList.contains('hidden');
            const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
            
            if (isHidden) {
                // Mostrar el menú
                mainNav.classList.remove('hidden');
                if (isMobile) document.body.classList.add('mobile-menu-open');
                sidebarToggle.innerHTML = '<i class="fas fa-bars"></i>';
                console.log('✅ Sidebar menu shown');
            } else {
                // Ocultar el menú
                mainNav.classList.add('hidden');
                if (isMobile) document.body.classList.remove('mobile-menu-open');
                sidebarToggle.innerHTML = '<i class="fas fa-bars"></i>'; // Mantener el mismo icono
                console.log('✅ Sidebar menu hidden');
            }
        } else {
            console.warn('⚠️ main-nav or sidebarToggle not found');
        }
    }

    // ===== INICIALIZACIÓN DE FIREBASE =====
    initializeFirebase() {
        console.log('🔍 [DEBUG] Iniciando Firebase...');
        console.log('🔍 [DEBUG] CONFIG disponible:', typeof CONFIG);
        console.log('🔍 [DEBUG] CONFIG.FIREBASE disponible:', typeof CONFIG.FIREBASE);
        console.log('🔍 [DEBUG] CONFIG.FIREBASE.enabled:', CONFIG.FIREBASE.enabled);
        console.log('🔍 [DEBUG] CONFIG.FIREBASE.config disponible:', typeof CONFIG.FIREBASE.config);
        
        // Log completo de la configuración para debug
        console.log('🔍 [DEBUG] CONFIG.FIREBASE completo:', CONFIG.FIREBASE);
        console.log('🔍 [DEBUG] CONFIG.FIREBASE.config completo:', CONFIG.FIREBASE.config);
        console.log('🔍 [DEBUG] databaseURL desde CONFIG:', CONFIG.FIREBASE.config.databaseURL);
        
        if (!CONFIG.FIREBASE.enabled) {
            console.log('❌ Firebase está deshabilitado en la configuración');
            return;
        }

        // Verificar si Firebase está disponible
        console.log('🔍 [DEBUG] typeof firebase:', typeof firebase);
        if (typeof firebase === 'undefined') {
            console.warn('⚠️ Firebase SDK no está cargado, reintentando en 2 segundos...');
            setTimeout(() => this.initializeFirebase(), 2000);
            return;
        }

        try {
            // Verificar si ya está inicializado
            if (this.firebase) {
                console.log('✅ Firebase ya está inicializado');
                return;
            }

            // Verificar que firebase.database esté disponible
            console.log('🔍 [DEBUG] typeof firebase.database:', typeof firebase.database);
            if (typeof firebase.database === 'undefined') {
                console.warn('⚠️ Firebase Database no está cargado, reintentando en 2 segundos...');
                setTimeout(() => this.initializeFirebase(), 2000);
                return;
            }

            // Verificar configuración
            console.log('🔍 [DEBUG] Configuración Firebase:', CONFIG.FIREBASE.config);
            console.log('🔍 [DEBUG] databaseURL:', CONFIG.FIREBASE.config.databaseURL);
            console.log('🔍 [DEBUG] CONFIG.FIREBASE completo:', CONFIG.FIREBASE);
            console.log('🔍 [DEBUG] Verificando estructura de CONFIG:', {
                'CONFIG.FIREBASE': CONFIG.FIREBASE,
                'CONFIG.FIREBASE.config': CONFIG.FIREBASE.config,
                'CONFIG.FIREBASE.config.databaseURL': CONFIG.FIREBASE.config.databaseURL,
                'typeof CONFIG.FIREBASE.config.databaseURL': typeof CONFIG.FIREBASE.config.databaseURL
            });
            
            // Verificar si la configuración es válida
            if (!CONFIG.FIREBASE.config.databaseURL) {
                console.warn('⚠️ databaseURL no está definido en la configuración');
                console.warn('⚠️ databaseURL:', CONFIG.FIREBASE.config.databaseURL);
                console.log('🔍 [DEBUG] Firebase deshabilitado por databaseURL faltante, usando modo local');
                this.showNotification('Configuración de Firebase incompleta. Usando modo local.', 'warning');
                return;
            }
            
            // Verificar si es una configuración válida
            if (CONFIG.FIREBASE.config.databaseURL.includes('parcero-6b971')) {
                console.log('🔍 [DEBUG] Usando configuración de Firebase real del proyecto parcero');
            } else if (CONFIG.FIREBASE.config.databaseURL.includes('samplep-d6b68')) {
                console.log('🔍 [DEBUG] Usando configuración de Firebase de prueba válida');
            } else if (CONFIG.FIREBASE.config.databaseURL.includes('firebaseio.com')) {
                console.warn('⚠️ Configuración de Firebase parece ser placeholder/falsa');
                console.warn('⚠️ databaseURL:', CONFIG.FIREBASE.config.databaseURL);
                console.log('🔍 [DEBUG] Firebase deshabilitado por configuración placeholder, usando modo local');
                this.showNotification('Configuración de Firebase no válida. Usando modo local.', 'warning');
                return;
            }

            // Inicializar Firebase
            console.log('🔍 [DEBUG] Intentando inicializar Firebase...');
            this.firebase = firebase.initializeApp(CONFIG.FIREBASE.config);
            this.database = firebase.database();
            this.wishesRef = this.database.ref(CONFIG.FIREBASE.database.wishes);
            
            console.log('✅ Firebase Realtime Database inicializado');
            console.log('📊 Database URL:', CONFIG.FIREBASE.config.databaseURL);
            
            // Cargar perfiles disponibles
            this.loadAvailableProfiles();
            
            // Escuchar cambios en tiempo real
            this.setupRealtimeListeners();
            
            // Escuchar cambios en perfiles disponibles
            this.setupAvailableProfilesListeners();
            
        } catch (error) {
            console.error('❌ Error inicializando Firebase:', error);
            console.error('🔍 [DEBUG] Error details:', error.message);
            console.error('🔍 [DEBUG] Error code:', error.code);
            console.error('🔍 [DEBUG] Error stack:', error.stack);
            console.error('🔍 [DEBUG] Configuración Firebase:', CONFIG.FIREBASE.config);
            console.error('🔍 [DEBUG] Firebase object:', firebase);
            console.error('🔍 [DEBUG] firebase.database:', firebase.database);
            this.showNotification(`Error Firebase: ${error.message} (${error.code || 'Sin código'})`, 'error');
        }
    }

    // ===== CARGA INICIAL DE DESEOS =====
    async loadExistingWishes() {
        if (!this.wishesRef) return;
        
        try {
            console.log('🔍 Cargando deseos existentes desde Firebase...');
            
            const snapshot = await this.wishesRef.once('value');
            const wishesData = snapshot.val();
            
            if (wishesData) {
                // Limpiar array de deseos existente
                this.wishes = [];
                
                // Procesar cada deseo
                Object.keys(wishesData).forEach(key => {
                    const wish = wishesData[key];
                    wish.id = key;
                    
                    // Normalizar datos del deseo
                    this.normalizeWishData(wish);
                    
                    // Agregar al array
                    this.wishes.push(wish);
                });
                
                console.log(`✅ Cargados ${this.wishes.length} deseos desde Firebase`);
                
                // Renderizar en el mapa y sidebar
                this.renderWishesOnMap();
                this.renderAvailableProfilesInSidebar();
            } else {
                console.log('ℹ️ No hay deseos en Firebase aún');
            }
            
        } catch (error) {
            console.error('❌ Error cargando deseos existentes:', error);
            this.showNotification('Error cargando deseos existentes', 'error');
        }
    }

    // ===== NORMALIZACIÓN DE DATOS =====
    normalizeWishData(wish) {
        // Asegurar que el deseo tenga la estructura correcta
        if (!wish.author) {
            wish.author = { id: 'anonymous', name: 'Usuario Anónimo' };
        }
        
        if (!wish.author.id) {
            wish.author.id = 'anonymous';
        }
        
        if (!wish.author.name) {
            wish.author.name = 'Usuario Anónimo';
        }
        
        if (!wish.status) {
            wish.status = 'active';
        }
        
        if (!wish.priceFormatted && wish.price) {
            wish.priceFormatted = this.formatPrice(wish.price);
        }
        
        if (!wish.location && wish.coordinates) {
            wish.location = {
                lat: wish.coordinates[1],
                lng: wish.coordinates[0]
            };
        }
        
        return wish;
    }

    // ===== LISTENERS DE TIEMPO REAL =====
    setupRealtimeListeners() {
        if (!this.wishesRef) return;

        // Escuchar nuevos deseos
        this.wishesRef.on('child_added', (snapshot) => {
            const wish = snapshot.val();
            wish.id = snapshot.key;
            
            // Asegurar que el deseo tenga la estructura correcta
            this.normalizeWishData(wish);
            
            // Solo agregar si no existe ya
            if (!this.wishes.find(w => w.id === wish.id)) {
                this.wishes.push(wish);
                this.addWishMarker(wish);
                console.log('✅ Nuevo deseo agregado en tiempo real:', wish.title);
            }
        });

        // Escuchar cambios en deseos existentes
        this.wishesRef.on('child_changed', (snapshot) => {
            const updatedWish = snapshot.val();
            updatedWish.id = snapshot.key;
            
            // Asegurar que el deseo tenga la estructura correcta
            this.normalizeWishData(updatedWish);
            
            const index = this.wishes.findIndex(w => w.id === updatedWish.id);
            if (index !== -1) {
                this.wishes[index] = updatedWish;
                this.updateWishMarker(updatedWish);
                console.log('✅ Deseo actualizado en tiempo real:', updatedWish.title);
            }
        });

        // Escuchar eliminación de deseos
        this.wishesRef.on('child_removed', (snapshot) => {
            const wishId = snapshot.key;
            const index = this.wishes.findIndex(w => w.id === wishId);
            
            if (index !== -1) {
                this.wishes.splice(index, 1);
                this.removeWishMarker(wishId);
                console.log('✅ Deseo eliminado en tiempo real:', wishId);
            }
        });
    }

    // ===== LISTENERS DE PERFILES DISPONIBLES =====
    setupAvailableProfilesListeners() {
        if (!this.database) return;

        // Prevenir múltiples configuraciones de listeners
        if (this.availableProfilesListenersSetup) {
            console.log('⚠️ [DEBUG] Listeners ya configurados, saltando...');
            return;
        }
        this.availableProfilesListenersSetup = true;

        const profilesRef = this.database.ref('availableProfiles');
        
        // Escuchar nuevos perfiles disponibles
        profilesRef.on('child_added', async (snapshot) => {
            const profile = snapshot.val();
            profile.id = snapshot.key;
            
            console.log(`🔍 [DEBUG] child_added event - Profile: ${profile.userName}, ID: ${profile.id}, userId: ${profile.userId}, isAvailable: ${profile.isAvailable}`);
            
            if (profile.isAvailable) {
                // Verificar duplicados por userId Y por id
                const existingById = this.availableProfiles.find(p => p.id === profile.id);
                const existingByUserId = this.availableProfiles.find(p => p.userId === profile.userId);
                
                console.log(`🔍 [DEBUG] Verificando duplicados - existingById: ${!!existingById}, existingByUserId: ${!!existingByUserId}`);
                console.log(`🔍 [DEBUG] availableProfiles actual length: ${this.availableProfiles.length}`);
                
                if (!existingById && !existingByUserId) {
                    this.availableProfiles.push(profile);
                    await this.createProfileMarker(profile);
                    this.renderAvailableProfilesInSidebar();
                    console.log('✅ Nuevo perfil disponible agregado:', profile.userName, 'ID:', profile.id);
                } else {
                    console.log('⚠️ Perfil duplicado ignorado:', profile.userName, 'ID:', profile.id, 'userId:', profile.userId);
                }
            } else {
                console.log('⚠️ Perfil no disponible ignorado:', profile.userName, 'ID:', profile.id);
            }
        });

        // Escuchar cambios en perfiles existentes
        profilesRef.on('child_changed', async (snapshot) => {
            const updatedProfile = snapshot.val();
            updatedProfile.id = snapshot.key;
            
            const index = this.availableProfiles.findIndex(p => p.id === updatedProfile.id);
            if (index !== -1) {
                this.availableProfiles[index] = updatedProfile;
                await this.updateProfileMarker(updatedProfile);
                this.renderAvailableProfilesInSidebar();
                console.log('✅ Perfil disponible actualizado:', updatedProfile.userName);
            }
        });

        // Escuchar eliminación de perfiles
        profilesRef.on('child_removed', (snapshot) => {
            const profileId = snapshot.key;
            const index = this.availableProfiles.findIndex(p => p.id === profileId);
            
            if (index !== -1) {
                this.availableProfiles.splice(index, 1);
                this.removeProfileMarker(profileId);
                this.renderAvailableProfilesInSidebar();
                console.log('✅ Perfil disponible eliminado:', profileId);
            }
        });
    }

    // ===== CREACIÓN DE DESEOS =====
    async createWish(wishData) {
        console.log('🔍 [DEBUG] createWish llamado con:', wishData);
        console.log('🔍 [DEBUG] CONFIG.FIREBASE.enabled:', CONFIG.FIREBASE.enabled);
        console.log('🔍 [DEBUG] this.wishesRef:', this.wishesRef);
        
        // Validar que el usuario esté autenticado
        if (!this.currentUser || !this.currentUser.id) {
            this.showNotification('Debes iniciar sesión para crear un deseo', 'error');
            this.showAuthUI();
            return;
        }
        
        // Si Firebase está deshabilitado, ir directamente al modo local
        if (!CONFIG.FIREBASE.enabled) {
            console.log('🔍 [DEBUG] Firebase deshabilitado en configuración, usando modo local');
            return this.createWishLocally(wishData);
        }
        
        // Si Firebase está habilitado pero no inicializado, intentar inicializar
        if (!this.wishesRef) {
            console.log('🔍 [DEBUG] Firebase habilitado pero no inicializado, intentando inicializar...');
            this.initializeFirebase();
            
            // Esperar un poco y verificar de nuevo
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            if (!this.wishesRef) {
                // Modo fallback: crear deseo localmente sin Firebase
                console.warn('⚠️ Firebase no disponible después de intentar inicializar, creando deseo localmente');
                return this.createWishLocally(wishData);
            }
        }

        try {
            console.log('🔍 [DEBUG] Iniciando creación de deseo en Firebase...');
            
            // Obtener ubicación actual del usuario
            console.log('🔍 [DEBUG] Obteniendo ubicación del usuario...');
            const location = await this.getCurrentLocation();
            console.log('🔍 [DEBUG] Ubicación obtenida:', location);
            
            const wish = {
                title: wishData.title,
                description: wishData.description,
                category: wishData.category,
                price: parseInt(wishData.price),
                priceFormatted: this.formatPrice(wishData.price),
                address: wishData.address,
                urgency: wishData.urgency,
                location: {
                    lat: location.lat,
                    lng: location.lng
                },
                author: {
                    id: this.currentUser?.id || 'anonymous',
                    name: this.currentUser?.name || 'Usuario Anónimo',
                    email: this.currentUser?.email || 'anonymous@example.com'
                },
                status: 'active', // active, completed, cancelled
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                updatedAt: firebase.database.ServerValue.TIMESTAMP,
                acceptedBy: null,
                completedAt: null
            };

            console.log('🔍 [DEBUG] Deseo creado:', wish);
            console.log('🔍 [DEBUG] this.wishesRef:', this.wishesRef);
            console.log('🔍 [DEBUG] Intentando guardar en Firebase...');

            // Guardar en Firebase
            const newWishRef = this.wishesRef.push();
            console.log('🔍 [DEBUG] Referencia creada:', newWishRef);
            
            await newWishRef.set(wish);
            console.log('🔍 [DEBUG] Deseo guardado exitosamente en Firebase');
            
            console.log('✅ Deseo creado exitosamente:', wish.title);
            this.showNotification(`¡Deseo "${wish.title}" creado exitosamente!`, 'success');
            
            return newWishRef.key;
            
        } catch (error) {
            console.error('❌ Error creando deseo:', error);
            console.error('🔍 [DEBUG] Error details:', error.message);
            console.error('🔍 [DEBUG] Error code:', error.code);
            console.error('🔍 [DEBUG] Error stack:', error.stack);
            console.error('🔍 [DEBUG] Firebase error details:', error.details);
            console.error('🔍 [DEBUG] this.wishesRef:', this.wishesRef);
            console.error('🔍 [DEBUG] this.database:', this.database);
            console.error('🔍 [DEBUG] this.firebase:', this.firebase);
            this.showNotification(`Error Firebase: ${error.message} (${error.code || 'Sin código'})`, 'error');
            throw error;
        }
    }

    // ===== OBTENER UBICACIÓN ACTUAL =====
    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                // Ubicación por defecto (Bogotá, Colombia)
                resolve({ lat: 4.6097, lng: -74.0817 });
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    console.warn('No se pudo obtener ubicación:', error);
                    // Ubicación por defecto
                    resolve({ lat: 4.6097, lng: -74.0817 });
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000
                }
            );
        });
    }

    // ===== FORMATEO DE PRECIOS =====
    formatPrice(price) {
        const numPrice = parseInt(price);
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(numPrice);
    }

    // ===== MANEJO DEL MODAL DE CREACIÓN =====
    openCreateWishModal() {
        const modal = document.getElementById('createWishModal');
        if (modal) {
            modal.classList.add('active');
            this.setupCreateWishModal();
        }
    }

    setupCreateWishModal() {
        const form = document.getElementById('createWishForm');
        const useCurrentLocationBtn = document.getElementById('useCurrentLocation');
        const priceInput = document.getElementById('wishPrice');
        const cancelBtn = document.getElementById('cancelCreateWish');
        const closeBtn = document.getElementById('closeCreateModal');

        // Formatear precio en tiempo real
        if (priceInput) {
            priceInput.addEventListener('input', (e) => {
                const value = e.target.value;
                if (value) {
                    const formatted = this.formatPrice(value);
                    e.target.title = formatted;
                }
            });
        }

        // Usar ubicación actual
        if (useCurrentLocationBtn) {
            useCurrentLocationBtn.addEventListener('click', async () => {
                try {
                    // Mostrar estado de carga
                    useCurrentLocationBtn.disabled = true;
                    useCurrentLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Obteniendo ubicación...';
                    
                    this.showNotification('Obteniendo tu ubicación...', 'info');
                    const location = await this.getCurrentLocation();
                    
                    // Usar geocodificación inversa para obtener dirección
                    const address = await this.reverseGeocode(location.lat, location.lng);
                    document.getElementById('wishAddress').value = address;
                    
                    this.showNotification('Ubicación actual obtenida', 'success');
                } catch (error) {
                    console.error('Error obteniendo ubicación:', error);
                    this.showNotification('Error al obtener ubicación', 'error');
                } finally {
                    // Restaurar botón
                    useCurrentLocationBtn.disabled = false;
                    useCurrentLocationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Usar mi ubicación actual';
                }
            });
        }

        // Enviar formulario
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(form);
                const wishData = {
                    title: formData.get('wishTitle') || document.getElementById('wishTitle').value,
                    description: formData.get('wishDescription') || document.getElementById('wishDescription').value,
                    category: formData.get('wishCategory') || document.getElementById('wishCategory').value,
                    price: formData.get('wishPrice') || document.getElementById('wishPrice').value,
                    address: formData.get('wishAddress') || document.getElementById('wishAddress').value,
                    urgency: formData.get('wishUrgency') || document.getElementById('wishUrgency').value
                };

                try {
                    await this.createWish(wishData);
                    this.closeCreateWishModal();
                } catch (error) {
                    console.error('Error creando deseo:', error);
                }
            });
        }

        // Botones de cerrar
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeCreateWishModal());
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeCreateWishModal());
        }
    }

    closeCreateWishModal() {
        const modal = document.getElementById('createWishModal');
        if (modal) {
            modal.classList.remove('active');
            // Limpiar formulario
            const form = document.getElementById('createWishForm');
            if (form) form.reset();
        }
    }

    // ===== GEOCODIFICACIÓN INVERSА =====
    async reverseGeocode(lat, lng) {
        try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}`
            );
            const data = await response.json();
            
            if (data.features && data.features.length > 0) {
                return data.features[0].place_name;
            }
            return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        } catch (error) {
            console.error('Error en geocodificación inversa:', error);
            return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
    }

    // ===== MODO FALLBACK - CREAR DESEO LOCALMENTE =====
    async createWishLocally(wishData) {
        console.log('🔍 [DEBUG] createWishLocally llamado con:', wishData);
        
        try {
            // Obtener ubicación actual del usuario
            console.log('🔍 [DEBUG] Obteniendo ubicación actual...');
            const location = await this.getCurrentLocation();
            console.log('🔍 [DEBUG] Ubicación obtenida:', location);
            
            const wish = {
                id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                title: wishData.title,
                description: wishData.description,
                category: wishData.category,
                price: parseInt(wishData.price),
                priceFormatted: this.formatPrice(wishData.price),
                address: wishData.address,
                urgency: wishData.urgency,
                location: {
                    lat: location.lat,
                    lng: location.lng
                },
                author: {
                    id: this.currentUser?.id || 'anonymous',
                    name: this.currentUser?.name || 'Usuario Anónimo',
                    email: this.currentUser?.email || 'anonymous@example.com'
                },
                status: 'active',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                acceptedBy: null,
                completedAt: null
            };

            console.log('🔍 [DEBUG] Deseo creado:', wish);

            // Agregar localmente
            this.wishes.push(wish);
            console.log('🔍 [DEBUG] Deseo agregado a la lista local');
            
            // Agregar marcador al mapa
            this.addWishMarker(wish);
            console.log('🔍 [DEBUG] Marcador agregado al mapa');
            
            // Actualizar lista en sidebar
            this.renderAvailableProfilesInSidebar();
            console.log('🔍 [DEBUG] Lista actualizada en sidebar');
            
            console.log('✅ Deseo creado localmente:', wish.title);
            this.showNotification(`¡Deseo "${wish.title}" creado exitosamente!`, 'success');
            
            return wish.id;
            
        } catch (error) {
            console.error('❌ Error creando deseo localmente:', error);
            console.error('🔍 [DEBUG] Error details:', error.message);
            console.error('🔍 [DEBUG] Error stack:', error.stack);
            this.showNotification('Error al crear el deseo localmente', 'error');
            throw error;
        }
    }

    // ===== CARGAR TEMA GUARDADO =====
    loadSavedTheme() {
        const savedTheme = localStorage.getItem('deseo-theme');
        const themeToggle = document.querySelector('#themeToggle i'); // Seleccionar el icono dentro del botón

        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            if (themeToggle) {
                if (savedTheme === 'light') {
                    themeToggle.className = 'fas fa-sun';
                } else {
                    themeToggle.className = 'fas fa-moon';
                }
            }
        } else {
            // Si no hay tema guardado, aplicar el tema por defecto (oscuro) y actualizar el icono
            document.documentElement.setAttribute('data-theme', 'dark');
            if (themeToggle) {
                themeToggle.className = 'fas fa-moon';
            }
        }
        
        // Guardar el tema actual para usar después de que el mapa se cargue
        this.currentTheme = document.documentElement.getAttribute('data-theme');
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

    // ===== ALERTA DE CHATS SIN RESPONDER =====
    initializeUnreadChatsAlert() {
        // Configurar botón para marcar todos como leídos
        const markAllReadBtn = document.getElementById('markAllReadBtn');
        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', () => {
                this.markAllChatsAsRead();
            });
        }

        // Solicitar permisos de notificación
        this.requestNotificationPermission();

        // Iniciar listener de chats sin responder
        this.setupUnreadChatsListener();
    }

    setupUnreadChatsListener() {
        if (!this.database || !this.currentUser) {
            console.log('⚠️ Firebase o usuario no disponible para alerta de chats');
            return;
        }

        // Detener listener anterior si existe
        if (this.unreadChatsListener) {
            this.unreadChatsListener.off();
        }

        console.log('🔍 Configurando listener de chats sin responder...');

        // Escuchar todos los chats del usuario
        const chatsRef = this.database.ref('chats');
        this.unreadChatsListener = chatsRef.on('value', (snapshot) => {
            const chatsData = snapshot.val();
            console.log('🔍 [DEBUG] Chats data recibida:', chatsData);
            
            if (!chatsData) {
                console.log('🔍 [DEBUG] No hay chats, ocultando alerta');
                this.updateUnreadChatsAlert(0);
                return;
            }

            let unreadCount = 0;
            const currentUserId = this.currentUser.id;
            const unreadChats = [];

            console.log('🔍 [DEBUG] Usuario actual ID:', currentUserId);

            // Contar chats sin responder
            Object.values(chatsData).forEach(chat => {
                console.log('🔍 [DEBUG] Procesando chat:', chat.id);
                
                if (chat.participants && chat.participants[currentUserId]) {
                    const userParticipant = chat.participants[currentUserId];
                    console.log('🔍 [DEBUG] Participante del usuario:', userParticipant);
                    
                    // Solo contar si el usuario es proveedor (debe responder)
                    if (userParticipant.role === 'provider') {
                        console.log('🔍 [DEBUG] Usuario es proveedor, verificando mensajes...');
                        
                        // Verificar si hay mensajes sin responder
                        if (chat.messages) {
                            const messages = Object.values(chat.messages);
                            const lastMessage = messages[messages.length - 1];
                            
                            console.log('🔍 [DEBUG] Último mensaje:', lastMessage);
                            
                            // Si el último mensaje no es del usuario actual y no es del sistema
                            if (lastMessage && 
                                lastMessage.senderId !== currentUserId && 
                                lastMessage.senderId !== 'system' &&
                                !lastMessage.responded) {
                                
                                unreadCount++;
                                unreadChats.push({
                                    chatId: chat.id,
                                    senderName: lastMessage.senderName,
                                    message: lastMessage.message
                                });
                                
                                console.log('🔍 [DEBUG] Chat sin responder encontrado:', {
                                    chatId: chat.id,
                                    senderName: lastMessage.senderName,
                                    message: lastMessage.message
                                });
                                
                                // Enviar notificación del navegador
                                this.sendBrowserNotification(lastMessage.senderName, lastMessage.message);
                            }
                        }
                    } else {
                        console.log('🔍 [DEBUG] Usuario no es proveedor, rol:', userParticipant.role);
                    }
                } else {
                    console.log('🔍 [DEBUG] Usuario no participa en este chat');
                }
            });

            console.log('🔍 [DEBUG] Total chats sin responder:', unreadCount);
            console.log('🔍 [DEBUG] Chats sin responder:', unreadChats);
            
            this.updateUnreadChatsAlert(unreadCount);
        });
    }

    updateUnreadChatsAlert(count) {
        const alert = document.getElementById('unreadChatsAlert');
        const countElement = document.getElementById('unreadChatsCount');
        
        console.log('🔍 [DEBUG] Actualizando alerta de chats:', count);
        console.log('🔍 [DEBUG] Elementos encontrados:', { alert: !!alert, countElement: !!countElement });
        
        if (!alert || !countElement) {
            console.error('❌ Elementos de alerta no encontrados');
            return;
        }

        this.unreadChatsCount = count;

        if (count > 0) {
            countElement.textContent = count;
            alert.style.display = 'block';
            
            console.log('🔍 [DEBUG] Mostrando alerta con', count, 'chats sin responder');
            
            // Agregar animación de pulso si hay muchos chats
            if (count >= 3) {
                alert.classList.add('pulse');
            } else {
                alert.classList.remove('pulse');
            }
        } else {
            alert.style.display = 'none';
            alert.classList.remove('pulse');
            console.log('🔍 [DEBUG] Ocultando alerta - no hay chats sin responder');
        }
    }

    // Solicitar permisos de notificación del navegador
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.log('❌ Este navegador no soporta notificaciones');
            return false;
        }

        if (Notification.permission === 'granted') {
            return true;
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }

        return false;
    }

    // Enviar notificación del navegador
    async sendBrowserNotification(senderName, message) {
        try {
            const hasPermission = await this.requestNotificationPermission();
            
            if (!hasPermission) {
                console.log('⚠️ Permisos de notificación denegados');
                return;
            }

            const notification = new Notification('Nuevo mensaje de ' + senderName, {
                body: message.length > 50 ? message.substring(0, 50) + '...' : message,
                icon: 'https://www.gravatar.com/avatar/?d=mp&f=y',
                badge: 'https://www.gravatar.com/avatar/?d=mp&f=y',
                tag: 'deseo-chat',
                requireInteraction: false,
                silent: false
            });

            // Cerrar la notificación después de 5 segundos
            setTimeout(() => {
                notification.close();
            }, 5000);

            // Al hacer click en la notificación, abrir la página de chats
            notification.onclick = () => {
                window.focus();
                window.location.href = 'chats.html';
                notification.close();
            };

            console.log('✅ Notificación del navegador enviada para:', senderName);
            
        } catch (error) {
            console.error('❌ Error enviando notificación del navegador:', error);
        }
    }

    async markAllChatsAsRead() {
        if (!this.database || !this.currentUser) {
            console.error('❌ Firebase o usuario no disponible');
            return;
        }

        try {
            const currentUserId = this.currentUser.id;
            const chatsRef = this.database.ref('chats');
            const snapshot = await chatsRef.once('value');
            const chatsData = snapshot.val();

            if (!chatsData) return;

            const updatePromises = [];

            Object.entries(chatsData).forEach(([chatId, chat]) => {
                if (chat.participants && chat.participants[currentUserId]) {
                    const userParticipant = chat.participants[currentUserId];
                    
                    // Solo marcar como leídos si el usuario es proveedor
                    if (userParticipant.role === 'provider' && chat.messages) {
                        const messages = Object.values(chat.messages);
                        
                        messages.forEach(message => {
                            if (message.senderId !== currentUserId && 
                                message.senderId !== 'system' && 
                                !message.responded) {
                                
                                // Marcar mensaje como respondido
                                const messageRef = this.database.ref(`chats/${chatId}/messages/${message.id}`);
                                updatePromises.push(
                                    messageRef.update({ responded: true, respondedAt: new Date().toISOString() })
                                );
                            }
                        });
                    }
                }
            });

            await Promise.all(updatePromises);
            
            this.showNotification('Todos los chats marcados como leídos', 'success');
            console.log('✅ Todos los chats marcados como leídos');
            
        } catch (error) {
            console.error('❌ Error marcando chats como leídos:', error);
            this.showNotification('Error al marcar chats como leídos', 'error');
        }
    }

    // ===== NOTIFICACIÓN DE MENSAJES NUEVOS =====
    initializeNewMessagesNotification() {
        console.log('🔍 [DEBUG] Inicializando notificación de mensajes nuevos...');
        
        const notificationElement = document.getElementById('newMessagesNotification');
        if (!notificationElement) {
            console.error('❌ Elemento newMessagesNotification no encontrado');
            return;
        }

        // Event listener para click en la notificación
        notificationElement.addEventListener('click', () => {
            console.log('🔍 [DEBUG] Click en notificación de mensajes nuevos');
            this.markNewMessagesAsRead();
        });

        // Cargar mensajes existentes y establecer listener
        this.loadAllMessages();
        this.setupNewMessagesListener();
        
        // Función de prueba temporal (eliminar en producción)
        this.addTestButton();
        
        console.log('✅ [DEBUG] Notificación de mensajes nuevos inicializada');
    }

    async loadAllMessages() {
        if (!this.database || !this.currentUser) return;

        try {
            const chatsRef = this.database.ref('chats');
            const snapshot = await chatsRef.once('value');
            const chatsData = snapshot.val();

            if (!chatsData) return;

            const currentUserId = this.currentUser.id;
            let initialNewMessagesCount = 0;

            console.log('🔍 [DEBUG] Cargando mensajes existentes...');

            // Cargar todos los mensajes de chats donde participa el usuario
            Object.entries(chatsData).forEach(([chatId, chat]) => {
                if (chat.participants && chat.participants[currentUserId]) {
                    if (chat.messages) {
                        Object.values(chat.messages).forEach(message => {
                            this.allMessages.set(message.id, message);
                            
                            // Si es un mensaje que no es del usuario actual y no es del sistema,
                            // considerarlo como "nuevo" inicialmente
                            if (message.senderId !== currentUserId && 
                                message.senderId !== 'system') {
                                initialNewMessagesCount++;
                            }
                        });
                    }
                }
            });

            console.log('🔍 [DEBUG] Mensajes cargados:', this.allMessages.size);
            console.log('🔍 [DEBUG] Mensajes nuevos iniciales detectados:', initialNewMessagesCount);

            // Si hay mensajes nuevos iniciales, mostrar la notificación
            if (initialNewMessagesCount > 0) {
                this.newMessagesCount = initialNewMessagesCount;
                this.updateNewMessagesNotification(this.newMessagesCount);
            }
        } catch (error) {
            console.error('❌ Error cargando mensajes:', error);
        }
    }

    setupNewMessagesListener() {
        if (!this.database || !this.currentUser) {
            console.error('❌ Firebase o usuario no disponible');
            return;
        }

        // Limpiar listener anterior si existe
        if (this.newMessagesListener) {
            this.newMessagesListener.off();
        }

        const chatsRef = this.database.ref('chats');

        this.newMessagesListener = chatsRef.on('value', (snapshot) => {
            const chatsData = snapshot.val();
            
            if (!chatsData) {
                this.updateNewMessagesNotification(0);
                return;
            }

            console.log('🔍 [DEBUG] Verificando mensajes nuevos en chats...');
            
            let newMessagesCount = 0;
            const currentUserId = this.currentUser.id;

            Object.values(chatsData).forEach(chat => {
                if (chat.participants && chat.participants[currentUserId]) {
                    if (chat.messages) {
                        const messages = Object.values(chat.messages);
                        
                        messages.forEach(message => {
                            const messageId = message.id;
                            const previouslyKnown = this.allMessages.has(messageId);
                            
                            // Si es un mensaje nuevo Y no es del usuario actual Y no es del sistema
                            if (!previouslyKnown && 
                                message.senderId !== currentUserId && 
                                message.senderId !== 'system') {
                                console.log('🔍 [DEBUG] Nuevo mensaje detectado:', message);
                                console.log('🔍 [DEBUG] - Chat ID:', chat.id);
                                console.log('🔍 [DEBUG] - Sender ID:', message.senderId);
                                console.log('🔍 [DEBUG] - Current User ID:', currentUserId);
                                console.log('🔍 [DEBUG] - Message:', message.message);
                                newMessagesCount++;
                            }
                            
                            // Actualizar cache
                            this.allMessages.set(messageId, message);
                        });
                    }
                }
            });

            console.log('🔍 [DEBUG] Mensajes nuevos encontrados en esta verificación:', newMessagesCount);
            console.log('🔍 [DEBUG] Total mensajes en cache:', this.allMessages.size);

            if (newMessagesCount > 0) {
                this.newMessagesCount += newMessagesCount;
                console.log('🔍 [DEBUG] Total mensajes nuevos acumulados:', this.newMessagesCount);
                this.updateNewMessagesNotification(this.newMessagesCount);
            }
        });
    }

    updateNewMessagesNotification(count) {
        const notificationElement = document.getElementById('newMessagesNotification');
        const countElement = document.getElementById('newMessagesCount');

        if (!notificationElement || !countElement) {
            console.error('❌ Elementos de notificación no encontrados');
            return;
        }

        if (count > 0) {
            countElement.textContent = count;
            notificationElement.style.display = 'block';
            
            // Añadir animación de pulso si hay 3 o más mensajes nuevos
            if (count >= 3) {
                notificationElement.classList.add('pulse');
                setTimeout(() => {
                    notificationElement.classList.remove('pulse');
                }, 2000);
            }
            
            console.log('🔍 [DEBUG] Notificación mostrada con', count, 'mensajes nuevos');
        } else {
            notificationElement.style.display = 'none';
            notificationElement.classList.remove('pulse');
            console.log('🔍 [DEBUG] Notificación ocultada');
        }
    }

    markNewMessagesAsRead() {
        console.log('🔍 [DEBUG] Marcando todos los mensajes nuevos como leídos...');
        
        const notificationElement = document.getElementById('newMessagesNotification');
        if (notificationElement) {
            notificationElement.style.display = 'none';
            notificationElement.classList.remove('pulse');
        }

        // Limpiar el cache de mensajes conocidos para que los mensajes actuales
        // no se consideren "nuevos" en futuras verificaciones
        this.allMessages.clear();
        
        // Recargar mensajes para establecer nueva línea base
        this.loadAllMessages();

        this.newMessagesCount = 0;
        
        this.showNotification('Mensajes marcados como leídos', 'success');
        console.log('✅ [DEBUG] Mensajes nuevos marcados como leídos');
    }

    // Función de prueba temporal (eliminar en producción)
    addTestButton() {
        // Crear botón de prueba temporal
        const testButton = document.createElement('button');
        testButton.innerHTML = '🧪 Test Notificación';
        testButton.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            z-index: 9999;
            background: #ff6b6b;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;
        
        testButton.addEventListener('click', () => {
            console.log('🧪 [TEST] Simulando mensaje nuevo...');
            this.newMessagesCount += 1;
            this.updateNewMessagesNotification(this.newMessagesCount);
        });

        document.body.appendChild(testButton);
        
        // Eliminar botón después de 30 segundos
        setTimeout(() => {
            if (testButton.parentNode) {
                testButton.parentNode.removeChild(testButton);
            }
        }, 30000);
    }
}

// ===== INICIALIZACIÓN DE LA APLICACIÓN =====
// La inicialización de DeseoApp ahora se maneja en index.html dentro del window.addEventListener('load')
// para asegurar que el DOM esté completamente cargado antes de la inicialización