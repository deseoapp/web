# Configuración de Firebase para Google Sign-In

## ⚠️ IMPORTANTE: Configuración Requerida

Para que Google Sign-In funcione correctamente, necesitas configurar tu proyecto de Firebase real.

## 🚀 Pasos Rápidos:

### 1. Crear Proyecto Firebase
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto
3. Habilita Google Analytics (opcional)

### 2. Habilitar Authentication
1. En el menú lateral: **Authentication** → **Get started**
2. Ve a **Sign-in method**
3. Habilita **Google** provider
4. Configura el nombre del proyecto y email de soporte

### 3. Obtener Configuración
1. Ve a **Project Settings** (⚙️)
2. Scroll down a **Your apps**
3. Click **Add app** → **Web** (</>)
4. Registra tu app con nombre: "Deseo Web App"
5. **Copia la configuración** que aparece

### 4. Actualizar config.js
Reemplaza en `config.js`:

```javascript
FIREBASE: {
    enabled: true,
    config: {
        apiKey: "TU_API_KEY_REAL",
        authDomain: "tu-proyecto-real.firebaseapp.com", 
        projectId: "tu-proyecto-real-id",
        storageBucket: "tu-proyecto-real.appspot.com",
        messagingSenderId: "TU_SENDER_ID_REAL",
        appId: "TU_APP_ID_REAL"
    },
    // ... resto igual
}
```

### 5. Configurar Dominios Autorizados
1. En **Authentication** → **Settings** → **Authorized domains**
2. Agrega:
   - `localhost` (para desarrollo)
   - Tu dominio de producción

## 🔧 Configuración Avanzada

### Firestore Database (Recomendado)
1. **Firestore Database** → **Create database**
2. **Start in test mode** (para desarrollo)
3. Elige ubicación cercana a ti

### Storage (Opcional)
1. **Storage** → **Get started**
2. **Start in test mode**
3. Elige ubicación

## 🎯 Resultado Esperado

Una vez configurado correctamente:

1. **Click en "Continuar con Google"**
2. **Se abre popup** con selector de cuentas de Google
3. **Selecciona tu cuenta** de Google
4. **¡Autenticación exitosa!**

## 🚨 Errores Comunes

### "Firebase: Error (auth/identity-toolkit-api-has-not-been-used)"
- **Solución**: Authentication no está habilitado
- **Fix**: Habilita Google provider en Firebase Console

### "Popup blocked"
- **Solución**: Permite popups para tu sitio
- **Fix**: Click en el ícono de popup bloqueado en el navegador

### "Network request failed"
- **Solución**: Problema de conexión o configuración
- **Fix**: Verifica tu configuración de Firebase

## 📱 Testing

Para probar sin configurar Firebase completo:

1. Cambia `FIREBASE.enabled = false` en `config.js`
2. Usa el registro con email/contraseña
3. Configura Firebase cuando estés listo

## 🔄 Migración

Cuando configures Firebase:
1. Los usuarios locales se mantienen
2. Nuevos usuarios usan Firebase
3. Datos se sincronizan automáticamente