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

        // Botones de servicio
        const acceptBtn = document.getElementById('acceptServiceBtn');
        const declineBtn = document.getElementById('declineServiceBtn');
        
        if (acceptBtn) {
            acceptBtn.addEventListener('click', () => this.acceptService());
        }
        
        if (declineBtn) {
            declineBtn.addEventListener('click', () => this.declineService());
        }

        // Modales
        this.setupModalListeners();
    }

    setupModalListeners() {
        // Modal de cotización
        const sendQuoteBtn = document.getElementById('sendQuoteBtn');
        if (sendQuoteBtn) {
            sendQuoteBtn.addEventListener('click', () => this.sendQuote());
        }

        // Modal de agendar
        const sendScheduleBtn = document.getElementById('sendScheduleBtn');
        if (sendScheduleBtn) {
            sendScheduleBtn.addEventListener('click', () => this.sendSchedule());
        }
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