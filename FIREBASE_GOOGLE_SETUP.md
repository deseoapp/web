# 🔥 Configuración Completa de Firebase con Google Sign-In

## 📋 Pasos para Configurar Firebase Correctamente

### 1. Crear Proyecto en Firebase Console

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Haz clic en "Agregar proyecto"
3. Nombre del proyecto: `deseo-app` (o el que prefieras)
4. **DESACTIVA** Google Analytics (no es necesario para este proyecto)
5. Haz clic en "Crear proyecto"

### 2. Configurar Aplicación Web

1. En el dashboard del proyecto, haz clic en el ícono **Web** (`</>`)
2. Nombre de la app: `deseo-web-app`
3. **NO** marques "También configura Firebase Hosting"
4. Haz clic en "Registrar app"
5. **COPIA** la configuración de Firebase que aparece

### 3. Habilitar Authentication

1. En el menú lateral, haz clic en **Authentication**
2. Haz clic en "Comenzar"
3. Ve a la pestaña **Sign-in method**
4. Haz clic en **Google**
5. **ACTIVA** el toggle "Habilitar"
6. Selecciona un **Correo de soporte del proyecto**
7. Haz clic en **Guardar**

### 4. Configurar Dominios Autorizados

1. En Authentication > Settings > **Authorized domains**
2. Asegúrate de que estén incluidos:
   - `localhost` (para desarrollo)
   - Tu dominio de producción (si tienes uno)

### 5. Obtener Configuración de Firebase

Copia la configuración que aparece en el paso 2 y reemplaza en `config.js`:

```javascript
FIREBASE: {
    enabled: true,
    config: {
        apiKey: "TU_API_KEY_AQUI",
        authDomain: "tu-proyecto.firebaseapp.com",
        projectId: "tu-proyecto-id",
        storageBucket: "tu-proyecto.appspot.com",
        messagingSenderId: "123456789",
        appId: "1:123456789:web:abcdef123456"
    },
    // ... resto de configuración
}
```

### 6. Verificar Configuración en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto de Firebase
3. Ve a **APIs y servicios** > **Biblioteca**
4. Busca y habilita:
   - **Identity Toolkit API**
   - **Firebase Authentication API**

### 7. Configurar OAuth Consent Screen (Opcional pero Recomendado)

1. En Google Cloud Console, ve a **APIs y servicios** > **Pantalla de consentimiento**
2. Selecciona **Externo** (a menos que tengas una organización)
3. Completa la información requerida:
   - Nombre de la aplicación: `Deseo App`
   - Correo de soporte: tu email
   - Dominio autorizado: `localhost` (para desarrollo)
4. Guarda y continúa

## 🚨 Solución de Problemas Comunes

### Error: "API key not valid"
- Verifica que la API key en `config.js` sea correcta
- Asegúrate de que el proyecto de Firebase esté activo

### Error: "Domain not authorized"
- Agrega tu dominio a **Authorized domains** en Firebase Auth
- Para desarrollo local, `localhost` debe estar incluido

### Error: "Identity Toolkit API not enabled"
- Ve a Google Cloud Console
- Habilita **Identity Toolkit API** para tu proyecto

### Error: "Popup blocked"
- Permite popups para tu sitio web
- O usa `signInWithRedirect` en lugar de `signInWithPopup`

## ✅ Verificación Final

1. Abre la consola del navegador (F12)
2. Haz clic en "Registrar con Google"
3. Deberías ver:
   - `Iniciando Google Sign-In con Firebase...`
   - `Google Sign-In exitoso: [objeto usuario]`
4. El selector de cuentas de Google debería abrirse

## 📞 Si Aún No Funciona

1. Verifica que todos los pasos estén completados
2. Revisa la consola del navegador para errores específicos
3. Asegúrate de que Firebase esté habilitado en `config.js`
4. Verifica que la configuración de Firebase sea correcta

---

**Nota**: Este proceso puede tomar unos minutos en propagarse. Si acabas de configurar Firebase, espera 5-10 minutos antes de probar.