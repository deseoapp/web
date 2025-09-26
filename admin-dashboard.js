// ===== ADMIN DASHBOARD FUNCTIONALITY =====
console.log('🚀 Inicializando Admin Dashboard...');

class AdminDashboard {
    constructor() {
        this.firebase = null;
        this.database = null;
        this.transactionsChart = null;
        this.currentFilter = 'pending';
        this.currentSection = 'dashboard';
        this.allTransactions = [];
        this.stats = {
            totalIncome: 0,
            totalOutcome: 0,
            pendingTransactions: 0,
            totalUsers: 0
        };
        this.pendingMessage = null;
        this.pendingAction = null;
        this.init();
    }

    async init() {
        console.log('🔍 AdminDashboard: Inicializando...');
        
        // Inicializar Firebase primero
        await this.initializeFirebase();
        
        // Inicializar componentes
        this.initializeTheme();
        this.initializeChart();
        this.setupEventListeners();
        this.loadDashboardData();
        
        console.log('✅ AdminDashboard: Inicializado correctamente');
    }

    async initializeFirebase() {
        console.log('🔍 [DEBUG] Iniciando Firebase en Admin Dashboard...');
        console.log('🔍 [DEBUG] CONFIG disponible:', typeof CONFIG);
        console.log('🔍 [DEBUG] CONFIG.FIREBASE disponible:', typeof CONFIG.FIREBASE);
        console.log('🔍 [DEBUG] CONFIG.FIREBASE.enabled:', CONFIG.FIREBASE.enabled);
        
        if (!CONFIG.FIREBASE.enabled) {
            console.log('❌ Firebase está deshabilitado en la configuración');
            this.showError('Firebase está deshabilitado en la configuración');
            return;
        }

        // Verificar si Firebase está disponible
        console.log('🔍 [DEBUG] typeof firebase:', typeof firebase);
        if (typeof firebase === 'undefined') {
            console.warn('⚠️ Firebase SDK no está cargado, reintentando en 2 segundos...');
            setTimeout(() => this.initializeFirebase(), 2000);
            return;
        }

        try {
            // Verificar si ya está inicializado
            if (this.firebase) {
                console.log('✅ Firebase ya está inicializado en Admin Dashboard');
                return;
            }

            // Verificar que firebase.database esté disponible
            console.log('🔍 [DEBUG] typeof firebase.database:', typeof firebase.database);
            if (typeof firebase.database === 'undefined') {
                console.warn('⚠️ Firebase Database no está cargado, reintentando en 2 segundos...');
                setTimeout(() => this.initializeFirebase(), 2000);
                return;
            }

            // Verificar configuración
            console.log('🔍 [DEBUG] Configuración Firebase:', CONFIG.FIREBASE.config);
            console.log('🔍 [DEBUG] databaseURL:', CONFIG.FIREBASE.config.databaseURL);
            
            // Verificar si la configuración es válida
            if (!CONFIG.FIREBASE.config.databaseURL) {
                console.warn('⚠️ databaseURL no está definido en la configuración');
                console.log('🔍 [DEBUG] Firebase deshabilitado por databaseURL faltante');
                this.showError('Configuración de Firebase incompleta');
                return;
            }
            
            // Verificar si es una configuración válida
            if (CONFIG.FIREBASE.config.databaseURL.includes('parcero-6b971')) {
                console.log('🔍 [DEBUG] Usando configuración de Firebase real del proyecto parcero');
            } else if (CONFIG.FIREBASE.config.databaseURL.includes('samplep-d6b68')) {
                console.log('🔍 [DEBUG] Usando configuración de Firebase de prueba válida');
            } else if (CONFIG.FIREBASE.config.databaseURL.includes('firebaseio.com')) {
                console.warn('⚠️ Configuración de Firebase parece ser placeholder/falsa');
                console.log('🔍 [DEBUG] Firebase deshabilitado por configuración placeholder');
                this.showError('Configuración de Firebase no válida');
                return;
            }

            // Inicializar Firebase
            console.log('🔍 [DEBUG] Intentando inicializar Firebase en Admin Dashboard...');
            this.firebase = firebase.initializeApp(CONFIG.FIREBASE.config);
            this.database = firebase.database();
            
            console.log('✅ Firebase Realtime Database inicializado en Admin Dashboard');
            console.log('📊 Database URL:', CONFIG.FIREBASE.config.databaseURL);
            
        } catch (error) {
            console.error('❌ Error inicializando Firebase en Admin Dashboard:', error);
            console.error('🔍 [DEBUG] Error details:', error.message);
            console.error('🔍 [DEBUG] Error code:', error.code);
            this.showError(`Error Firebase: ${error.message} (${error.code || 'Sin código'})`);
        }
    }

