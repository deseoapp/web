/**
 * Chat Provider - Lógica para usuarios que ofrecen servicios
 * Maneja la funcionalidad específica de proveedores en el chat
 */

class ChatProvider {
    constructor() {
        this.firebase = null;
        this.database = null;
        this.currentUser = null;
        this.chatId = null;
        this.otherUser = null;
        this.messages = [];
        this.isTyping = false;
        this.typingTimeout = null;
        
        // Notificaciones
        this.notificationPermission = false;
        
        this.init();
    }

    async init() {
        console.log('🔍 ChatProvider: Inicializando...');
        
        // Inicializar Firebase
        await this.initializeFirebase();
        
        // Obtener datos del chat desde URL
        this.getChatDataFromURL();
        
        // Cargar datos del usuario
        await this.loadCurrentUser();
        
        // Configurar listeners
        this.setupEventListeners();
        
        // Cargar mensajes
        await this.loadMessages();
        // Cargar perfil del otro usuario y su balance
        await this.loadOtherUserProfileAndHeader();
        await this.loadClientBalanceBadge();
        
        // Inicializar notificaciones
        await this.initializeNotifications();
        
        console.log('✅ ChatProvider: Inicializado correctamente');
    }

    async initializeFirebase() {
        try {
            console.log('🔍 Iniciando Firebase en chat provider...');
            
            if (typeof CONFIG === 'undefined' || !CONFIG.FIREBASE) {
                throw new Error('CONFIG.FIREBASE no está disponible');
            }

            this.firebase = firebase.initializeApp(CONFIG.FIREBASE.config);
            this.database = firebase.database();
            
            console.log('✅ Firebase inicializado en chat provider');
        } catch (error) {
            console.error('❌ Error inicializando Firebase:', error);
            throw error;
        }
    }

    getChatDataFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        this.chatId = urlParams.get('chatId');
        this.otherUserId = urlParams.get('userId');
        
        if (!this.chatId || !this.otherUserId) {
            console.error('❌ Faltan parámetros en la URL');
            this.showError('Parámetros de chat no válidos');
            return;
        }
        
        console.log('📋 Datos del chat:', { chatId: this.chatId, otherUserId: this.otherUserId });
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

    async loadOtherUserProfileAndHeader() {
        try {
            if (!this.database || !this.otherUserId) return;
            const profileRef = this.database.ref(`users/${this.otherUserId}/profile`);
            let snap = await profileRef.once('value');
            let profile = snap.val();
            if (!profile) {
                const rootRef = this.database.ref(`users/${this.otherUserId}`);
                snap = await rootRef.once('value');
                profile = snap.val();
            }
            const alias = profile?.nickname || profile?.alias || profile?.apodo || profile?.userInfo?.name || profile?.name || 'Usuario';
            const avatarEl = document.getElementById('chatUserAvatar');
            const nameEl = document.getElementById('chatUserName');
            if (nameEl) nameEl.firstChild && (nameEl.firstChild.nodeValue = alias + ' ');
            // Foto: usar primera imagen; soporta base64 u objetos guardados en Firebase
            if (avatarEl) {
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

                let rawPhoto = null;
                if (profile?.photos && Array.isArray(profile.photos) && profile.photos.length > 0) {
                    rawPhoto = profile.photos[0];
                } else if (profile?.profileImageUrl) {
                    rawPhoto = profile.profileImageUrl;
                }
                const photoSrc = toImageSrc(rawPhoto);
                if (photoSrc) {
                    avatarEl.innerHTML = '';
                    const img = document.createElement('img');
                    img.src = photoSrc;
                    img.alt = alias;
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'cover';
                    img.style.borderRadius = '50%';
                    avatarEl.appendChild(img);
                }
            }
        } catch (e) {
            console.warn('No se pudo cargar perfil del otro usuario:', e);
        }
    }

