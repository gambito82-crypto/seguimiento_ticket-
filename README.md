# TaskFlow

Aplicación de seguimiento de tareas por fases con cronómetro en tiempo real y alarmas configurables.

## Funcionalidades

- 📋 **Tablero Kanban** — 3 columnas: En Proceso, En Pausa, Finalizada
- ⏱️ **Cronómetro en tiempo real** — Se pausa y reanuda automáticamente
- 🔔 **Alarmas configurables** — De 15min a 8 horas, con sonido y notificaciones del navegador
- 👤 **Asignación de responsables** — Con avatares de iniciales
- 🎫 **Tickets INC y CRQ** — Para vincular tareas a incidentes y cambios
- 📊 **Panel de estadísticas** — Total, En Proceso, En Pausa, Finalizadas hoy
- 📝 **Panel de detalle** — Historial completo de cambios de fase
- 🔍 **Búsqueda y filtros** — Por responsable, ticket o nombre
- 🔥 **Firebase Realtime Database** — Datos sincronizados en tiempo real
- 💾 **Fallback localStorage** — Funciona offline

## Tecnologías

- HTML5 / CSS3 / JavaScript (Vanilla)
- Firebase Realtime Database
- Firebase Hosting

## Deploy

```bash
npm install -g firebase-tools
firebase login
firebase deploy
```