    showError(message) {
        const transactionsList = document.getElementById('transactionsList');
        if (transactionsList) {
            transactionsList.innerHTML = `
                <div class="no-transactions">
                    <i class="fas fa-exclamation-triangle" style="color: #f44336;"></i>
                    <p style="color: #f44336;">${message}</p>
                </div>
            `;
        }
    }

    initializeTheme() {
        // Cargar tema guardado o usar tema por defecto
        const savedTheme = localStorage.getItem('admin-theme') || 'light';
        this.setTheme(savedTheme);
        
        // Configurar botón de tema
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
                const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                this.setTheme(newTheme);
            });
        }
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('admin-theme', theme);
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            if (icon) {
                icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
            }
        }
        
        // Actualizar gráfico si existe
        if (this.transactionsChart) {
            this.transactionsChart.options.plugins.legend.labels.color = 
                theme === 'dark' ? '#e0e0e0' : '#333';
            this.transactionsChart.update();
        }
    }

    initializeChart() {
        const ctx = document.getElementById('transactionsChart');
        if (!ctx) return;

        this.transactionsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Ingresos',
                    data: [],
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Retiros',
                    data: [],
                    borderColor: '#f44336',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString('es-CO');
                            }
                        }
                    }
                }
            }
        });
    }

    setupEventListeners() {
        // Filtros de transacciones
        const filterTabs = document.querySelectorAll('.filter-tab');
        filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                filterTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentFilter = tab.getAttribute('data-filter');
                this.renderTransactions();
            });
        });

        // Navegación del sidebar
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                this.navigateToSection(section);
            });
        });

        // Toggle del sidebar
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                const sidebar = document.getElementById('adminSidebar');
                if (sidebar) {
                    sidebar.classList.toggle('collapsed');
                }
            });
        }

        // Botón de guardar mensaje
        const saveMessageBtn = document.getElementById('saveMessageBtn');
        if (saveMessageBtn) {
            saveMessageBtn.addEventListener('click', () => {
                this.saveAdminMessage();
            });
        }
    }

    navigateToSection(section) {
        // Actualizar navegación activa
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-section') === section) {
                link.classList.add('active');
            }
        });

        // Ocultar todas las secciones
        const sections = document.querySelectorAll('.dashboard-section');
        sections.forEach(sec => {
            sec.style.display = 'none';
        });

        // Mostrar sección seleccionada
        const targetSection = document.getElementById(section + 'Section');
        if (targetSection) {
            targetSection.style.display = 'block';
            this.currentSection = section;
        }

        // Cargar datos específicos de la sección si es necesario
        if (section === 'transactions') {
            this.loadTransactionManagement();
        } else if (section === 'users') {
            this.loadUserManagement();
        } else if (section === 'analytics') {
            this.loadAnalytics();
        } else if (section === 'settings') {
            this.loadSettings();
        }
    }

    async loadDashboardData() {
        if (!this.database) {
            console.log('⚠️ Firebase no inicializado, no se pueden cargar datos');
            return;
        }

        try {
            // Cargar todas las transacciones
            await this.loadTransactions();
            
            // Cargar estadísticas de usuarios
            await this.loadUserStats();
            
            // Actualizar estadísticas
            this.updateStats();
            
            // Actualizar gráfico
            this.updateChart();
            
            // Renderizar transacciones
            this.renderTransactions();
            
        } catch (error) {
            console.error('❌ Error cargando datos del dashboard:', error);
        }
    }

    async loadTransactions() {
        return new Promise((resolve, reject) => {
            this.database.ref('transactions').on('value', (snapshot) => {
                try {
                    const data = snapshot.val() || {};
                    this.allTransactions = [];
                    
                    // Recopilar todas las transacciones de todos los usuarios
                    Object.keys(data).forEach(userId => {
                        const userTransactions = data[userId];
                        Object.keys(userTransactions).forEach(transactionId => {
                            const transaction = userTransactions[transactionId];
                            this.allTransactions.push({
                                id: transactionId,
                                userId: userId,
                                transaction: transaction
                            });
                        });
                    });
                    
                    // Ordenar por fecha (más recientes primero)
                    this.allTransactions.sort((a, b) => 
                        new Date(b.transaction.timestamp) - new Date(a.transaction.timestamp)
                    );
                    
                    console.log(`✅ ${this.allTransactions.length} transacciones cargadas`);
                    resolve();
                    
                } catch (error) {
                    console.error('❌ Error procesando transacciones:', error);
                    reject(error);
                }
            }, (error) => {
                console.error('❌ Error cargando transacciones:', error);
                reject(error);
            });
        });
    }

    async loadUserStats() {
        return new Promise((resolve, reject) => {
            this.database.ref('users').on('value', (snapshot) => {
                try {
                    const users = snapshot.val() || {};
                    this.stats.totalUsers = Object.keys(users).length;
                    console.log(`✅ ${this.stats.totalUsers} usuarios cargados`);
                    resolve();
                } catch (error) {
                    console.error('❌ Error cargando usuarios:', error);
                    reject(error);
                }
            }, (error) => {
                console.error('❌ Error cargando usuarios:', error);
                reject(error);
            });
        });
    }

    updateStats() {
        // Calcular estadísticas
        this.stats.totalIncome = 0;
        this.stats.totalOutcome = 0;
        this.stats.pendingTransactions = 0;

        this.allTransactions.forEach(({transaction}) => {
            if (transaction.type === 'income') {
                this.stats.totalIncome += transaction.amount || 0;
            } else if (transaction.type === 'outcome') {
                this.stats.totalOutcome += transaction.amount || 0;
            }
            
            if (transaction.status === 'pending_verification') {
                this.stats.pendingTransactions++;
            }
        });

        // Actualizar UI
        document.getElementById('totalIncome').textContent = 
            '$' + this.stats.totalIncome.toLocaleString('es-CO');
        document.getElementById('totalOutcome').textContent = 
            '$' + this.stats.totalOutcome.toLocaleString('es-CO');
        document.getElementById('pendingTransactions').textContent = 
            this.stats.pendingTransactions;
        document.getElementById('totalUsers').textContent = 
            this.stats.totalUsers;
    }

    updateChart() {
        if (!this.transactionsChart) return;

        // Agrupar transacciones por día
        const dailyData = {};
        
        this.allTransactions.forEach(({transaction}) => {
            const date = new Date(transaction.timestamp).toISOString().split('T')[0];
            if (!dailyData[date]) {
                dailyData[date] = { income: 0, outcome: 0 };
            }
            
            if (transaction.type === 'income') {
                dailyData[date].income += transaction.amount || 0;
            } else if (transaction.type === 'outcome') {
                dailyData[date].outcome += transaction.amount || 0;
            }
        });

        // Ordenar fechas y preparar datos para el gráfico
        const sortedDates = Object.keys(dailyData).sort();
        const last7Days = sortedDates.slice(-7); // Últimos 7 días
        
        const incomeData = last7Days.map(date => dailyData[date].income);
        const outcomeData = last7Days.map(date => dailyData[date].outcome);

        // Actualizar gráfico
        this.transactionsChart.data.labels = last7Days.map(date => 
            new Date(date).toLocaleDateString('es-ES', { 
                month: 'short', 
                day: 'numeric' 
            })
        );
        this.transactionsChart.data.datasets[0].data = incomeData;
        this.transactionsChart.data.datasets[1].data = outcomeData;
        this.transactionsChart.update();
    }

    renderTransactions() {
        const list = document.getElementById('transactionsList');
        if (!list) return;

        // Filtrar transacciones según el filtro seleccionado
        let filteredTransactions = this.allTransactions;
        
        if (this.currentFilter === 'pending') {
            filteredTransactions = this.allTransactions.filter(t => 
                t.transaction.status === 'pending_verification'
            );
        } else if (this.currentFilter === 'approved') {
            filteredTransactions = this.allTransactions.filter(t => 
                t.transaction.status === 'completed'
            );
        } else if (this.currentFilter === 'rejected') {
            filteredTransactions = this.allTransactions.filter(t => 
                t.transaction.status === 'rejected'
            );
        }

        if (filteredTransactions.length === 0) {
            list.innerHTML = `
                <div class="no-transactions">
                    <i class="fas fa-receipt"></i>
                    <p>No hay transacciones para mostrar</p>
                </div>
            `;
            return;
        }

        // Renderizar transacciones (máximo 10)
        const recentTransactions = filteredTransactions.slice(0, 10);
        list.innerHTML = recentTransactions.map(({id, userId, transaction}) => 
            this.renderTransactionItem(id, userId, transaction)
        ).join('');
    }

    renderTransactionItem(transactionId, userId, transaction) {
        // Determinar el estado
        let statusBadge = '';
        let statusColor = '';
        let statusIcon = '';
        
        if (transaction.status === 'pending_verification') {
            statusBadge = 'Pendiente';
            statusColor = '#ff9800';
            statusIcon = 'fas fa-clock';
        } else if (transaction.status === 'completed') {
            statusBadge = 'Aprobado';
            statusColor = '#4CAF50';
            statusIcon = 'fas fa-check';
        } else if (transaction.status === 'rejected') {
            statusBadge = 'Rechazado';
            statusColor = '#f44336';
            statusIcon = 'fas fa-times';
        }

        const transactionIcon = transaction.type === 'income' ? 'fas fa-arrow-up' : 'fas fa-arrow-down';
        const transactionColor = transaction.type === 'income' ? 'var(--primary-color)' : '#f44336';

        return `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-icon" style="background: ${transactionColor};">
                        <i class="${transactionIcon}"></i>
                    </div>
                    <div class="transaction-details">
                        <h4>
                            ${transaction.type === 'income' ? 'Depósito' : 'Retiro'} 
                            ${statusBadge ? `<span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; margin-left: 8px;">
                                <i class="${statusIcon}"></i> ${statusBadge}
                            </span>` : ''}
                        </h4>
                        <p><strong>Usuario:</strong> ${userId}</p>
                        <p><strong>Monto:</strong> $${transaction.amount.toLocaleString('es-CO')} COP</p>
                        <p><strong>Método:</strong> ${transaction.method || 'N/A'}</p>
                        <p><strong>Fecha:</strong> ${new Date(transaction.timestamp).toLocaleString('es-ES')}</p>
                        ${transaction.proofFileName ? `<p><strong>Comprobante:</strong> ${transaction.proofFileName}</p>` : ''}
                        ${transaction.adminMessage ? `
                            <div class="admin-message">
                                <h4><i class="fas fa-comment"></i> Mensaje del Administrador:</h4>
                                <p>${transaction.adminMessage}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="transaction-actions">
                    ${transaction.proofImage ? `
                        <button class="btn-admin btn-view" onclick="adminApp.showProof('${transaction.proofImage}')">
                            <i class="fas fa-eye"></i> Ver Comprobante
                        </button>
                    ` : ''}
                    ${transaction.status === 'pending_verification' ? `
                        <button class="btn-admin btn-approve" onclick="adminApp.showMessageModal('${transactionId}', '${userId}', ${transaction.amount}, 'approve')">
                            <i class="fas fa-check"></i> Aprobar
                        </button>
                        <button class="btn-admin btn-reject" onclick="adminApp.showMessageModal('${transactionId}', '${userId}', ${transaction.amount}, 'reject')">
                            <i class="fas fa-times"></i> Rechazar
                        </button>
                    ` : ''}
                    <button class="btn-admin btn-message" onclick="adminApp.showMessageModal('${transactionId}', '${userId}', ${transaction.amount}, 'message')">
                        <i class="fas fa-comment"></i> Mensaje
                    </button>
                </div>
            </div>
        `;
    }

    showProof(proofImage) {
        const modal = document.getElementById('proofModal');
        const container = document.getElementById('proofImageContainer');
        
        if (modal && container) {
            container.innerHTML = `
                <img src="${proofImage}" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.3);" />
            `;
            modal.style.display = 'flex';
        }
    }

    showMessageModal(transactionId, userId, amount, action) {
        this.pendingAction = {
            transactionId,
            userId,
            amount,
            action
        };
        
        const modal = document.getElementById('messageModal');
        const messageInput = document.getElementById('adminMessage');
        
        if (modal && messageInput) {
            // Limpiar mensaje anterior
            messageInput.value = '';
            
            // Cambiar placeholder según la acción
            if (action === 'approve') {
                messageInput.placeholder = 'Escribe un mensaje explicando por qué se aprueba la transacción...';
            } else if (action === 'reject') {
                messageInput.placeholder = 'Escribe un mensaje explicando por qué se rechaza la transacción...';
            } else {
                messageInput.placeholder = 'Escribe un mensaje para el usuario...';
            }
            
            modal.style.display = 'flex';
        }
    }

    async saveAdminMessage() {
        const messageInput = document.getElementById('adminMessage');
        const message = messageInput ? messageInput.value.trim() : '';
        
        if (!this.pendingAction) {
            console.error('❌ No hay acción pendiente');
            return;
        }

        const { transactionId, userId, amount, action } = this.pendingAction;

        try {
            if (action === 'approve') {
                await this.approveTransactionWithMessage(transactionId, userId, amount, message);
            } else if (action === 'reject') {
                await this.rejectTransactionWithMessage(transactionId, userId, message);
            } else if (action === 'message') {
                await this.addMessageToTransaction(transactionId, userId, message);
            }

            this.closeModal('messageModal');
            this.loadDashboardData(); // Recargar datos
            
        } catch (error) {
            console.error('❌ Error procesando acción:', error);
            alert('❌ Error al procesar la acción');
        }
    }

    async approveTransactionWithMessage(transactionId, userId, amount, message) {
        if (!this.database) {
            alert('❌ Firebase no disponible');
            return;
        }

        try {
            console.log('🔍 Debug: Aprobando transacción con mensaje:', transactionId);
            
            // Actualizar estado de la transacción y agregar mensaje
            const transactionRef = this.database.ref(`transactions/${userId}/${transactionId}`);
            await transactionRef.update({
                status: 'completed',
                adminMessage: message || null,
                adminActionDate: new Date().toISOString()
            });
            
            // Actualizar balance del usuario
            const userRef = this.database.ref(`users/${userId}`);
            const userSnapshot = await userRef.once('value');
            const userData = userSnapshot.val();
            const currentBalance = userData.balance || 0;
            const newBalance = currentBalance + amount;
            
            await userRef.update({
                balance: newBalance,
                lastUpdated: new Date().toISOString()
            });
            
            console.log('✅ Transacción aprobada con mensaje exitosamente');
            alert('✅ Transacción aprobada. El dinero se ha acreditado a la billetera del usuario.');
            
        } catch (error) {
            console.error('❌ Error aprobando transacción:', error);
            throw error;
        }
    }

    async rejectTransactionWithMessage(transactionId, userId, message) {
        if (!this.database) {
            alert('❌ Firebase no disponible');
            return;
        }

        try {
            console.log('🔍 Debug: Rechazando transacción con mensaje:', transactionId);
            
            // Actualizar estado de la transacción y agregar mensaje
            const transactionRef = this.database.ref(`transactions/${userId}/${transactionId}`);
            await transactionRef.update({
                status: 'rejected',
                adminMessage: message || null,
                adminActionDate: new Date().toISOString()
            });
            
            console.log('✅ Transacción rechazada con mensaje');
            alert('✅ Transacción rechazada.');
            
        } catch (error) {
            console.error('❌ Error rechazando transacción:', error);
            throw error;
        }
    }

    async addMessageToTransaction(transactionId, userId, message) {
        if (!this.database) {
            alert('❌ Firebase no disponible');
            return;
        }

        try {
            console.log('🔍 Debug: Agregando mensaje a transacción:', transactionId);
            
            // Solo agregar mensaje sin cambiar estado
            const transactionRef = this.database.ref(`transactions/${userId}/${transactionId}`);
            await transactionRef.update({
                adminMessage: message || null,
                adminActionDate: new Date().toISOString()
            });
            
            console.log('✅ Mensaje agregado a transacción');
            alert('✅ Mensaje agregado correctamente.');
            
        } catch (error) {
            console.error('❌ Error agregando mensaje:', error);
            throw error;
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Placeholder functions for other sections
    loadTransactionManagement() {
        console.log('📊 Cargando gestión de transacciones...');
        // Aquí se implementaría la gestión avanzada de transacciones
    }

    loadUserManagement() {
        console.log('👥 Cargando gestión de usuarios...');
        // Aquí se implementaría la gestión de usuarios
    }

    loadAnalytics() {
        console.log('📈 Cargando analytics avanzados...');
        // Aquí se implementarían analytics más detallados
    }

    loadSettings() {
        console.log('⚙️ Cargando configuración...');
        // Aquí se implementaría la configuración del sistema
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏁 DOM cargado. Inicializando Admin Dashboard...');
    
    // Esperar un momento para asegurar que todos los scripts estén cargados
    setTimeout(() => {
        if (!window.adminApp) {
            window.adminApp = new AdminDashboard();
            console.log('✨ AdminDashboard instance created.');
        } else {
            console.log('AdminDashboard ya estaba inicializada.');
        }
    }, 100);
});