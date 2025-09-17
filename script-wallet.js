// ===== SISTEMA DE BILLETERA =====
class WalletManager {
    constructor() {
        this.balance = 0;
        this.transactions = [];
        this.boldClient = null;
        this.init();
    }

    async init() {
        await this.loadBalance();
        await this.loadTransactions();
        this.renderBalance();
        this.renderTransactions();
        this.setupEventListeners();
        await this.initializeBold();
    }

    async initializeBold() {
        try {
            // Inicializar Bold con la configuración
            if (typeof Bold !== 'undefined' && window.CONFIG && window.CONFIG.BOLD) {
                this.boldClient = new Bold({
                    apiKey: window.CONFIG.BOLD.API_KEY,
                    environment: window.CONFIG.BOLD.ENVIRONMENT
                });
                console.log('✅ Bold payment gateway initialized');
            } else {
                console.warn('⚠️ Bold SDK not loaded or config missing, using fallback payment simulation');
            }
        } catch (error) {
            console.error('❌ Error initializing Bold:', error);
        }
    }

    async loadBalance() {
        try {
            // Cargar balance desde localStorage o Firebase
            const savedBalance = localStorage.getItem('deseo_balance');
            if (savedBalance) {
                this.balance = parseFloat(savedBalance);
            } else {
                this.balance = 0;
            }
        } catch (error) {
            console.error('Error loading balance:', error);
            this.balance = 0;
        }
    }

