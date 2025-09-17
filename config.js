/**
 * CONFIGURACIÓN DE DESEO APP
 * Archivo de configuración para la plataforma de micro-deseos
 * VERSIÓN 2.0 - Proyecto parcero
 */

console.log('🔥 [CONFIG] Cargando configuración Firebase - VERSIÓN 3.0 - Proyecto parcero');
console.log('🔥 [CONFIG] Timestamp:', new Date().toISOString());

// ===== CONFIGURACIÓN DE MAPBOX =====
const CONFIG = {
    // IMPORTANTE: Reemplaza 'TU_MAPBOX_TOKEN' con tu token real de Mapbox
    // Obtén tu token en: https://account.mapbox.com/access-tokens/
    MAPBOX_TOKEN: 'pk.eyJ1Ijoic2ltb245OTA1MjAiLCJhIjoiY2p1OXpqM214MjB4cjRkbzJnMHFhZDhlOSJ9.9P0l2uLH_QEtD0-GtASk6Q', // pk.eyJ1Ijoi...
    
    // Configuración del mapa
    MAP: {
        // Coordenadas por defecto (Madrid, España)
        defaultCenter: [-3.7038, 40.4168],
        defaultZoom: 12,
        
        // Estilos de mapa disponibles
        styles: {
            light: 'mapbox://styles/mapbox/light-v11',
            dark: 'mapbox://styles/mapbox/dark-v11',
            streets: 'mapbox://styles/mapbox/streets-v12',
            satellite: 'mapbox://styles/mapbox/satellite-v9',
            outdoors: 'mapbox://styles/mapbox/outdoors-v12'
        },
        
        // Estilo por defecto
        defaultStyle: 'dark'
    },
    
    // Configuración de la aplicación
    APP: {
        name: 'Deseo',
        version: '1.0.0',
        description: 'Plataforma de Micro-Deseos',
        
        // Configuración de notificaciones
        notifications: {
            duration: 4000, // 4 segundos
            position: 'top-right'
        },
        
        // Configuración de filtros por defecto
        defaultFilters: {
            maxPrice: 1000,
            category: '',
            distance: 10
        }
    },
    
    // Configuración de categorías
    CATEGORIES: {
        comida: {
            name: 'Comida',
            icon: 'fas fa-utensils',
            color: '#10b981',
            priceRange: [5, 25]
        },
        transporte: {
            name: 'Transporte',
            icon: 'fas fa-car',
            color: '#3b82f6',
            priceRange: [8, 30]
        },
        entretenimiento: {
            name: 'Entretenimiento',
            icon: 'fas fa-gamepad',
            color: '#8b5cf6',
            priceRange: [15, 50]
        },
        servicios: {
            name: 'Servicios',
            icon: 'fas fa-tools',
            color: '#f59e0b',
            priceRange: [10, 40]
        },
        compras: {
            name: 'Compras',
            icon: 'fas fa-shopping-bag',
            color: '#ef4444',
            priceRange: [10, 35]
        }
    },
    
    // Configuración de IA
    AI: {
        responseDelay: 1000, // 1 segundo
        maxRetries: 3,
        // Gemini configuration using REST API (recommended by Google)
        GEMINI: {
            enabled: true,
            apiKey: 'AIzaSyCIwYtCIlFQMOZGEP3VqEhQ0kycBIFfBMc', // https://ai.google.dev/ (Generative Language API)
            model: 'gemini-2.0-flash',
            apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models'
        },
        // Diccionario básico de categorías y palabras clave
        KEYWORDS: {
            viajes: ['viaje', 'viajar', 'playa', 'montaña', 'hotel', 'vuelo', 'turismo', 'vacaciones', 'ruta', 'tour'],
            comida: ['comida', 'café', 'coffee', 'almuerzo', 'cena', 'desayuno', 'pizza', 'hamburguesa', 'restaurante', 'postre'],
            ocio: ['ocio', 'diversión', 'cine', 'película', 'leer', 'música', 'concierto', 'parque', 'paseo', 'juego'],
            trabajo: ['trabajo', 'freelance', 'proyecto', 'reunión', 'oficina', 'empleo', 'currículum', 'cv', 'entrevista', 'deadline'],
            amor: ['amor', 'cita', 'pareja', 'novia', 'novio', 'romántico', 'regalo', 'flores', 'detalles', 'san valentín'],
            transporte: ['transporte', 'uber', 'taxi', 'carro', 'coche', 'moto', 'bus', 'metro', 'traslado', 'llevar'],
            servicios: ['servicio', 'arreglar', 'reparar', 'limpieza', 'pasear perro', 'jardín', 'mudanza', 'clases', 'ayuda', 'cuidar'],
            compras: ['comprar', 'compra', 'tienda', 'supermercado', 'pedido', 'producto', 'envío', 'entrega', 'mercado', 'regalo']
        },
        
        // Análisis emocional
        EMOTIONAL_ANALYSIS: {
            positive: ['feliz', 'contento', 'alegre', 'emocionado', 'genial', 'perfecto', 'excelente', 'fantástico', 'increíble', 'maravilloso', 'bueno', 'bien', 'sí', 'claro', 'quiero', 'necesito', 'busco', 'deseo', 'me gusta', 'me encanta', 'me fascina', 'me interesa', 'me apetece', 'me gustaría', 'me encantaría', 'me fascinaría', 'me interesaría', 'me apetecería', 'genial', 'perfecto', 'excelente', 'fantástico', 'increíble', 'maravilloso', 'bueno', 'bien', 'sí', 'claro', 'quiero', 'necesito', 'busco', 'deseo', 'me gusta', 'me encanta', 'me fascina', 'me interesa', 'me apetece', 'me gustaría', 'me encantaría', 'me fascinaría', 'me interesaría', 'me apetecería'],
            negative: ['triste', 'deprimido', 'mal', 'terrible', 'horrible', 'fatal', 'pésimo', 'odio', 'detesto', 'no', 'nunca', 'jamás', 'imposible', 'difícil', 'complicado', 'problema', 'error', 'fallo', 'fracaso', 'decepción', 'frustración', 'ira', 'enojo', 'molesto', 'irritado', 'furioso', 'enojado', 'molesto', 'irritado', 'furioso', 'enojado', 'estresado', 'ansioso', 'preocupado', 'nervioso', 'tenso', 'agobiado', 'abrumado', 'cansado', 'agotado', 'exhausto', 'frustrado', 'decepcionado', 'triste', 'deprimido', 'mal', 'terrible', 'horrible', 'fatal', 'pésimo', 'odio', 'detesto', 'no', 'nunca', 'jamás', 'imposible', 'difícil', 'complicado', 'problema', 'error', 'fallo', 'fracaso', 'decepción', 'frustración', 'ira', 'enojo', 'molesto', 'irritado', 'furioso', 'enojado', 'estresado', 'ansioso', 'preocupado', 'nervioso', 'tenso', 'agobiado', 'abrumado', 'cansado', 'agotado', 'exhausto', 'frustrado', 'decepcionado'],
            neutral: ['ok', 'vale', 'bien', 'entendido', 'claro', 'sí', 'no', 'tal vez', 'quizás', 'posiblemente', 'probablemente', 'seguramente', 'ciertamente', 'efectivamente', 'exactamente', 'precisamente', 'justamente', 'exactamente', 'precisamente', 'justamente', 'puede ser', 'tal vez', 'quizás', 'posiblemente', 'probablemente', 'seguramente', 'ciertamente', 'efectivamente', 'exactamente', 'precisamente', 'justamente', 'puede ser', 'tal vez', 'quizás', 'posiblemente', 'probablemente', 'seguramente', 'ciertamente', 'efectivamente', 'exactamente', 'precisamente', 'justamente', 'puede ser']
        },
        
        // Respuestas predefinidas
        responses: {
            greetings: [
                "¡Hola! Soy tu asistente de deseos. ¿En qué puedo ayudarte hoy?",
                "¡Perfecto! Cuéntame qué necesitas y te ayudo a crear el deseo ideal.",
                "¡Excelente! Vamos a crear un deseo que alguien pueda cumplir fácilmente."
            ],
            priceSuggestions: {
                comida: "Para deseos de comida, sugiero entre $5-25 dependiendo de lo que necesites.",
                servicios: "Para servicios, el precio típico es $10-40 según la complejidad.",
                compras: "Para compras, considera $10-35 más el costo de los productos.",
                transporte: "Para transporte, $8-30 es un rango justo según la distancia.",
                entretenimiento: "Para entretenimiento, $15-50 es apropiado según la actividad."
            }
        }
    },
    
    // Configuración de Bold Payment Gateway
    BOLD: {
        // API key real de Bold para el proyecto Deseo
        API_KEY: 'H-HdPzurw8OPki3Fv8_WU-qFOAPQ9SarD_HV36Fp4_I',
        ENVIRONMENT: 'sandbox', // 'sandbox' para pruebas, 'production' para producción
        CURRENCY: 'COP', // Pesos colombianos
        WEBHOOK_URL: 'https://simon990520.github.io/deseo/webhooks/bold', // URL para webhooks de Bold
        // Endpoint backend que devuelve la firma de integridad (HMAC) requerida por Bold
        // Debe implementarse en tu servidor usando tu Secret Key (NO en el frontend)
        SIGNATURE_ENDPOINT: 'https://server-eo9ez6okm-koddio999s-projects.vercel.app/api/bold/integrity-signature',
        // Endpoint para crear links de pago (proxy para evitar CORS)
        PAYMENT_LINK_ENDPOINT: 'https://server-eo9ez6okm-koddio999s-projects.vercel.app/api/bold/create-payment-link',
        // Opcional: token para saltar Vercel Deployment Protection en el endpoint
        // Genera uno en: Project → Settings → Deployment Protection → Generate Bypass Token
        VERCEL_BYPASS_TOKEN: ''
    },
    
    // Configuración de geolocalización
    GEOLOCATION: {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutos
    },
    
    // Configuración de desarrollo
    DEBUG: {
        enabled: false,
        logLevel: 'info' // 'debug', 'info', 'warn', 'error'
    },

    // CLERK AUTHENTICATION CONFIGURATION
    CLERK: {
        enabled: true,
        publishableKey: 'pk_test_bWVycnktamF5LTExLmNsZXJrLmFjY291bnRzLmRldiQ' // Reemplaza con tu clave publicable de Clerk
    },

    // ===== CONFIGURACIÓN DE FIREBASE (Realtime Database) =====
    // CONFIGURACIÓN REAL - Proyecto parcero - VERSIÓN 2.0
    FIREBASE: {
        enabled: true, // Habilitado para usar Firebase Realtime Database
        config: {
            // CONFIGURACIÓN REAL - Proyecto parcero
            apiKey: "AIzaSyCcM6jTBDMl_Ax3tAhbv7OAVaTSAnzFUXw",
            authDomain: "parcero-6b971.firebaseapp.com",
            databaseURL: "https://parcero-6b971-default-rtdb.firebaseio.com",
            projectId: "parcero-6b971",
            storageBucket: "parcero-6b971.firebasestorage.app",
            messagingSenderId: "855329582875",
            appId: "1:855329582875:web:e2926159a49d196cb36dbe",
            measurementId: "G-604T468RBK"
        },
        database: {
            wishes: 'wishes',
            users: 'users',     
            conversations: 'conversations'
        }
    }
};

