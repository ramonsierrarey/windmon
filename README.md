# 🏄‍♂️ WindMon Burguillo · Windsurf Analytics, Forecast & Quiver Advisor

Solución completa para **windsurfistas en el Embalse del Burguillo (Ávila)** (`40.429030° N, -4.564277° W`, frente a Las Cruceras / Arroyo de la Parra, ~730 m de altitud, Valle del Alberche).

Incluye captura de datos históricos horarios de viento y rachas, análisis por fechas/horas/orientación, pronóstico multimodelo a 7 días vista con recomendación automática de **Tabla + Vela** por franja horaria, y un **Modo Medidor Portátil (Anemómetro de mano)** diseñado para usar desde el móvil a pie de agua.

---

## 📁 Estructura del Proyecto

| Archivo | Descripción |
| :--- | :--- |
| `burguillo_data.py` | Capturador de histórico horario desde **Open-Meteo Archive API (ERA5-Land / CERRA)** en nudos (`kt`), base de datos SQLite (`data/burguillo_windmon.db`) y modelo orográfico de las 16 direcciones del Pantano del Burguillo. |
| `recommender.py` | Motor físico-práctico de recomendación de **Tabla + Vela** según viento base, racha máxima, diferencial de racha ($\Delta V$), orientación del viento en el pantano y peso del rider. |
| `server.py` | Servidor web ligero (**Starlette + Uvicorn**) que sirve la aplicación móvil (PWA) y expone la API REST (`/api/history/stats`, `/api/history/fetch`, `/api/recommend`, `/api/measurements`, `/api/quiver`). |
| `web/index.html` | Interfaz **Mobile-First Progressive Web App (PWA)** con 4 módulos: *Medidor Spot*, *Pronóstico 7D*, *Histórico* y *Mi Quiver*. |
| `web/app.js` | Lógica interactiva en cliente, conversor de unidades (`kt`, `km/h`, `m/s`, `Beaufort`), conexión multimodelo en vivo y soporte **Offline** en el pantano. |
| `web/styles.css` | Diseño náutico de alto contraste (pensado para leerse a pleno sol en la orilla del embalse) con barra de navegación inferior para manejo con el pulgar. |
| `web/manifest.json` | Manifiesto PWA para instalar la app en la pantalla de inicio de Android o iPhone. |
| `data/burguillo_windmon.db` | Base de datos SQLite local con **17.544 registros horarios** descargados del Pantano del Burguillo + tabla de mediciones reales del anemómetro portátil. |
| `data/quiver.json` | Archivo JSON con los datos del navegante (peso, estilo) y el inventario de **Tablas** y **Velas**. |

---

## 🚀 Cómo Ejecutar y Usar en el Móvil

### 1. Iniciar el servidor en tu PC
Desde la carpeta del proyecto (`c:\Users\ramon\Projects\windmon`), ejecuta:

```powershell
python server.py
```

- En tu ordenador puedes abrir: **http://localhost:8000**
- **Para abrirlo en tu móvil (Android / iPhone):**
  1. Conecta tu móvil a la misma red WiFi que tu PC (o comparte punto de acceso).
  2. Mira la IP local de tu PC (con `ipconfig` en PowerShell, por ejemplo `192.168.1.XX`).
  3. Abre en el navegador del móvil `http://192.168.1.XX:8000`.
  4. Pulsa en el menú del navegador **"Añadir a pantalla de inicio" (Instalar aplicación)**.
  5. **Modo Offline en la orilla del pantano:** La pestaña **Medidor Spot** y tu **Quiver** quedan guardados en la memoria del móvil (`localStorage`), por lo que aunque tengas poca cobertura en Las Cruceras o El Barraco, podrás introducir las lecturas de tu anemómetro portátil y obtener la recomendación de Tabla + Vela al instante.

---

## 🌐 Publicar en GitHub Pages para usarlo en el móvil

El repositorio ya incluye el flujo `.github/workflows/deploy-pages.yml`. Para publicarlo:

1. Sube el proyecto a un repositorio de GitHub en la rama `main` o `master`.
2. En GitHub, abre **Settings → Pages** y selecciona **GitHub Actions** como origen del despliegue.
3. Espera a que termine el flujo **Deploy WindMon PWA to GitHub Pages** en la pestaña **Actions**.
4. Abre la URL que aparece en **Settings → Pages** desde el móvil y usa **Añadir a pantalla de inicio**.

GitHub Pages sirve la versión estática de la PWA: el pronóstico necesita conexión a internet; las mediciones y el quiver se guardan solo en el almacenamiento local de ese navegador/dispositivo; y el histórico usa los datos precomputados incluidos, que no se pueden ampliar desde Pages. Para actualizar el histórico o compartir datos entre dispositivos hay que ejecutar `server.py` en un servicio que admita Python.

---

## 🧭 Módulos de la Solución