    async loadTransactions() {
        try {
            const savedTransactions = localStorage.getItem('deseo_transactions');
            if (savedTransactions) {
                this.transactions = JSON.parse(savedTransactions);
            } else {
                // Generar transacciones de ejemplo
                this.transactions = this.generateSampleTransactions();
                this.saveTransactions();
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
            this.transactions = [];
        }
    }

    generateSampleTransactions() {
        return [
            {
                id: 1,
                type: 'income',
                amount: 50.00,
                description: 'Pago por deseo completado',
                method: 'Transferencia bancaria',
                date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'completed'
            },
            {
                id: 2,
                type: 'expense',
                amount: 15.00,
                description: 'Compra de café',
                method: 'Tarjeta de crédito',
                date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'completed'
            },
            {
                id: 3,
                type: 'income',
                amount: 25.00,
                description: 'Servicio de entrega',
                method: 'PayPal',
                date: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
                status: 'completed'
            }
        ];
    }

    saveBalance() {
        localStorage.setItem('deseo_balance', this.balance.toString());
    }

    saveTransactions() {
        localStorage.setItem('deseo_transactions', JSON.stringify(this.transactions));
    }

    renderBalance() {
        const balanceElement = document.getElementById('totalBalance');
        if (balanceElement) {
            balanceElement.textContent = this.balance.toFixed(2);
        }
    }

    renderTransactions(filter = 'all') {
        const transactionsList = document.getElementById('transactionsList');
        if (!transactionsList) return;

        let filteredTransactions = this.transactions;
        if (filter !== 'all') {
            filteredTransactions = this.transactions.filter(t => t.type === filter);
        }

        // Ordenar por fecha (más recientes primero)
        filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        transactionsList.innerHTML = '';

        if (filteredTransactions.length === 0) {
            transactionsList.innerHTML = `
                <div class="no-transactions">
                    <i class="fas fa-receipt"></i>
                    <p>No hay transacciones para mostrar</p>
                </div>
            `;
            return;
        }

        filteredTransactions.forEach(transaction => {
            const transactionElement = this.createTransactionElement(transaction);
            transactionsList.appendChild(transactionElement);
        });
    }

    createTransactionElement(transaction) {
        const div = document.createElement('div');
        div.className = 'transaction-item';

        const iconClass = transaction.type === 'income' ? 'fas fa-arrow-down' : 'fas fa-arrow-up';
        const amountClass = transaction.type === 'income' ? 'income' : 'expense';
        const amountPrefix = transaction.type === 'income' ? '+' : '-';

        div.innerHTML = `
            <div class="transaction-info">
                <div class="transaction-icon ${transaction.type}">
                    <i class="${iconClass}"></i>
                </div>
                <div class="transaction-details">
                    <h4>${transaction.description}</h4>
                    <p>${transaction.method} • ${this.formatDate(transaction.date)}</p>
                </div>
            </div>
            <div class="transaction-amount ${amountClass}">
                ${amountPrefix}$${transaction.amount.toFixed(2)}
            </div>
        `;

        return div;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    setupEventListeners() {
        // Filtros de transacciones
        const filterTabs = document.querySelectorAll('.filter-tab');
        filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remover clase active de todos los tabs
                filterTabs.forEach(t => t.classList.remove('active'));
                // Agregar clase active al tab clickeado
                tab.classList.add('active');

                const filter = tab.getAttribute('data-filter');
                this.renderTransactions(filter);
            });
        });

        // Formulario de agregar dinero
        const addMoneyForm = document.getElementById('addMoneyForm');
        if (addMoneyForm) {
            addMoneyForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddMoney();
            });
        }

        // Formulario de retirar dinero
        const withdrawForm = document.getElementById('withdrawForm');
        if (withdrawForm) {
            withdrawForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleWithdraw();
            });
        }
    }

    async handleAddMoney() {
        const amount = parseFloat(document.getElementById('addAmount').value);

        if (!amount || amount < 1000) {
            this.showNotification('Por favor ingresa una cantidad válida (mínimo $1,000 COP)', 'error');
            return;
        }

        try {
            // Actualizar el botón de Bold con el monto
            this.updateBoldButton(amount);
            
            this.showNotification('Configurando pago con Bold...', 'info');
        } catch (error) {
            console.error('Error configuring Bold payment:', error);
            this.showNotification('Error al configurar el pago', 'error');
        }
    }

    updateBoldButton(amount) {
        // Generar un ID único para la orden
        const orderId = `deseo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Obtener datos del usuario si están disponibles
        const userData = this.getUserData();
        
        // Actualizar los atributos del script de Bold
        const boldScript = document.querySelector('script[data-bold-button]');
        if (boldScript) {
            boldScript.setAttribute('data-amount', amount.toString());
            boldScript.setAttribute('data-order-id', orderId);
            boldScript.setAttribute('data-customer-data', JSON.stringify(userData));
            
            // Recargar el script para aplicar los cambios
            this.reloadBoldScript();
        }
    }

    getUserData() {
        // Obtener datos del usuario desde localStorage o el sistema de autenticación
        const user = JSON.parse(localStorage.getItem('deseo_user') || '{}');
        return {
            email: user.email || '',
            fullName: user.name || '',
            phone: user.phone || '',
            dialCode: '+57',
            documentNumber: user.documentNumber || '',
            documentType: 'CC'
        };
    }

    reloadBoldScript() {
        // Remover el script actual
        const oldScript = document.querySelector('script[data-bold-button]');
        if (oldScript) {
            oldScript.remove();
        }
        
        // Crear nuevo script con los datos actualizados
        const newScript = document.createElement('script');
        newScript.setAttribute('data-bold-button', '');
        newScript.setAttribute('data-api-key', 'H-HdPzurw8OPki3Fv8_WU-qFOAPQ9SarD_HV36Fp4_I');
        newScript.setAttribute('data-description', 'Recarga de billetera Deseo');
        newScript.setAttribute('data-redirection-url', 'https://simon990520.github.io/deseo/wallet.html?payment=success');
        newScript.setAttribute('data-render-mode', 'embedded');
        newScript.setAttribute('data-currency', 'COP');
        newScript.setAttribute('data-amount', document.getElementById('addAmount').value);
        newScript.setAttribute('data-order-id', `deseo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
        newScript.setAttribute('data-customer-data', JSON.stringify(this.getUserData()));
        newScript.setAttribute('data-billing-address', '');
        newScript.setAttribute('data-tax', '');
        newScript.setAttribute('data-expiration-date', '');
        newScript.setAttribute('data-origin-url', 'https://simon990520.github.io/deseo/wallet.html');
        newScript.setAttribute('data-extra-data-1', 'wallet_recharge');
        newScript.setAttribute('data-extra-data-2', 'deseo_app');
        
        // Agregar el nuevo script al contenedor
        const container = document.querySelector('.bold-payment-container');
        if (container) {
            container.appendChild(newScript);
        }
    }

    // Función para procesar el resultado del pago (llamada desde la URL de redirección)
    processPaymentResult() {
        const urlParams = new URLSearchParams(window.location.search);
        const paymentStatus = urlParams.get('payment');
        
        if (paymentStatus === 'success') {
            this.showNotification('¡Pago procesado exitosamente!', 'success');
            
            // Aquí podrías obtener los detalles de la transacción desde Bold
            // y actualizar el balance y las transacciones
            this.loadBalance();
            this.loadTransactions();
            this.renderBalance();
            this.renderTransactions();
        } else if (paymentStatus === 'error') {
            this.showNotification('Error en el procesamiento del pago', 'error');
        }
    }

    // Función para simular el procesamiento de pago (fallback)
    async processPayment(amount, method, type) {
        try {
            // Mostrar indicador de carga
            this.showNotification('Procesando pago...', 'info');

            // Simular procesamiento de pago
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Simular resultado exitoso
            const paymentResult = {
                success: true,
                transactionId: `sim_${Date.now()}`,
                amount: amount,
                method: method
            };

            if (paymentResult.success) {
                // Agregar dinero al balance
                this.balance += amount;

                // Crear transacción
                const transaction = {
                    id: Date.now(),
                    type: 'income',
                    amount: amount,
                    description: `Depósito via ${method}`,
                    method: method,
                    date: new Date().toISOString(),
                    status: 'completed',
                    boldTransactionId: paymentResult.transactionId
                };

                this.transactions.unshift(transaction);

                // Guardar cambios
                this.saveBalance();
                this.saveTransactions();

                // Actualizar UI
                this.renderBalance();
                this.renderTransactions();

                // Cerrar modal y limpiar formulario
                this.closeModal('addMoneyModal');
                document.getElementById('addMoneyForm').reset();

                this.showNotification(`$${amount.toFixed(2)} agregados exitosamente`, 'success');
            } else {
                throw new Error(paymentResult.error || 'Error en el procesamiento del pago');
            }
        } catch (error) {
            console.error('Error adding money:', error);
            this.showNotification(error.message || 'Error al procesar el pago', 'error');
        }
    }

    async handleWithdraw() {
        const amount = parseFloat(document.getElementById('withdrawAmount').value);
        const method = document.getElementById('withdrawMethod').value;

        if (!amount || amount <= 0) {
            this.showNotification('Por favor ingresa una cantidad válida', 'error');
            return;
        }

        if (amount > this.balance) {
            this.showNotification('Fondos insuficientes', 'error');
            return;
        }

        if (!method) {
            this.showNotification('Por favor selecciona un método de retiro', 'error');
            return;
        }

        try {
            // Mostrar indicador de carga
            this.showNotification('Procesando retiro...', 'info');

            // Procesar retiro con Bold o simulación
            const paymentResult = await this.processPayment(amount, method, 'withdraw');

            if (paymentResult.success) {
                // Retirar dinero del balance
                this.balance -= amount;

                // Crear transacción
                const transaction = {
                    id: Date.now(),
                    type: 'expense',
                    amount: amount,
                    description: `Retiro via ${method}`,
                    method: method,
                    date: new Date().toISOString(),
                    status: 'completed',
                    boldTransactionId: paymentResult.transactionId
                };

                this.transactions.unshift(transaction);

                // Guardar cambios
                this.saveBalance();
                this.saveTransactions();

                // Actualizar UI
                this.renderBalance();
                this.renderTransactions();

                // Cerrar modal y limpiar formulario
                this.closeModal('withdrawModal');
                document.getElementById('withdrawForm').reset();

                this.showNotification(`$${amount.toFixed(2)} retirados exitosamente`, 'success');
            } else {
                throw new Error(paymentResult.error || 'Error en el procesamiento del retiro');
            }
        } catch (error) {
            console.error('Error withdrawing money:', error);
            this.showNotification(error.message || 'Error al procesar el retiro', 'error');
        }
    }

    async processPayment(amount, method, type) {
        try {
            // Si Bold está disponible, usarlo
            if (this.boldClient) {
                return await this.processBoldPayment(amount, method, type);
            } else {
                // Fallback a simulación
                return await this.simulatePayment(amount, method, type);
            }
        } catch (error) {
            console.error('Payment processing error:', error);
            return { success: false, error: error.message };
        }
    }

    async processBoldPayment(amount, method, type) {
        try {
            // Crear transacción con Bold
            const paymentData = {
                amount: amount * 100, // Bold usa centavos
                currency: 'USD',
                description: `${type === 'deposit' ? 'Depósito' : 'Retiro'} via ${method}`,
                payment_method: method,
                metadata: {
                    type: type,
                    user_id: 'current_user', // Reemplazar con ID real del usuario
                    app: 'deseo'
                }
            };

            const result = await this.boldClient.payments.create(paymentData);
            
            return {
                success: true,
                transactionId: result.id,
                boldResponse: result
            };
        } catch (error) {
            console.error('Bold payment error:', error);
            return {
                success: false,
                error: `Error de Bold: ${error.message}`
            };
        }
    }

    async simulatePayment(amount, method, type) {
        // Simular delay de procesamiento
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Simular éxito/fallo (90% éxito)
        const success = Math.random() > 0.1;
        
        if (success) {
            return {
                success: true,
                transactionId: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };
        } else {
            return {
                success: false,
                error: 'Simulación de error de pago'
            };
        }
    }

    async simulatePaymentProcessing() {
        // Simular delay de procesamiento
        return new Promise(resolve => {
            setTimeout(resolve, 2000);
        });
    }

    showAddMoneyModal() {
        const modal = document.getElementById('addMoneyModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    showWithdrawModal() {
        const modal = document.getElementById('withdrawModal');
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
let walletManager;

// Función de inicialización mejorada
function initializeWallet() {
    console.log('🚀 Inicializando billetera...');
    
    try {
        walletManager = new WalletManager();
        window.walletManager = walletManager;
        console.log('✅ Billetera inicializada correctamente');
    } catch (error) {
        console.error('❌ Error inicializando billetera:', error);
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initializeWallet);

// También inicializar si el DOM ya está listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWallet);
} else {
    initializeWallet();
}

// Procesar resultados de pago al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    if (walletManager) {
        walletManager.processPaymentResult();
    }
});

// ===== FUNCIONES GLOBALES =====
window.app = window.app || {};

window.app.showAddMoneyModal = () => {
    if (walletManager) {
        walletManager.showAddMoneyModal();
    } else {
        console.error('WalletManager no está disponible');
    }
};

window.app.showWithdrawModal = () => {
    if (walletManager) {
        walletManager.showWithdrawModal();
    } else {
        console.error('WalletManager no está disponible');
    }
};

window.app.closeModal = (modalId) => {
    if (walletManager) {
        walletManager.closeModal(modalId);
    } else {
        // Fallback básico
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }
};

// Funciones de navegación
window.app.toggleNavMenu = () => {
    const navMenu = document.getElementById('navMenu');
    if (navMenu) {
        navMenu.style.display = navMenu.style.display === 'none' ? 'block' : 'none';
    }
};

window.app.closeNavMenu = () => {
    const navMenu = document.getElementById('navMenu');
    if (navMenu) {
        navMenu.style.display = 'none';
    }
};

window.app.logout = () => {
    // Simular logout
    localStorage.removeItem('deseo_user_profile');
    localStorage.removeItem('deseo_balance');
    localStorage.removeItem('deseo_transactions');
    alert('Sesión cerrada');
    window.location.href = 'index.html';
};