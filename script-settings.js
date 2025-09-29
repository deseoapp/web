/**
 * Settings - Página de configuración
 * Maneja la configuración del usuario y preferencias de la aplicación
 */

class SettingsManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        console.log('🔍 SettingsManager: Inicializando...');
        
        // Cargar datos del usuario
        await this.loadCurrentUser();
        
        // Configurar event listeners
        this.setupEventListeners();
        
        // Cargar configuración
        this.loadSettings();
        
        console.log('✅ SettingsManager: Inicializado correctamente');
    }

    async loadCurrentUser() {
        try {
            const userData = localStorage.getItem('deseo_user');
            if (userData) {
                this.currentUser = JSON.parse(userData);
                console.log('✅ Usuario cargado:', this.currentUser.name);
                
                // Llenar campos del formulario
                this.populateUserFields();
            } else {
                console.log('⚠️ No hay usuario logueado');
                this.showLoginPrompt();
            }
        } catch (error) {
            console.error('❌ Error cargando usuario:', error);
        }
    }

    populateUserFields() {
        if (!this.currentUser) return;

        const userNameField = document.getElementById('userName');
        const userEmailField = document.getElementById('userEmail');

        if (userNameField) userNameField.value = this.currentUser.name || '';
        if (userEmailField) userEmailField.value = this.currentUser.email || '';
    }

    showLoginPrompt() {
        const settingsContainer = document.querySelector('.settings-container');
        if (settingsContainer) {
            settingsContainer.innerHTML = `
                <div class="login-prompt">
                    <i class="fas fa-user-lock"></i>
                    <h2>Inicia sesión para acceder a la configuración</h2>
                    <p>Necesitas estar logueado para personalizar tu experiencia</p>
                    <button class="btn-primary" onclick="window.location.href='index.html'">
                        <i class="fas fa-sign-in-alt"></i> Ir al inicio
                    </button>
                </div>
            `;
        }
    }

    setupEventListeners() {
        // Event listeners para el sidebar
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => this.toggleSidebarMenu());
        }

        // Event listeners para campos de configuración
        const userNameField = document.getElementById('userName');
        const userEmailField = document.getElementById('userEmail');

        if (userNameField) {
            userNameField.addEventListener('change', () => this.saveUserSettings());
        }
        if (userEmailField) {
            userEmailField.addEventListener('change', () => this.saveUserSettings());
        }

        // Event listeners para checkboxes
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => this.saveSettings());
        });

        // Event listener para tema
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
    }

    toggleSidebarMenu() {
        console.log('🔄 Toggling sidebar menu...');
        const mainNav = document.querySelector('.main-nav');
        const sidebarToggle = document.getElementById('sidebarToggle');
        
        if (mainNav && sidebarToggle) {
            const isHidden = mainNav.classList.contains('hidden');
            const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
            
            if (isHidden) {
                mainNav.classList.remove('hidden');
                if (isMobile) document.body.classList.add('mobile-menu-open');
                console.log('✅ Sidebar menu shown');
            } else {
                mainNav.classList.add('hidden');
                if (isMobile) document.body.classList.remove('mobile-menu-open');
                console.log('✅ Sidebar menu hidden');
            }
        }
    }

    loadSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('deseo_settings') || '{}');
            
            // Cargar configuración de notificaciones
            const chatNotifications = document.getElementById('chatNotifications');
            const wishNotifications = document.getElementById('wishNotifications');
            
            if (chatNotifications) chatNotifications.checked = settings.chatNotifications !== false;
            if (wishNotifications) wishNotifications.checked = settings.wishNotifications !== false;

            // Cargar configuración de privacidad
            const publicProfile = document.getElementById('publicProfile');
            const showLocation = document.getElementById('showLocation');
            
            if (publicProfile) publicProfile.checked = settings.publicProfile !== false;
            if (showLocation) showLocation.checked = settings.showLocation !== false;

            console.log('✅ Configuración cargada');
        } catch (error) {
            console.error('❌ Error cargando configuración:', error);
        }
    }

    saveSettings() {
        try {
            const settings = {
                chatNotifications: document.getElementById('chatNotifications')?.checked ?? true,
                wishNotifications: document.getElementById('wishNotifications')?.checked ?? true,
                publicProfile: document.getElementById('publicProfile')?.checked ?? true,
                showLocation: document.getElementById('showLocation')?.checked ?? true
            };

            localStorage.setItem('deseo_settings', JSON.stringify(settings));
            console.log('✅ Configuración guardada');
            this.showNotification('Configuración guardada', 'success');
        } catch (error) {
            console.error('❌ Error guardando configuración:', error);
            this.showNotification('Error al guardar configuración', 'error');
        }
    }

    saveUserSettings() {
        if (!this.currentUser) return;

        try {
            const userNameField = document.getElementById('userName');
            const userEmailField = document.getElementById('userEmail');

            if (userNameField) this.currentUser.name = userNameField.value;
            if (userEmailField) this.currentUser.email = userEmailField.value;

            localStorage.setItem('deseo_user', JSON.stringify(this.currentUser));
            console.log('✅ Datos de usuario actualizados');
            this.showNotification('Perfil actualizado', 'success');
                } catch (error) {
            console.error('❌ Error actualizando perfil:', error);
            this.showNotification('Error al actualizar perfil', 'error');
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('deseo_theme', newTheme);
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            if (icon) {
                icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            }
        }
        
        console.log('✅ Tema cambiado a:', newTheme);
    }

    showNotification(message, type = 'info') {
        // Crear notificación temporal
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Funciones globales
function goBack() {
    window.history.back();
}

function clearCache() {
    if (confirm('¿Estás seguro de que quieres limpiar el caché? Esto eliminará todos los datos temporales.')) {
        localStorage.clear();
        sessionStorage.clear();
        alert('Caché limpiado correctamente');
        window.location.reload();
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.settingsManager = new SettingsManager();
});