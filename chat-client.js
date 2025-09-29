/**
 * Chat Client - Lógica para usuarios que solicitan servicios
 * Maneja la funcionalidad específica de clientes en el chat
 */

class ChatClient {
    constructor() {
        this.firebase = null;
        this.database = null;
        this.currentUser = null;
        this.chatId = null;
        this.otherUser = null;
        this.messages = [];
        this.isTyping = false;
        this.typingTimeout = null;
        this.serviceData = null;
        
        // Notificaciones
        this.notificationPermission = false;
        
        this.init();
    }

    async init() {
        console.log('🔍 ChatClient: Inicializando...');
        
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
        
        // Cargar datos del servicio
        await this.loadServiceData();
        
        // Inicializar notificaciones
        await this.initializeNotifications();
        
        console.log('✅ ChatClient: Inicializado correctamente');
    }

    async initializeFirebase() {
        try {
            console.log('🔍 Iniciando Firebase en chat client...');
            
            if (typeof CONFIG === 'undefined' || !CONFIG.FIREBASE) {
                throw new Error('CONFIG.FIREBASE no está disponible');
            }

            this.firebase = firebase.initializeApp(CONFIG.FIREBASE.config);
            this.database = firebase.database();
            
            console.log('✅ Firebase inicializado en chat client');
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

        // Modales
        this.setupModalListeners();
        
        // Tema
        this.initializeTheme();
    }

    setupModalListeners() {
        // Modal de modificar
        const sendModifyBtn = document.getElementById('sendModifyBtn');
        if (sendModifyBtn) {
            sendModifyBtn.addEventListener('click', () => this.sendModification());
        }

        // Modal de cancelar
        const confirmCancelBtn = document.getElementById('confirmCancelBtn');
        if (confirmCancelBtn) {
            confirmCancelBtn.addEventListener('click', () => this.confirmCancellation());
        }

        // Modal de calificar
        const sendRateBtn = document.getElementById('sendRateBtn');
        if (sendRateBtn) {
            sendRateBtn.addEventListener('click', () => this.sendRating());
        }

        // Modal: Propina
        const sendTipBtn = document.getElementById('sendTipBtn');
        if (sendTipBtn) {
            sendTipBtn.addEventListener('click', () => this.sendTip());
        }

        // Modal: Solicitar servicio
        const sendRequestServiceBtn = document.getElementById('sendRequestServiceBtn');
        if (sendRequestServiceBtn) {
            sendRequestServiceBtn.addEventListener('click', () => this.sendServiceRequest());
        }

        // Estrellas de calificación
        const stars = document.querySelectorAll('#starRating i');
        stars.forEach((star, index) => {
            star.addEventListener('click', () => this.setRating(index + 1));
            star.addEventListener('mouseenter', () => this.highlightStars(index + 1));
        });

        document.getElementById('starRating').addEventListener('mouseleave', () => {
            this.highlightStars(this.currentRating || 0);
        });
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
                        console.log('🔍 [DEBUG] Nuevo mensaje recibido en chat-client:', message);
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

    async loadServiceData() {
        if (!this.database || !this.chatId) return;

        try {
            const serviceRef = this.database.ref(`chats/${this.chatId}/serviceData`);
            const snapshot = await serviceRef.once('value');
            const serviceData = snapshot.val();
            

        } catch (error) {
            console.error('❌ Error cargando datos del servicio:', error);
        }
    }


    getStatusText(status) {
        const statusTexts = {
            'pending': 'Esperando respuesta',
            'accepted': 'Aceptado',
            'declined': 'Rechazado',
            'in_progress': 'En progreso',
            'completed': 'Completado',
            'cancelled': 'Cancelado'
        };
        return statusTexts[status] || 'Desconocido';
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
            // Cobro por mensaje de cliente: 100
            const canCharge = await this.chargeClient(100, 'message');
            if (!canCharge) {
                this.showError('Saldo insuficiente para enviar mensaje.');
                return;
            }
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

    async sendTip() {
        const amountEl = document.getElementById('tipAmount');
        const noteEl = document.getElementById('tipNote');
        const amount = parseInt(amountEl && amountEl.value ? amountEl.value : '0', 10);
        const note = noteEl && noteEl.value ? noteEl.value.trim() : '';
        if (!amount || amount <= 0) { this.showError('Monto inválido'); return; }
        if (!this.database || !this.chatId) return;
        try {
            const ok = await this.chargeClient(amount, 'tip');
            if (!ok) { this.showError('Saldo insuficiente para propina.'); return; }
            const messageData = {
                id: `tip_${Date.now()}`,
                senderId: this.currentUser.id,
                senderName: this.currentUser.name,
                message: `Propina enviada: ${amount} pesos${note ? ' - ' + note : ''}`,
                timestamp: new Date().toISOString(),
                type: 'tip',
                amount: amount
            };
            await this.database.ref(`chats/${this.chatId}/messages/${messageData.id}`).set(messageData);
            this.closeModalSafe('tipModal');
        } catch (e) {
            console.error('❌ Error enviando propina:', e);
        }
    }

    async sendServiceRequest() {
        const title = (document.getElementById('reqTitle') || {}).value || '';
        const description = (document.getElementById('reqDescription') || {}).value || '';
        const budgetStr = (document.getElementById('reqBudget') || {}).value || '0';
        const when = (document.getElementById('reqWhen') || {}).value || '';
        const budget = parseInt(budgetStr, 10) || 0;
        if (!title.trim()) { this.showError('Título requerido'); return; }
        if (!this.database || !this.chatId) return;
        try {
            const reqId = `request_${Date.now()}`;
            const payload = {
                id: reqId,
                senderId: this.currentUser.id,
                senderName: this.currentUser.name,
                type: 'service_request',
                title: title.trim(),
                description: description.trim(),
                budget: budget,
                when,
                timestamp: new Date().toISOString()
            };
            await this.database.ref(`chats/${this.chatId}/messages/${reqId}`).set(payload);
            this.closeModalSafe('requestServiceModal');
        } catch (e) {
            console.error('❌ Error solicitando servicio:', e);
        }
    }

    async handleQuickAction(action) {
        switch (action) {
            case 'tip':
                this.openModal('tipModal');
                break;
            case 'request':
                this.openModal('requestServiceModal');
                break;
            case 'favorite':
                await this.toggleFavorite(true);
                break;
            case 'report':
                this.openModal('reportModal');
                break;
            default:
                // Acciones existentes
                break;
        }
    }

    async toggleFavorite(state) {
        if (!this.database || !this.chatId) return;
        try {
            await this.database.ref(`chats/${this.chatId}/favorites/${this.currentUser.id}`).set(!!state);
            this.showNotification(state ? 'Añadido a favoritos' : 'Eliminado de favoritos', 'success');
        } catch (e) {
            console.error('❌ Error guardando favorito:', e);
        }
    }

    async sendReport() {
        const reason = (document.getElementById('reportReason') || {}).value || 'otro';
        const details = (document.getElementById('reportDetails') || {}).value || '';
        if (!this.database || !this.chatId) return;
        try {
            const reportId = `report_${Date.now()}`;
            await this.database.ref(`chats/${this.chatId}/reports/${reportId}`).set({
                by: this.currentUser.id,
                reason,
                details,
                timestamp: new Date().toISOString()
            });
            this.closeModalSafe('reportModal');
            this.showNotification('Reporte enviado', 'success');
        } catch (e) {
            console.error('❌ Error enviando reporte:', e);
        }
    }

    // Simulación de cobro contra saldo del cliente (placeholder)
    async chargeClient(amount, reason) {
        try {
            const balanceRef = this.database.ref(`wallet/${this.currentUser.id}/balance`);
            const snap = await balanceRef.once('value');
            const current = parseInt(snap.val() || '0', 10);
            if (current < amount) return false;
            await balanceRef.set(current - amount);
            const txId = `tx_${Date.now()}`;
            await this.database.ref(`wallet/${this.currentUser.id}/transactions/${txId}`).set({
                id: txId,
                type: 'debit',
                reason,
                amount,
                timestamp: new Date().toISOString()
            });
            return true;
        } catch (e) {
            console.error('❌ Error cobrando al cliente:', e);
            return false;
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
        
        // Agregar clase especial para mensajes del sistema
        if (message.type === 'system' || message.type === 'quote' || message.type === 'schedule') {
            div.classList.add(message.type);
        }
        
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
            case 'urgent':
                this.markAsUrgent();
                break;
            case 'modify':
                this.openModifyModal();
                break;
            case 'cancel':
                this.openCancelModal();
                break;
            case 'rate':
                this.openRateModal();
                break;
        }
    }

    async markAsUrgent() {
        try {
            const urgentMessage = `🚨 **URGENTE**\n\n` +
                `Necesito que este servicio se realice con la mayor urgencia posible. Por favor, confirma si puedes hacerlo pronto.`;
            
            await this.sendSpecialMessage(urgentMessage, 'urgent');

        } catch (error) {
            console.error('❌ Error marcando como urgente:', error);
            this.showError('Error marcando como urgente');
        }
    }

    openModifyModal() {
        // Llenar el modal con datos actuales
        if (this.serviceData) {
            const titleInput = document.getElementById('modifyTitle');
            const descInput = document.getElementById('modifyDescription');
            const budgetInput = document.getElementById('modifyBudget');
            const locationInput = document.getElementById('modifyLocation');
            
            if (titleInput) titleInput.value = this.serviceData.title || '';
            if (descInput) descInput.value = this.serviceData.description || '';
            if (budgetInput) budgetInput.value = this.serviceData.budget || '';
            if (locationInput) locationInput.value = this.serviceData.location || '';
        }

        const modal = document.getElementById('modifyModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    async sendModification() {
        const title = document.getElementById('modifyTitle').value;
        const description = document.getElementById('modifyDescription').value;
        const budget = document.getElementById('modifyBudget').value;
        const location = document.getElementById('modifyLocation').value;
        
        if (!title || !description) {
            this.showError('Por favor completa los campos obligatorios');
            return;
        }

        try {
            const modifyMessage = `✏️ **SOLICITUD MODIFICADA**\n\n` +
                `Título: ${title}\n` +
                `Descripción: ${description}\n` +
                `Presupuesto: $${budget}\n` +
                `Ubicación: ${location}`;

            await this.sendSpecialMessage(modifyMessage, 'modification');
            
            // Actualizar datos del servicio
            await this.updateServiceData({
                title: title,
                description: description,
                budget: budget,
                location: location,
                modifiedAt: new Date().toISOString()
            });
            
            this.closeModal('modifyModal');

        } catch (error) {
            console.error('❌ Error enviando modificación:', error);
            this.showError('Error enviando modificación');
        }
    }

    openCancelModal() {
        const modal = document.getElementById('cancelModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    async confirmCancellation() {
        const reason = document.getElementById('cancelReason').value;
        
        try {
            const cancelMessage = `❌ **SOLICITUD CANCELADA**\n\n` +
                `He decidido cancelar esta solicitud.` +
                (reason ? `\n\nMotivo: ${reason}` : '');
            
            await this.sendSpecialMessage(cancelMessage, 'cancellation');
            
            // Actualizar estado del servicio
            await this.updateServiceStatus('cancelled');
            
            this.closeModal('cancelModal');

        } catch (error) {
            console.error('❌ Error cancelando solicitud:', error);
            this.showError('Error cancelando solicitud');
        }
    }

    openRateModal() {
        const modal = document.getElementById('rateModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    setRating(rating) {
        this.currentRating = rating;
        this.highlightStars(rating);
    }

    highlightStars(rating) {
        const stars = document.querySelectorAll('#starRating i');
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    }

    async sendRating() {
        if (!this.currentRating) {
            this.showError('Por favor selecciona una calificación');
            return;
        }

        const comment = document.getElementById('rateComment').value;
        
        try {
            const ratingMessage = `⭐ **CALIFICACIÓN**\n\n` +
                `Calificación: ${this.currentRating}/5 estrellas\n` +
                (comment ? `Comentario: ${comment}` : 'Sin comentarios');
            
            await this.sendSpecialMessage(ratingMessage, 'rating');
            
            // Guardar calificación en Firebase
            await this.saveRating({
                rating: this.currentRating,
                comment: comment,
                ratedAt: new Date().toISOString()
            });
            
            this.closeModal('rateModal');

        } catch (error) {
            console.error('❌ Error enviando calificación:', error);
            this.showError('Error enviando calificación');
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

    async updateServiceData(updates) {
        if (!this.database || !this.chatId) return;

        try {
            const serviceRef = this.database.ref(`chats/${this.chatId}/serviceData`);
            await serviceRef.update(updates);
        } catch (error) {
            console.error('❌ Error actualizando datos del servicio:', error);
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

    async saveRating(ratingData) {
        if (!this.database || !this.chatId) return;

        try {
            const ratingRef = this.database.ref(`chats/${this.chatId}/rating`);
            await ratingRef.set(ratingData);
        } catch (error) {
            console.error('❌ Error guardando calificación:', error);
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
        console.log('🔍 [DEBUG] Inicializando notificaciones en chat-client...');
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

            console.log('✅ [DEBUG] Notificación del navegador enviada desde chat-client para:', senderName);
            
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
    window.chatClient = new ChatClient();
});