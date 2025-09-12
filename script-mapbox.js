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

// ===== CONFIGURACIÓN DE MAPBOX =====
// La configuración se carga desde config.js
const MAPBOX_TOKEN = CONFIG.MAPBOX_TOKEN;
const MAP_CONFIG = CONFIG.MAP;

// ===== ESTADO GLOBAL DE LA APLICACIÓN =====
class DeseoApp {
    constructor() {
        this.map = null;
        this.wishes = [];
        this.markers = [];
        this.currentUser = { id: 'user1', name: 'Usuario Actual' };
        this.activeChat = null;
        this.userLocation = null;
        this.userLocationMarker = null;
        this.filters = {
            maxPrice: 1000,
            category: '',
            distance: 10
        };
        this.aiResponses = this.initializeAIResponses();
        // Historial de chat con IA (para contexto de Gemini)
        this.aiChatHistory = [];
        // Perfil de intereses del usuario (persistido en localStorage)
        this.userProfile = this.loadUserProfile();
        this.initializeApp();
    }

    // ===== INICIALIZACIÓN =====
    async initializeApp() {
        try {
            await this.initializeMapbox();
            this.setupEventListeners();
            this.generateSampleWishes();
            this.renderWishesOnMap();
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

    // ===== CONFIGURACIÓN DE EVENT LISTENERS =====
    setupEventListeners() {
        // Botones principales
        document.getElementById('createWishBtn').addEventListener('click', () => this.openCreateWishModal());
        document.getElementById('floatingCreateBtn').addEventListener('click', () => this.openCreateWishModal());
        document.getElementById('filterBtn').addEventListener('click', () => this.openFilterModal());

        // Controles del mapa
        document.getElementById('locateBtn').addEventListener('click', () => this.locateUser());
        document.getElementById('zoomInBtn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOutBtn').addEventListener('click', () => this.zoomOut());

        // Modales - botones de cerrar
        document.getElementById('closeCreateModal').addEventListener('click', () => this.closeModal('createWishModal'));
        document.getElementById('closeDetailsModal').addEventListener('click', () => this.closeModal('wishDetailsModal'));
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

        // Detalles del deseo
        document.getElementById('acceptWishBtn').addEventListener('click', () => this.acceptWish());
        document.getElementById('viewDetailsBtn').addEventListener('click', () => this.viewWishDetails());

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

        // Filtros
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

    // ===== GENERACIÓN DE DATOS DE PRUEBA =====
    generateSampleWishes() {
        const sampleWishes = [
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

        this.wishes = sampleWishes;
    }

    // ===== RENDERIZADO DEL MAPA =====
    renderWishesOnMap() {
        // Limpiar marcadores existentes
        this.clearMarkers();

        this.wishes
            .filter(wish => wish.status === 'active')
            .filter(wish => this.passesFilters(wish))
            .forEach(wish => {
                this.addWishMarker(wish);
            });
    }

    clearMarkers() {
        this.markers.forEach(marker => marker.remove());
        this.markers = [];
    }

    addWishMarker(wish) {
        // Crear elemento HTML para el marcador
        const markerElement = document.createElement('div');
        markerElement.className = 'custom-marker';
        
        // Icono según categoría
        const categoryIcon = getCategoryIcon(wish.category);

        markerElement.innerHTML = `
            <i class="${categoryIcon}"></i>
            <span class="marker-price">$${wish.price}</span>
        `;

        // Crear marcador de Mapbox
        const marker = new mapboxgl.Marker(markerElement)
            .setLngLat(wish.coordinates)
            .addTo(this.map);

        // Crear popup
        const popup = new mapboxgl.Popup({
            offset: 25,
            closeButton: true,
            closeOnClick: false
        }).setHTML(this.createPopupHTML(wish));

        marker.setPopup(popup);

        // Evento de clic en el marcador
        markerElement.addEventListener('click', () => {
            this.showWishDetails(wish);
        });

        this.markers.push(marker);
    }

    createPopupHTML(wish) {
        return `
            <div class="wish-popup">
                <h3>${wish.title}</h3>
                <p>${wish.description}</p>
                <div class="popup-meta">
                    <span class="price">$${wish.price}</span>
                    <span class="category">${this.getCategoryName(wish.category)}</span>
                </div>
                <div class="popup-actions">
                    <button class="btn-secondary" onclick="window.deseoApp.viewWishDetails('${wish.id}')">
                        Ver Detalles
                    </button>
                    <button class="btn-primary" onclick="window.deseoApp.acceptWish('${wish.id}')">
                        Aceptar
                    </button>
                </div>
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
        this.aiChatHistory = [
            { role: 'model', content: '¡Hola! Soy tu acompañante. ¿Qué tienes en mente hoy?' }
        ];
    }

    async sendAIMessage() {
        const input = document.getElementById('aiChatInput');
        const message = input.value.trim();
        
        if (!message) return;

        // Agregar mensaje del usuario
        this.addMessageToChat('user', message);
        this.aiChatHistory.push({ role: 'user', content: message });
        input.value = '';

        // Análisis básico de texto y actualización de perfil
        const analysis = this.analyzeText(message);
        if (analysis.matchedCategories.length > 0) {
            this.updateUserProfile(analysis.matchedCategories);
        }

        // Respuesta de IA (Gemini con fallback)
        const aiResponse = await this.respondWithAI(message, analysis);
        this.addMessageToChat('ai', aiResponse.text);
        this.aiChatHistory.push({ role: 'model', content: aiResponse.text });
        
        if (aiResponse.wishData) {
            this.showWishPreview(aiResponse.wishData);
        }

        // Sugerencias personalizadas en base a intereses
        this.maybeShowPersonalizedSuggestion();
    }

    addMessageToChat(sender, message) {
        const messagesContainer = document.getElementById('aiChatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `${sender}-message`;
        
        const avatar = sender === 'ai' ? 
            '<div class="ai-avatar"><i class="fas fa-robot"></i></div>' :
            '<div class="user-avatar"><i class="fas fa-user"></i></div>';

        messageDiv.innerHTML = `
            ${avatar}
            <div class="message-content">
                <p>${message}</p>
            </div>
        `;

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    generateAIResponse(userMessage) {
        const lowerMessage = userMessage.toLowerCase();
        
        // Detectar tipo de deseo y generar respuesta
        if (lowerMessage.includes('café') || lowerMessage.includes('coffee') || lowerMessage.includes('bebida')) {
            return {
                text: "¡Perfecto! Un deseo de comida. Basándome en tu solicitud, sugiero un precio de $8-12. ¿Te parece bien? También podrías especificar el tipo de café y la ubicación donde lo necesitas.",
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
                text: "¡Excelente! Un servicio de cuidado de mascotas. Para pasear un perro, recomiendo un precio de $15-25 dependiendo del tiempo. ¿Cuánto tiempo necesitas que dure el paseo?",
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
                text: "¡Genial! Un deseo de compras. El precio dependerá de los productos, pero sugiero $15-30. ¿Podrías ser más específico sobre qué necesitas comprar?",
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
                text: "¡Perfecto! Un servicio de entrega. Para entregas locales, sugiero $10-20 dependiendo de la distancia. ¿A dónde necesitas que se entregue?",
                wishData: {
                    title: "Servicio de entrega",
                    description: userMessage,
                    price: 15,
                    category: "servicios"
                }
            };
        }
        
        // Respuesta genérica
        return {
            text: "Interesante deseo. Para ayudarte mejor, ¿podrías ser más específico sobre qué necesitas? También me gustaría saber si tienes alguna preferencia de precio o si hay algo especial que deba considerar.",
            wishData: null
        };
    }

    // ===== PERFIL DE USUARIO EN LOCALSTORAGE =====
    loadUserProfile() {
        try {
            const raw = localStorage.getItem('deseo_user_profile');
            if (raw) return JSON.parse(raw);
        } catch (e) { /* ignore */ }
        // Estructura base
        return {
            interests: {
                viajes: 0,
                comida: 0,
                ocio: 0,
                trabajo: 0,
                amor: 0,
                transporte: 0,
                entretenimiento: 0,
                servicios: 0,
                compras: 0
            },
            updatedAt: Date.now()
        };
    }

    saveUserProfile() {
        try {
            localStorage.setItem('deseo_user_profile', JSON.stringify(this.userProfile));
        } catch (e) { /* ignore */ }
    }

    updateUserProfile(categories) {
        categories.forEach(cat => {
            if (!(cat in this.userProfile.interests)) {
                this.userProfile.interests[cat] = 0;
            }
            this.userProfile.interests[cat] += 1;
        });
        this.userProfile.updatedAt = Date.now();
        this.saveUserProfile();
    }

    getTopInterests(limit = 3) {
        const entries = Object.entries(this.userProfile.interests);
        entries.sort((a, b) => b[1] - a[1]);
        return entries.slice(0, limit).map(([k, v]) => ({ category: k, count: v }));
    }

    // ===== ANÁLISIS BÁSICO DE TEXTO =====
    analyzeText(text) {
        const t = (text || '').toLowerCase();
        const categories = {
            viajes: ['viajar', 'viaje', 'playa', 'montaña', 'avión', 'hotel', 'turismo'],
            comida: ['comer', 'café', 'coffee', 'restaurante', 'pizza', 'hamburguesa', 'comida'],
            ocio: ['película', 'cine', 'juego', 'paseo', 'música', 'fiesta', 'ocio'],
            trabajo: ['trabajo', 'empleo', 'freelance', 'proyecto', 'oficina'],
            amor: ['amor', 'pareja', 'cita', 'romántico'],
            transporte: ['taxi', 'uber', 'llevar', 'entregar', 'transporte', 'paquete'],
            entretenimiento: ['concierto', 'videojuego', 'evento', 'diversión'],
            servicios: ['arreglar', 'instalar', 'pasear', 'perro', 'servicio'],
            compras: ['comprar', 'supermercado', 'tienda', 'mercado']
        };

        const matchedCategories = [];
        Object.entries(categories).forEach(([category, keywords]) => {
            if (keywords.some(k => t.includes(k))) {
                matchedCategories.push(category);
            }
        });

        return { matchedCategories };
    }

    // ===== GEMINI INTEGRATION (con fallback) =====
    async respondWithAI(userMessage, analysis) {
        // Si hay API Key configurada, intentamos usar Gemini
        const hasGeminiKey = window.CONFIG && window.CONFIG.GEMINI && window.CONFIG.GEMINI.API_KEY && window.CONFIG.GEMINI.API_KEY !== 'TU_GEMINI_API_KEY';
        if (hasGeminiKey) {
            try {
                const responseText = await this.callGeminiAPI(userMessage, analysis);
                // Intentar inferir wishData básico por categorías
                const fallback = this.generateAIResponse(userMessage);
                return {
                    text: responseText,
                    wishData: fallback.wishData || null
                };
            } catch (e) {
                console.warn('Gemini falló, usando fallback local:', e);
            }
        }
        // Fallback local
        return this.generateAIResponse(userMessage);
    }

    async callGeminiAPI(userMessage, analysis) {
        const apiKey = window.CONFIG.GEMINI.API_KEY;
        const model = window.CONFIG.GEMINI.MODEL || 'gemini-1.5-flash';
        const temperature = window.CONFIG.GEMINI.TEMPERATURE || 0.7;
        const maxTokens = window.CONFIG.GEMINI.MAX_TOKENS || 1000;

        const systemPrompt = `Eres un acompañante psicológico empático y un amigo que escucha. Mantén un tono amable y cercano. Analiza el mensaje del usuario, refleja sus emociones brevemente y sugiere pasos claros. Si aplica a la app de deseos, sugiere un título, categoría y rango de precio razonable. Categorías: comida, transporte, entretenimiento, servicios, compras, viajes, ocio, trabajo, amor.`;

        const history = this.aiChatHistory.slice(-8).map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`).join('\n');
        const interestSummary = this.getTopInterests(3).map(i => `${i.category}(${i.count})`).join(', ');

        const prompt = `${systemPrompt}\n\nIntereses del usuario: ${interestSummary || 'N/A'}\nCategorias detectadas ahora: ${(analysis.matchedCategories || []).join(', ') || 'N/A'}\n\nHistorial reciente:\n${history}\n\nMensaje actual del usuario: ${userMessage}\n\nResponde de forma breve (máx 3-4 oraciones). Si corresponde, incluye una sugerencia estructurada de deseo con formato: Título:, Categoría:, Precio sugerido:.`;

        // Llamada a Gemini vía fetch (API Generative Language v1beta; simulación genérica)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const body = {
            contents: [{ parts: [{ text: prompt }] }],
            safetySettings: [],
            generationConfig: { temperature, maxOutputTokens: maxTokens }
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('Gemini HTTP error ' + res.status);
        const data = await res.json();
        // Extraer texto (estructura típica de Gemini)
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Gracias por compartir. ¿Me cuentas un poco más?';
        return text;
    }

    // ===== SUGERENCIAS PERSONALIZADAS =====
    maybeShowPersonalizedSuggestion() {
        const top = this.getTopInterests(3);
        if (!top || top.length === 0) return;
        const best = top[0];
        if (!best || best.count <= 0) return;
        const suggestions = {
            viajes: 'Noto que te gustan los viajes, ¿quieres que te muestre deseos relacionados con viajar?',
            comida: 'Veo que te gusta la comida, ¿te muestro deseos de comida cercanos?',
            ocio: 'Parece que te interesa el ocio, ¿buscamos actividades cerca?',
            trabajo: 'Te interesa el trabajo, ¿quieres ver tareas disponibles?',
            amor: 'Te interesan temas de amor, ¿quieres consejos o actividades románticas?',
            transporte: 'Interés en transporte, ¿te muestro entregas o traslados?',
            entretenimiento: 'Te gusta el entretenimiento, ¿vemos planes y eventos?',
            servicios: 'Te interesan servicios, ¿te muestro tareas que ayudar?',
            compras: 'Interés en compras, ¿quieres ver recados y compras cercanas?'
        };
        const msg = suggestions[best.category];
        if (msg) {
            this.addMessageToChat('ai', msg);
            this.aiChatHistory.push({ role: 'model', content: msg });
        }
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

    // ===== DETALLES DEL DESEO =====
    showWishDetails(wish) {
        if (typeof wish === 'string') {
            wish = this.wishes.find(w => w.id === wish);
        }
        
        if (!wish) return;

        document.getElementById('wishDetailsTitle').textContent = wish.title;
        document.getElementById('wishDetailsDescription').textContent = wish.description;
        document.getElementById('wishDetailsPrice').textContent = `$${wish.price}`;
        document.getElementById('wishDetailsCategory').textContent = this.getCategoryName(wish.category);
        document.getElementById('wishDetailsLocation').textContent = 'Ubicación en el mapa';
        
        this.currentWish = wish;
        this.openModal('wishDetailsModal');
    }

    acceptWish(wishId) {
        const wish = typeof wishId === 'string' ? 
            this.wishes.find(w => w.id === wishId) : 
            this.currentWish;
            
        if (!wish) return;

        wish.status = 'in_progress';
        wish.acceptedBy = this.currentUser;
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

        this.closeModal('wishDetailsModal');
        this.openPrivateChat();
        this.renderWishesOnMap();
        this.showNotification('¡Deseo aceptado! Puedes coordinar los detalles en el chat.', 'success');
    }

    // ===== CHAT PRIVADO =====
    openPrivateChat() {
        if (!this.activeChat) return;

        document.getElementById('chatUserName').textContent = this.activeChat.otherUser.name;
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
        });

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
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

    // ===== FILTROS =====
    openFilterModal() {
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

        this.renderWishesOnMap();
        this.closeModal('filterModal');
        this.showNotification('Filtros aplicados correctamente.', 'success');
    }

    passesFilters(wish) {
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
    getCategoryName(category) {
        return getCategoryName(category);
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
}

// ===== INICIALIZACIÓN DE LA APLICACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
    // Verificar si Mapbox está disponible
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
        return;
    }

    window.deseoApp = new DeseoApp();
    // Exponer API pública mínima
    window.getTopInterests = () => window.deseoApp.getTopInterests();
});

console.log('🗺️ Deseo App con Mapbox cargada exitosamente!');
console.log('📱 Plataforma de micro-deseos con mapa real');
console.log('🤖 IA simulada activa');
console.log('🗺️ Mapa interactivo de Mapbox funcionando');
console.log('💬 Sistema de chat implementado');
console.log('⭐ Sistema de calificaciones activo');