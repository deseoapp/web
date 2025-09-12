# 🗺️ Configuración de Mapbox para Deseo

Esta guía te ayudará a configurar Mapbox para que la plataforma Deseo funcione con mapas reales.

## 📋 Pasos para Configurar Mapbox

### 1. Crear Cuenta en Mapbox

1. Ve a [https://account.mapbox.com/auth/signup/](https://account.mapbox.com/auth/signup/)
2. Completa el formulario de registro:
   - **Username**: Elige un nombre de usuario único
   - **Email**: Tu email válido
   - **Password**: Una contraseña segura
3. Haz clic en "Create Account"

### 2. Obtener tu Token de API

1. Una vez registrado, serás redirigido al dashboard de Mapbox
2. En la página principal, busca la sección **"Access tokens"**
3. Verás un token llamado **"Default public token"**
4. Haz clic en el botón de **copiar** (📋) para copiar el token
5. El token tendrá un formato como: `pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImNsYWJjZGVmZyJ9.example`

### 3. Configurar el Token en la Aplicación

1. Abre el archivo `config.js` en tu editor de código
2. Busca la línea que dice:
   ```javascript
   MAPBOX_TOKEN: 'TU_MAPBOX_TOKEN',
   ```
3. Reemplaza `'TU_MAPBOX_TOKEN'` con tu token real:
   ```javascript
   MAPBOX_TOKEN: 'pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImNsYWJjZGVmZyJ9.example',
   ```
4. Guarda el archivo

### 4. Verificar la Configuración

1. Abre `index.html` en tu navegador
2. Si todo está configurado correctamente, verás un mapa real de Mapbox
3. Si hay un error, verifica que:
   - El token esté copiado correctamente
   - No haya espacios extra en el token
   - El token comience con `pk.`

## 🔒 Configuración de Seguridad (Opcional)

Para mayor seguridad, puedes restringir tu token a tu dominio:

### 1. Crear un Token Restringido

1. En el dashboard de Mapbox, haz clic en **"Create a token"**
2. Dale un nombre descriptivo (ej: "Deseo App - Producción")
3. En **"Token scopes"**, deja todos los "Public scopes" seleccionados
4. En **"Token restrictions"**, en el campo **"URLs"**:
   - Si estás desarrollando localmente: `localhost`
   - Si tienes un dominio: `tudominio.com`
5. Haz clic en **"Create token"**
6. Copia el nuevo token y úsalo en lugar del token por defecto

### 2. Restricciones Adicionales

- **IP Addresses**: Puedes restringir por IP si tienes una IP fija
- **Referrers**: Puedes restringir por dominio de referencia

## 🆓 Límites del Plan Gratuito

Mapbox ofrece un plan gratuito generoso:

| Servicio | Límite Mensual |
|----------|----------------|
| **Map Loads** | 50,000 |
| **Geocoding** | 100,000 requests |
| **Directions** | 100,000 requests |
| **Matrix** | 100,000 requests |
| **Isochrones** | 100,000 requests |

**Nota**: Para la mayoría de aplicaciones pequeñas y medianas, estos límites son más que suficientes.

## 🎨 Personalización del Mapa

En `config.js`, puedes cambiar el estilo del mapa:

```javascript
MAP: {
    // Estilos disponibles
    styles: {
        light: 'mapbox://styles/mapbox/light-v11',      // Claro
        dark: 'mapbox://styles/mapbox/dark-v11',        // Oscuro
        streets: 'mapbox://styles/mapbox/streets-v12',  // Calles
        satellite: 'mapbox://styles/mapbox/satellite-v9', // Satélite
        outdoors: 'mapbox://styles/mapbox/outdoors-v12'  // Exterior
    },
    
    // Cambia este valor para usar un estilo diferente
    defaultStyle: 'light'
}
```

## 🐛 Solución de Problemas

### Error: "Token de Mapbox no configurado"

**Causa**: El token no está configurado o es inválido.

**Solución**:
1. Verifica que hayas copiado el token completo
2. Asegúrate de que el token comience con `pk.`
3. No incluyas espacios extra al copiar

### Error: "Mapbox GL JS no está cargado"

**Causa**: Problema de conexión a internet o CDN bloqueado.

**Solución**:
1. Verifica tu conexión a internet
2. Intenta recargar la página
3. Si usas un firewall corporativo, verifica que permita acceso a `api.mapbox.com`

### Mapa se ve gris o vacío

**Causa**: Token inválido o restricciones de dominio.

**Solución**:
1. Verifica que el token sea válido
2. Si usas restricciones de dominio, asegúrate de que tu dominio esté en la lista permitida
3. Para desarrollo local, usa `localhost` en las restricciones

### Los marcadores no aparecen

**Causa**: Error en el JavaScript o coordenadas inválidas.

**Solución**:
1. Abre la consola del navegador (F12)
2. Busca errores en la consola
3. Verifica que las coordenadas de los deseos sean válidas

## 📞 Soporte

Si tienes problemas con la configuración:

1. **Mapbox Support**: [https://support.mapbox.com/](https://support.mapbox.com/)
2. **Documentación**: [https://docs.mapbox.com/](https://docs.mapbox.com/)
3. **Comunidad**: [https://github.com/mapbox/mapbox-gl-js](https://github.com/mapbox/mapbox-gl-js)

## ✅ Lista de Verificación

- [ ] Cuenta de Mapbox creada
- [ ] Token copiado correctamente
- [ ] Token configurado en `config.js`
- [ ] Mapa se carga correctamente
- [ ] Marcadores aparecen en el mapa
- [ ] Geolocalización funciona
- [ ] Filtros funcionan correctamente

¡Una vez completados todos los pasos, tu plataforma Deseo estará lista para usar con mapas reales de Mapbox! 🎉