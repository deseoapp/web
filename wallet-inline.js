// ===== WALLET FUNCTIONALITY - INLINE IMPLEMENTATION =====
console.log('🚀 Inicializando billetera inline...');

// ===== WALLET MANAGER INLINE =====
class InlineWalletManager {
    constructor() {
        this.balance = 0;
        this.transactions = [];
        this.init();
    }

    async init() {
        console.log('🟣 InlineWalletManager: Inicializando...');
        await this.loadBalance();
        await this.loadTransactions();
        this.initializeTheme();
        this.renderBalance();
        this.renderTransactions();
        this.setupEventListeners();
        console.log('✅ InlineWalletManager: Inicializado correctamente');
    }
    
    initializeTheme() {
        this.syncWithMainTheme();
        this.observeThemeChanges();
    }
    
    syncWithMainTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 
                           localStorage.getItem('deseo-theme') || 'dark';
        this.applyWalletTheme(currentTheme === 'dark');
    }
    
    observeThemeChanges() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                    const newTheme = document.documentElement.getAttribute('data-theme');
                    const isDark = newTheme === 'dark';
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
        document.body.classList.toggle('dark-mode', isDark);
    }

    async loadBalance() {
        try {
            if (typeof window.firebase === 'undefined') {
                this.balance = 0;
                return;
            }
            
            const user = JSON.parse(localStorage.getItem('deseo_user') || '{}');
            const userId = user.id || user.uid;
            if (!userId) {
                this.balance = 0;
                return;
            }
            
            const db = window.firebase.database();
            const userRef = db.ref(`users/${userId}`);
            const snapshot = await userRef.once('value');
            const userData = snapshot.val();
            
            if (userData && userData.balance !== undefined) {
                this.balance = parseFloat(userData.balance);
            } else {
                this.balance = 0;
            }
        } catch (error) {
            console.error('❌ Error loading balance from Firebase:', error);
            this.balance = 0;
        }
    }

    async loadTransactions() {
        try {
            if (typeof window.firebase === 'undefined') {
                this.transactions = [];
                return;
            }
            
            const user = JSON.parse(localStorage.getItem('deseo_user') || '{}');
            const userId = user.id || user.uid;
            if (!userId) {
                this.transactions = [];
                return;
            }
            
            const db = window.firebase.database();
            const transactionsRef = db.ref(`transactions/${userId}`);
            const snapshot = await transactionsRef.once('value');
            const transactionsData = snapshot.val();
            
            if (transactionsData) {
                this.transactions = Object.values(transactionsData)
                    .sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));
            } else {
                this.transactions = [];
            }
        } catch (error) {
            console.error('❌ Error loading transactions from Firebase:', error);
            this.transactions = [];
        }
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
        filteredTransactions.sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));

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

        let statusBadge = '';
        if (transaction.status === 'pending_verification') {
            statusBadge = '<span style="background: #ff9800; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; margin-left: 8px;">Pendiente</span>';
        } else if (transaction.status === 'completed') {
            statusBadge = '<span style="background: #4CAF50; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; margin-left: 8px;">Completado</span>';
        } else if (transaction.status === 'rejected') {
            statusBadge = '<span style="background: #f44336; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; margin-left: 8px;">Rechazado</span>';
        }

        div.innerHTML = `
            <div class="transaction-info">
                <div class="transaction-icon ${transaction.type}">
                    <i class="${iconClass}"></i>
                </div>
                <div class="transaction-details">
                    <h4>${transaction.description || 'Transacción'}${statusBadge}</h4>
                    <p>${transaction.method || 'Método'} • ${this.formatDate(transaction.timestamp || transaction.date || new Date().toISOString())}</p>
                    ${transaction.nequiNumber ? `<p style=\"font-size: 12px; color: #666;\">Nequi: ${transaction.nequiNumber}</p>` : ''}
                </div>
            </div>
            <div class="transaction-amount ${amountClass}">
                ${amountPrefix}$${Number(transaction.amount || 0).toFixed(2)}
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
        const filterTabs = document.querySelectorAll('.filter-tab');
        filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                filterTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const filter = tab.getAttribute('data-filter');
                this.renderTransactions(filter);
            });
        });

        const addMoneyForm = document.getElementById('addMoneyForm');
        if (addMoneyForm) {
            addMoneyForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddMoney();
            });
        }

        const addAmountInput = document.getElementById('addAmount');
        if (addAmountInput) {
            addAmountInput.addEventListener('input', (e) => {
                const amount = parseFloat(e.target.value);
                if (amount && amount >= 1000) {
                    this.showNequiInstructions(amount);
                } else {
                    const container = document.querySelector('.nequi-payment-container');
                    if (container) {
                        container.innerHTML = '<div id="nequiInstructionsPlaceholder"><p style="text-align: center; color: #666; padding: 20px;"><i class="fas fa-mobile-alt" style="font-size: 48px; color: #E91E63; margin-bottom: 15px;"></i><br>Ingresa una cantidad para ver las instrucciones de transferencia</p></div>';
                    }
                }
            });
        }

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
            this.showNequiInstructions(amount);
        } catch (error) {
            console.error('Error showing Nequi instructions:', error);
            this.showNotification('Error al mostrar las instrucciones', 'error');
        }
    }

    showNequiInstructions(amount) {
        const container = document.querySelector('.nequi-payment-container');
        if (!container) return;

        const currentTheme = document.documentElement.getAttribute('data-theme') || 
                           localStorage.getItem('deseo-theme') || 'dark';
        const isDarkMode = currentTheme === 'dark';
        
        // Colores de la app (basados en styles.css)
        const appColors = {
            primary: '#60c48e',      // Verde principal de la app
            primaryHover: '#4fb87a', // Verde hover
            secondary: '#26282a',    // Gris secundario
            accent: '#e88dff',        // Rosa-púrpura accent
            success: '#00ba7c',       // Verde éxito
            warning: '#ffd400',      // Amarillo advertencia
            error: '#f4212e',        // Rojo error
            dark: {
                bg: '#18191a',
                card: '#26282a',
                text: '#ffffff',
                textSecondary: '#a8a8a8',
                border: '#383a3c'
            },
            light: {
                bg: '#ffffff',
                card: '#f0f2f5',
                text: '#0f1419',
                textSecondary: '#536471',
                border: '#cfd9de'
            }
        };
        
        const theme = isDarkMode ? appColors.dark : appColors.light;
        
        container.innerHTML = `
            <div class="nequi-instructions-container" style="
                text-align: center; 
                padding: 25px; 
                border: 2px solid ${appColors.primary}; 
                border-radius: 15px; 
                background: linear-gradient(135deg, ${theme.card} 0%, ${theme.bg} 100%);
                color: ${theme.text};
                transition: all 0.3s ease;
                box-shadow: 0 8px 32px rgba(96, 196, 142, 0.15);
            ">
                <div style="margin-bottom: 25px;">
                    <div style="
                        width: 80px; 
                        height: 80px; 
                        background: linear-gradient(135deg, ${appColors.primary}, ${appColors.primaryHover});
                        border-radius: 50%; 
                        display: inline-flex; 
                        align-items: center; 
                        justify-content: center; 
                        margin-bottom: 20px;
                        box-shadow: 0 4px 20px rgba(96, 196, 142, 0.3);
                    ">
                        <i class="fas fa-mobile-alt" style="font-size: 36px; color: white;"></i>
                    </div>
                    <h3 style="color: ${theme.text}; margin-bottom: 10px; font-size: 24px; font-weight: 600;">Transferencia a Nequi</h3>
                    <p style="color: ${theme.textSecondary}; font-size: 18px; margin-bottom: 20px;">
                        <strong style="color: ${appColors.primary};">Monto a transferir:</strong> $${amount.toLocaleString('es-CO')} COP
                    </p>
                </div>
                
                <div style="
                    background: ${theme.card}; 
                    border: 1px solid ${appColors.primary}; 
                    border-radius: 12px; 
                    padding: 25px; 
                    margin-bottom: 25px; 
                    text-align: left;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
                ">
                    <h4 style="color: ${theme.text}; margin-bottom: 20px; text-align: center; font-size: 18px; font-weight: 600;">📋 Pasos para transferir:</h4>
                    
                    <div style="margin-bottom: 15px; padding: 15px; background: ${isDarkMode ? '#2a2a2a' : '#f8f9fa'}; border-radius: 8px; border-left: 4px solid ${appColors.primary};">
                        <strong style="color: ${appColors.primary}; font-size: 16px;">1.</strong> 
                        <span style="color: ${theme.text}; font-size: 14px;">Abre tu app de Nequi</span>
                    </div>
                    
                    <div style="margin-bottom: 15px; padding: 15px; background: ${isDarkMode ? '#2a2a2a' : '#f8f9fa'}; border-radius: 8px; border-left: 4px solid ${appColors.primary};">
                        <strong style="color: ${appColors.primary}; font-size: 16px;">2.</strong> 
                        <span style="color: ${theme.text}; font-size: 14px;">Ve a "Enviar dinero" o "Transferir"</span>
                    </div>
                    
                    <div style="margin-bottom: 15px; padding: 15px; background: ${isDarkMode ? '#2a2a2a' : '#f8f9fa'}; border-radius: 8px; border-left: 4px solid ${appColors.primary};">
                        <strong style="color: ${appColors.primary}; font-size: 16px;">3.</strong> 
                        <span style="color: ${theme.text}; font-size: 14px;">Ingresa el número: </span>
                        <strong style="color: ${appColors.primary}; font-size: 18px; background: ${theme.bg}; padding: 4px 8px; border-radius: 4px;">3146959639</strong>
                    </div>
                    
                    <div style="margin-bottom: 15px; padding: 15px; background: ${isDarkMode ? '#2a2a2a' : '#f8f9fa'}; border-radius: 8px; border-left: 4px solid ${appColors.primary};">
                        <strong style="color: ${appColors.primary}; font-size: 16px;">4.</strong> 
                        <span style="color: ${theme.text}; font-size: 14px;">Ingresa el monto: </span>
                        <strong style="color: ${appColors.primary}; font-size: 16px;">$${amount.toLocaleString('es-CO')} COP</strong>
                    </div>
                    
                    <div style="margin-bottom: 15px; padding: 15px; background: ${isDarkMode ? '#2a2a2a' : '#f8f9fa'}; border-radius: 8px; border-left: 4px solid ${appColors.primary};">
                        <strong style="color: ${appColors.primary}; font-size: 16px;">5.</strong> 
                        <span style="color: ${theme.text}; font-size: 14px;">Completa la transferencia</span>
                    </div>
                </div>
                
                <div style="margin-bottom: 25px;">
                    <p style="color: ${theme.textSecondary}; font-size: 14px; margin-bottom: 20px;">
                        Una vez realizada la transferencia, toma una captura de pantalla del comprobante:
                    </p>
                    
                    <input type="file" id="paymentProof" accept="image/*" style="display: none;">
                    
                    <!-- Previsualización de imagen -->
                    <div id="imagePreview" style="
                        margin-bottom: 20px; 
                        display: none;
                        text-align: center;
                    ">
                        <p style="color: ${theme.textSecondary}; font-size: 12px; margin-bottom: 10px;">
                            <i class="fas fa-image" style="margin-right: 5px;"></i>Vista previa del comprobante:
                        </p>
                        <img id="previewImage" style="
                            max-width: 200px; 
                            max-height: 150px; 
                            border-radius: 8px; 
                            border: 2px solid ${appColors.primary};
                            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                        " />
                        <button onclick="document.getElementById('paymentProof').click()" style="
                            background: ${appColors.secondary}; 
                            color: ${theme.text}; 
                            padding: 8px 15px; 
                            border: none; 
                            border-radius: 6px; 
                            font-size: 12px; 
                            cursor: pointer; 
                            margin-top: 10px;
                            transition: all 0.3s ease;
                        " onmouseover="this.style.background='${appColors.primary}'" onmouseout="this.style.background='${appColors.secondary}'">
                            <i class="fas fa-edit" style="margin-right: 5px;"></i> Cambiar imagen
                        </button>
                    </div>
                    
                    <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                        <button onclick="document.getElementById('paymentProof').click()" style="
                            background: linear-gradient(135deg, ${appColors.primary}, ${appColors.primaryHover}); 
                            color: white; 
                            padding: 15px 30px; 
                            border: none; 
                            border-radius: 25px; 
                            font-size: 14px; 
                            font-weight: 600; 
                            cursor: pointer; 
                            transition: all 0.3s ease;
                            box-shadow: 0 4px 16px rgba(96, 196, 142, 0.3);
                        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(96, 196, 142, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 16px rgba(96, 196, 142, 0.3)'">
                            <i class="fas fa-camera" style="margin-right: 8px;"></i> Subir Captura
                        </button>
                        
                        <button onclick="window.inlineWalletManager.handleNequiPayment(${amount})" style="
                            background: linear-gradient(135deg, ${appColors.success}, #00a86b); 
                            color: white; 
                            padding: 15px 30px; 
                            border: none; 
                            border-radius: 25px; 
                            font-size: 14px; 
                            font-weight: 600; 
                            cursor: pointer; 
                            transition: all 0.3s ease;
                            box-shadow: 0 4px 16px rgba(0, 186, 124, 0.3);
                        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(0, 186, 124, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 16px rgba(0, 186, 124, 0.3)'">
                            <i class="fas fa-check" style="margin-right: 8px;"></i> Ya envié el dinero
                        </button>
                    </div>
                </div>
                
                <div style="
                    background: linear-gradient(135deg, #fff8e1, #ffecb3); 
                    border: 1px solid ${appColors.warning}; 
                    border-radius: 12px; 
                    padding: 20px; 
                    margin-top: 20px;
                ">
                    <p style="color: #e65100; font-size: 13px; margin: 0; line-height: 1.4;">
                        <i class="fas fa-info-circle" style="margin-right: 8px; color: ${appColors.warning};"></i> 
                        <strong>Importante:</strong> Tu transferencia será verificada por un administrador. El dinero se acreditará en tu billetera una vez aprobada.
                    </p>
                </div>
            </div>
        `;
        
        const fileInput = document.getElementById('paymentProof');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    // Mostrar previsualización de la imagen
                    const preview = document.getElementById('imagePreview');
                    const previewImage = document.getElementById('previewImage');
                    
                    if (preview && previewImage) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            previewImage.src = e.target.result;
                            preview.style.display = 'block';
                        };
                        reader.readAsDataURL(file);
                    }
                    
                    this.showNotification('Captura seleccionada. Ahora confirma que ya enviaste el dinero.', 'info');
                }
            });
        }
    }
    
    async handleNequiPayment(amount) {
        try {
            const fileInput = document.getElementById('paymentProof');
            const hasProof = fileInput && fileInput.files && fileInput.files.length > 0;
            if (!hasProof) {
                this.showNotification('Por favor sube la captura del comprobante antes de continuar', 'warning');
                return;
            }
            const confirmed = confirm(`¿Confirmas que ya enviaste $${amount.toLocaleString('es-CO')} COP por Nequi al número 3146959639?\n\nIMPORTANTE: Este pago será verificado por un administrador.`);
            if (!confirmed) return;
            this.showNotification('Procesando pago por Nequi...', 'info');
            const proofFile = fileInput.files[0];
            const proofBase64 = await this.fileToBase64(proofFile);
            const transaction = {
                id: `nequi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'income',
                amount: amount,
                description: 'Recarga de billetera via Nequi (Pendiente de verificación)',
                method: 'Nequi',
                nequiNumber: '3146959639',
                proofImage: proofBase64,
                proofFileName: proofFile.name,
                timestamp: new Date().toISOString(),
                status: 'pending_verification',
                needsAdminApproval: true
            };
            this.transactions.unshift(transaction);
            await this.saveToFirebase(this.balance, transaction);
            this.renderTransactions();
            this.closeModal('addMoneyModal');
            document.getElementById('addMoneyForm').reset();
            this.showNotification('¡Pago por Nequi registrado! Se verificará en las próximas 24 horas.', 'success');
        } catch (error) {
            console.error('❌ Error procesando pago por Nequi:', error);
            this.showNotification('Error al procesar el pago por Nequi', 'error');
        }
    }
    
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }
    
    async saveToFirebase(balance, transaction) {
        try {
            if (typeof window.firebase === 'undefined') {
                throw new Error('Firebase no disponible');
            }
            const user = JSON.parse(localStorage.getItem('deseo_user') || '{}');
            const userId = user.id || user.uid;
            if (!userId) {
                throw new Error('Usuario no autenticado');
            }
            const db = window.firebase.database();
            const transactionRef = db.ref(`transactions/${userId}/${transaction.id}`);
            await transactionRef.set({
                ...transaction,
                userId: userId,
                createdAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('❌ Error guardando en Firebase:', error);
            throw error;
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
            this.showNotification('Procesando retiro...', 'info');
            await new Promise(resolve => setTimeout(resolve, 2000));
            this.balance -= amount;
            const transaction = {
                id: Date.now(),
                type: 'expense',
                amount: amount,
                description: `Retiro via ${method}`,
                method: method,
                timestamp: new Date().toISOString(),
                status: 'completed'
            };
            this.transactions.unshift(transaction);
            await this.saveToFirebase(this.balance, transaction);
            this.renderBalance();
            this.renderTransactions();
            this.closeModal('withdrawModal');
            document.getElementById('withdrawForm').reset();
            this.showNotification(`$${amount.toFixed(2)} retirados exitosamente`, 'success');
        } catch (error) {
            console.error('Error withdrawing money:', error);
            this.showNotification(error.message || 'Error al procesar el retiro', 'error');
        }
    }

    showAddMoneyModal() {
        const modal = document.getElementById('addMoneyModal');
        if (modal) modal.style.display = 'flex';
    }

    showWithdrawModal() {
        const modal = document.getElementById('withdrawModal');
        if (modal) modal.style.display = 'flex';
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => { notification.remove(); }, 4000);
    }
}

// ===== INICIALIZACIÓN INLINE =====
let inlineWalletManager;

function initializeInlineWallet() {
    console.log('🚀 Inicializando billetera inline...');
    try {
        inlineWalletManager = new InlineWalletManager();
        window.inlineWalletManager = inlineWalletManager;
        console.log('✅ Billetera inline inicializada correctamente');
    } catch (error) {
        console.error('❌ Error inicializando billetera inline:', error);
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initializeInlineWallet);

// También inicializar si el DOM ya está listo
if (document.readyState !== 'loading') {
    initializeInlineWallet();
}

// ===== FUNCIONES GLOBALES ACTUALIZADAS =====
window.app = window.app || {};
window.app.showAddMoneyModal = () => { 
    if (inlineWalletManager) {
        inlineWalletManager.showAddMoneyModal();
    } else {
        console.log('⏳ Esperando walletManager...');
        setTimeout(() => window.app.showAddMoneyModal(), 100);
    }
};
window.app.showWithdrawModal = () => { 
    if (inlineWalletManager) {
        inlineWalletManager.showWithdrawModal();
    } else {
        console.log('⏳ Esperando walletManager...');
        setTimeout(() => window.app.showWithdrawModal(), 100);
    }
};
window.app.closeModal = (modalId) => { 
    if (inlineWalletManager) {
        inlineWalletManager.closeModal(modalId);
    } else {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    }
};
window.app.closeNavMenu = () => {
    const navMenu = document.getElementById('navMenu');
    if (navMenu) navMenu.style.display = 'none';
};
window.app.logout = () => {
    console.log('Logout simulado');
    localStorage.removeItem('deseo_user_profile');
    localStorage.removeItem('deseo_balance');
    localStorage.removeItem('deseo_transactions');
    alert('Sesión cerrada');
    window.location.href = 'index.html';
};

console.log('✅ Funcionalidad de billetera inline cargada');