### 1. 📡 Modo Medidor Portátil en el Spot (Pestaña *Medidor Spot*)
Diseñado para cuando estás en la orilla con tu **medidor de viento portátil**:
- **Selector de unidad instantáneo:** Puedes introducir la lectura directamente en **Nudos (`kt`)**, **`km/h`** o **`m/s`** según cómo esté configurado tu anemómetro de mano. La app muestra automáticamente las equivalencias y la escala **Beaufort**.
- **Viento Medio (Base) + Racha Máxima (Gust):** Controles deslizantes grandes y botones `-` / `+` para ajustar con una sola mano.
- **Rosa de 16 Rumbos con Inteligencia Local del Burguillo:**
  - Destaca en verde las orientaciones mejor canalizadas por el eje del valle (**SW**, **WSW**, **SSW**, **NE**, **NNE**).
  - Avisa cuando el rumbo entra cruzado por encima de las montañas (**NW**, **WNW**, **SE**, **ESE**, **E**), donde se producen grandes rachas seguidas de huecos ("calmas").
- **Propuesta de Material en Tiempo Real:**
  - **Tabla Titular + Vela Titular** + porcentaje de adecuación.
  - **Opción Alternativa** (por si prefieres asegurar planeo en los huecos o más control en la racha).
  - **Consejos de trimado:** tensión de amura (*downhaul*), escota (*outhaul*) y posición del pie de mástil en función del diferencial entre viento medio y racha.
- **Cuaderno del Spot:** Botón para guardar la medición real con fecha, hora, zona del pantano (*Las Cruceras*, *El Barraco*, *Puente de la Gaznata*, *Presa*) y notas de la sesión.

---

### 2. 📊 Histórico de Vientos y Rachas del Burguillo (Pestaña *Histórico*)
- **Actualización bajo demanda:** Incluye ya **2 años completos (17.544 horas)** en `data/burguillo_windmon.db`, ampliables a 5+ años con un clic.
- **Factor de Encañonamiento y Térmico del Valle del Alberche:** Permite alternar entre el dato bruto de reanálisis (ERA5 9 km) y el dato corregido por el efecto de aceleración orográfica y térmica de tarde (13:00 a 19:00 de abril a octubre) propio del Burguillo.
- **Mapa de Calor (Mes × Hora de luz de 10:00 a 20:00):** Muestra la racha media en nudos y el porcentaje de días navegables en cada hora de cada mes del año.
- **Rosa de los Vientos Histórica:** Frecuencia de cada dirección, cuota de horas reales de planeo, velocidad media y racha media.
- **Simulador de Quiver sobre el Histórico:** Calcula qué porcentaje de las sesiones navegables del año en El Burguillo usarías cada combinación de **Tabla + Vela** de tu inventario.

---

### 3. 🌤️ Pronóstico a 7 Días Vista y Mejores Fuentes (Pestaña *Pronóstico 7D*)
- **Modelos integrados en directo (vía Open-Meteo Forecast API):**
  1. **⭐ Consenso Burguillo (+Efecto Térmico Valle):** Combina la previsión numérica con el factor de canalización según el rumbo y el calentamiento diurno.
  2. **ICON-EU / DWD:** Especialmente fiable en estimación de rachas máximas.
  3. **ECMWF IFS:** Modelo europeo de referencia para tendencias de 3 a 7 días.
  4. **GFS (NOAA):** Modelo base de Windguru.
- **Detector de Ventanas de Navegación:** Resume automáticamente en la parte superior qué días y en qué franja horaria exacta (ej. `Sáb 14:00–18:00 · SW 15–21 kt`) se dan condiciones de planeo y qué **Tabla + Vela** debes cargar en el coche.
- **Tabla Horaria (09:00 a 20:00):** Muestra para cada hora del día seleccionado el rumbo, viento base, racha, temperatura, calidad de la dirección en el spot y la pareja **Tabla + Vela** recomendada.
- **Accesos directos a las 4 mejores fuentes externas para El Burguillo:**
  - **Windy (Capa AROME / ICON HD 2 km)** en `40.425, -4.558`.
  - **Windguru (Spot Embalse del Burguillo #48692)**.
  - **AEMET (El Barraco / Cebreros - HARMONIE-AROME)**.
  - **Embalses.net / SAIH Tajo (Nivel de agua en hm³ y %)**, clave para saber si hay desvente en la orilla de Las Cruceras.

---

### 4. ⛵ Mi Quiver: Inventario de Tablas, Velas y Peso (Pestaña *Mi Quiver*)
- Permite configurar el **peso del rider (kg)** y añadir, editar o eliminar todas tus **Tablas** (nombre, litros, manga, vela mín/máx, nudos ideales) y **Velas** ($m^2$, cambers, nudos mín/dulce/máx).
- Cómo calcula el motor (`recommender.py`) la propuesta:
  - **Viento efectivo para la Vela ($V_{eff\_sail}$):** Pondera el $58\%$ del viento base y el $42\%$ de la racha máxima, ajustado por el factor de peso del rider $(75 / \text{Peso})^{0.55}$.
  - **Viento efectivo para la Tabla ($V_{eff\_board}$):** Si el diferencial de racha es alto ($\Delta V \ge 6\text{ kt}$) o la dirección en el Burguillo es cruzada/racheada (`NW`, `SE`, `E`), da un $75\%$ de peso al viento base para priorizar flotabilidad y pasar los huecos sin hundirse.
  - **Validación cruzada:** Verifica siempre que el tamaño en $m^2$ de la vela elegida esté dentro del rango admitido (`min_sail_m2` – `max_sail_m2`) de la tabla propuesta.