// ===== VERIFICACIÓN DE CONFIGURACIÓN =====
console.log('🔥 [CONFIG] Firebase config cargada:', CONFIG.FIREBASE.config);
console.log('🔥 [CONFIG] databaseURL:', CONFIG.FIREBASE.config.databaseURL);
console.log('🔥 [CONFIG] projectId:', CONFIG.FIREBASE.config.projectId);
console.log('🔥 [CONFIG] Verificando configuración completa:', {
    enabled: CONFIG.FIREBASE.enabled,
    databaseURL: CONFIG.FIREBASE.config.databaseURL,
    projectId: CONFIG.FIREBASE.config.projectId,
    apiKey: CONFIG.FIREBASE.config.apiKey
});

// ===== FUNCIONES DE UTILIDAD =====

/**
 * Obtiene la configuración de una categoría
 */
function getCategoryConfig(category) {
    return CONFIG.CATEGORIES[category] || {
        name: 'Otros',
        icon: 'fas fa-star',
        color: '#6b7280',
        priceRange: [5, 50]
    };
}

/**
 * Obtiene el nombre de una categoría
 */
function getCategoryName(category) {
    return getCategoryConfig(category).name;
}

/**
 * Obtiene el color de una categoría
 */
function getCategoryColor(category) {
    return getCategoryConfig(category).color;
}

