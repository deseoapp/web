// ===== SISTEMA DE CONFIGURACIÓN =====
class SettingsManager {
    constructor() {
        this.settings = {};
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.renderSettings();
        this.setupEventListeners();
    }

    async loadSettings() {
        try {
            const savedSettings = localStorage.getItem('deseo_settings');
            if (savedSettings) {
                this.settings = JSON.parse(savedSettings);
            } else {
                // Configuración por defecto
                this.settings = {
                    theme: 'dark',
                    notifications: true,
                    location: true,
                    publicProfile: true,
                    activityHistory: true
                };
                this.saveSettings();
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            this.settings = {
                theme: 'dark',
                notifications: true,
                location: true,
                publicProfile: true,
                activityHistory: true
            };
        }
    }

    saveSettings() {
        localStorage.setItem('deseo_settings', JSON.stringify(this.settings));
    }

    renderSettings() {
        // Cargar tema guardado
        this.loadSavedTheme();
        
        // Configurar toggles
        this.setupToggles();
        
        // Cargar información del usuario
        this.loadUserInfo();
    }

    loadSavedTheme() {
        const savedTheme = localStorage.getItem('deseo-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        const themeToggle = document.getElementById('themeToggleSetting');
        if (themeToggle) {
            themeToggle.checked = savedTheme === 'light';
        }
        
        // Actualizar icono del header
        const themeIcon = document.querySelector('#themeToggle i');
        if (themeIcon) {
            themeIcon.className = savedTheme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    setupToggles() {
        const toggles = [
            { id: 'themeToggleSetting', setting: 'theme' },
            { id: 'notificationsToggle', setting: 'notifications' },
            { id: 'locationToggle', setting: 'location' },
            { id: 'publicProfileToggle', setting: 'publicProfile' },
            { id: 'activityHistoryToggle', setting: 'activityHistory' }
        ];

        toggles.forEach(toggle => {
            const element = document.getElementById(toggle.id);
            if (element) {
                if (toggle.setting === 'theme') {
                    element.checked = this.settings.theme === 'light';
                } else {
                    element.checked = this.settings[toggle.setting];
                }
            }
        });
    }

    loadUserInfo() {
        // Cargar información del usuario desde localStorage o Firebase
        const userData = localStorage.getItem('deseo_user');
        if (userData) {
            const user = JSON.parse(userData);
            const profile = user.profile || {};
            
            // Actualizar información del perfil
            const profileName = document.getElementById('profileName');
            const profileEmail = document.getElementById('profileEmail');
            const profileAvatar = document.getElementById('profileAvatar');
            
            if (profileName) {
                profileName.textContent = profile.fullName || user.displayName || 'Usuario';
            }
            
            if (profileEmail) {
                profileEmail.textContent = user.email || 'usuario@email.com';
            }
            
            if (profileAvatar && profile.photoURL) {
                profileAvatar.innerHTML = `<img src="${profile.photoURL}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            }
        }
    }

    setupEventListeners() {
        // Toggle de tema
        const themeToggle = document.getElementById('themeToggleSetting');
        if (themeToggle) {
            themeToggle.addEventListener('change', (e) => {
                this.handleThemeToggle(e.target.checked);
            });
        }

        // Toggle de notificaciones
        const notificationsToggle = document.getElementById('notificationsToggle');
        if (notificationsToggle) {
            notificationsToggle.addEventListener('change', (e) => {
                this.handleSettingChange('notifications', e.target.checked);
            });
        }

        // Toggle de ubicación
        const locationToggle = document.getElementById('locationToggle');
        if (locationToggle) {
            locationToggle.addEventListener('change', (e) => {
                this.handleSettingChange('location', e.target.checked);
            });
        }

        // Toggle de perfil público
        const publicProfileToggle = document.getElementById('publicProfileToggle');
        if (publicProfileToggle) {
            publicProfileToggle.addEventListener('change', (e) => {
                this.handleSettingChange('publicProfile', e.target.checked);
            });
        }

        // Toggle de historial de actividad
        const activityHistoryToggle = document.getElementById('activityHistoryToggle');
        if (activityHistoryToggle) {
            activityHistoryToggle.addEventListener('change', (e) => {
                this.handleSettingChange('activityHistory', e.target.checked);
            });
        }

        // Formulario de editar perfil
        const editProfileForm = document.getElementById('editProfileForm');
        if (editProfileForm) {
            editProfileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleEditProfile();
            });
        }
    }

    handleThemeToggle(isLight) {
        const newTheme = isLight ? 'light' : 'dark';
        this.settings.theme = newTheme;
        this.saveSettings();
        
        // Aplicar tema
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('deseo-theme', newTheme);
        
        // Actualizar icono del header
        const themeIcon = document.querySelector('#themeToggle i');
        if (themeIcon) {
            themeIcon.className = isLight ? 'fas fa-sun' : 'fas fa-moon';
        }
        
        this.showNotification(`Tema cambiado a ${isLight ? 'claro' : 'oscuro'}`, 'success');
    }

    handleSettingChange(setting, value) {
        this.settings[setting] = value;
        this.saveSettings();
        
        const settingNames = {
            notifications: 'Notificaciones',
            location: 'Ubicación',
            publicProfile: 'Perfil público',
            activityHistory: 'Historial de actividad'
        };
        
        this.showNotification(`${settingNames[setting]} ${value ? 'activado' : 'desactivado'}`, 'success');
    }

    async handleEditProfile() {
        const formData = new FormData(document.getElementById('editProfileForm'));
        const userData = {
            fullName: document.getElementById('editFullName').value,
            address: document.getElementById('editAddress').value,
            gender: document.getElementById('editGender').value,
            photo: document.getElementById('editPhoto').files[0]
        };

        try {
            // Actualizar datos locales
            const userDataStr = localStorage.getItem('deseo_user');
            if (userDataStr) {
                const user = JSON.parse(userDataStr);
                const profile = user.profile || {};
                
                // Actualizar perfil
                profile.fullName = userData.fullName;
                profile.address = userData.address;
                profile.gender = userData.gender;
                
                // Subir foto si existe
                if (userData.photo && window.authManager) {
                    profile.photoURL = await window.authManager.uploadUserPhoto(user.uid, userData.photo);
                }
                
                user.profile = profile;
                localStorage.setItem('deseo_user', JSON.stringify(user));
                
                // Actualizar UI
                this.loadUserInfo();
                
                this.closeModal('editProfileModal');
                this.showNotification('Perfil actualizado exitosamente', 'success');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showNotification('Error al actualizar el perfil', 'error');
        }
    }

    editProfile() {
        // Cargar datos actuales en el formulario
        const userData = localStorage.getItem('deseo_user');
        if (userData) {
            const user = JSON.parse(userData);
            const profile = user.profile || {};
            
            document.getElementById('editFullName').value = profile.fullName || '';
            document.getElementById('editAddress').value = profile.address || '';
            document.getElementById('editGender').value = profile.gender || '';
        }
        
        this.showModal('editProfileModal');
    }

    changePassword() {
        this.showNotification('Función de cambio de contraseña próximamente', 'info');
    }

    exportData() {
        try {
            const userData = localStorage.getItem('deseo_user');
            const settings = localStorage.getItem('deseo_settings');
            const wishes = localStorage.getItem('deseo_wishes');
            const transactions = localStorage.getItem('deseo_transactions');
            
            const exportData = {
                user: userData ? JSON.parse(userData) : null,
                settings: settings ? JSON.parse(settings) : null,
                wishes: wishes ? JSON.parse(wishes) : null,
                transactions: transactions ? JSON.parse(transactions) : null,
                exportDate: new Date().toISOString()
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `deseo-data-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            this.showNotification('Datos exportados exitosamente', 'success');
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showNotification('Error al exportar datos', 'error');
        }
    }

    deleteAccount() {
        if (confirm('¿Estás seguro de que quieres eliminar tu cuenta? Esta acción no se puede deshacer.')) {
            if (confirm('Esta acción eliminará todos tus datos permanentemente. ¿Continuar?')) {
                try {
                    // Limpiar todos los datos locales
                    localStorage.removeItem('deseo_user');
                    localStorage.removeItem('deseo_settings');
                    localStorage.removeItem('deseo_wishes');
                    localStorage.removeItem('deseo_transactions');
                    localStorage.removeItem('deseo_balance');
                    localStorage.removeItem('deseo-theme');
                    
                    // Cerrar sesión si está autenticado
                    if (window.authManager) {
                        window.authManager.logout();
                    }
                    
                    this.showNotification('Cuenta eliminada exitosamente', 'success');
                    
                    // Redirigir al inicio
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 2000);
                } catch (error) {
                    console.error('Error deleting account:', error);
                    this.showNotification('Error al eliminar la cuenta', 'error');
                }
            }
        }
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
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
}

// ===== INICIALIZACIÓN =====
let settingsManager;

document.addEventListener('DOMContentLoaded', () => {
    settingsManager = new SettingsManager();
    
    // Hacer disponible globalmente
    window.settingsManager = settingsManager;
});

// ===== FUNCIONES GLOBALES =====
window.app = window.app || {};

window.app.editProfile = () => settingsManager.editProfile();
window.app.changePassword = () => settingsManager.changePassword();
window.app.exportData = () => settingsManager.exportData();
window.app.deleteAccount = () => settingsManager.deleteAccount();
window.app.closeModal = (modalId) => settingsManager.closeModal(modalId);