class AdminDisputes {
    constructor() {
        this.database = null;
        this.currentDispute = null;
        this.disputes = [];
        this.currentTheme = localStorage.getItem('admin-theme') || 'dark';
        
        this.init();
    }

    async init() {
        console.log('🔍 AdminDisputes: Inicializando...');
        
        // Inicializar Firebase
        await this.initializeFirebase();
        
        // Aplicar tema
        this.applyTheme();
        
        // Configurar event listeners
        this.setupEventListeners();
        
        // Cargar disputas
        await this.loadDisputes();
        
        console.log('✅ AdminDisputes: Inicializado correctamente');
    }

    async initializeFirebase() {
        try {
            console.log('🔍 Iniciando Firebase en admin disputes...');
            
            if (typeof CONFIG === 'undefined' || !CONFIG.FIREBASE) {
                throw new Error('CONFIG.FIREBASE no está definido');
            }

            const firebaseConfig = CONFIG.FIREBASE.config;
            
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            
            this.database = firebase.database();
            console.log('✅ Firebase inicializado correctamente en admin disputes');
        } catch (error) {
            console.error('❌ Error inicializando Firebase en admin disputes:', error);
            throw error;
        }
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        const themeIcon = document.querySelector('#themeToggle i');
        if (themeIcon) {
            themeIcon.className = this.currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    setupEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
            localStorage.setItem('admin-theme', this.currentTheme);
            this.applyTheme();
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            if (confirm('¿Estás seguro de que quieres salir?')) {
                window.location.href = 'index.html';
            }
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterDisputes(e.target.dataset.filter);
            });
        });

        // Request evidence button
        const requestEvidenceBtn = document.getElementById('requestEvidenceBtn');
        if (requestEvidenceBtn) {
            requestEvidenceBtn.addEventListener('click', () => {
                this.requestEvidence();
            });
        }

        // Resolve dispute button
        const resolveDisputeBtn = document.getElementById('resolveDisputeBtn');
        if (resolveDisputeBtn) {
            resolveDisputeBtn.addEventListener('click', () => {
                this.showResolutionModal();
            });
        }

        // Execute resolution
        const executeResolutionBtn = document.getElementById('executeResolutionBtn');
        if (executeResolutionBtn) {
            executeResolutionBtn.addEventListener('click', () => {
                this.executeResolution();
            });
        }

        // Send message
        const sendMessageBtn = document.getElementById('sendMessageBtn');
        if (sendMessageBtn) {
            sendMessageBtn.addEventListener('click', () => {
                this.sendAdminMessage();
            });
        }

        // Enter key in message input
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendAdminMessage();
                }
            });
        }

        // Confirm resolution
        const confirmResolutionBtn = document.getElementById('confirmResolutionBtn');
        if (confirmResolutionBtn) {
            confirmResolutionBtn.addEventListener('click', () => {
                this.confirmResolution();
            });
        }

        // Evidence system - no upload functionality for admin
    }

    async loadDisputes() {
        try {
            console.log('🔍 Cargando disputas...');
            
            const disputesRef = this.database.ref('disputes');
            const snapshot = await disputesRef.once('value');
            const disputesData = snapshot.val() || {};
            
            this.disputes = Object.values(disputesData).map(dispute => ({
                id: dispute.id,
                orderId: dispute.orderId,
                chatId: dispute.chatId,
                clientId: dispute.clientId,
                providerId: dispute.providerId,
                reason: dispute.reason,
                status: dispute.status || 'pending',
                createdAt: dispute.createdAt,
                resolvedAt: dispute.resolvedAt,
                resolvedBy: dispute.resolvedBy,
                resolution: dispute.resolution
            }));

            this.renderDisputes();
            console.log(`✅ Cargadas ${this.disputes.length} disputas`);
        } catch (error) {
            console.error('❌ Error cargando disputas:', error);
            this.showError('Error cargando disputas');
        }
    }

    renderDisputes() {
        const container = document.getElementById('disputesList');
        container.innerHTML = '';

        if (this.disputes.length === 0) {
            container.innerHTML = `
                <div class="dispute-item">
                    <div class="dispute-title">No hay disputas</div>
                    <div class="dispute-meta">Todas las disputas han sido resueltas</div>
                </div>
            `;
            return;
        }

        this.disputes.forEach(dispute => {
            const disputeElement = document.createElement('div');
            disputeElement.className = 'dispute-item';
            disputeElement.dataset.disputeId = dispute.id;
            
            disputeElement.innerHTML = `
                <div class="dispute-title">Disputa #${dispute.id.slice(-8)}</div>
                <div class="dispute-meta">
                    <span class="dispute-status ${dispute.status}">${dispute.status === 'pending' ? 'Pendiente' : 'Resuelta'}</span>
                    <span>${this.formatDate(dispute.createdAt)}</span>
                </div>
            `;

            disputeElement.addEventListener('click', () => {
                this.selectDispute(dispute);
            });

            container.appendChild(disputeElement);
        });
    }

    filterDisputes(filter) {
        const items = document.querySelectorAll('.dispute-item');
        items.forEach(item => {
            const disputeId = item.dataset.disputeId;
            const dispute = this.disputes.find(d => d.id === disputeId);
            
            if (filter === 'all' || dispute.status === filter) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    async selectDispute(dispute) {
        try {
            console.log('🔍 Seleccionando disputa:', dispute.id);
            
            // Update UI
            document.querySelectorAll('.dispute-item').forEach(item => {
                item.classList.remove('active');
            });
            document.querySelector(`[data-dispute-id="${dispute.id}"]`).classList.add('active');

            this.currentDispute = dispute;
            
            // Update chat header
            document.getElementById('disputeTitle').textContent = `Disputa #${dispute.id.slice(-8)}`;
            document.getElementById('disputeDetails').textContent = `Razón: ${dispute.reason}`;
            
            // Enable buttons
            document.getElementById('resolveDisputeBtn').disabled = false;
            document.getElementById('requestEvidenceBtn').disabled = false;
            
            // Show chat input
            document.getElementById('chatInputArea').style.display = 'block';
            
            // Load evidence if available
            await this.loadEvidence();
            
            // Load chat messages
            await this.loadChatMessages(dispute.chatId);
            
            // Load dispute details
            await this.loadDisputeDetails(dispute);
            
        } catch (error) {
            console.error('❌ Error seleccionando disputa:', error);
            this.showError('Error cargando disputa');
        }
    }

    async loadChatMessages(chatId) {
        try {
            const messagesRef = this.database.ref(`chats/${chatId}/messages`);
            const snapshot = await messagesRef.once('value');
            const messagesData = snapshot.val() || {};
            
            const messages = Object.values(messagesData)
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            this.renderChatMessages(messages);
        } catch (error) {
            console.error('❌ Error cargando mensajes:', error);
        }
    }

    renderChatMessages(messages) {
        const container = document.getElementById('chatMessages');
        container.innerHTML = '';

        if (messages.length === 0) {
            container.innerHTML = `
                <div class="no-dispute-selected">
                    <i class="fas fa-comments"></i>
                    <h3>No hay mensajes</h3>
                    <p>No se han intercambiado mensajes en este chat</p>
                </div>
            `;
            return;
        }

        messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            container.appendChild(messageElement);
        });

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.type || 'user'}`;
        
        let content = message.message || '';
        
        // Handle different message types
        if (message.type === 'system') {
            content = `🔔 ${content}`;
        } else if (message.type === 'admin') {
            content = `👨‍💼 Admin: ${content}`;
        }
        
        messageDiv.innerHTML = `
            <div>${content}</div>
            <div class="message-time">${this.formatTime(message.timestamp)}</div>
        `;
        
        return messageDiv;
    }

    async loadDisputeDetails(dispute) {
        try {
            // Load order details
            const orderRef = this.database.ref(`encounterOrders/${dispute.orderId}`);
            const orderSnap = await orderRef.once('value');
            const order = orderSnap.val();
            
            if (order) {
                // Load user details
                const clientRef = this.database.ref(`users/${dispute.clientId}`);
                const providerRef = this.database.ref(`users/${dispute.providerId}`);
                
                const [clientSnap, providerSnap] = await Promise.all([
                    clientRef.once('value'),
                    providerRef.once('value')
                ]);
                
                const client = clientSnap.val();
                const provider = providerSnap.val();
                
                // Update resolution panel
                document.getElementById('clientName').textContent = client?.alias || client?.name || 'Usuario';
                document.getElementById('providerName').textContent = provider?.alias || provider?.name || 'Usuario';
                document.getElementById('disputeAmount').textContent = `$${order.escrowAmount || 0}`;
                document.getElementById('disputeReason').textContent = dispute.reason;
            }
        } catch (error) {
            console.error('❌ Error cargando detalles de disputa:', error);
        }
    }

    showResolutionModal() {
        if (!this.currentDispute) {
            this.showError('Selecciona una disputa primero');
            return;
        }
        
        // Populate modal with dispute data
        this.populateResolutionModal();
        document.getElementById('resolutionModal').style.display = 'flex';
    }

    populateResolutionModal() {
        const dispute = this.currentDispute;
        document.getElementById('clientName').textContent = dispute.clientName || 'Cliente';
        document.getElementById('providerName').textContent = dispute.providerName || 'Proveedor';
        document.getElementById('disputeAmount').textContent = `$${dispute.amount || 0}`;
        document.getElementById('disputeReason').textContent = dispute.reason || 'No especificada';
    }

    requestEvidence() {
        if (!this.currentDispute) {
            this.showError('Selecciona una disputa primero');
            return;
        }
        
        // Send message to both parties requesting evidence
        this.sendEvidenceRequest();
        
        // Show evidence panel to review submitted evidence
        document.getElementById('evidencePanel').style.display = 'block';
        
        // Load existing evidence
        this.loadEvidence();
    }

    async sendEvidenceRequest() {
        try {
            const message = {
                senderId: 'admin',
                message: 'El administrador solicita evidencias para resolver esta disputa. Por favor, sube imágenes que respalden tu caso usando el botón de evidencias en el chat.',
                timestamp: Date.now(),
                type: 'admin_request_evidence'
            };
            
            // Send to chat
            await this.database.ref(`chats/${this.currentDispute.chatId}/messages`).push(message);
            
            this.showSuccess('Solicitud de evidencias enviada a ambas partes');
        } catch (error) {
            console.error('Error enviando solicitud de evidencias:', error);
            this.showError('Error enviando solicitud de evidencias');
        }
    }

    async loadEvidence() {
        try {
            const dispute = this.currentDispute;
            if (!dispute) return;
            
            // Load client evidence
            const clientEvidenceRef = this.database.ref(`disputes/${dispute.id}/evidence/client`);
            const clientSnapshot = await clientEvidenceRef.once('value');
            const clientEvidence = clientSnapshot.val() || [];
            
            // Load provider evidence
            const providerEvidenceRef = this.database.ref(`disputes/${dispute.id}/evidence/provider`);
            const providerSnapshot = await providerEvidenceRef.once('value');
            const providerEvidence = providerSnapshot.val() || [];
            
            // Update counts
            document.getElementById('clientEvidenceCount').textContent = `${clientEvidence.length} evidencias`;
            document.getElementById('providerEvidenceCount').textContent = `${providerEvidence.length} evidencias`;
            
            // Render client evidence
            this.renderEvidence(clientEvidence, 'clientEvidenceItems');
            
            // Render provider evidence
            this.renderEvidence(providerEvidence, 'providerEvidenceItems');
            
        } catch (error) {
            console.error('Error cargando evidencias:', error);
        }
    }

    renderEvidence(evidenceData, containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        if (evidenceData.length === 0) {
            container.innerHTML = '<p class="no-evidence">No hay evidencias subidas aún</p>';
            return;
        }
        
        evidenceData.forEach(evidence => {
            const evidenceItem = document.createElement('div');
            evidenceItem.className = 'evidence-item-display';
            evidenceItem.innerHTML = `
                <img src="${evidence.data}" alt="Evidence" onclick="this.style.transform = this.style.transform === 'scale(1.5)' ? 'scale(1)' : 'scale(1.5)'">
                <div class="evidence-info">
                    <small>Subido: ${new Date(evidence.uploadedAt).toLocaleString('es-ES')}</small>
                </div>
            `;
            container.appendChild(evidenceItem);
        });
    }

    async executeResolution() {
        const resolution = document.querySelector('input[name="resolution"]:checked');
        const comment = document.getElementById('adminComment').value;
        
        if (!resolution) {
            this.showError('Selecciona una resolución');
            return;
        }
        
        if (!comment.trim()) {
            this.showError('Agrega un comentario explicando la decisión');
            return;
        }
        
        // Show confirmation modal
        const summary = this.getResolutionSummary(resolution.value);
        document.getElementById('resolutionSummary').textContent = summary;
        document.getElementById('resolutionModal').style.display = 'flex';
    }

    getResolutionSummary(resolution) {
        const clientName = document.getElementById('clientName').textContent;
        const providerName = document.getElementById('providerName').textContent;
        const amount = document.getElementById('disputeAmount').textContent;
        
        switch (resolution) {
            case 'client':
                return `El dinero (${amount}) será devuelto al cliente (${clientName})`;
            case 'provider':
                return `El dinero (${amount}) será transferido al proveedor (${providerName})`;
            case 'split':
                return `El dinero (${amount}) será dividido 50/50 entre ${clientName} y ${providerName}`;
            default:
                return 'Resolución no válida';
        }
    }

    async confirmResolution() {
        try {
            const resolution = document.querySelector('input[name="resolution"]:checked').value;
            const comment = document.getElementById('adminComment').value;
            
            // Update dispute
            const disputeRef = this.database.ref(`disputes/${this.currentDispute.id}`);
            await disputeRef.update({
                status: 'resolved',
                resolvedAt: new Date().toISOString(),
                resolvedBy: 'admin',
                resolution: resolution,
                adminComment: comment
            });
            
            // Execute the resolution
            await this.executeResolutionAction(resolution);
            
            // Send admin message to chat
            await this.sendAdminMessageToChat(comment, resolution);
            
            // Close modal and refresh
            this.closeModal('resolutionModal');
            this.showSuccess('Disputa resuelta exitosamente');
            
            // Refresh disputes list
            await this.loadDisputes();
            
            // Clear current dispute
            this.currentDispute = null;
            document.getElementById('resolutionPanel').style.display = 'none';
            document.getElementById('chatInputArea').style.display = 'none';
            document.getElementById('resolveDisputeBtn').disabled = true;
            
        } catch (error) {
            console.error('❌ Error confirmando resolución:', error);
            this.showError('Error ejecutando resolución');
        }
    }

    async executeResolutionAction(resolution) {
        const orderRef = this.database.ref(`encounterOrders/${this.currentDispute.orderId}`);
        const orderSnap = await orderRef.once('value');
        const order = orderSnap.val();
        
        if (!order) return;
        
        const amount = order.escrowAmount || 0;
        
        switch (resolution) {
            case 'client':
                // Return money to client
                await this.creditUser(this.currentDispute.clientId, amount, 'dispute_resolution_client');
                break;
            case 'provider':
                // Transfer money to provider
                await this.creditUser(this.currentDispute.providerId, amount, 'dispute_resolution_provider');
                break;
            case 'split':
                // Split money 50/50
                const halfAmount = amount / 2;
                await this.creditUser(this.currentDispute.clientId, halfAmount, 'dispute_resolution_split_client');
                await this.creditUser(this.currentDispute.providerId, halfAmount, 'dispute_resolution_split_provider');
                break;
        }
        
        // Update order status
        await orderRef.update({
            status: 'dispute_resolved',
            disputeResolution: resolution,
            resolvedAt: new Date().toISOString()
        });
    }

    async creditUser(userId, amount, reason) {
        try {
            const userRef = this.database.ref(`users/${userId}`);
            const userSnap = await userRef.once('value');
            const user = userSnap.val();
            
            const newBalance = (user.balance || 0) + amount;
            await userRef.update({ balance: newBalance });
            
            // Record transaction
            const transactionId = `txn_${Date.now()}`;
            await this.database.ref(`transactions/${transactionId}`).set({
                id: transactionId,
                userId: userId,
                amount: amount,
                type: 'credit',
                reason: reason,
                timestamp: new Date().toISOString(),
                source: 'admin_dispute_resolution'
            });
            
        } catch (error) {
            console.error('❌ Error acreditando usuario:', error);
            throw error;
        }
    }

    async sendAdminMessageToChat(comment, resolution) {
        try {
            const messageId = `admin_${Date.now()}`;
            const message = {
                id: messageId,
                type: 'admin',
                message: `Resolución de disputa: ${this.getResolutionSummary(resolution)}. Comentario: ${comment}`,
                timestamp: new Date().toISOString(),
                admin: true
            };
            
            await this.database.ref(`chats/${this.currentDispute.chatId}/messages/${messageId}`).set(message);
            
        } catch (error) {
            console.error('❌ Error enviando mensaje de admin:', error);
        }
    }

    async sendAdminMessage() {
        try {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            
            if (!message) return;
            
            const messageId = `admin_${Date.now()}`;
            const messageData = {
                id: messageId,
                type: 'admin',
                message: message,
                timestamp: new Date().toISOString(),
                admin: true
            };
            
            await this.database.ref(`chats/${this.currentDispute.chatId}/messages/${messageId}`).set(messageData);
            
            // Clear input
            input.value = '';
            
            // Reload messages
            await this.loadChatMessages(this.currentDispute.chatId);
            
        } catch (error) {
            console.error('❌ Error enviando mensaje:', error);
            this.showError('Error enviando mensaje');
        }
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    showError(message) {
        // Simple error notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--admin-danger);
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 10001;
            box-shadow: var(--admin-shadow-lg);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    showSuccess(message) {
        // Simple success notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--admin-success);
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 10001;
            box-shadow: var(--admin-shadow-lg);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }
}

// Global functions for modal
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AdminDisputes();
});