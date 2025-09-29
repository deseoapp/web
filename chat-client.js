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
        
        // Cargar mensajes
        await this.loadMessages();
        
        // Cargar perfil del otro usuario
        await this.loadOtherUserProfileAndHeader();
        
        // Configurar listeners DESPUÉS de cargar todo
        await new Promise(resolve => setTimeout(resolve, 100)); // Pequeño delay para asegurar DOM
        this.setupEventListeners();
        
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

    // Eliminado: el cliente no ve balance

    setupEventListeners() {
        console.log('🔍 [DEBUG] setupEventListeners called');
        console.log('🔍 [DEBUG] DOM ready state:', document.readyState);
        console.log('🔍 [DEBUG] Document body:', document.body);
        
        // Botón de envío
        const sendBtn = document.getElementById('sendBtn');
        const messageInput = document.getElementById('messageInput');
        
        console.log('🔍 [DEBUG] sendBtn found:', sendBtn);
        console.log('🔍 [DEBUG] messageInput found:', messageInput);
        
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
        console.log('🔍 [DEBUG] Found quick action buttons:', quickActions.length);
        
        quickActions.forEach((btn, index) => {
            console.log(`🔍 [DEBUG] Button ${index}:`, btn, 'action:', btn.dataset.action);
            
            // NUEVO ENFOQUE: Usar onclick directamente en el HTML
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const action = btn.dataset.action;
                console.log('🔍 [DEBUG] Button onclick triggered:', action);
                
                // SOLUCIÓN DIRECTA SIN MÉTODOS COMPLEJOS
                if (action === 'tip') {
                    console.log('🔍 [DEBUG] Opening tip modal with onclick');
                    const modal = document.getElementById('tipModal');
                    console.log('🔍 [DEBUG] Modal found:', modal);
                    if (modal) {
                        modal.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; z-index: 9999 !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; background: rgba(0,0,0,0.5) !important;';
                        console.log('🔍 [DEBUG] Modal CSS applied');
                    } else {
                        console.error('❌ Modal not found!');
                    }
                }
                
                if (action === 'request') {
                    const modal = document.getElementById('requestServiceModal');
                    if (modal) {
                        modal.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; z-index: 9999 !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; background: rgba(0,0,0,0.5) !important;';
                    }
                }
                
                if (action === 'favorite') {
                    alert('Añadido a favoritos');
                }
                
                if (action === 'report') {
                    const modal = document.getElementById('reportModal');
                    if (modal) {
                        modal.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; z-index: 9999 !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; background: rgba(0,0,0,0.5) !important;';
                    }
                }
                
                if (action === 'urgent') {
                    alert('Mensaje urgente enviado');
                }
                
                if (action === 'rate') {
                    const modal = document.getElementById('rateModal');
                    if (modal) {
                        modal.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; z-index: 9999 !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; background: rgba(0,0,0,0.5) !important;';
                    }
                }
            };
        });

        // Modales
        this.setupModalListeners();
        
        // Tema
        this.initializeTheme();
        
        // Prueba inmediata
        this.testButtonFunctionality();
    }

    testButtonFunctionality() {
        console.log('🔍 [DEBUG] Testing button functionality...');
        const tipBtn = document.querySelector('[data-action="tip"]');
        console.log('🔍 [DEBUG] Tip button found:', tipBtn);
        if (tipBtn) {
            console.log('🔍 [DEBUG] Tip button dataset:', tipBtn.dataset);
            console.log('🔍 [DEBUG] Tip button onclick:', tipBtn.onclick);
        }
        
        // Verificar si el modal existe
        const tipModal = document.getElementById('tipModal');
        console.log('🔍 [DEBUG] Tip modal found:', tipModal);
        if (tipModal) {
            console.log('🔍 [DEBUG] Tip modal display:', tipModal.style.display);
            console.log('🔍 [DEBUG] Tip modal computed display:', window.getComputedStyle(tipModal).display);
        }
        
        // Verificar todos los modales
        const allModals = document.querySelectorAll('.modal');
        console.log('🔍 [DEBUG] All modals found:', allModals.length);
        allModals.forEach((modal, index) => {
            console.log(`🔍 [DEBUG] Modal ${index}:`, modal.id, modal);
        });
    }

    setupModalListeners() {
        console.log('🔍 [DEBUG] Setting up modal listeners...');
        
        // Modal de propina
        const sendTipBtn = document.getElementById('sendTipBtn');
        console.log('🔍 [DEBUG] sendTipBtn found:', sendTipBtn);
        if (sendTipBtn) {
            sendTipBtn.addEventListener('click', () => this.sendTip());
            console.log('🔍 [DEBUG] sendTipBtn listener added');
        }

        // Modal de solicitar servicio
        const sendRequestServiceBtn = document.getElementById('sendRequestServiceBtn');
        console.log('🔍 [DEBUG] sendRequestServiceBtn found:', sendRequestServiceBtn);
        if (sendRequestServiceBtn) {
            sendRequestServiceBtn.addEventListener('click', () => this.sendRequestService());
            console.log('🔍 [DEBUG] sendRequestServiceBtn listener added');
        }

        // Modal de reportar
        const sendReportBtn = document.getElementById('sendReportBtn');
        console.log('🔍 [DEBUG] sendReportBtn found:', sendReportBtn);
        if (sendReportBtn) {
            sendReportBtn.addEventListener('click', () => this.sendReport());
            console.log('🔍 [DEBUG] sendReportBtn listener added');
        }

        // Modal de calificar
        const sendRateBtn = document.getElementById('sendRateBtn');
        console.log('🔍 [DEBUG] sendRateBtn found:', sendRateBtn);
        if (sendRateBtn) {
            sendRateBtn.addEventListener('click', () => this.sendRating());
            console.log('🔍 [DEBUG] sendRateBtn listener added');
        }

        // Preview de imágenes en reporte
        const reportImages = document.getElementById('reportImages');
        if (reportImages) {
            reportImages.addEventListener('change', () => this.previewReportImages());
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
            // Acreditar al proveedor y registrar microtransacción
            await this.creditProvider(100, 'message');
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
        console.log('🔍 [DEBUG] handleQuickAction called with action:', action);
        
        // IMPLEMENTACIÓN DIRECTA - SIN SWITCH COMPLEJO
        if (action === 'tip') {
            console.log('🔍 [DEBUG] Opening tip modal DIRECTLY');
            const modal = document.getElementById('tipModal');
            console.log('🔍 [DEBUG] Modal element:', modal);
            if (modal) {
                modal.style.display = 'block';
                modal.style.visibility = 'visible';
                modal.style.opacity = '1';
                modal.style.zIndex = '9999';
                console.log('🔍 [DEBUG] Modal forced to show');
            } else {
                console.error('❌ Modal not found!');
            }
            return;
        }
        
        if (action === 'request') {
            const modal = document.getElementById('requestServiceModal');
            if (modal) {
                modal.style.display = 'block';
                modal.style.visibility = 'visible';
                modal.style.opacity = '1';
                modal.style.zIndex = '9999';
            }
            return;
        }
        
        if (action === 'favorite') {
            await this.toggleFavorite(true);
            return;
        }
        
        if (action === 'report') {
            const modal = document.getElementById('reportModal');
            if (modal) {
                modal.style.display = 'block';
                modal.style.visibility = 'visible';
                modal.style.opacity = '1';
                modal.style.zIndex = '9999';
            }
            return;
        }
        
        if (action === 'urgent') {
            await this.sendUrgentMessage();
            return;
        }
        
        if (action === 'rate') {
            const modal = document.getElementById('rateModal');
            if (modal) {
                modal.style.display = 'block';
                modal.style.visibility = 'visible';
                modal.style.opacity = '1';
                modal.style.zIndex = '9999';
            }
            return;
        }
        
        console.log('🔍 [DEBUG] Unknown action:', action);
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
        const reason = (document.getElementById('reportReason') || {}).value || '';
        const details = (document.getElementById('reportDetails') || {}).value || '';
        
        if (!reason || !details.trim()) {
            this.showError('Por favor completa todos los campos obligatorios');
            return;
        }
        
        if (!this.database || !this.chatId) return;
        
        try {
            // Procesar imágenes si las hay
            const images = await this.processReportImages();
            
            const reportId = `report_${Date.now()}`;
            const reportData = {
                id: reportId,
                reportedBy: this.currentUser.id,
                reportedUser: this.otherUserId,
                chatId: this.chatId,
                reason,
                details: details.trim(),
                images: images,
                status: 'pending',
                timestamp: new Date().toISOString()
            };
            
            // Guardar en reports globales para admin
            await this.database.ref(`reports/${reportId}`).set(reportData);
            
            // También en el chat para referencia
            await this.database.ref(`chats/${this.chatId}/reports/${reportId}`).set(reportData);
            
            this.closeModalSafe('reportModal');
            this.showNotification('Reporte enviado correctamente', 'success');
            
        } catch (e) {
            console.error('❌ Error enviando reporte:', e);
            this.showError('Error enviando reporte');
        }
    }

    async processReportImages() {
        const fileInput = document.getElementById('reportImages');
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            return [];
        }
        
        const images = [];
        const files = Array.from(fileInput.files).slice(0, 5); // Máximo 5 imágenes
        
        for (const file of files) {
            try {
                const base64 = await this.fileToBase64(file);
                images.push({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: base64
                });
            } catch (e) {
                console.error('Error procesando imagen:', e);
            }
        }
        
        return images;
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async sendUrgentMessage() {
        try {
            const urgentMessage = `🚨 **SOLICITUD URGENTE**\n\n` +
                `Necesito que este servicio se realice con la mayor urgencia posible. ` +
                `Por favor, confirma si puedes hacerlo pronto.`;
            
            await this.sendSpecialMessage(urgentMessage, 'urgent');
            this.showNotification('Mensaje urgente enviado', 'success');
            
        } catch (error) {
            console.error('❌ Error enviando mensaje urgente:', error);
            this.showError('Error enviando mensaje urgente');
        }
    }

    async sendRequestService() {
        const title = (document.getElementById('reqTitle') || {}).value || '';
        const description = (document.getElementById('reqDescription') || {}).value || '';
        const budget = (document.getElementById('reqBudget') || {}).value || '';
        const when = (document.getElementById('reqWhen') || {}).value || '';
        
        if (!title.trim() || !description.trim()) {
            this.showError('Por favor completa título y descripción');
            return;
        }
        
        try {
            const requestMessage = `🤝 **SOLICITUD DE SERVICIO**\n\n` +
                `Título: ${title}\n` +
                `Descripción: ${description}\n` +
                (budget ? `Presupuesto: $${budget}\n` : '') +
                (when ? `Cuándo: ${when}\n` : '') +
                `\nPor favor, confirma si puedes realizar este servicio.`;
            
            await this.sendSpecialMessage(requestMessage, 'service_request');
            this.closeModalSafe('requestServiceModal');
            this.showNotification('Solicitud de servicio enviada', 'success');
            
        } catch (error) {
            console.error('❌ Error enviando solicitud:', error);
            this.showError('Error enviando solicitud');
        }
    }

    previewReportImages() {
        const fileInput = document.getElementById('reportImages');
        const preview = document.getElementById('reportImagePreview');
        
        if (!fileInput || !preview) return;
        
        preview.innerHTML = '';
        
        if (fileInput.files && fileInput.files.length > 0) {
            const files = Array.from(fileInput.files).slice(0, 5);
            
            files.forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.style.width = '80px';
                    img.style.height = '80px';
                    img.style.objectFit = 'cover';
                    img.style.margin = '5px';
                    img.style.borderRadius = '8px';
                    img.style.border = '2px solid #ccc';
                    preview.appendChild(img);
                };
                reader.readAsDataURL(file);
            });
        }
    }

    // Simulación de cobro contra saldo del cliente (placeholder)
    async chargeClient(amount, reason) {
        try {
            // Ajuste al path real usado en la app: users/{id}/balance
            const balanceRef = this.database.ref(`users/${this.currentUser.id}/balance`);
            const snap = await balanceRef.once('value');
            const current = parseInt(snap.val() || '0', 10);
            if (current < amount) return false;
            await balanceRef.set(current - amount);
            const txId = `tx_${Date.now()}`;
            // Transacción general (si se usa)
            await this.database.ref(`users/${this.currentUser.id}/transactions/${txId}`).set({
                id: txId,
                type: 'debit',
                reason,
                amount,
                timestamp: new Date().toISOString()
            });
            // Microtransacción
            const microId = `micro_${Date.now()}`;
            await this.database.ref(`users/${this.currentUser.id}/microtransactions/${microId}`).set({
                id: microId,
                direction: 'out',
                reason,
                amount,
                to: this.otherUserId,
                chatId: this.chatId,
                timestamp: new Date().toISOString()
            });
            return true;
        } catch (e) {
            console.error('❌ Error cobrando al cliente:', e);
            return false;
        }
    }

    async creditProvider(amount, reason) {
        try {
            if (!this.otherUserId) return;
            const balanceRef = this.database.ref(`users/${this.otherUserId}/balance`);
            const snap = await balanceRef.once('value');
            const current = parseInt(snap.val() || '0', 10);
            await balanceRef.set(current + amount);
            const microId = `micro_${Date.now()}`;
            await this.database.ref(`users/${this.otherUserId}/microtransactions/${microId}`).set({
                id: microId,
                direction: 'in',
                reason,
                amount,
                from: this.currentUser.id,
                chatId: this.chatId,
                timestamp: new Date().toISOString()
            });
        } catch (e) {
            console.error('❌ Error acreditando al proveedor:', e);
        }
    }

    openModal(id) {
        console.log('🔍 [DEBUG] openModal called with id:', id);
        const el = document.getElementById(id);
        console.log('🔍 [DEBUG] Modal element found:', el);
        console.log('🔍 [DEBUG] Modal element style before:', el ? el.style.display : 'N/A');
        if (el) {
            el.style.display = 'block';
            console.log('🔍 [DEBUG] Modal element style after:', el.style.display);
            console.log('🔍 [DEBUG] Modal computed style:', window.getComputedStyle(el).display);
            console.log('🔍 [DEBUG] Modal z-index:', window.getComputedStyle(el).zIndex);
            console.log('🔍 [DEBUG] Modal position:', window.getComputedStyle(el).position);
            console.log('🔍 [DEBUG] Modal displayed successfully');
            
            // Forzar visibilidad
            el.style.visibility = 'visible';
            el.style.opacity = '1';
        } else {
            console.error('❌ Modal not found:', id);
            console.error('❌ Available modals:', document.querySelectorAll('.modal').length);
        }
    }

    async sendTip() {
        const amount = parseInt((document.getElementById('tipAmount') || {}).value || '0', 10);
        const note = (document.getElementById('tipNote') || {}).value || '';
        
        if (amount <= 0) {
            this.showError('Por favor ingresa un monto válido');
            return;
        }
        
        try {
            // Cobrar al cliente
            const charged = await this.chargeClient(amount, 'Propina');
            if (!charged) {
                this.showError('Saldo insuficiente para enviar propina');
                return;
            }
            
            // Acreditar al proveedor
            await this.creditProvider(amount, 'Propina recibida');
            
            // Enviar mensaje de propina
            const tipMessage = `💰 **PROPINA ENVIADA**\n\n` +
                `Monto: $${amount.toLocaleString('es-CO')}\n` +
                (note ? `Nota: ${note}` : 'Gracias por tu excelente servicio!');
            
            await this.sendSpecialMessage(tipMessage, 'tip');
            
            this.closeModalSafe('tipModal');
            this.showNotification(`Propina de $${amount.toLocaleString('es-CO')} enviada`, 'success');
            
        } catch (error) {
            console.error('❌ Error enviando propina:', error);
            this.showError('Error enviando propina');
        }
    }

    closeModalSafe(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    }

    showNotification(message, type = 'info') {
        console.log(`🔔 [${type.toUpperCase()}] ${message}`);
        // Crear notificación visual simple
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Remover después de 3 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    showError(message) {
        this.showNotification(message, 'error');
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

        // Solo cobrar para mensajes que requieren pago (urgent, service_request)
        const paidMessageTypes = ['urgent', 'service_request'];
        if (paidMessageTypes.includes(type)) {
            const canCharge = await this.chargeClient(100, type || 'message');
            if (!canCharge) {
                this.showError('Saldo insuficiente para enviar mensaje.');
                return;
            }
            // Acreditar al proveedor
            await this.creditProvider(100, type || 'message');
        }

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