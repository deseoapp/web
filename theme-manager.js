// ===== THEME MANAGER - GESTIÓN GLOBAL DE TEMAS =====
console.log('🎨 Inicializando Theme Manager...');

class ThemeManager {
    constructor() {
        this.currentTheme = this.getStoredTheme() || 'light';
        this.init();
    }

    init() {
        console.log('🎨 ThemeManager: Inicializando...');
        
        // Aplicar tema guardado al cargar la página
        this.applyTheme(this.currentTheme);
        
        // Configurar botón de tema si existe
        this.setupThemeToggle();
        
        // Escuchar cambios de tema desde otras pestañas
        this.setupStorageListener();
        
        console.log(`✅ ThemeManager: Inicializado con tema ${this.currentTheme}`);
    }

    getStoredTheme() {
        try {
            return localStorage.getItem('deseo_theme') || 'dark';
        } catch (error) {
            console.warn('⚠️ Error accediendo a localStorage:', error);
            return 'dark';
        }
    }

    setStoredTheme(theme) {
        try {
            localStorage.setItem('deseo_theme', theme);
            console.log(`💾 Tema guardado en localStorage: ${theme}`);
        } catch (error) {
            console.warn('⚠️ Error guardando tema en localStorage:', error);
        }
    }

    applyTheme(theme) {
        console.log(`🎨 Aplicando tema: ${theme}`);
        
        // Aplicar tema al documento
        document.documentElement.setAttribute('data-theme', theme);
        document.body.classList.toggle('dark-mode', theme === 'dark');
        
        // Actualizar botón de tema si existe
        this.updateThemeToggleButton(theme);
        
        // Guardar tema
        this.setStoredTheme(theme);
        this.currentTheme = theme;
        
        // Disparar evento personalizado para que otras páginas se enteren
        this.dispatchThemeChangeEvent(theme);
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
        return newTheme;
    }

    setupThemeToggle() {
        // Buscar botón de tema en diferentes ubicaciones posibles
        const themeToggle = document.getElementById('themeToggle') || 
                           document.getElementById('theme-toggle') ||
                           document.querySelector('.theme-toggle') ||
                           document.querySelector('[data-theme-toggle]');
        
        if (themeToggle) {
            console.log('🎨 Botón de tema encontrado, configurando...');
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        } else {
            console.log('⚠️ Botón de tema no encontrado en esta página');
        }
    }

    updateThemeToggleButton(theme) {
        const themeToggle = document.getElementById('themeToggle') || 
                           document.getElementById('theme-toggle') ||
                           document.querySelector('.theme-toggle') ||
                           document.querySelector('[data-theme-toggle]');
        
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            if (icon) {
                icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
            }
        }
    }

    setupStorageListener() {
        // Escuchar cambios en localStorage desde otras pestañas
        window.addEventListener('storage', (e) => {
            if (e.key === 'deseo_theme' && e.newValue !== this.currentTheme) {
                console.log('🔄 Tema cambiado desde otra pestaña:', e.newValue);
                this.currentTheme = e.newValue;
                this.applyTheme(e.newValue);
            }
        });
    }

    dispatchThemeChangeEvent(theme) {
        // Disparar evento personalizado para que otros scripts se enteren
        const event = new CustomEvent('themeChanged', {
            detail: { theme: theme }
        });
        window.dispatchEvent(event);
    }

    // Método para obtener el tema actual
    getCurrentTheme() {
        return this.currentTheme;
    }

    // Método para forzar un tema específico
    setTheme(theme) {
        if (theme === 'light' || theme === 'dark') {
            this.applyTheme(theme);
        } else {
            console.warn('⚠️ Tema inválido:', theme);
        }
    }
}

// Crear instancia global
let themeManager;

// Inicializar cuando el DOM esté listo
function initializeThemeManager() {
    if (!themeManager) {
        themeManager = new ThemeManager();
        window.themeManager = themeManager;
        console.log('✅ ThemeManager global creado');
    }
}

// Inicializar inmediatamente si el DOM ya está listo
if (document.readyState !== 'loading') {
    initializeThemeManager();
} else {
    document.addEventListener('DOMContentLoaded', initializeThemeManager);
}

// También inicializar si el script se carga después del DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeThemeManager);
} else {
    initializeThemeManager();
}

// Exportar para uso en otros scripts
window.ThemeManager = ThemeManager;