    async loadClientBalanceBadge() {
        try {
            if (!this.database || !this.otherUserId) return;
            const badge = document.getElementById('clientBalanceBadge');
            // Path real: users/{id}/balance, con fallback a wallet/{id}/balance
            let snap = await this.database.ref(`users/${this.otherUserId}/balance`).once('value');
            let balanceValue = snap.val();
            if (balanceValue === null || balanceValue === undefined) {
                const alt = await this.database.ref(`wallet/${this.otherUserId}/balance`).once('value');
                balanceValue = alt.val();
            }
            const balance = parseInt(balanceValue || '0', 10);
            if (badge) {
                badge.textContent = `${balance} pesos`;
                badge.style.display = 'inline-block';
            }
        } catch (e) {
            console.warn('No se pudo cargar balance del cliente:', e);
        }
    }

    setupEventListeners() {
        // Botón de envío
        const sendBtn = document.getElementById('sendBtn');
        const messageInput = document.getElementById('messageInput');
        
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }
        
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
            
            messageInput.addEventListener('input', () => this.handleTyping());
        }

        // Botones de acción rápida
        const quickActions = document.querySelectorAll('.quick-action-btn');
        quickActions.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleQuickAction(action);
            });
        });

        // Acciones nuevas proveedor
        const sendOfferServiceBtn = document.getElementById('sendOfferServiceBtn');
        if (sendOfferServiceBtn) {
            sendOfferServiceBtn.addEventListener('click', () => this.sendOfferService());
        }
        const sendPaidPhotoBtn = document.getElementById('sendPaidPhotoBtn');
        if (sendPaidPhotoBtn) {
            sendPaidPhotoBtn.addEventListener('click', () => this.sendPaidPhoto());
        }

        // Modales
        this.setupModalListeners();
        
        // Tema
        this.initializeTheme();
    }

    setupModalListeners() {
        // No-op aquí; listeners arriba
    }

    async loadMessages() {
        if (!this.database || !this.chatId) return;

        try {
            const messagesRef = this.database.ref(`chats/${this.chatId}/messages`);
            
            // Cargar mensajes existentes
            const snapshot = await messagesRef.once('value');
            const messagesData = snapshot.val();
            
            if (messagesData) {
                this.messages = Object.values(messagesData)
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                this.renderMessages();
            }

            // Escuchar nuevos mensajes
            messagesRef.on('child_added', (snapshot) => {
                const message = snapshot.val();
                if (!this.messages.find(m => m.id === message.id)) {
                    this.messages.push(message);
                    this.renderMessages();
                    this.scrollToBottom();
                    
                    // Enviar notificación si el mensaje no es del usuario actual
                    if (message.senderId !== this.currentUser.id && 
                        message.senderId !== 'system' && 
                        message.senderName) {
                        console.log('🔍 [DEBUG] Nuevo mensaje recibido en chat-provider:', message);
                        this.sendBrowserNotification(message.senderName, message.message);
                    }
                }
            });

            // Escuchar cambios en estado de escritura
            this.setupTypingListener();

        } catch (error) {
            console.error('❌ Error cargando mensajes:', error);
        }
    }

    setupTypingListener() {
        if (!this.database || !this.chatId) return;

        const typingRef = this.database.ref(`chats/${this.chatId}/typing/${this.otherUserId}`);
        
        typingRef.on('value', (snapshot) => {
            const isTyping = snapshot.val();
            this.showTypingIndicator(isTyping);
        });
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message || !this.database || !this.chatId) return;

        try {
            const messageData = {
                id: Date.now().toString(),
                senderId: this.currentUser.id,
                senderName: this.currentUser.name,
                message: message,
                timestamp: new Date().toISOString(),
                type: 'text'
            };

            // Guardar mensaje en Firebase
            const messagesRef = this.database.ref(`chats/${this.chatId}/messages/${messageData.id}`);
            await messagesRef.set(messageData);

            // Limpiar input
            messageInput.value = '';
            
            // Detener indicador de escritura
            this.stopTyping();

            // Scroll al final
            this.scrollToBottom();

        } catch (error) {
            console.error('❌ Error enviando mensaje:', error);
            this.showError('Error enviando mensaje');
        }
    }

    async handleQuickAction(action) {
        switch (action) {
            case 'respond':
                // Responder: foco al input
                const input = document.getElementById('messageInput');
                if (input) input.focus();
                break;
            case 'paid-photo':
                this.openModal('paidPhotoModal');
                break;
            case 'offer-service':
                this.openModal('offerServiceModal');
                break;
            case 'client-balance':
                await this.viewClientBalance();
                break;
            default:
                break;
        }
    }

    async viewClientBalance() {
        if (!this.database || !this.otherUserId) return;
        try {
            // Ajuste al path real usado en la app: users/{id}/balance
            const balanceRef = this.database.ref(`users/${this.otherUserId}/balance`);
            const snap = await balanceRef.once('value');
            const balance = parseInt(snap.val() || '0', 10);
            this.showNotification(`Balance del cliente: ${balance} pesos`, 'info');
        } catch (e) {
            console.error('❌ Error consultando balance del cliente:', e);
            this.showError('No se pudo obtener el balance del cliente');
        }
    }

    async sendOfferService() {
        const priceStr = (document.getElementById('offerPrice') || {}).value || '0';
        const description = (document.getElementById('offerDescription') || {}).value || '';
        const time = (document.getElementById('offerTime') || {}).value || '';
        const price = parseInt(priceStr, 10) || 0;
        if (!this.database || !this.chatId) return;
        try {
            const msgId = `offer_${Date.now()}`;
            await this.database.ref(`chats/${this.chatId}/messages/${msgId}`).set({
                id: msgId,
                senderId: this.currentUser.id,
                senderName: this.currentUser.name,
                type: 'service_offer',
                price,
                description: description.trim(),
                time,
                timestamp: new Date().toISOString()
            });
            this.closeModalSafe('offerServiceModal');
        } catch (e) {
            console.error('❌ Error enviando oferta:', e);
        }
    }

    async sendPaidPhoto() {
        const priceStr = (document.getElementById('paidPhotoPrice') || {}).value || '0';
        const fileInput = document.getElementById('paidPhotoFile');
        const price = parseInt(priceStr, 10) || 0;
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) { this.showError('Selecciona una imagen'); return; }
        if (!this.database || !this.chatId) return;
        try {
            // Placeholder: no subimos archivo real, solo metadatos
            const msgId = `photo_${Date.now()}`;
            await this.database.ref(`chats/${this.chatId}/messages/${msgId}`).set({
                id: msgId,
                senderId: this.currentUser.id,
                senderName: this.currentUser.name,
                type: 'paid_photo',
                price,
                fileName: fileInput.files[0].name,
                timestamp: new Date().toISOString()
            });
            this.closeModalSafe('paidPhotoModal');
        } catch (e) {
            console.error('❌ Error enviando foto pagada:', e);
        }
    }

    openModal(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'block';
    }

    closeModalSafe(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    }

    handleTyping() {
        if (!this.database || !this.chatId) return;

        // Indicar que está escribiendo
        this.startTyping();

        // Limpiar timeout anterior
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        // Detener indicador después de 3 segundos
        this.typingTimeout = setTimeout(() => {
            this.stopTyping();
        }, 3000);
    }

    startTyping() {
        if (this.isTyping) return;
        
        this.isTyping = true;
        const typingRef = this.database.ref(`chats/${this.chatId}/typing/${this.currentUser.id}`);
        typingRef.set(true);
    }

    stopTyping() {
        if (!this.isTyping) return;
        
        this.isTyping = false;
        const typingRef = this.database.ref(`chats/${this.chatId}/typing/${this.currentUser.id}`);
        typingRef.set(false);
    }

    showTypingIndicator(isTyping) {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.style.display = isTyping ? 'flex' : 'none';
            if (isTyping) {
                this.scrollToBottom();
            }
        }
    }

    renderMessages() {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;

        messagesContainer.innerHTML = '';

        this.messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            messagesContainer.appendChild(messageElement);
        });
    }

    createMessageElement(message) {
        const div = document.createElement('div');
        const isSent = message.senderId === this.currentUser.id;
        
        div.className = `chat-message ${isSent ? 'sent' : 'received'}`;
        
        // Avatar
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = `<i class="fas fa-user"></i>`;
        
        // Contenido del mensaje
        const content = document.createElement('div');
        content.className = 'message-content';
        
        let messageHtml = `<p>${this.escapeHtml(message.message)}</p>`;
        
        // Agregar timestamp
        const timestamp = new Date(message.timestamp);
        messageHtml += `<small>${timestamp.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        })}</small>`;
        
        content.innerHTML = messageHtml;
        
        // Agregar elementos al mensaje
        div.appendChild(avatar);
        div.appendChild(content);
        
        return div;
    }

    handleQuickAction(action) {
        switch (action) {
            case 'quote':
                this.openQuoteModal();
                break;
            case 'schedule':
                this.openScheduleModal();
                break;
            case 'location':
                this.sendLocation();
                break;
            case 'complete':
                this.completeService();
                break;
        }
    }

    openQuoteModal() {
        const modal = document.getElementById('quoteModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    openScheduleModal() {
        const modal = document.getElementById('scheduleModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    async sendQuote() {
        const amount = document.getElementById('quoteAmount').value;
        const description = document.getElementById('quoteDescription').value;
        const time = document.getElementById('quoteTime').value;
        
        if (!amount || !description) {
            this.showError('Por favor completa todos los campos');
            return;
        }

        try {
            const quoteMessage = `💰 **COTIZACIÓN**\n\n` +
                `Precio: $${amount}\n` +
                `Tiempo estimado: ${time}\n\n` +
                `Descripción: ${description}`;

            await this.sendSpecialMessage(quoteMessage, 'quote');
            this.closeModal('quoteModal');
            
            // Limpiar formulario
            document.getElementById('quoteAmount').value = '';
            document.getElementById('quoteDescription').value = '';
            document.getElementById('quoteTime').value = '';

        } catch (error) {
            console.error('❌ Error enviando cotización:', error);
            this.showError('Error enviando cotización');
        }
    }

    async sendSchedule() {
        const date = document.getElementById('scheduleDate').value;
        const time = document.getElementById('scheduleTime').value;
        const location = document.getElementById('scheduleLocation').value;
        const notes = document.getElementById('scheduleNotes').value;
        
        if (!date || !time || !location) {
            this.showError('Por favor completa los campos obligatorios');
            return;
        }

        try {
            const scheduleMessage = `📅 **PROPUESTA DE AGENDA**\n\n` +
                `Fecha: ${date}\n` +
                `Hora: ${time}\n` +
                `Ubicación: ${location}\n\n` +
                (notes ? `Notas: ${notes}` : '');

            await this.sendSpecialMessage(scheduleMessage, 'schedule');
            this.closeModal('scheduleModal');
            
            // Limpiar formulario
            document.getElementById('scheduleDate').value = '';
            document.getElementById('scheduleTime').value = '';
            document.getElementById('scheduleLocation').value = '';
            document.getElementById('scheduleNotes').value = '';

        } catch (error) {
            console.error('❌ Error enviando agenda:', error);
            this.showError('Error enviando agenda');
        }
    }

    async sendLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    
                    const locationMessage = `📍 **MI UBICACIÓN**\n\n` +
                        `Latitud: ${lat}\n` +
                        `Longitud: ${lng}\n\n` +
                        `[Ver en mapa](https://maps.google.com/?q=${lat},${lng})`;
                    
                    await this.sendSpecialMessage(locationMessage, 'location');
                },
                (error) => {
                    console.error('Error obteniendo ubicación:', error);
                    this.showError('No se pudo obtener la ubicación');
                }
            );
        } else {
            this.showError('Geolocalización no soportada');
        }
    }

    async sendSpecialMessage(message, type) {
        if (!this.database || !this.chatId) return;

        const messageData = {
            id: Date.now().toString(),
            senderId: this.currentUser.id,
            senderName: this.currentUser.name,
            message: message,
            timestamp: new Date().toISOString(),
            type: type
        };

        const messagesRef = this.database.ref(`chats/${this.chatId}/messages/${messageData.id}`);
        await messagesRef.set(messageData);
    }

    async acceptService() {
        try {
            const acceptMessage = `✅ **SERVICIO ACEPTADO**\n\n` +
                `He aceptado tu solicitud. ¡Empecemos a coordinar los detalles!`;
            
            await this.sendSpecialMessage(acceptMessage, 'system');
            
            // Actualizar estado del servicio
            await this.updateServiceStatus('accepted');
            
            // Ocultar botones de aceptar/rechazar
            const serviceActions = document.querySelector('.service-actions');
            if (serviceActions) {
                serviceActions.style.display = 'none';
            }

        } catch (error) {
            console.error('❌ Error aceptando servicio:', error);
            this.showError('Error aceptando servicio');
        }
    }

    async declineService() {
        try {
            const declineMessage = `❌ **SERVICIO RECHAZADO**\n\n` +
                `Lamento informarte que no puedo realizar este servicio en este momento.`;
            
            await this.sendSpecialMessage(declineMessage, 'system');
            
            // Actualizar estado del servicio
            await this.updateServiceStatus('declined');
            
            // Ocultar botones de aceptar/rechazar
            const serviceActions = document.querySelector('.service-actions');
            if (serviceActions) {
                serviceActions.style.display = 'none';
            }

        } catch (error) {
            console.error('❌ Error rechazando servicio:', error);
            this.showError('Error rechazando servicio');
        }
    }

    async updateServiceStatus(status) {
        if (!this.database || !this.chatId) return;

        try {
            const serviceRef = this.database.ref(`chats/${this.chatId}/serviceStatus`);
            await serviceRef.set({
                status: status,
                updatedBy: this.currentUser.id,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('❌ Error actualizando estado del servicio:', error);
        }
    }

    async completeService() {
        try {
            const completeMessage = `🎉 **SERVICIO COMPLETADO**\n\n` +
                `¡El servicio ha sido completado exitosamente! Espero que estés satisfecho con el resultado.`;
            
            await this.sendSpecialMessage(completeMessage, 'system');
            
            // Actualizar estado del servicio
            await this.updateServiceStatus('completed');

        } catch (error) {
            console.error('❌ Error completando servicio:', error);
            this.showError('Error completando servicio');
        }
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
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

    initializeTheme() {
        // Cargar tema guardado
        const savedTheme = localStorage.getItem('deseo_theme') || 'light';
        this.setTheme(savedTheme);
        
        // Configurar botón de tema
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                this.setTheme(newTheme);
            });
        }
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('deseo_theme', theme);
        
        // Actualizar icono del botón
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            if (icon) {
                icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            }
        }
    }

    // ===== NOTIFICACIONES =====
    async initializeNotifications() {
        console.log('🔍 [DEBUG] Inicializando notificaciones en chat-provider...');
        this.notificationPermission = await this.requestNotificationPermission();
        console.log('🔍 [DEBUG] Permisos de notificación:', this.notificationPermission);
    }

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

    async sendBrowserNotification(senderName, message) {
        try {
            if (!this.notificationPermission) {
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

            // Al hacer click en la notificación, enfocar la ventana
            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            console.log('✅ [DEBUG] Notificación del navegador enviada desde chat-provider para:', senderName);
            
        } catch (error) {
            console.error('❌ Error enviando notificación del navegador:', error);
        }
    }
}

// Funciones globales
function goBack() {
    window.history.back();
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.chatProvider = new ChatProvider();
});