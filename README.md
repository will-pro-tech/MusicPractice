# Mi Práctica Musical

App sencilla y mobile-first para que los niños registren su práctica diaria de
instrumento y los padres puedan ver el progreso. El enfoque está en **metas**,
no en cumplir minutos. Es un proyecto **independiente y auto-contenido**.

Cada práctica del día tiene tres partes:

1. **Ejercicios** — técnica, escalas, etc.
2. **Canción del repertorio (iglesia)** — elegida del repertorio compartido.
3. **Canción nueva** — con una **meta específica** (ej. "dos líneas de la
   partitura") y una casilla de **"meta cumplida"**.

El niño también indica **día y hora** de cada práctica.

## Vistas

- **Niño** (`Hoy` / `Historial`): planea la práctica y marca lo completado. El
  historial se guarda en filas compactas y expandibles.
- **Padres** (`Resumen` / `Repertorio` / `Domingos` / `Niños`):
  - **Resumen** — metas y consistencia de cada hijo.
  - **Repertorio** — biblioteca de canciones con **tags/temas** y búsqueda.
  - **Domingos** — la directora planifica cada servicio eligiendo canciones del
    repertorio, filtrando por tema, y define el orden.
  - **Niños** — configura a los hijos e instrumentos.

Se cambia entre "Niño" y "Padres" con el interruptor de arriba a la derecha.

## Stack

- **Frontend:** React 19 + Vite + Tailwind CSS v4 (PWA instalable).
- **Backend:** Express 5 sirviendo la API y la app estática en el mismo puerto.
- **Datos:** PostgreSQL (`DATABASE_URL`). Las tablas (`mp_children`,
  `mp_sessions`, `mp_songs`, `mp_services`, `mp_service_songs`) se crean solas
  al arrancar — no hay migraciones que correr.

## Desarrollo local

```bash
# Requiere DATABASE_URL apuntando a un Postgres.
pnpm install
pnpm run dev            # http://localhost:8081  (API + app, con recarga)
```

## Build y arranque de producción

```bash
pnpm run build          # client → dist/public, server → dist/index.mjs
pnpm run start          # NODE_ENV=production node dist/index.mjs
```

## Publicar en Replit

1. **Create Repl → Import from GitHub** y elige este repositorio.
2. Añade una base de datos: panel **Database** (PostgreSQL) — Replit crea la
   variable `DATABASE_URL` automáticamente.
3. Pulsa **Run** para probarla (webview en el puerto 8081).
4. Para publicarla: **Deploy → Autoscale**. El `.replit` ya trae los comandos
   de build y run. Deja el deployment **Público** para que el ícono de la PWA
   funcione en iPhone.
5. En el teléfono: abre la URL publicada → **Compartir → "Agregar a pantalla de
   inicio"**.

## API

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET/POST | `/api/children` | Listar / crear hijos |
| PATCH/DELETE | `/api/children/:id` | Editar / eliminar hijo |
| GET/POST | `/api/sessions` | Listar (`?childId=&date=&from=&to=`) / crear práctica |
| PATCH/DELETE | `/api/sessions/:id` | Editar / eliminar práctica |
| GET | `/api/summary?days=30` | Resumen por hijo (vista de padres) |
| GET/POST | `/api/songs` | Repertorio: listar (`?q=&tag=`) / crear canción |
| PATCH/DELETE | `/api/songs/:id` | Editar / eliminar canción |
| GET | `/api/song-tags` | Tags/temas para los filtros |
| GET/POST | `/api/services` | Domingos: listar / crear servicio (con `songIds`) |
| PATCH/DELETE | `/api/services/:id` | Editar (incl. `songIds`) / eliminar servicio |
| GET | `/api/healthz` | Health check |

## Notas

- **MVP sin login:** una sola familia comparte los datos; el rol Niño/Padres es
  un interruptor. Se puede añadir un código de acceso más adelante.
- Para llevarla a las tiendas (App Store / Google Play), se puede envolver con
  Capacitor reutilizando este mismo código.
