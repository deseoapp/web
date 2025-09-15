# 🚀 Instrucciones de Configuración Rápida

## ⚡ Solución Inmediata

### Paso 1: Habilitar API
1. **Haz clic aquí**: https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=294859121487
2. **Click "HABILITAR"**
3. **Espera 2-3 minutos**

### Paso 2: Configurar Firebase
1. **Ve a**: https://console.firebase.google.com/
2. **Crea proyecto** o selecciona existente
3. **Authentication** → **Get started**
4. **Sign-in method** → **Google** → **Enable**

### Paso 3: Obtener Configuración
1. **Project Settings** (⚙️)
2. **Your apps** → **Add app** → **Web**
3. **Copia la configuración**

### Paso 4: Actualizar config.js
Reemplaza en `config.js`:

```javascript
FIREBASE: {
    enabled: true,
    config: {
        apiKey: "TU_API_KEY_REAL",
        authDomain: "tu-proyecto.firebaseapp.com",
        projectId: "tu-proyecto-id",
        storageBucket: "tu-proyecto.appspot.com",
        messagingSenderId: "123456789",
        appId: "1:123456789:web:abcdef123456"
    },
    collections: {
        wishes: 'wishes',
        users: 'users',
        conversations: 'conversations'
    },
    auth: {
        providers: ['email', 'google'],
        googleClientId: 'TU_GOOGLE_CLIENT_ID.apps.googleusercontent.com'
    }
}
```

## 🎯 Resultado Esperado

Después de estos pasos:
1. **Click "Continuar con Google"**
2. **Se abre popup** con selector de cuentas
3. **Selecciona tu cuenta**
4. **¡Autenticación exitosa!**

## 🚨 Si Aún No Funciona

### Opción A: Esperar
- El API puede tardar hasta 10 minutos en propagarse
- Recarga la página y prueba de nuevo

### Opción B: Usar Email/Contraseña
- Cambia `FIREBASE.enabled = false` en `config.js`
- Usa el registro con email mientras configuras Firebase

### Opción C: Verificar Dominios
- En Firebase Console → Authentication → Settings
- Agrega `localhost` a dominios autorizados

## 📞 Soporte

Si necesitas ayuda:
1. Verifica que el API esté habilitado
2. Confirma que Firebase Authentication esté activo
3. Revisa que la configuración sea correcta
4. Espera unos minutos después de hacer cambios