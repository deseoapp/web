const crypto = require('crypto');

function generateBoldIntegrityHash(attributes, secretKey) {
    // Según la documentación oficial de Bold:
    // Hash = SHA256({Identificador}{Monto}{Divisa}{LlaveSecreta})
    // Usando el método exacto que Bold especifica
    
    const orderId = attributes['data-order-id'];
    const amount = attributes['data-amount'];
    const currency = attributes['data-currency'];
    
    // Validar que tenemos todos los datos necesarios
    if (!orderId || !amount || !currency) {
        throw new Error(`Missing required fields: orderId=${orderId}, amount=${amount}, currency=${currency}`);
    }
    
    // Asegurar que amount sea un entero sin decimales
    const cleanAmount = parseInt(amount.toString(), 10);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
        throw new Error(`Invalid amount: ${amount}`);
    }
    
    // Concatenar en el orden exacto que Bold especifica
    const concatenatedString = `${orderId}${cleanAmount}${currency}${secretKey}`;
    
    console.log('🔍 Debug - String para hash:', concatenatedString);
    console.log('🔍 Debug - Componentes:', { orderId, amount: cleanAmount, currency, secretKey: secretKey.substring(0, 8) + '...' });
    
    // Generar SHA256 usando el método exacto de Bold
    // En Node.js usamos crypto.createHash pero con la misma lógica que crypto.subtle.digest
    
    // Crear hash SHA-256
    const hash = crypto.createHash('sha256');
    
    // Actualizar con la cadena concatenada (UTF-8)
    hash.update(concatenatedString, 'utf8');
    
    // Obtener el hash en hexadecimal
    const hashHex = hash.digest('hex');
    
    console.log('🔍 Debug - Hash generado (método Bold):', hashHex);
    
    return hashHex;
}

// Función alternativa que incluye más datos (por si Bold valida contra todos los atributos)
function generateBoldIntegrityHashAlternative(attributes, secretKey) {
    // Crear un objeto con todos los atributos ordenados alfabéticamente
    const sortedAttributes = {};
    Object.keys(attributes).sort().forEach(key => {
        if (key.startsWith('data-') && key !== 'data-integrity-signature') {
            sortedAttributes[key] = attributes[key];
        }
    });
    
    // Crear string de datos ordenado
    const dataString = Object.keys(sortedAttributes)
        .map(key => `${key}=${sortedAttributes[key]}`)
        .join('&');
    
    console.log('🔍 Debug - Alternative data string:', dataString);
    
    // Generar HMAC-SHA256 con la secret key
    const hash = crypto.createHmac('sha256', secretKey)
        .update(dataString, 'utf8')
        .digest('base64');
    
    console.log('🔍 Debug - Alternative hash generated:', hash);
    
    return hash;
}

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
        
        // Ahora esperamos { attributes: { 'data-api-key': '...', ... } }
        const { attributes } = req.body || {};
        if (!attributes || typeof attributes !== 'object') {
            console.error('❌ Missing attributes in request body');
            return res.status(400).json({ error: 'Missing attributes' });
        }

        const secret = process.env.BOLD_SECRET_KEY;
        if (!secret) {
            console.error('❌ BOLD_SECRET_KEY not configured');
            return res.status(500).json({ error: 'Server misconfigured: missing BOLD_SECRET_KEY' });
        }

        console.log('🔍 Debug - Attributes received:', {
            'data-order-id': attributes['data-order-id'],
            'data-amount': attributes['data-amount'],
            'data-currency': attributes['data-currency']
        });

        // Probar ambos métodos de generación de firma
        const signature1 = generateBoldIntegrityHash(attributes, secret);
        const signature2 = generateBoldIntegrityHashAlternative(attributes, secret);

        console.log('🔍 Debug - Signature method 1 (basic):', signature1);
        console.log('🔍 Debug - Signature method 2 (alternative):', signature2);

        // Por ahora usar el método básico (método 1)
        const signature = signature1;

        console.log('✅ Signature generated successfully');
        return res.status(200).json({ 
            signature,
            method: 'basic',
            alternative: signature2 // Para debugging
        });
    } catch (err) {
        console.error('❌ Signature error:', err.message);
        return res.status(500).json({ error: `Internal error: ${err.message}` });
    }
};

