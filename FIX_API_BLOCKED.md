# 🔧 Solución: API Bloqueada

## 🚨 Error Actual
```
auth/requests-to-this-api-identitytoolkit-method-google.cloud.identitytoolkit.v1.projectconfigservice.getprojectconfig-are-blocked
```

## 🎯 Soluciones Paso a Paso

### **Solución 1: Verificar Estado del Proyecto**

1. **Ve a Google Cloud Console**: https://console.cloud.google.com/
2. **Selecciona proyecto**: `294859121487`
3. **Ve a "APIs y servicios"** → **"Pantalla de consentimiento"**
4. **Verifica el estado**:
   - ✅ **"En producción"** = Correcto
   - ✅ **"En prueba"** = Correcto  
   - ❌ **"Borrador"** = Necesita publicación

### **Solución 2: Publicar Pantalla de Consentimiento**

Si está en "Borrador":
1. **Click "PUBLICAR APLICACIÓN"**
2. **Confirma la publicación**
3. **Espera 5-10 minutos**

### **Solución 3: Verificar Cuotas**

1. **Google Cloud Console** → **"APIs y servicios"** → **"Cuotas"**
2. **Busca "Identity Toolkit API"**
3. **Verifica que no esté en 0 o bloqueada**

### **Solución 4: Verificar Permisos**

1. **"IAM y administración"** → **"IAM"**
2. **Tu cuenta debe tener**:
   - ✅ **Propietario** (Owner)
   - ✅ **Editor** (Editor)
   - ❌ **Solo Lector** (Viewer) = Insuficiente

## 🚀 Solución Rápida: Crear Nuevo Proyecto

Si el proyecto actual tiene problemas:

### **Paso 1: Crear Nuevo Proyecto Firebase**
1. **Ve a**: https://console.firebase.google.com/
2. **"Crear proyecto"**
3. **Nombre**: "deseo-app-nuevo"
4. **Habilita Google Analytics** (opcional)

### **Paso 2: Configurar Authentication**
1. **Authentication** → **"Comenzar"**
2. **Sign-in method** → **Google** → **"Habilitar"**
3. **Configura** nombre y email de soporte

### **Paso 3: Obtener Configuración**
1. **Configuración del proyecto** (⚙️)
2. **"Tus aplicaciones"** → **"Agregar app"** → **Web**
3. **Registra app**: "Deseo Web App"
4. **Copia la configuración**

### **Paso 4: Actualizar config.js**
```javascript
FIREBASE: {
    enabled: true,
    config: {
        apiKey: "TU_NUEVA_API_KEY",
        authDomain: "tu-nuevo-proyecto.firebaseapp.com",
        projectId: "tu-nuevo-proyecto-id",
        storageBucket: "tu-nuevo-proyecto.appspot.com",
        messagingSenderId: "TU_NUEVO_SENDER_ID",
        appId: "TU_NUEVO_APP_ID"
    },
    // ... resto igual
}
```

## ⏰ Tiempo Estimado
- **Verificar estado**: 2 minutos
- **Publicar aplicación**: 5 minutos
- **Crear nuevo proyecto**: 10 minutos

## 🎯 Resultado Esperado
Después de cualquier solución:
1. **Click "Continuar con Google"**
2. **Se abre popup** con selector de cuentas
3. **Selecciona tu cuenta**
4. **¡Autenticación exitosa!**

## 🚨 Si Nada Funciona
**Opción temporal**: Cambia `FIREBASE.enabled = false` en `config.js` y usa registro con email.