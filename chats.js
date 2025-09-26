/**
 * Chats - Sistema de gestión de chats y notificaciones
 * Maneja la lista de chats, búsqueda, filtros y notificaciones
 */

class ChatsManager {
    constructor() {
        this.firebase = null;
        this.database = null;
        this.currentUser = null;
        this.chats = [];
        this.notifications = [];
        this.users = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        
        this.init();
    }

    async init() {
        console.log('🔍 ChatsManager: Inicializando...');
        
        // Inicializar Firebase
        await this.initializeFirebase();
        
        // Cargar datos del usuario
        await this.loadCurrentUser();
        
        // Configurar listeners
        this.setupEventListeners();
        
        // Cargar datos
        await this.loadChats();
        await this.loadNotifications();
        
        console.log('✅ ChatsManager: Inicializado correctamente');
    }

    async initializeFirebase() {
        try {
            console.log('🔍 Iniciando Firebase en chats...');
            
            if (typeof CONFIG === 'undefined' || !CONFIG.FIREBASE) {
                throw new Error('CONFIG.FIREBASE no está disponible');
            }

            this.firebase = firebase.initializeApp(CONFIG.FIREBASE.config);
            this.database = firebase.database();
            
            console.log('✅ Firebase inicializado en chats');
        } catch (error) {
            console.error('❌ Error inicializando Firebase:', error);
            throw error;
        }
    }

    async loadCurrentUser() {
        try {
            const userData = localStorage.getItem('deseo_user');
            if (!userData) {
                throw new Error('Usuario no autenticado');
            }
            
            this.currentUser = JSON.parse(userData);
            console.log('👤 Usuario actual cargado:', this.currentUser.name);
        } catch (error) {
            console.error('❌ Error cargando usuario:', error);
            this.showError('Error de autenticación');
        }
    }

