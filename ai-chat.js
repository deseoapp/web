/**
 * Módulo de Chat con IA
 * Maneja la conversación con Gemini y análisis emocional
 */

class DeseoAI {
    constructor() {
        this.emotionalState = this.loadEmotionalState();
        this.userProfile = this.loadUserProfile();
    }

    loadEmotionalState() {
        try {
            const saved = localStorage.getItem('deseo_emotional_state');
            return saved ? JSON.parse(saved) : {
                current: 'neutral',
                history: [],
                lastUpdate: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error loading emotional state:', error);
            return {
                current: 'neutral',
                history: [],
                lastUpdate: new Date().toISOString()
            };
        }
    }

    saveEmotionalState() {
        try {
            localStorage.setItem('deseo_emotional_state', JSON.stringify(this.emotionalState));
        } catch (error) {
            console.error('Error saving emotional state:', error);
        }
    }

    loadUserProfile() {
        try {
            const saved = localStorage.getItem('deseo_user_profile');
            return saved ? JSON.parse(saved) : {
                interests: [],
                preferences: {},
                lastUpdate: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error loading user profile:', error);
            return {
                interests: [],
                preferences: {},
                lastUpdate: new Date().toISOString()
            };
        }
    }

    saveUserProfile() {
        try {
            localStorage.setItem('deseo_user_profile', JSON.stringify(this.userProfile));
        } catch (error) {
            console.error('Error saving user profile:', error);
        }
    }

    analyzeEmotionalState(text) {
        const emotionalAnalysis = CONFIG.AI.EMOTIONAL_ANALYSIS;
        let positiveCount = 0;
        let negativeCount = 0;

        // Analizar palabras positivas
        emotionalAnalysis.positive.forEach(keyword => {
            if (text.toLowerCase().includes(keyword.toLowerCase())) {
                positiveCount++;
            }
        });

        // Analizar palabras negativas
        emotionalAnalysis.negative.forEach(keyword => {
            if (text.toLowerCase().includes(keyword.toLowerCase())) {
                negativeCount++;
            }
        });

        // Determinar estado emocional
        let newState = 'neutral';
        if (positiveCount > negativeCount) {
            newState = 'positive';
        } else if (negativeCount > positiveCount) {
            newState = 'negative';
        }

        // Actualizar estado si cambió
        if (newState !== this.emotionalState.current) {
            this.emotionalState.current = newState;
            this.emotionalState.history.push({
                state: newState,
                timestamp: new Date().toISOString(),
                text: text.substring(0, 100) // Guardar solo los primeros 100 caracteres
            });
            this.emotionalState.lastUpdate = new Date().toISOString();
            this.saveEmotionalState();
        }

        return newState;
    }

    async sendAIMessage(message) {
        try {
            // Analizar estado emocional del mensaje
            this.analyzeEmotionalState(message);

            // Agregar indicador de escritura
            this.addTypingIndicator();

            let aiResponse;
            
            if (CONFIG.AI.enabled && CONFIG.AI.apiKey) {
                // Usar Gemini API
                aiResponse = await this.generateGeminiResponse(message);
            } else {
                // Usar IA local
                aiResponse = this.generateAIResponse(message);
            }

            // Remover indicador de escritura
            this.removeTypingIndicator();

            // Procesar respuesta
            if (typeof aiResponse === 'object' && aiResponse.response) {
                this.processGeminiResponse(aiResponse, message);
                return aiResponse.response;
            } else {
                return aiResponse;
            }

        } catch (error) {
            console.error('Error sending AI message:', error);
            this.removeTypingIndicator();
            
            // Respuesta de fallback
            const fallbackResponse = this.generateAIResponse(message);
            this.addMessageToChat(fallbackResponse, 'ai');
            return fallbackResponse;
        }
    }

    async generateGeminiResponse(message) {
        try {
            const prompt = `Eres un asistente de IA amigable y empático para la aplicación "Deseo", una plataforma de micro-deseos. 

Contexto del usuario:
- Estado emocional actual: ${this.emotionalState.current}
- Intereses: ${this.userProfile.interests.join(', ') || 'No especificados'}
- Mensaje: "${message}"

Responde de manera conversacional y amigable. Analiza el mensaje para detectar:
1. Categorías de interés (tecnología, viajes, comida, entretenimiento, deportes, etc.)
2. Estado emocional (positivo, negativo, neutral)
3. Si el usuario expresa un deseo o necesidad que podría convertirse en un deseo en la plataforma

IMPORTANTE: Responde SOLO en formato JSON con esta estructura exacta:
{
    "response": "Tu respuesta amigable aquí",
    "emotionalState": "positive|negative|neutral",
    "categories": ["categoria1", "categoria2"],
    "shouldCreateWish": true/false,
    "wishData": {
        "title": "Título del deseo",
        "description": "Descripción detallada",
        "category": "categoria",
        "price": 25,
        "location": "ubicación del usuario"
    }
}

Si shouldCreateWish es true, incluye wishData. Si es false, omite wishData.`;

            const response = await fetch(`${CONFIG.AI.apiUrl}/${CONFIG.AI.model}:generateContent?key=${CONFIG.AI.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const responseText = data.candidates[0].content.parts[0].text;
                
                try {
                    // Intentar parsear como JSON
                    const parsedResponse = JSON.parse(responseText);
                    return parsedResponse;
                } catch (parseError) {
                    console.warn('Failed to parse Gemini response as JSON:', parseError);
                    // Si no es JSON válido, extraer solo el texto de respuesta
                    const lines = responseText.split('\n');
                    const responseLine = lines.find(line => line.includes('"response"'));
                    if (responseLine) {
                        const match = responseLine.match(/"response":\s*"([^"]+)"/);
                        if (match) {
                            return { response: match[1] };
                        }
                    }
                    // Fallback: usar todo el texto como respuesta
                    return { response: responseText };
                }
            } else {
                throw new Error('No valid response from Gemini');
            }

        } catch (error) {
            console.error('Error generating Gemini response:', error);
            throw error;
        }
    }

    processGeminiResponse(aiResponse, originalMessage) {
        try {
            // Mostrar solo la respuesta en el chat
            this.addMessageToChat(aiResponse.response, 'ai');

            // Actualizar estado emocional internamente
            if (aiResponse.emotionalState) {
                this.emotionalState.current = aiResponse.emotionalState;
                this.emotionalState.history.push({
                    state: aiResponse.emotionalState,
                    timestamp: new Date().toISOString(),
                    text: originalMessage.substring(0, 100)
                });
                this.emotionalState.lastUpdate = new Date().toISOString();
                this.saveEmotionalState();
            }

            // Actualizar perfil del usuario con categorías detectadas
            if (aiResponse.categories && aiResponse.categories.length > 0) {
                aiResponse.categories.forEach(category => {
                    if (!this.userProfile.interests.includes(category)) {
                        this.userProfile.interests.push(category);
                    }
                });
                this.userProfile.lastUpdate = new Date().toISOString();
                this.saveUserProfile();
            }

            // Mostrar sugerencia de deseo si corresponde
            if (aiResponse.shouldCreateWish && aiResponse.wishData) {
                setTimeout(() => {
                    this.showWishPreview(aiResponse.wishData);
                }, 1000);
            }

        } catch (error) {
            console.error('Error processing Gemini response:', error);
        }
    }

    generateAIResponse(message) {
        const responses = [
            "¡Hola! ¿En qué puedo ayudarte hoy?",
            "Me encanta conversar contigo. ¿Qué te gustaría hacer?",
            "Estoy aquí para ayudarte con tus deseos. ¿Qué tienes en mente?",
            "¡Qué interesante! Cuéntame más sobre eso.",
            "Me parece genial. ¿Hay algo específico que te gustaría explorar?"
        ];

        // Respuesta más empática si el estado emocional es negativo
        if (this.emotionalState.current === 'negative') {
            const empatheticResponses = [
                "Entiendo que puedas estar pasando por un momento difícil. ¿Hay algo en lo que pueda ayudarte?",
                "Lamento escuchar eso. ¿Te gustaría hablar sobre algo que te haga sentir mejor?",
                "Estoy aquí para escucharte. ¿Qué te gustaría hacer para mejorar tu día?",
                "Parece que estás pasando por algo complicado. ¿Hay algún pequeño deseo que pueda hacerte sentir mejor?"
            ];
            return empatheticResponses[Math.floor(Math.random() * empatheticResponses.length)];
        }

        // Respuesta más entusiasta si el estado emocional es positivo
        if (this.emotionalState.current === 'positive') {
            const enthusiasticResponses = [
                "¡Me encanta tu energía positiva! ¿Qué te gustaría hacer para celebrar?",
                "¡Qué genial! Tu actitud positiva es contagiosa. ¿Hay algo especial que te gustaría lograr?",
                "¡Fantástico! Me alegra verte tan bien. ¿Qué deseos tienes en mente?",
                "¡Excelente! Tu buen humor me inspira. ¿Qué te gustaría explorar hoy?"
            ];
            return enthusiasticResponses[Math.floor(Math.random() * enthusiasticResponses.length)];
        }

        return responses[Math.floor(Math.random() * responses.length)];
    }

    addMessageToChat(message, sender) {
        const chatMessages = document.getElementById('aiChatMessages');
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `${sender}-message`;
        
        const formattedMessage = this.formatMessage(message);
        messageDiv.innerHTML = `
            <div class="message-avatar">
                ${sender === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>'}
            </div>
            <div class="message-content">${formattedMessage}</div>
        `;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    formatMessage(message) {
        // Escapar HTML y convertir saltos de línea
        const escaped = this.escapeHtml(message);
        return escaped.replace(/\n/g, '<br>');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    addTypingIndicator() {
        const chatMessages = document.getElementById('aiChatMessages');
        if (!chatMessages) return;

        const typingDiv = document.createElement('div');
        typingDiv.className = 'ai-message typing-indicator';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;

        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    removeTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    showWishPreview(wishData) {
        if (window.deseoApp && window.deseoApp.showWishPreview) {
            window.deseoApp.showWishPreview(wishData);
        }
    }

    maybeShowSuggestions() {
        // Solo mostrar sugerencias si el estado emocional es positivo
        if (this.emotionalState.current === 'positive') {
            const suggestions = [
                "¿Te gustaría crear un nuevo deseo?",
                "¿Hay algo que siempre has querido hacer?",
                "¿Qué te haría feliz hoy?",
                "¿Tienes algún sueño que quieras cumplir?"
            ];
            
            const suggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
            this.addMessageToChat(suggestion, 'ai');
        }
    }
}

// Exportar para uso global
window.DeseoAI = DeseoAI;