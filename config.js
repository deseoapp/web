/**
 * CONFIGURACIÓN DE DESEO APP
 * Archivo de configuración para la plataforma de micro-deseos
 */

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
        defaultStyle: 'light'
    },
    
    // Configuración de Gemini AI
    GEMINI: {
        // IMPORTANTE: Reemplaza 'TU_GEMINI_API_KEY' con tu API key real de Gemini
        // Obtén tu API key en: https://makersuite.google.com/app/apikey
        API_KEY: 'TU_GEMINI_API_KEY', // Reemplaza con tu API key real
        MODEL: 'gemini-1.5-flash',
        MAX_TOKENS: 1000,
        TEMPERATURE: 0.7
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
    }
};

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
 * Obtiene el icono de una categoría
 */
function getCategoryIcon(category) {
    return getCategoryConfig(category).icon;
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
    window.getCategoryIcon = getCategoryIcon;
    window.getCategoryColor = getCategoryColor;
    window.getCategoryPriceRange = getCategoryPriceRange;
    window.isMapboxTokenConfigured = isMapboxTokenConfigured;
    window.getRandomAIResponse = getRandomAIResponse;
    window.debugLog = debugLog;
}

console.log('⚙️ Configuración de Deseo App cargada');
console.log('🗺️ Token de Mapbox:', isMapboxTokenConfigured() ? '✅ Configurado' : '❌ No configurado');
console.log('📱 Versión:', CONFIG.APP.version);