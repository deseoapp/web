# 🌟 Deseo - Plataforma de Micro-Deseos

Una plataforma web interactiva que conecta personas con deseos y servicios a través de un mapa interactivo y un sistema de chat con IA.

## 🚀 Características Principales

### ✨ Funcionalidades MVP Implementadas

- **🗺️ Mapa Interactivo**: Visualiza deseos activos como pines con precio y categoría
- **🤖 Chat con IA**: Asistente inteligente que ayuda a crear y refinar deseos
- **💬 Chat Privado**: Sistema de mensajería entre usuarios para coordinar servicios
- **⭐ Sistema de Calificación**: Evaluación con estrellas y comentarios
- **🔍 Filtros Avanzados**: Búsqueda por precio, categoría y distancia
- **📱 Diseño Responsive**: Optimizado para desktop y móvil
- **🎨 UI Moderna**: Interfaz limpia con animaciones suaves

### 🎯 Flujo de Usuario

1. **Explorar**: Los usuarios ven deseos en el mapa interactivo
2. **Crear**: Chat con IA para crear deseos personalizados
3. **Aceptar**: Otros usuarios pueden aceptar deseos
4. **Coordinar**: Chat privado para organizar detalles
5. **Calificar**: Sistema de evaluación al completar el servicio

## 🛠️ Tecnologías Utilizadas

- **HTML5**: Estructura semántica y accesible
- **CSS3**: Diseño responsive con variables CSS y animaciones
- **JavaScript Vanilla**: Lógica de aplicación sin frameworks
- **Mapbox GL JS**: Mapas interactivos reales con geolocalización
- **Font Awesome**: Iconografía moderna
- **Google Fonts**: Tipografía Inter para mejor legibilidad

## 📁 Estructura del Proyecto

```
parcero/
├── index.html          # Estructura principal de la aplicación
├── styles.css          # Estilos y diseño responsive
├── script-mapbox.js    # Lógica de la aplicación con Mapbox
├── config.js           # Configuración de la aplicación
└── README.md           # Documentación del proyecto
```

## ⚙️ Configuración de Mapbox

### 🔑 Obtener Token de Mapbox

1. **Crear cuenta**: Ve a [Mapbox](https://account.mapbox.com/auth/signup/) y crea una cuenta gratuita
2. **Generar token**: En tu dashboard, copia el "Default public token" (formato: `pk.eyJ1Ijoi...`)
3. **Configurar token**: Abre `config.js` y reemplaza `'TU_MAPBOX_TOKEN'` con tu token real
4. **Restricciones (opcional)**: En Mapbox, puedes restringir el token a tu dominio para mayor seguridad

### 📝 Ejemplo de Configuración

```javascript
// En config.js
const CONFIG = {
    MAPBOX_TOKEN: 'pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImNsYWJjZGVmZyJ9.example', // Tu token aquí
    // ... resto de configuración
};
```

### 🆓 Límites Gratuitos de Mapbox

- **50,000 cargas de mapa** por mes
- **100,000 solicitudes de geocodificación** por mes
- **100,000 solicitudes de direcciones** por mes
- **Suficiente para la mayoría de aplicaciones pequeñas y medianas**

## 🚀 Cómo Usar

1. **Configurar Mapbox**: Sigue las instrucciones de configuración arriba
2. **Abrir la aplicación**: Simplemente abre `index.html` en tu navegador
3. **Explorar deseos**: Haz clic en los pines del mapa para ver detalles
4. **Crear deseo**: Usa el botón "Crear Deseo" para iniciar el chat con IA
5. **Aceptar deseos**: Haz clic en "Aceptar Deseo" para coordinar con el usuario
6. **Chat privado**: Coordina detalles a través del sistema de mensajería
7. **Calificar**: Al completar, evalúa la experiencia con estrellas y comentarios

## 🎨 Características de Diseño

### Paleta de Colores
- **Primario**: #6366f1 (Índigo)
- **Secundario**: #f1f5f9 (Gris claro)
- **Acento**: #f59e0b (Ámbar)
- **Éxito**: #10b981 (Verde)
- **Peligro**: #ef4444 (Rojo)

### Componentes Principales
- **Header fijo** con logo y acciones principales
- **Mapa interactivo** con gradiente y pines animados
- **Modales** con animaciones de entrada suaves
- **Botones flotantes** para acciones rápidas
- **Sistema de notificaciones** para feedback del usuario

## 🤖 Simulación de IA

La IA está simulada con respuestas predefinidas que:
- Analizan el tipo de deseo del usuario
- Sugieren precios apropiados según la categoría
- Refinan la descripción para mayor claridad
- Generan datos estructurados para el deseo

### Categorías Soportadas
- 🍽️ **Comida**: Cafés, comidas, bebidas
- 🚗 **Transporte**: Viajes, entregas
- 🎮 **Entretenimiento**: Actividades, paseos
- 🔧 **Servicios**: Tareas, cuidado de mascotas
- 🛒 **Compras**: Productos, supermercado

## 📱 Responsive Design

La aplicación está optimizada para:
- **Desktop**: Experiencia completa con sidebar y mapa amplio
- **Tablet**: Layout adaptado con controles táctiles
- **Móvil**: Interfaz simplificada con botones grandes

## 🔧 Funcionalidades Técnicas

### Gestión de Estado
- Estado global de la aplicación en la clase `DeseoApp`
- Persistencia de deseos, chats y calificaciones
- Filtros dinámicos y búsqueda en tiempo real

### Optimizaciones
- **Lazy loading** para recursos no críticos
- **Debounce** para búsquedas y filtros
- **Throttle** para eventos de scroll y resize
- **Preload** de recursos críticos

### Accesibilidad
- Navegación por teclado
- Contraste de colores adecuado
- Textos alternativos en iconos
- Estructura semántica HTML

## 🎯 Próximas Mejoras

### Funcionalidades Adicionales
- [ ] Integración con mapas reales (Google Maps/OpenStreetMap)
- [ ] Sistema de autenticación de usuarios
- [ ] Backend con base de datos
- [ ] Sistema de pagos real
- [ ] Notificaciones push
- [ ] Geolocalización precisa
- [ ] Chat en tiempo real con WebSockets

### Mejoras de UX
- [ ] Modo oscuro
- [ ] Temas personalizables
- [ ] Animaciones más avanzadas
- [ ] Sonidos de notificación
- [ ] Tutorial interactivo

## 🐛 Solución de Problemas

### Problemas Comunes
1. **Los pines no aparecen**: Verifica que JavaScript esté habilitado
2. **Modales no se abren**: Revisa la consola del navegador para errores
3. **Estilos no se cargan**: Asegúrate de que `styles.css` esté en la misma carpeta

### Compatibilidad
- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+

## 📄 Licencia

Este proyecto es un MVP educativo y de demostración. Libre para uso y modificación.

## 👥 Contribuciones

Las contribuciones son bienvenidas. Para contribuir:
1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📞 Contacto

Para preguntas o sugerencias sobre este proyecto, puedes:
- Abrir un issue en el repositorio
- Contactar al desarrollador

---

**¡Disfruta explorando y creando deseos en la plataforma Deseo! 🌟**