    setupEventListeners() {
        // Botón de búsqueda
        const searchBtn = document.getElementById('searchBtn');
        const closeSearch = document.getElementById('closeSearch');
        const searchBar = document.getElementById('searchBar');
        const searchInput = document.getElementById('searchInput');
        
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                searchBar.style.display = searchBar.style.display === 'none' ? 'flex' : 'none';
                if (searchBar.style.display !== 'none') {
                    searchInput.focus();
                }
            });
        }
        
        if (closeSearch) {
            closeSearch.addEventListener('click', () => {
                searchBar.style.display = 'none';
                searchInput.value = '';
                this.searchQuery = '';
                this.renderChats();
            });
        }
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.renderChats();
            });
        }

        // Filtros
        const filterTabs = document.querySelectorAll('.filter-tab');
        filterTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                // Remover clase active de todos los tabs
                filterTabs.forEach(t => t.classList.remove('active'));
                // Agregar clase active al tab clickeado
                e.target.classList.add('active');
                
                this.currentFilter = e.target.dataset.filter;
                this.renderChats();
            });
        });

        // Botón flotante
        const newChatFab = document.getElementById('newChatFab');
        if (newChatFab) {
            newChatFab.addEventListener('click', () => {
                this.openNewChatModal();
            });
        }

        // Modales
        this.setupModalListeners();
    }

    setupModalListeners() {
        // Modal de nuevo chat
        const searchUserInput = document.getElementById('searchUser');
        if (searchUserInput) {
            searchUserInput.addEventListener('input', (e) => {
                this.searchUsers(e.target.value);
            });
        }

        // Cerrar modales al hacer click fuera
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    async loadChats() {
        if (!this.database || !this.currentUser) return;

        try {
            const chatsRef = this.database.ref('chats');
            const snapshot = await chatsRef.once('value');
            const chatsData = snapshot.val();
            
            if (chatsData) {
                // Filtrar chats donde el usuario actual es participante
                this.chats = Object.values(chatsData)
                    .filter(chat => chat.participants && chat.participants[this.currentUser.id])
                    .sort((a, b) => {
                        const aTime = a.lastMessage ? new Date(a.lastMessage.timestamp) : new Date(a.createdAt);
                        const bTime = b.lastMessage ? new Date(b.lastMessage.timestamp) : new Date(b.createdAt);
                        return bTime - aTime;
                    });
                
                console.log('✅ Chats cargados:', this.chats.length);
                this.renderChats();
            }

            // Escuchar cambios en tiempo real
            this.setupChatsListener();

        } catch (error) {
            console.error('❌ Error cargando chats:', error);
        }
    }

    setupChatsListener() {
        if (!this.database || !this.currentUser) return;

        const chatsRef = this.database.ref('chats');
        
        chatsRef.on('value', (snapshot) => {
            const chatsData = snapshot.val();
            
            if (chatsData) {
                const newChats = Object.values(chatsData)
                    .filter(chat => chat.participants && chat.participants[this.currentUser.id])
                    .sort((a, b) => {
                        const aTime = a.lastMessage ? new Date(a.lastMessage.timestamp) : new Date(a.createdAt);
                        const bTime = b.lastMessage ? new Date(b.lastMessage.timestamp) : new Date(b.createdAt);
                        return bTime - aTime;
                    });
                
                this.chats = newChats;
                this.renderChats();
            }
        });
    }

    async loadNotifications() {
        if (!this.database || !this.currentUser) return;

        try {
            const notificationsRef = this.database.ref(`notifications/${this.currentUser.id}`);
            const snapshot = await notificationsRef.once('value');
            const notificationsData = snapshot.val();
            
            if (notificationsData) {
                this.notifications = Object.values(notificationsData)
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                
                console.log('✅ Notificaciones cargadas:', this.notifications.length);
            }

            // Escuchar nuevas notificaciones
            this.setupNotificationsListener();

        } catch (error) {
            console.error('❌ Error cargando notificaciones:', error);
        }
    }

    setupNotificationsListener() {
        if (!this.database || !this.currentUser) return;

        const notificationsRef = this.database.ref(`notifications/${this.currentUser.id}`);
        
        notificationsRef.on('child_added', (snapshot) => {
            const notification = snapshot.val();
            if (!this.notifications.find(n => n.id === notification.id)) {
                this.notifications.unshift(notification);
                this.showNotificationToast(notification);
            }
        });
    }

    renderChats() {
        const chatsList = document.getElementById('chatsList');
        const emptyState = document.getElementById('emptyState');
        
        if (!chatsList) return;

        // Filtrar chats
        let filteredChats = this.chats;
        
        // Aplicar filtro
        switch (this.currentFilter) {
            case 'active':
                filteredChats = filteredChats.filter(chat => chat.status === 'active');
                break;
            case 'unread':
                filteredChats = filteredChats.filter(chat => this.hasUnreadMessages(chat));
                break;
            case 'archived':
                filteredChats = filteredChats.filter(chat => chat.status === 'archived');
                break;
        }
        
        // Aplicar búsqueda
        if (this.searchQuery) {
            filteredChats = filteredChats.filter(chat => {
                const otherParticipant = this.getOtherParticipant(chat);
                return otherParticipant.name.toLowerCase().includes(this.searchQuery) ||
                       (chat.lastMessage && chat.lastMessage.message.toLowerCase().includes(this.searchQuery));
            });
        }

        // Limpiar lista
        chatsList.innerHTML = '';

        if (filteredChats.length === 0) {
            emptyState.style.display = 'flex';
            return;
        }

        emptyState.style.display = 'none';

        // Renderizar chats
        filteredChats.forEach(chat => {
            const chatElement = this.createChatElement(chat);
            chatsList.appendChild(chatElement);
        });
    }

    createChatElement(chat) {
        const div = document.createElement('div');
        div.className = 'chat-item';
        
        const otherParticipant = this.getOtherParticipant(chat);
        const hasUnread = this.hasUnreadMessages(chat);
        
        if (hasUnread) {
            div.classList.add('unread');
        }
        
        if (chat.status === 'archived') {
            div.classList.add('archived');
        }

        const lastMessage = chat.lastMessage ? chat.lastMessage.message : 'No hay mensajes';
        const lastMessageTime = chat.lastMessage ? 
            this.formatTime(chat.lastMessage.timestamp) : 
            this.formatTime(chat.createdAt);

        div.innerHTML = `
            <div class="chat-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="chat-info">
                <h3 class="chat-name">${this.escapeHtml(otherParticipant.name)}</h3>
                <p class="chat-last-message">${this.escapeHtml(lastMessage)}</p>
            </div>
            <div class="chat-meta">
                <span class="chat-time">${lastMessageTime}</span>
                ${hasUnread ? '<div class="chat-unread-badge">!</div>' : ''}
                <div class="chat-status ${otherParticipant.isOnline ? 'online' : 'offline'}">
                    <i class="fas fa-circle"></i>
                </div>
            </div>
        `;

        // Agregar evento de click
        div.addEventListener('click', () => {
            this.openChat(chat);
        });

        return div;
    }

    getOtherParticipant(chat) {
        const participants = Object.values(chat.participants);
        return participants.find(p => p.id !== this.currentUser.id) || { name: 'Usuario', isOnline: false };
    }

    hasUnreadMessages(chat) {
        // Implementar lógica para detectar mensajes no leídos
        // Por ahora, asumir que hay mensajes no leídos si el último mensaje no es del usuario actual
        if (!chat.lastMessage) return false;
        return chat.lastMessage.senderId !== this.currentUser.id;
    }

    openChat(chat) {
        const otherParticipant = this.getOtherParticipant(chat);
        
        // Determinar el tipo de usuario y redirigir
        const userType = this.determineUserType(chat);
        
        if (userType === 'provider') {
            window.location.href = `chat-provider.html?chatId=${chat.id}&userId=${otherParticipant.id}`;
        } else {
            window.location.href = `chat-client.html?chatId=${chat.id}&userId=${otherParticipant.id}`;
        }
    }

    determineUserType(chat) {
        // Lógica para determinar si el usuario actual es proveedor o cliente
        // Por ahora, asumir que es cliente si está contactando a alguien
        return 'client';
    }

    async searchUsers(query) {
        if (!this.database || !query.trim()) {
            document.getElementById('usersList').innerHTML = '';
            return;
        }

        try {
            const usersRef = this.database.ref('users');
            const snapshot = await usersRef.once('value');
            const usersData = snapshot.val();
            
            if (usersData) {
                const users = Object.values(usersData)
                    .filter(user => 
                        user.id !== this.currentUser.id &&
                        (user.name.toLowerCase().includes(query.toLowerCase()) ||
                         user.email.toLowerCase().includes(query.toLowerCase()))
                    )
                    .slice(0, 10); // Limitar a 10 resultados
                
                this.renderUsersList(users);
            }
        } catch (error) {
            console.error('❌ Error buscando usuarios:', error);
        }
    }

    renderUsersList(users) {
        const usersList = document.getElementById('usersList');
        if (!usersList) return;

        usersList.innerHTML = '';

        if (users.length === 0) {
            usersList.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 1rem;">No se encontraron usuarios</p>';
            return;
        }

        users.forEach(user => {
            const userElement = this.createUserElement(user);
            usersList.appendChild(userElement);
        });
    }

    createUserElement(user) {
        const div = document.createElement('div');
        div.className = 'user-item';
        
        div.innerHTML = `
            <div class="user-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="user-info">
                <h4 class="user-name">${this.escapeHtml(user.name)}</h4>
                <p class="user-status">${user.isAvailable ? 'Disponible' : 'No disponible'}</p>
            </div>
        `;

        div.addEventListener('click', () => {
            this.startChatWithUser(user);
        });

        return div;
    }

    async startChatWithUser(user) {
        try {
            // Crear chat con el usuario seleccionado
            const chatId = await this.createChatWithUser(user.id);
            
            // Cerrar modal
            this.closeModal('newChatModal');
            
            // Redirigir al chat
            this.openChat({ id: chatId, participants: { [user.id]: user } });
            
        } catch (error) {
            console.error('❌ Error iniciando chat:', error);
            this.showError('Error iniciando chat');
        }
    }

    async createChatWithUser(userId) {
        if (!this.database) {
            throw new Error('Firebase no inicializado');
        }

        const chatId = `chat_${Math.min(this.currentUser.id, userId)}_${Math.max(this.currentUser.id, userId)}`;
        
        try {
            // Verificar si el chat ya existe
            const chatRef = this.database.ref(`chats/${chatId}`);
            const snapshot = await chatRef.once('value');
            
            if (!snapshot.exists()) {
                // Crear nuevo chat
                const chatData = {
                    id: chatId,
                    participants: {
                        [this.currentUser.id]: {
                            id: this.currentUser.id,
                            name: this.currentUser.name,
                            type: 'contacting'
                        },
                        [userId]: {
                            id: userId,
                            name: 'Usuario',
                            type: 'contacted'
                        }
                    },
                    createdAt: new Date().toISOString(),
                    lastMessage: null,
                    status: 'active'
                };
                
                await chatRef.set(chatData);
            }
            
            return chatId;
            
        } catch (error) {
            console.error('❌ Error creando chat:', error);
            throw error;
        }
    }

    openNewChatModal() {
        const modal = document.getElementById('newChatModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    showNotificationToast(notification) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--primary-color);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 300px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-bell" style="font-size: 18px;"></i>
                <div>
                    <strong>${notification.title}</strong>
                    <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">${notification.message}</p>
                </div>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) { // Menos de 1 minuto
            return 'Ahora';
        } else if (diff < 3600000) { // Menos de 1 hora
            return `${Math.floor(diff / 60000)}m`;
        } else if (diff < 86400000) { // Menos de 1 día
            return `${Math.floor(diff / 3600000)}h`;
        } else {
            return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    showError(message) {
        // Crear notificación de error
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 300px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 18px;"></i>
                <div>
                    <strong>Error</strong>
                    <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">${message}</p>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Funciones globales
function goBack() {
    window.history.back();
}

function goToMap() {
    window.location.href = 'index.html';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.chatsManager = new ChatsManager();
});