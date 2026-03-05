# PROYECTO: SoundVault — Sistema de Gestión de Inventario de Audio para Iglesia & Estudio de Grabación

## CONTEXTO DEL PROYECTO
Desarrollar una aplicación web full-stack moderna y corporativa para gestionar el inventario completo de equipos de audio de una iglesia que también cuenta con estudio de grabación. La aplicación debe ser desplegable en un subdominio (ej: inventario.iglesia.com).

---

## STACK TECNOLÓGICO

### Frontend
- React 18 + TypeScript
- Vite como bundler
- TailwindCSS + shadcn/ui para componentes
- React Router v6 para navegación
- React Hook Form + Zod para validaciones
- TanStack Query (React Query) para manejo de estado servidor
- Recharts para gráficas y estadísticas
- Lucide React para iconografía
- date-fns para manejo de fechas
- React Hot Toast para notificaciones

### Backend
- Node.js + Express + TypeScript
- Prisma ORM
- PostgreSQL como base de datos principal
- JWT para autenticación
- Multer para carga de imágenes/archivos
- Sharp para optimización de imágenes
- Nodemailer para alertas por correo
- dotenv para variables de entorno

### DevOps / Deploy
- Docker + Docker Compose para contenedores
- Nginx como reverse proxy para el subdominio
- PM2 para gestión de procesos Node
- Variables de entorno separadas por ambiente (.env.development / .env.production)

---

## DISEÑO Y UI/UX

### Identidad Visual
- **Tema**: Dark/Corporate Premium con acentos en color dorado/ámbar (#F59E0B) y azul profundo (#1E3A5F)
- **Fondo principal**: #0F172A (slate-900) con superficies en #1E293B (slate-800)
- **Tipografía Display**: "Sora" de Google Fonts (headings, títulos)
- **Tipografía Body**: "DM Sans" de Google Fonts (textos, labels, datos)
- **Estilo general**: Moderno, limpio, corporativo, intuitivo — inspirado en software empresarial premium
- **Iconos de categorías**: Representaciones visuales reales de cada tipo de equipo
- **Modo**: Únicamente dark mode (no toggle)

### Características de Diseño
- Sidebar colapsable con navegación principal
- Header sticky con buscador global y notificaciones
- Cards con glassmorphism sutil para inventario
- Badges de estado con colores semafóricos (verde/amarillo/rojo)
- Animaciones suaves en transiciones de página (framer-motion)
- Tablas con sorting, filtering y paginación
- Responsive completo (móvil, tablet, desktop)
- Skeleton loaders mientras cargan datos
- Empty states ilustrados por categoría

---

## ARQUITECTURA DE BASE DE DATOS

### Entidades Principales
- **Enums**: DeviceCategory (AUDIO_PA, RECORDING_STUDIO, INSTRUMENTS, CABLES_ACCESSORIES, LIGHTING, MULTIMEDIA), DeviceStatus (ACTIVE, MAINTENANCE, DAMAGED, LOST, RETIRED, LOANED), DeviceLocation (MAIN_AUDITORIUM, RECORDING_STUDIO, STORAGE_ROOM, YOUTH_ROOM, CHAPEL, ON_LOAN)
- **User**: id, name, email, password, role (UserRole), avatar, phone, movements, maintenances
- **Category**: id, name, slug, icon, color, parentId, parent, children, devices (árbol jerárquico)
- **Device**: id, name, brand, model, serialNumber, internalCode, categoryId, status, location, purchaseDate, purchasePrice, warrantyExpiry, supplier, notes, images, documents, movements, maintenances, loanRecords, qrCode, isQrGenerated, condition (0-100), tags, createdBy, lastCheckedAt
- **Movement**: id, deviceId, type (CHECK_IN, CHECK_OUT, TRANSFER, STATUS_CHANGE), fromLocation, toLocation, reason, userId, createdAt
- **Maintenance**: id, deviceId, type (preventivo/correctivo/calibración), description, cost, technician, startDate, endDate, status (SCHEDULED, IN_PROGRESS, COMPLETED), notes, userId
- **LoanRecord**: id, deviceId, borrowerName, borrowerEmail, borrowerPhone, purpose, loanDate, expectedReturn, returnDate, status (ACTIVE, RETURNED, OVERDUE), approvedBy, notes

---

## MÓDULOS Y PÁGINAS

### 1. Dashboard (`/dashboard`)
- KPIs: Total equipos, Operativos, En mantenimiento, En préstamo, Valor total
- Gráfica distribución por categoría (donut), estado de equipos (bar)
- Timeline últimos movimientos (10), alertas activas, mantenimientos programados
- Quick actions: Agregar equipo, Registrar préstamo, Nueva mantención

### 2. Inventario (`/inventory`)
- Vista tabla y grid (toggle), filtros: Categoría, Estado, Ubicación, Marca, Condición
- Búsqueda en tiempo real, exportar Excel/CSV/PDF, bulk actions
- Click en fila → drawer con preview; botón → detalle completo

### 3. Detalle de Equipo (`/inventory/:id`)
- Header con foto, nombre, código, badge; galería; tabs: Info General | Movimientos | Mantenimientos | Préstamos | Documentos
- QR Code generación/descarga, editar equipo, imprimir ficha PDF

### 4. Categorías (`/categories`)
- Árbol con acordeón, CRUD con ícono y color, contador por categoría, drag & drop jerarquía

### 5. Mantenimientos (`/maintenance`)
- Vista Kanban (Programado → En Progreso → Completado), lista con filtros, calendario mensual, formulario crear/editar, alertas preventivas, historial de costos

### 6. Préstamos (`/loans`)
- Lista activos con badge (A tiempo / Por vencer / Vencido), formulario nuevo préstamo, check disponibilidad, confirmar devolución, recordatorio por email

### 7. Movimientos (`/movements`)
- Log completo, filtros por tipo/usuario/equipo/fecha, exportar para auditoría

### 8. Reportes (`/reports`)
- Inventario completo, valor por categoría/ubicación, depreciación, mantenimientos y costos, préstamos por período; exportables a PDF con logo y fecha; gráficas Recharts

### 9. Usuarios (`/users`) — Solo ADMIN
- CRUD usuarios, roles (ADMIN, MANAGER, TECHNICIAN, VIEWER), log de accesos

### 10. Configuración (`/settings`) — Solo ADMIN
- Datos organización (nombre, logo), alertas, backup DB, campos por categoría, SMTP, ubicaciones/salas

---

## FEATURES ESPECIALES

- **QR por equipo**: QR con URL de ficha, página pública sin login, etiquetas batch
- **Alertas**: Notificaciones en app + email (garantía, mantenimiento preventivo, préstamo vencido, condición &lt;50%)
- **Búsqueda global**: Ctrl+K tipo Spotlight (equipos, categorías, préstamos, mantenimientos)
- **Importación masiva**: Excel/CSV con plantilla, validación, reporte de errores por fila

---

## ESTRUCTURA DE CARPETAS

```
├── client/          # Frontend React + Vite
├── server/          # Backend Express + Prisma
├── packages/shared/ # Schemas Zod compartidos
└── docker-compose.yml
```

---

*Especificación de referencia para SoundVault. Usar @docs/PROJECT_SPEC.md para que el asistente tenga contexto del proyecto.*
