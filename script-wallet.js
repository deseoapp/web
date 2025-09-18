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
        this.initializeTheme();
        this.renderBalance();
        this.renderTransactions();
        this.setupEventListeners();
        await this.initializeBold();
    }
    
    initializeTheme() {
        // Sincronizar con el sistema de temas del index
        this.syncWithMainTheme();
        
        // Escuchar cambios en el tema principal
        this.observeThemeChanges();
    }
    
    syncWithMainTheme() {
        // Obtener el tema actual del sistema principal
        const currentTheme = document.documentElement.getAttribute('data-theme') || 
                           localStorage.getItem('deseo-theme') || 'dark';
        
        console.log('🔍 Debug - Sincronizando tema de billetera con:', currentTheme);
        this.applyWalletTheme(currentTheme === 'dark');
    }
    
    observeThemeChanges() {
        // Observar cambios en el atributo data-theme
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                    const newTheme = document.documentElement.getAttribute('data-theme');
                    const isDark = newTheme === 'dark';
                    console.log('🔍 Debug - Tema cambiado a:', newTheme);
                    this.applyWalletTheme(isDark);
                }
            });
        });
        
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });
    }
    
    applyWalletTheme(isDark) {
        const root = document.documentElement;
        if (isDark) {
            root.style.setProperty('--bg-primary', '#0f0f0f');
            root.style.setProperty('--bg-secondary', '#1a1a1a');
            root.style.setProperty('--text-primary', '#ffffff');
            root.style.setProperty('--text-secondary', '#cccccc');
            root.style.setProperty('--border-color', '#333333');
        } else {
            root.style.setProperty('--bg-primary', '#ffffff');
            root.style.setProperty('--bg-secondary', '#f5f5f5');
            root.style.setProperty('--text-primary', '#333333');
            root.style.setProperty('--text-secondary', '#666666');
            root.style.setProperty('--border-color', '#e0e0e0');
        }
        
        // Aplicar clase al body para compatibilidad
        document.body.classList.toggle('dark-mode', isDark);
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
            // Cargar balance SOLO desde Firebase por seguridad
            if (typeof window.firebase === 'undefined') {
                console.warn('⚠️ Firebase no disponible, balance inicializado en 0');
                this.balance = 0;
                return;
            }
            
            const user = JSON.parse(localStorage.getItem('deseo_user') || '{}');
            if (!user.uid) {
                console.warn('⚠️ Usuario no autenticado, balance inicializado en 0');
                this.balance = 0;
                return;
            }
            
            // Usar Firebase Realtime Database
            const db = window.firebase.database();
            const userRef = db.ref(`users/${user.uid}`);
            
            const snapshot = await userRef.once('value');
            const userData = snapshot.val();
            
            if (userData && userData.balance !== undefined) {
                this.balance = parseFloat(userData.balance);
                console.log('✅ Balance cargado desde Firebase:', this.balance);
            } else {
                this.balance = 0;
                console.log('ℹ️ Balance inicializado en 0 (primer uso)');
            }
        } catch (error) {
            console.error('❌ Error loading balance from Firebase:', error);
            this.balance = 0;
        }
    }

    async loadTransactions() {
        try {
            // Cargar transacciones SOLO desde Firebase por seguridad
            if (typeof window.firebase === 'undefined') {
                console.warn('⚠️ Firebase no disponible, transacciones inicializadas vacías');
                this.transactions = [];
                return;
            }
            
            const user = JSON.parse(localStorage.getItem('deseo_user') || '{}');
            if (!user.uid) {
                console.warn('⚠️ Usuario no autenticado, transacciones inicializadas vacías');
                this.transactions = [];
                return;
            }
            
            // Usar Firebase Realtime Database
            const db = window.firebase.database();
            const transactionsRef = db.ref(`transactions/${user.uid}`);
            
            const snapshot = await transactionsRef.once('value');
            const transactionsData = snapshot.val();
            
            if (transactionsData) {
                // Convertir objeto a array y ordenar por fecha
                this.transactions = Object.values(transactionsData)
                    .sort((a, b) => new Date(b.date) - new Date(a.date));
                console.log('✅ Transacciones cargadas desde Firebase:', this.transactions.length);
            } else {
                this.transactions = [];
                console.log('ℹ️ No hay transacciones previas (primer uso)');
            }
        } catch (error) {
            console.error('❌ Error loading transactions from Firebase:', error);
            this.transactions = [];
        }
    }

    // Función eliminada por seguridad - no se generan transacciones de ejemplo

    // MÉTODOS DE GUARDADO ELIMINADOS POR SEGURIDAD
    // Los datos se guardan directamente en Firebase en saveToFirebase()

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

        // Event listener para actualizar el botón Bold cuando cambie la cantidad
        const addAmountInput = document.getElementById('addAmount');
        console.log('🔍 Debug: addAmountInput encontrado:', addAmountInput);
        
        if (addAmountInput) {
            addAmountInput.addEventListener('input', (e) => {
                console.log('🔍 Debug: Input cambiado, valor:', e.target.value);
                const amount = parseFloat(e.target.value);
                console.log('🔍 Debug: Amount parseado:', amount);
                
                if (amount && amount >= 1000) {
                    console.log('🔍 Debug: Cantidad válida, creando botón Bold...');
                    this.updateBoldButton(amount);
                } else {
                    console.log('🔍 Debug: Cantidad inválida, mostrando placeholder');
                    // Mostrar placeholder si no hay cantidad válida
                    const container = document.querySelector('.bold-payment-container');
                    if (container) {
                        container.innerHTML = '<div id="boldButtonPlaceholder"><p>Ingresa una cantidad para habilitar el pago</p></div>';
                    }
                }
            });
        } else {
            console.error('❌ Error: No se encontró el input addAmount');
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

    // Obtener firma de integridad desde el backend (requerido por Bold)
    async fetchIntegritySignature(signatureData) {
        try {
            if (!window.CONFIG || !window.CONFIG.BOLD || !window.CONFIG.BOLD.SIGNATURE_ENDPOINT) {
                throw new Error('SIGNATURE_ENDPOINT no configurado en CONFIG.BOLD');
            }
            let endpoint = window.CONFIG.BOLD.SIGNATURE_ENDPOINT;
            // Adjuntar bypass token de Vercel si está configurado (Deployment Protection)
            const bypassToken = window.CONFIG.BOLD.VERCEL_BYPASS_TOKEN;
            if (bypassToken) {
                const url = new URL(endpoint);
                url.searchParams.set('x-vercel-set-bypass-cookie', 'true');
                url.searchParams.set('x-vercel-protection-bypass', bypassToken);
                endpoint = url.toString();
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(signatureData)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Error ${response.status}: ${text}`);
            }

            const data = await response.json();
            // Se espera que el backend devuelva { signature: '...' }
            if (!data || !data.signature) {
                throw new Error('Respuesta inválida del servidor: falta signature');
            }
            return data.signature;
        } catch (error) {
            console.error('❌ Error obteniendo data-integrity-signature:', error);
            this.showNotification('Error obteniendo firma de integridad', 'error');
            return null;
        }
    }

    async updateBoldButton(amount) {
        console.log('🔍 Debug: Creando link de pago Bold con amount:', amount);
        
        try {
            // Crear link de pago usando la API de Bold
            const paymentLink = await this.createBoldPaymentLink(amount);
            
            if (!paymentLink) {
                this.showNotification('Error al crear el link de pago', 'error');
                return;
            }
            
            // Mostrar el link de pago en el contenedor
            this.displayPaymentLink(paymentLink, amount);
            
        } catch (error) {
            console.error('❌ Error creando link de pago:', error);
            this.showNotification('Error al crear el link de pago', 'error');
        }
    }
    
    async createBoldPaymentLink(amount) {
        try {
            const orderId = `deseo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Guardar pago pendiente para procesar después
            localStorage.setItem('pending_payment', JSON.stringify({
                amount: amount,
                orderId: orderId,
                timestamp: Date.now()
            }));
            
            // Usar nuestro proxy en Vercel para evitar CORS
            const proxyUrl = window.CONFIG.BOLD.PAYMENT_LINK_ENDPOINT || 'https://server-eo9ez6okm-koddio999s-projects.vercel.app/api/bold/create-payment-link';
            
            const requestData = {
                amount: amount,
                orderId: orderId,
                description: "Recarga de billetera Deseo",
                callbackUrl: "https://simon990520.github.io/deseo/wallet.html?payment=success"
            };
            
            console.log('🔍 Debug: Creando link de pago via proxy:', requestData);
            
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Error ${response.status}: ${errorData.error || response.statusText}`);
            }
            
            const data = await response.json();
            console.log('✅ Link de pago creado via proxy:', data);
            
            return data.data; // data.paymentLink, data.url, etc.
            
        } catch (error) {
            console.error('❌ Error creando link de pago Bold:', error);
            // Limpiar pago pendiente si hay error
            localStorage.removeItem('pending_payment');
            throw error;
        }
    }
    
    displayPaymentLink(paymentData, amount) {
        const container = document.querySelector('.bold-payment-container');
        
        if (!container) {
            console.error('❌ Error: No se encontró el contenedor .bold-payment-container');
            return;
        }

        // Detectar si estamos en dark mode (sincronizado con el sistema principal)
        const currentTheme = document.documentElement.getAttribute('data-theme') || 
                           localStorage.getItem('deseo-theme') || 'dark';
        const isDarkMode = currentTheme === 'dark';
        
        const darkStyles = isDarkMode ? {
            background: '#1a1a1a',
            border: '2px solid #4CAF50',
            textColor: '#ffffff',
            textSecondary: '#cccccc',
            buttonBg: '#4CAF50',
            buttonHover: '#45a049',
            idColor: '#888888'
        } : {
            background: '#f9f9f9',
            border: '2px solid #4CAF50',
            textColor: '#333333',
            textSecondary: '#666666',
            buttonBg: '#4CAF50',
            buttonHover: '#45a049',
            idColor: '#999999'
        };
        
        container.innerHTML = `
            <div class="payment-link-container" style="
                text-align: center; 
                padding: 20px; 
                border: ${darkStyles.border}; 
                border-radius: 10px; 
                background: ${darkStyles.background};
                color: ${darkStyles.textColor};
                transition: all 0.3s ease;
            ">
                <p style="margin-bottom: 15px; font-size: 18px; color: ${darkStyles.textColor};">
                    <strong>Monto:</strong> $${amount.toLocaleString('es-CO')} COP
                </p>
                <p style="margin-bottom: 20px; color: ${darkStyles.textSecondary}; font-size: 14px;">
                    Haz clic en el botón para proceder con el pago
                </p>
                <a href="${paymentData.url}" 
                   target="_blank" 
                   class="bold-payment-button" 
                   style="
                       display: inline-block; 
                       background: ${darkStyles.buttonBg}; 
                       color: white; 
                       padding: 15px 30px; 
                       text-decoration: none; 
                       border-radius: 8px; 
                       font-size: 16px; 
                       font-weight: bold; 
                       box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                       transition: all 0.3s ease;
                   "
                   onmouseover="this.style.background='${darkStyles.buttonHover}'; this.style.transform='translateY(-2px)';"
                   onmouseout="this.style.background='${darkStyles.buttonBg}'; this.style.transform='translateY(0)';">
                     Pagar Ahora
                </a>
                <p style="margin-top: 15px; font-size: 12px; color: ${darkStyles.idColor};">
                    ID: ${paymentData.payment_link}
                </p>
            </div>
        `;
        
        console.log('✅ Link de pago mostrado correctamente');
        this.showNotification('Link de pago creado exitosamente', 'success');
    }

    addTestButtons(container, attributes, signatureResponse) {
        // Crear div para botones de prueba
        const testDiv = document.createElement('div');
        testDiv.style.marginTop = '10px';
        testDiv.style.padding = '10px';
        testDiv.style.border = '1px solid #ccc';
        testDiv.style.borderRadius = '5px';
        testDiv.style.backgroundColor = '#f9f9f9';
        
        testDiv.innerHTML = `
            <h4>🔧 Pruebas de Firma (Debug)</h4>
            <p><strong>Método actual:</strong> ${signatureResponse.method}</p>
            <p><strong>Firma básica:</strong> ${signatureResponse.signature.substring(0, 20)}...</p>
            <p><strong>Firma alternativa:</strong> ${signatureResponse.alternative.substring(0, 20)}...</p>
            <button id="testBasicSignature" style="margin: 5px; padding: 5px 10px;">Probar Firma Básica</button>
            <button id="testAlternativeSignature" style="margin: 5px; padding: 5px 10px;">Probar Firma Alternativa</button>
        `;
        
        container.appendChild(testDiv);
        
        // Event listeners para los botones de prueba
        document.getElementById('testBasicSignature').addEventListener('click', () => {
            this.testSignatureMethod(attributes, 'basic');
        });
        
        document.getElementById('testAlternativeSignature').addEventListener('click', () => {
            this.testSignatureMethod(attributes, 'alternative');
        });
    }
    
    async testSignatureMethod(attributes, method) {
        try {
            const response = await fetch(window.CONFIG.BOLD.SIGNATURE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attributes, method })
            });
            
            const data = await response.json();
            console.log(`🔍 Debug - Prueba método ${method}:`, data);
            
            // Crear botón con la firma de prueba
            this.createTestButton(attributes, data.signature, method);
            
        } catch (error) {
            console.error(`❌ Error probando método ${method}:`, error);
        }
    }
    
    createTestButton(attributes, signature, method) {
        const container = document.querySelector('.bold-payment-container');
        const testButton = document.createElement('script');
        testButton.src = 'https://checkout.bold.co/library/boldPaymentButton.js';
        testButton.async = true;
        testButton.setAttribute('data-bold-button', 'dark-L');
        testButton.setAttribute('data-api-key', attributes['data-api-key']);
        testButton.setAttribute('data-description', `Prueba ${method} - ${attributes['data-description']}`);
        testButton.setAttribute('data-redirection-url', attributes['data-redirection-url']);
        testButton.setAttribute('data-render-mode', 'embedded');
        testButton.setAttribute('data-currency', attributes['data-currency']);
        testButton.setAttribute('data-amount', attributes['data-amount']);
        testButton.setAttribute('data-order-id', attributes['data-order-id']);
        testButton.setAttribute('data-integrity-signature', signature);
        testButton.setAttribute('data-origin-url', attributes['data-origin-url']);
        testButton.setAttribute('data-extra-data-1', attributes['data-extra-data-1']);
        testButton.setAttribute('data-extra-data-2', attributes['data-extra-data-2']);
        
        // Añadir al contenedor
        container.appendChild(testButton);
        
        console.log(`✅ Botón de prueba ${method} creado con firma:`, signature.substring(0, 20) + '...');
    }

    checkBoldButtonRendered() {
        console.log('🔍 Debug: Verificando si el botón Bold se renderizó...');
        
        const container = document.querySelector('.bold-payment-container');
        const boldButton = container.querySelector('button, iframe, [data-bold-button]');
        
        console.log('🔍 Debug: Elementos en el contenedor:', container.innerHTML);
        console.log('🔍 Debug: Botón Bold encontrado:', boldButton);
        
        if (boldButton) {
            console.log('✅ Botón Bold renderizado correctamente');
            this.showNotification('Botón de pago listo', 'success');
        } else {
            console.error('❌ Error: El botón Bold no se renderizó');
            this.showNotification('Error: No se pudo crear el botón de pago', 'error');
            
            // Mostrar información de debugging
            console.log('🔍 Debug: Contenedor completo:', container.outerHTML);
            console.log('🔍 Debug: Scripts en la página:', document.querySelectorAll('script[src*="bold"]'));
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
            documentType: 'CC',
            // Datos de dirección opcionales
            address: user.address || '',
            city: user.city || '',
            zipCode: user.zipCode || '',
            state: user.state || '',
            country: user.country || 'CO'
        };
    }


    // Función para procesar el resultado del pago (llamada desde la URL de redirección)
    async processPaymentResult() {
        console.log('🔍 Debug - Iniciando processPaymentResult...');
        console.log('🔍 Debug - URL actual:', window.location.href);
        
        const urlParams = new URLSearchParams(window.location.search);
        const paymentStatus = urlParams.get('payment');
        const paymentId = urlParams.get('bold-order-id');
        const txStatus = urlParams.get('bold-tx-status');
        
        console.log('🔍 Debug - Parámetros de URL:', {
            paymentStatus,
            paymentId,
            txStatus,
            allParams: Object.fromEntries(urlParams.entries())
        });
        
        // Verificar si hay pago pendiente
        const pendingPayment = JSON.parse(localStorage.getItem('pending_payment') || '{}');
        console.log('🔍 Debug - Pago pendiente:', pendingPayment);
        
        if (paymentStatus === 'success' || txStatus === 'approved') {
            console.log('✅ Pago exitoso detectado, procesando...');
            await this.handleSuccessfulPayment(paymentId);
        } else if (paymentStatus === 'error' || txStatus === 'rejected') {
            console.log('❌ Pago fallido detectado');
            this.showNotification('Error en el procesamiento del pago', 'error');
        } else if (pendingPayment.amount) {
            // Si no hay parámetros de URL pero hay pago pendiente, asumir éxito
            console.log('⚠️ No hay parámetros de URL pero hay pago pendiente, asumiendo éxito...');
            await this.handleSuccessfulPayment(pendingPayment.orderId);
        } else {
            console.log('ℹ️ No hay pago para procesar');
        }
    }
    
    async handleSuccessfulPayment(paymentId) {
        try {
            console.log('🔍 Debug - Iniciando handleSuccessfulPayment con paymentId:', paymentId);
            
            // Obtener el monto del pago desde localStorage (lo guardamos cuando se crea el link)
            const pendingPayment = JSON.parse(localStorage.getItem('pending_payment') || '{}');
            const amount = pendingPayment.amount;
            
            console.log('🔍 Debug - Pago pendiente encontrado:', pendingPayment);
            console.log('🔍 Debug - Balance actual:', this.balance);
            
            if (!amount) {
                console.warn('⚠️ No se encontró el monto del pago pendiente');
                this.showNotification('¡Pago procesado! Recargando datos...', 'success');
                await this.refreshWalletData();
            return;
        }

            // Actualizar balance
            const newBalance = this.balance + amount;
            console.log('🔍 Debug - Nuevo balance calculado:', newBalance);
            
            this.balance = newBalance;
            
            // Crear transacción
            const transaction = {
                id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'deposit',
                amount: amount,
                description: 'Recarga de billetera via Bold',
                paymentId: paymentId,
                timestamp: new Date().toISOString(),
                status: 'completed'
            };
            
            console.log('🔍 Debug - Transacción creada:', transaction);
            
            // Agregar transacción al array local
            this.transactions.unshift(transaction);
            
            // Guardar SEGURAMENTE en Firebase (NO en localStorage por seguridad)
            await this.saveToFirebase(newBalance, transaction);
            
            console.log('🔍 Debug - Datos guardados SEGURAMENTE en Firebase');
            console.log('🔍 Debug - Balance actualizado:', newBalance);
            console.log('🔍 Debug - Transacciones guardadas:', this.transactions.length);
            
            // Limpiar pago pendiente
            localStorage.removeItem('pending_payment');
            console.log('🔍 Debug - Pago pendiente limpiado');
            
            // Actualizar UI
            this.renderBalance();
            this.renderTransactions();
            
            console.log('✅ Pago procesado exitosamente');
            this.showNotification(`¡Pago exitoso! +$${amount.toLocaleString('es-CO')} COP`, 'success');
            
        } catch (error) {
            console.error('❌ Error procesando pago exitoso:', error);
            this.showNotification('Pago procesado, pero hubo un error actualizando el saldo', 'warning');
        }
    }
    
    async saveToFirebase(balance, transaction) {
        try {
            if (typeof window.firebase === 'undefined') {
                console.error('❌ Firebase no disponible - NO se pueden guardar datos sensibles');
                throw new Error('Firebase no disponible');
            }
            
            const user = JSON.parse(localStorage.getItem('deseo_user') || '{}');
            if (!user.uid) {
                console.error('❌ Usuario no autenticado - NO se pueden guardar datos sensibles');
                throw new Error('Usuario no autenticado');
            }
            
            // Usar Firebase Realtime Database (más seguro que Firestore para este caso)
            const db = window.firebase.database();
            
            // Actualizar balance del usuario
            const userRef = db.ref(`users/${user.uid}`);
            await userRef.update({
                balance: balance,
                lastUpdated: new Date().toISOString()
            });
            
            // Guardar transacción
            const transactionRef = db.ref(`transactions/${user.uid}/${transaction.id}`);
            await transactionRef.set({
                ...transaction,
                userId: user.uid,
                createdAt: new Date().toISOString()
            });
            
            console.log('✅ Datos guardados SEGURAMENTE en Firebase Realtime Database');
            
        } catch (error) {
            console.error('❌ Error guardando en Firebase:', error);
            throw error; // Re-lanzar error para que se maneje apropiadamente
        }
    }
    
    async refreshWalletData() {
        await this.loadBalance();
        await this.loadTransactions();
        this.renderBalance();
        this.renderTransactions();
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

            // Guardar cambios SEGURAMENTE en Firebase
            await this.saveToFirebase(this.balance, transaction);

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

            // Guardar cambios SEGURAMENTE en Firebase
            await this.saveToFirebase(this.balance, transaction);

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