/**
 * Obtiene el rango de precios sugerido para una categoría
 */
function getCategoryPriceRange(category) {
    return getCategoryConfig(category).priceRange;
}

/**
 * Valida si el token de Mapbox está configurado
 */
function isMapboxTokenConfigured() {
    return CONFIG.MAPBOX_TOKEN && 
           CONFIG.MAPBOX_TOKEN !== 'TU_MAPBOX_TOKEN' && 
           CONFIG.MAPBOX_TOKEN.startsWith('pk.');
}

/**
 * Obtiene una respuesta aleatoria de IA
 */
function getRandomAIResponse(type) {
    const responses = CONFIG.AI.responses[type];
    if (!responses || responses.length === 0) return '';
    return responses[Math.floor(Math.random() * responses.length)];
}

/**
 * Log de debug (solo si está habilitado)
 */
function debugLog(message, level = 'info') {
    if (!CONFIG.DEBUG.enabled) return;
    
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(CONFIG.DEBUG.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    if (messageLevelIndex >= currentLevelIndex) {
        console[level](`[Deseo App] ${message}`);
    }
}

// ===== EXPORTAR CONFIGURACIÓN =====
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
    window.getCategoryConfig = getCategoryConfig;
    window.getCategoryName = getCategoryName;
    window.getCategoryColor = getCategoryColor;
    window.getCategoryPriceRange = getCategoryPriceRange;
    window.isMapboxTokenConfigured = isMapboxTokenConfigured;
    window.getRandomAIResponse = getRandomAIResponse;
    window.debugLog = debugLog;
}

// ===== LOGS FINALES =====
console.log('⚙️ Configuración de Deseo App cargada');
console.log('🗺️ Token de Mapbox:', isMapboxTokenConfigured() ? '✅ Configurado' : '❌ No configurado');
console.log('🔥 Firebase:', CONFIG.FIREBASE.enabled ? '✅ Habilitado' : '❌ Deshabilitado');
console.log('📱 Versión:', CONFIG.APP.version);