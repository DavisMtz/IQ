# Test de Inteligencia CHC — Web App de Google Apps Script

Test de coeficiente intelectual (CI) **adaptativo**, con rigor psicométrico, listo para
desplegarse como **aplicación web de Google Apps Script** y que **guarda cada resultado
en una hoja de Google Sheets** (creando el formato automáticamente si no existe).

El test pide **nombre, edad y género**, adapta la dificultad de cada pregunta al nivel de
la persona, **tiene en cuenta la edad** para normalizar la puntuación y, al terminar,
entrega un **informe visual completo** (gráficos, percentiles, fortalezas, debilidades y la
explicación de cada respuesta).

---

## 1. Fundamento técnico

| Pilar | Implementación |
|-------|----------------|
| **Teoría CHC** (Cattell–Horn–Carroll) | Se miden 5 capacidades amplias del Estrato II que convergen en el factor *g*: **Gf** (razonamiento fluido), **Gc** (conocimiento cristalizado), **Gwm** (memoria de trabajo), **Gs** (velocidad de procesamiento) y **Gv** (procesamiento visoespacial). |
| **Referencias Gold-Standard** | Estructura de índices inspirada en **WAIS-IV/V**; ítems *culture-fair* tipo **Matrices Progresivas de Raven** generados proceduralmente en SVG. |
| **Teoría de Respuesta al Ítem (IRT)** | Cada ítem tiene parámetros **3PL**: dificultad `b`, discriminación `a` y azar `c`. La habilidad **θ** se estima por **EAP** (media a posteriori con prior normal), numéricamente estable incluso con patrones de respuesta extremos. |
| **Test Adaptativo (CAT)** | Tras cada respuesta se recalcula θ y se selecciona el siguiente ítem con dificultad ≈ θ, equilibrando los cinco dominios. Converge con menos preguntas. |
| **Estandarización** | θ se normaliza por **edad** (curvas de desarrollo y envejecimiento por dominio) y se convierte a escala CI: **media 100, desviación 15**. El percentil sale de la curva normal (CI 130 ≈ +2σ ≈ percentil 97,7). |

Cada pregunta se **adapta visualmente** para responderse de forma intuitiva:

- **Secuencias** (Gf): fichas numéricas con la regla a inferir.
- **Matrices** (Gf): cuadro lógico 3×3 en SVG con opciones gráficas.
- **Verbal** (Gc): analogías, sinónimos, antónimos y razonamiento en español.
- **Memoria** (Gwm): amplitud de dígitos inversa (teclado en pantalla) y test de Corsi inverso (rejilla que se ilumina), además de cálculo mental.
- **Velocidad** (Gs): emparejamiento y comparación de símbolos **cronometrados**.
- **Visoespacial** (Gv): **rotación mental** y detección de la imagen espejo, con figuras SVG.

---

## 2. Estructura del proyecto

```
apps-script/
├── appsscript.json   Manifiesto (Web App, V8). Los permisos se infieren del código.
├── Code.gs           Servidor: doGet, guardado en Sheets, creación del formato.
├── Index.html        Estructura de la app (plantilla con includes).
├── Styles.html       Estilos (CSS).
├── ItemBank.html     Banco de ítems: generadores SVG por dominio + parámetros IRT.
├── Engine.html       Motor psicométrico: IRT 3PL, EAP, CAT, normas por edad, escala CI.
└── App.html          Controlador de UI: flujo del test, gráficos SVG e informe.
```

> En Apps Script, los archivos de cliente deben tener extensión **`.html`** (incluidos los
> que contienen JavaScript). El servidor usa **`.gs`**.

---

## 3. Despliegue

### Opción A — Manual (sin instalar nada)

1. Entra en <https://script.google.com> → **Nuevo proyecto**.
2. Crea los archivos con **exactamente** estos nombres y pega el contenido de `apps-script/`:
   - `Code.gs` (archivo de secuencia de comandos).
   - `Index.html`, `Styles.html`, `ItemBank.html`, `Engine.html`, `App.html` (Archivo → HTML).
3. (Opcional) En **Configuración del proyecto** activa *«Mostrar el archivo de manifiesto
   appsscript.json»* y pega el manifiesto incluido.
4. **Implementar → Nueva implementación → Aplicación web**:
   - *Ejecutar como*: **Yo**.
   - *Quién tiene acceso*: **Cualquier usuario** (o el que prefieras).
5. Autoriza los permisos (acceso a Hojas de cálculo). Copia la **URL de la app** y ábrela.

La primera vez que alguien termina el test, el script **crea automáticamente** una hoja
llamada **«Resultados Test CHC»** y guarda ahí las respuestas. El enlace a la hoja aparece
en la pantalla de resultados.

### Opción B — Con `clasp` (CLI)

```bash
npm install -g @google/clasp
clasp login
clasp create --type webapp --title "Test de Inteligencia CHC" --rootDir ./apps-script
clasp push
clasp deploy
```

`clasp` subirá los archivos tal cual están en `apps-script/`.

---

## 4. Dónde se guardan las respuestas

El servidor localiza la hoja en este orden (`Code.gs → getResultsSpreadsheet_`):

1. Si el script está **enlazado** a una hoja (creado desde Hojas → Extensiones → Apps Script), usa esa.
2. Si existe la propiedad de script **`SPREADSHEET_ID`**, abre esa hoja.
3. Si no, **crea** «Resultados Test CHC» y recuerda su ID.

Funciones útiles (ejecutar desde el editor de Apps Script):

- `setupSpreadsheet()` — crea la hoja y su formato ya mismo; devuelve la URL.
- `setSpreadsheetId('ID_DE_TU_HOJA')` — para guardar en una hoja existente concreta.
- `getSpreadsheetUrl()` — muestra la URL de la hoja activa.

**Formato creado automáticamente** (hoja «Resultados»): marca temporal, ID de sesión,
nombre, edad, género, CI, error estándar, IC95, percentil, clasificación, los 5 índices de
dominio, θ, ítems administrados, tiempo total, fortalezas, debilidades y un JSON de detalle.
Una segunda hoja «Respuestas\_Detalle» registra una fila por ítem (dominio, tipo, `a`, `b`,
acierto, tiempo, θ y EE tras cada ítem). Si las hojas o las cabeceras no existen, se crean;
si ya existen, solo se **añade** la fila nueva.

---

## 5. Opciones de uso

En la pantalla inicial se puede elegir:

- **Modo adaptativo (CAT)** — recomendado — vs. modo lineal de dificultad media.
- **Longitud**: corta (~20), estándar (~30) o completa (~40 ítems).

---

## 6. Aviso

Herramienta **educativa y de autoconocimiento**. La maquinaria estadística (IRT, EAP, CAT,
conversión a escala CI) es estándar, pero **las normas por edad son ilustrativas** (basadas
en las curvas conocidas de desarrollo y envejecimiento cognitivo). No sustituye una
evaluación clínica con baremos validados (WAIS-V, Raven, etc.) administrada por un
profesional cualificado.
