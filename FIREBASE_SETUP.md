# Configuración de Firebase para Deseo

## Pasos para habilitar Firebase Authentication

### 1. Crear un proyecto en Firebase Console
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Haz clic en "Crear un proyecto"
3. Ingresa el nombre del proyecto (ej: "deseo-app")
4. Habilita Google Analytics (opcional)
5. Crea el proyecto

### 2. Habilitar Authentication
1. En el panel izquierdo, haz clic en "Authentication"
2. Haz clic en "Comenzar"
3. Ve a la pestaña "Sign-in method"
4. Habilita los siguientes proveedores:
   - **Email/Password**: Activar
   - **Google**: Activar y configurar

### 3. Configurar Google Sign-In
1. En la configuración de Google:
   - Ingresa el nombre del proyecto
   - Agrega tu email como soporte
   - Guarda los cambios

### 4. Obtener configuración del proyecto
1. Ve a "Configuración del proyecto" (ícono de engranaje)
2. Desplázate hacia abajo hasta "Tus aplicaciones"
3. Haz clic en "Agregar app" y selecciona "Web"
4. Registra tu app con un nombre (ej: "Deseo Web App")
5. Copia la configuración que aparece

### 5. Actualizar config.js
Reemplaza la configuración en `config.js` con tus datos reales:

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
    // ... resto de la configuración
}
```

### 6. Configurar Firestore Database
1. En el panel izquierdo, haz clic en "Firestore Database"
2. Haz clic en "Crear base de datos"
3. Selecciona "Comenzar en modo de prueba"
4. Elige una ubicación para tu base de datos
5. Haz clic en "Listo"

### 7. Configurar Storage (opcional)
1. En el panel izquierdo, haz clic en "Storage"
2. Haz clic en "Comenzar"
3. Revisa las reglas de seguridad
4. Elige una ubicación para el storage
5. Haz clic en "Siguiente"

### 8. Configurar dominios autorizados
1. En Authentication > Settings > Authorized domains
2. Agrega tu dominio (ej: localhost para desarrollo)
3. Para producción, agrega tu dominio real

## Reglas de Firestore (opcional)

Puedes usar estas reglas básicas para desarrollo:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Usuarios pueden leer/escribir sus propios datos
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Deseos son públicos para lectura, solo el autor puede escribir
    match /wishes/{wishId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    // Conversaciones solo para usuarios autenticados
    match /conversations/{conversationId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Solución de problemas comunes

### Error: "identity-toolkit-api-has-not-been-used"
- Asegúrate de que Authentication esté habilitado
- Espera unos minutos después de habilitar Authentication
- Verifica que el proyecto ID sea correcto

### Error: "Firebase App named '[DEFAULT]' already exists"
- Esto es normal si Firebase ya está inicializado
- No afecta la funcionalidad

### Error de dominios no autorizados
- Agrega tu dominio a la lista de dominios autorizados en Firebase Console
- Para desarrollo local, agrega "localhost"

## Modo de desarrollo sin Firebase

Si prefieres desarrollar sin Firebase por ahora:

1. Mantén `FIREBASE.enabled = false` en `config.js`
2. El sistema usará autenticación local con localStorage
3. Los datos se guardarán localmente
4. Puedes habilitar Firebase más tarde sin perder funcionalidad

## Migración a Firebase

Cuando estés listo para usar Firebase:

1. Sigue los pasos de configuración arriba
2. Cambia `FIREBASE.enabled = true` en `config.js`
3. Actualiza la configuración con tus datos reales
4. Los usuarios existentes se migrarán automáticamente