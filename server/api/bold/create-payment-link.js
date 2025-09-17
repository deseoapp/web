const crypto = require('crypto');

module.exports = async (req, res) => {
    // CORS: siempre setear cabeceras
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'false');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    // Preflight
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        console.log('🔍 Debug - Request body:', JSON.stringify(req.body, null, 2));
        
        const { amount, orderId, description, callbackUrl } = req.body || {};
        
        if (!amount || amount < 1000) {
            return res.status(400).json({ error: 'Invalid amount. Minimum 1000 COP' });
        }

        // Usar la API key directamente (en producción debería estar en variables de entorno)
        const apiKey = process.env.BOLD_API_KEY || 'H-HdPzurw8OPki3Fv8_WU-qFOAPQ9SarD_HV36Fp4_I';
        
        if (!apiKey) {
            console.error('❌ BOLD_API_KEY not configured');
            return res.status(500).json({ error: 'Server misconfigured: missing BOLD_API_KEY' });
        }

        // Datos para la API de Bold según documentación
        const paymentData = {
            amount_type: "CLOSE",
            amount: {
                currency: "COP",
                total_amount: parseInt(amount)
            },
            reference: orderId || `deseo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            description: description || "Recarga de billetera Deseo",
            callback_url: callbackUrl || "https://simon990520.github.io/deseo/wallet.html?payment=success"
        };
        
        console.log('🔍 Debug - Datos del link de pago:', paymentData);
        
        // Llamar a la API de Bold desde el servidor
        const response = await fetch('https://integrations.api.bold.co/online/link/v1', {
            method: 'POST',
            headers: {
                'Authorization': `x-api-key ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentData)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Error from Bold API:', response.status, errorText);
            throw new Error(`Bold API Error ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('✅ Link de pago creado exitosamente:', data);
        
        return res.status(200).json({ 
            success: true,
            paymentLink: data.payload.payment_link,
            url: data.payload.url,
            data: data.payload
        });
        
    } catch (err) {
        console.error('❌ Error creando link de pago:', err.message);
        return res.status(500).json({ 
            error: `Error creating payment link: ${err.message}`,
            success: false
        });
    }
};