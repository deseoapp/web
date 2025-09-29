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
        this.allUsers = [];
        this.analyticsData = {};
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

        // Mobile menu toggle
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const mobileOverlay = document.getElementById('mobileOverlay');
        const adminSidebar = document.getElementById('adminSidebar');

        if (mobileMenuToggle && mobileOverlay && adminSidebar) {
            mobileMenuToggle.addEventListener('click', () => {
                adminSidebar.classList.toggle('open');
                mobileOverlay.classList.toggle('active');
            });

            mobileOverlay.addEventListener('click', () => {
                adminSidebar.classList.remove('open');
                mobileOverlay.classList.remove('active');
            });

            // Close mobile menu when clicking on nav links
            const navLinks = document.querySelectorAll('.nav-link');
            navLinks.forEach(link => {
                link.addEventListener('click', () => {
                    if (window.innerWidth <= 768) {
                        adminSidebar.classList.remove('open');
                        mobileOverlay.classList.remove('active');
                    }
                });
            });
        }

        // Botón de guardar mensaje
        const saveMessageBtn = document.getElementById('saveMessageBtn');
        if (saveMessageBtn) {
            saveMessageBtn.addEventListener('click', () => {
                this.saveAdminMessage();
            });
        }

        // Handle window resize
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });

        // Initial responsive setup
        this.handleWindowResize();
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

    // ===== GESTIÓN DE TRANSACCIONES AVANZADA =====
    async loadTransactionManagement() {
        console.log('📊 Cargando gestión de transacciones...');
        await this.loadAdvancedTransactions();
        this.updateTransactionStats();
    }

    async loadAdvancedTransactions() {
        if (!this.database) {
            console.log('⚠️ Firebase no disponible');
            return;
        }

        try {
            const transactionsRef = this.database.ref('transactions');
            const snapshot = await transactionsRef.once('value');
            const transactionsData = snapshot.val();
            
            this.allTransactions = [];
            if (transactionsData) {
                Object.keys(transactionsData).forEach(userId => {
                    const userTransactions = transactionsData[userId];
                    Object.keys(userTransactions).forEach(transactionId => {
                        this.allTransactions.push({
                            id: transactionId,
                            userId: userId,
                            transaction: userTransactions[transactionId]
                        });
                    });
                });
            }

            this.renderAdvancedTransactions();
        } catch (error) {
            console.error('❌ Error cargando transacciones:', error);
        }
    }

    renderAdvancedTransactions() {
        const list = document.getElementById('advancedTransactionsList');
        if (!list) return;

        if (this.allTransactions.length === 0) {
            list.innerHTML = `
                <div class="no-transactions">
                    <i class="fas fa-inbox"></i>
                    <p>No hay transacciones disponibles</p>
                </div>
            `;
            return;
        }

        list.innerHTML = this.allTransactions.map(({id, userId, transaction}) => 
            this.renderTransactionItem(id, userId, transaction)
        ).join('');
    }

    updateTransactionStats() {
        const deposits = this.allTransactions
            .filter(t => t.transaction.type === 'income' && t.transaction.status === 'completed')
            .reduce((sum, t) => sum + (t.transaction.amount || 0), 0);
        
        const withdrawals = this.allTransactions
            .filter(t => t.transaction.type === 'outcome' && t.transaction.status === 'completed')
            .reduce((sum, t) => sum + (t.transaction.amount || 0), 0);
        
        const pending = this.allTransactions
            .filter(t => t.transaction.status === 'pending_verification').length;
        
        const activeUsers = new Set(this.allTransactions.map(t => t.userId)).size;

        document.getElementById('totalDeposits').textContent = `$${deposits.toLocaleString('es-CO')}`;
        document.getElementById('totalWithdrawals').textContent = `$${withdrawals.toLocaleString('es-CO')}`;
        document.getElementById('pendingCount').textContent = pending;
        document.getElementById('activeUsers').textContent = activeUsers;
    }

    applyAdvancedFilters() {
        const statusFilter = document.getElementById('statusFilter')?.value || 'all';
        const typeFilter = document.getElementById('typeFilter')?.value || 'all';
        const dateFrom = document.getElementById('dateFrom')?.value;
        const dateTo = document.getElementById('dateTo')?.value;
        const userSearch = document.getElementById('userSearch')?.value?.toLowerCase();

        let filtered = this.allTransactions;

        if (statusFilter !== 'all') {
            filtered = filtered.filter(t => t.transaction.status === statusFilter);
        }

        if (typeFilter !== 'all') {
            filtered = filtered.filter(t => t.transaction.type === typeFilter);
        }

        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            filtered = filtered.filter(t => new Date(t.transaction.timestamp) >= fromDate);
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(t => new Date(t.transaction.timestamp) <= toDate);
        }

        if (userSearch) {
            filtered = filtered.filter(t => 
                t.userId.toLowerCase().includes(userSearch) ||
                (t.transaction.userEmail && t.transaction.userEmail.toLowerCase().includes(userSearch))
            );
        }

        const list = document.getElementById('advancedTransactionsList');
        if (list) {
            list.innerHTML = filtered.map(({id, userId, transaction}) => 
                this.renderTransactionItem(id, userId, transaction)
            ).join('');
        }
    }

    clearFilters() {
        document.getElementById('statusFilter').value = 'all';
        document.getElementById('typeFilter').value = 'all';
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        document.getElementById('userSearch').value = '';
        this.renderAdvancedTransactions();
    }

    exportTransactions(format) {
        const data = this.allTransactions.map(({id, userId, transaction}) => ({
            ID: id,
            Usuario: userId,
            Tipo: transaction.type === 'income' ? 'Depósito' : 'Retiro',
            Monto: transaction.amount,
            Estado: transaction.status,
            Fecha: new Date(transaction.timestamp).toLocaleString('es-ES'),
            Método: transaction.method || 'N/A',
            Comprobante: transaction.proofFileName || 'N/A'
        }));

        if (format === 'csv') {
            this.downloadCSV(data, 'transacciones.csv');
        } else if (format === 'excel') {
            this.downloadExcel(data, 'transacciones.xlsx');
        }
    }

    downloadCSV(data, filename) {
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }

    downloadExcel(data, filename) {
        // Implementación básica - en producción usar una librería como SheetJS
        alert('Funcionalidad de Excel en desarrollo. Por ahora se descarga como CSV.');
        this.downloadCSV(data, filename.replace('.xlsx', '.csv'));
    }

    // ===== GESTIÓN DE USUARIOS =====
    async loadUserManagement() {
        console.log('👥 Cargando gestión de usuarios...');
        await this.loadUsers();
        this.updateUserStats();
    }

    async loadUsers() {
        if (!this.database) {
            console.log('⚠️ Firebase no disponible');
            return;
        }

        try {
            const usersRef = this.database.ref('users');
            const snapshot = await usersRef.once('value');
            const usersData = snapshot.val();
            
            this.allUsers = [];
            if (usersData) {
                Object.keys(usersData).forEach(userId => {
                    this.allUsers.push({
                        id: userId,
                        ...usersData[userId]
                    });
                });
            }

            this.renderUsers();
        } catch (error) {
            console.error('❌ Error cargando usuarios:', error);
        }
    }

    renderUsers() {
        const list = document.getElementById('usersList');
        if (!list) return;

        if (this.allUsers.length === 0) {
            list.innerHTML = `
                <div class="no-transactions">
                    <i class="fas fa-users"></i>
                    <p>No hay usuarios registrados</p>
                </div>
            `;
            return;
        }

        list.innerHTML = this.allUsers.map(user => this.renderUserItem(user)).join('');
    }

    renderUserItem(user) {
        const statusBadge = user.status === 'active' ? 
            '<span style="background: #4CAF50; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px;">Activo</span>' :
            '<span style="background: #f44336; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px;">Inactivo</span>';

        return `
            <div class="user-item">
                <div class="user-info">
                    <div class="user-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="user-details">
                        <h4>${user.email || user.id} ${statusBadge}</h4>
                        <p><strong>ID:</strong> ${user.id}</p>
                        <p><strong>Balance:</strong> $${(user.balance || 0).toLocaleString('es-CO')} COP</p>
                        <p><strong>Última actividad:</strong> ${user.lastUpdated ? new Date(user.lastUpdated).toLocaleString('es-ES') : 'N/A'}</p>
                    </div>
                </div>
                <div class="user-actions">
                    <button class="btn-admin btn-view" onclick="adminApp.viewUserDetails('${user.id}')">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                    <button class="btn-admin btn-message" onclick="adminApp.messageUser('${user.id}')">
                        <i class="fas fa-comment"></i> Mensaje
                    </button>
                    ${user.status === 'active' ? 
                        `<button class="btn-admin btn-reject" onclick="adminApp.banUser('${user.id}')">
                            <i class="fas fa-ban"></i> Suspender
                        </button>` :
                        `<button class="btn-admin btn-approve" onclick="adminApp.unbanUser('${user.id}')">
                            <i class="fas fa-check"></i> Activar
                        </button>`
                    }
                </div>
            </div>
        `;
    }

    updateUserStats() {
        const total = this.allUsers.length;
        const active = this.allUsers.filter(u => u.status === 'active').length;
        const newUsers = this.allUsers.filter(u => {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return new Date(u.lastUpdated || 0) > weekAgo;
        }).length;
        const banned = this.allUsers.filter(u => u.status === 'banned').length;

        document.getElementById('totalUsersCount').textContent = total;
        document.getElementById('activeUsersCount').textContent = active;
        document.getElementById('newUsersCount').textContent = newUsers;
        document.getElementById('bannedUsersCount').textContent = banned;
    }

    searchUsers() {
        const searchTerm = document.getElementById('userSearchInput')?.value?.toLowerCase();
        const statusFilter = document.getElementById('userStatusFilter')?.value;

        let filtered = this.allUsers;

        if (searchTerm) {
            filtered = filtered.filter(user => 
                user.id.toLowerCase().includes(searchTerm) ||
                (user.email && user.email.toLowerCase().includes(searchTerm))
            );
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(user => user.status === statusFilter);
        }

        const list = document.getElementById('usersList');
        if (list) {
            list.innerHTML = filtered.map(user => this.renderUserItem(user)).join('');
        }
    }

    viewUserDetails(userId) {
        const user = this.allUsers.find(u => u.id === userId);
        if (user) {
            alert(`Detalles del usuario:\n\nID: ${user.id}\nEmail: ${user.email || 'N/A'}\nBalance: $${(user.balance || 0).toLocaleString('es-CO')}\nEstado: ${user.status}\nÚltima actividad: ${user.lastUpdated ? new Date(user.lastUpdated).toLocaleString('es-ES') : 'N/A'}`);
        }
    }

    messageUser(userId) {
        const message = prompt('Escribe un mensaje para el usuario:');
        if (message) {
            // Aquí se implementaría el envío de mensaje al usuario
            alert('Mensaje enviado al usuario');
        }
    }

    async banUser(userId) {
        if (confirm('¿Estás seguro de suspender este usuario?')) {
            try {
                await this.database.ref(`users/${userId}/status`).set('banned');
                alert('Usuario suspendido');
                this.loadUserManagement();
            } catch (error) {
                console.error('❌ Error suspendiendo usuario:', error);
                alert('Error al suspender usuario');
            }
        }
    }

    async unbanUser(userId) {
        try {
            await this.database.ref(`users/${userId}/status`).set('active');
            alert('Usuario activado');
            this.loadUserManagement();
        } catch (error) {
            console.error('❌ Error activando usuario:', error);
            alert('Error al activar usuario');
        }
    }

    showCreateUserModal() {
        alert('Funcionalidad de crear usuario en desarrollo');
    }

    // ===== ANALYTICS AVANZADOS =====
    async loadAnalytics() {
        console.log('📈 Cargando analytics avanzados...');
        await this.loadAnalyticsData();
        this.initializeAnalyticsCharts();
    }

    async loadAnalyticsData() {
        // Cargar datos para analytics
        this.analyticsData = {
            revenue: this.calculateRevenueData(),
            userGrowth: this.calculateUserGrowth(),
            transactionVolume: this.calculateTransactionVolume(),
            approvalRate: this.calculateApprovalRate()
        };
    }

    calculateRevenueData() {
        const last30Days = [];
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayTransactions = this.allTransactions.filter(t => {
                const transactionDate = new Date(t.transaction.timestamp);
                return transactionDate.toDateString() === date.toDateString() && 
                       t.transaction.type === 'income' && 
                       t.transaction.status === 'completed';
            });
            const revenue = dayTransactions.reduce((sum, t) => sum + (t.transaction.amount || 0), 0);
            last30Days.push({ date: date.toISOString().split('T')[0], revenue });
        }
        return last30Days;
    }

    calculateUserGrowth() {
        const last30Days = [];
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayUsers = this.allUsers.filter(u => {
                const userDate = new Date(u.lastUpdated || 0);
                return userDate.toDateString() === date.toDateString();
            });
            last30Days.push({ date: date.toISOString().split('T')[0], users: dayUsers.length });
        }
        return last30Days;
    }

    calculateTransactionVolume() {
        return this.allTransactions.length;
    }

    calculateApprovalRate() {
        const completed = this.allTransactions.filter(t => t.transaction.status === 'completed').length;
        const total = this.allTransactions.filter(t => t.transaction.status !== 'pending_verification').length;
        return total > 0 ? Math.round((completed / total) * 100) : 0;
    }

    initializeAnalyticsCharts() {
        this.initializeRevenueChart();
        this.initializeTransactionDistributionChart();
        this.initializeUserActivityChart();
        this.initializeApprovalTrendsChart();
        this.updateAnalyticsMetrics();
    }

    initializeRevenueChart() {
        const ctx = document.getElementById('revenueChart');
        if (!ctx) return;

        const data = this.analyticsData.revenue;
        
        this.revenueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => new Date(d.date).toLocaleDateString('es-ES')),
                datasets: [{
                    label: 'Ingresos (COP)',
                    data: data.map(d => d.revenue),
                    borderColor: 'var(--primary-color)',
                    backgroundColor: 'rgba(96, 196, 142, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#e0e0e0' : '#333'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#e0e0e0' : '#333'
                        }
                    },
                    x: {
                        ticks: {
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#e0e0e0' : '#333'
                        }
                    }
                }
            }
        });
    }

    initializeTransactionDistributionChart() {
        const ctx = document.getElementById('transactionDistributionChart');
        if (!ctx) return;

        const income = this.allTransactions.filter(t => t.transaction.type === 'income').length;
        const outcome = this.allTransactions.filter(t => t.transaction.type === 'outcome').length;

        this.transactionDistributionChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Depósitos', 'Retiros'],
                datasets: [{
                    data: [income, outcome],
                    backgroundColor: ['var(--primary-color)', '#f44336'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#e0e0e0' : '#333'
                        }
                    }
                }
            }
        });
    }

    initializeUserActivityChart() {
        const ctx = document.getElementById('userActivityChart');
        if (!ctx) return;

        const data = this.analyticsData.userGrowth;
        
        this.userActivityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => new Date(d.date).toLocaleDateString('es-ES')),
                datasets: [{
                    label: 'Usuarios Activos',
                    data: data.map(d => d.users),
                    backgroundColor: 'var(--primary-color)',
                    borderColor: 'var(--primary-dark)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#e0e0e0' : '#333'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#e0e0e0' : '#333'
                        }
                    },
                    x: {
                        ticks: {
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#e0e0e0' : '#333'
                        }
                    }
                }
            }
        });
    }

    initializeApprovalTrendsChart() {
        const ctx = document.getElementById('approvalTrendsChart');
        if (!ctx) return;

        // Datos simulados para tendencias de aprobación
        const data = [];
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayTransactions = this.allTransactions.filter(t => {
                const transactionDate = new Date(t.transaction.timestamp);
                return transactionDate.toDateString() === date.toDateString();
            });
            const approved = dayTransactions.filter(t => t.transaction.status === 'completed').length;
            const total = dayTransactions.filter(t => t.transaction.status !== 'pending_verification').length;
            const rate = total > 0 ? (approved / total) * 100 : 0;
            data.push({ date: date.toISOString().split('T')[0], rate });
        }

        this.approvalTrendsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => new Date(d.date).toLocaleDateString('es-ES')),
                datasets: [{
                    label: 'Tasa de Aprobación (%)',
                    data: data.map(d => d.rate),
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#e0e0e0' : '#333'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#e0e0e0' : '#333'
                        }
                    },
                    x: {
                        ticks: {
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#e0e0e0' : '#333'
                        }
                    }
                }
            }
        });
    }

    updateAnalyticsMetrics() {
        const revenueGrowth = this.calculateGrowthRate(this.analyticsData.revenue.map(d => d.revenue));
        const userGrowth = this.calculateGrowthRate(this.analyticsData.userGrowth.map(d => d.users));

        document.getElementById('revenueGrowth').textContent = `+${revenueGrowth}%`;
        document.getElementById('userGrowth').textContent = `+${userGrowth}%`;
        document.getElementById('transactionVolume').textContent = this.analyticsData.transactionVolume;
        document.getElementById('approvalRate').textContent = `${this.analyticsData.approvalRate}%`;
    }

    calculateGrowthRate(values) {
        if (values.length < 2) return 0;
        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        return firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0;
    }

    updateAnalytics() {
        this.loadAnalytics();
    }

    generateReport(type) {
        alert(`Generando reporte ${type}...`);
        // Aquí se implementaría la generación de reportes
    }

    // ===== CONFIGURACIÓN DEL SISTEMA =====
    async loadSettings() {
        console.log('⚙️ Cargando configuración...');
        await this.loadSystemSettings();
    }

    async loadSystemSettings() {
        if (!this.database) {
            console.log('⚠️ Firebase no disponible');
            return;
        }

        try {
            const settingsRef = this.database.ref('admin/settings');
            const snapshot = await settingsRef.once('value');
            const settings = snapshot.val() || this.getDefaultSettings();

            this.populateSettingsForm(settings);
        } catch (error) {
            console.error('❌ Error cargando configuraciones:', error);
            this.populateSettingsForm(this.getDefaultSettings());
        }
    }

    getDefaultSettings() {
        return {
            platformName: 'Deseo',
            contactEmail: 'admin@deseo.com',
            dailyDepositLimit: 1000000,
            dailyWithdrawalLimit: 500000,
            autoApproveSmall: true,
            requireProof: true,
            approvalTimeout: 24,
            transactionFee: 2.5,
            twoFactorAuth: true,
            sessionTimeout: true,
            maxLoginAttempts: 5,
            lockoutDuration: 30,
            emailNotifications: true,
            pushNotifications: true,
            transactionAlerts: true,
            reportFrequency: 7
        };
    }

    populateSettingsForm(settings) {
        Object.keys(settings).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = settings[key];
                } else {
                    element.value = settings[key];
                }
            }
        });
    }

    async saveSettings() {
        if (!this.database) {
            alert('❌ Firebase no disponible');
            return;
        }

        try {
            const settings = {
                platformName: document.getElementById('platformName')?.value || 'Deseo',
                contactEmail: document.getElementById('contactEmail')?.value || 'admin@deseo.com',
                dailyDepositLimit: parseInt(document.getElementById('dailyDepositLimit')?.value) || 1000000,
                dailyWithdrawalLimit: parseInt(document.getElementById('dailyWithdrawalLimit')?.value) || 500000,
                autoApproveSmall: document.getElementById('autoApproveSmall')?.checked || false,
                requireProof: document.getElementById('requireProof')?.checked || false,
                approvalTimeout: parseInt(document.getElementById('approvalTimeout')?.value) || 24,
                transactionFee: parseFloat(document.getElementById('transactionFee')?.value) || 2.5,
                twoFactorAuth: document.getElementById('twoFactorAuth')?.checked || false,
                sessionTimeout: document.getElementById('sessionTimeout')?.checked || false,
                maxLoginAttempts: parseInt(document.getElementById('maxLoginAttempts')?.value) || 5,
                lockoutDuration: parseInt(document.getElementById('lockoutDuration')?.value) || 30,
                emailNotifications: document.getElementById('emailNotifications')?.checked || false,
                pushNotifications: document.getElementById('pushNotifications')?.checked || false,
                transactionAlerts: document.getElementById('transactionAlerts')?.checked || false,
                reportFrequency: parseInt(document.getElementById('reportFrequency')?.value) || 7,
                lastUpdated: new Date().toISOString()
            };

            await this.database.ref('admin/settings').set(settings);
            alert('✅ Configuraciones guardadas correctamente');
        } catch (error) {
            console.error('❌ Error guardando configuraciones:', error);
            alert('❌ Error al guardar configuraciones');
        }
    }

    resetSettings() {
        if (confirm('¿Estás seguro de restaurar los valores por defecto?')) {
            this.populateSettingsForm(this.getDefaultSettings());
            alert('✅ Configuraciones restauradas a valores por defecto');
        }
    }

    clearCache() {
        if (confirm('¿Estás seguro de limpiar el caché?')) {
            localStorage.clear();
            sessionStorage.clear();
            alert('✅ Caché limpiado correctamente');
        }
    }

    backupData() {
        alert('Funcionalidad de respaldo en desarrollo');
        // Aquí se implementaría la funcionalidad de respaldo
    }

    // ===== RESPONSIVE HANDLING =====
    handleWindowResize() {
        const width = window.innerWidth;
        const adminSidebar = document.getElementById('adminSidebar');
        const mobileOverlay = document.getElementById('mobileOverlay');

        if (width > 768) {
            // Desktop view
            if (adminSidebar) {
                adminSidebar.classList.remove('open');
            }
            if (mobileOverlay) {
                mobileOverlay.classList.remove('active');
            }
        } else {
            // Mobile view - ensure sidebar is closed by default
            if (adminSidebar && !adminSidebar.classList.contains('open')) {
                adminSidebar.classList.remove('open');
            }
            if (mobileOverlay) {
                mobileOverlay.classList.remove('active');
            }
        }

        // Update charts if they exist
        this.updateChartsResponsiveness();
    }

    updateChartsResponsiveness() {
        // Update chart sizes for responsive behavior
        const charts = [
            this.transactionsChart,
            this.revenueChart,
            this.transactionDistributionChart,
            this.userActivityChart,
            this.approvalTrendsChart
        ];

        charts.forEach(chart => {
            if (chart) {
                chart.resize();
            }
        });
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