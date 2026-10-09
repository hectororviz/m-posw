# DESIGN.md — Sistema de diseño de m-posw

Este archivo es la fuente de verdad del diseño de la interfaz web (PC/tablet).
Todo código de UI nuevo o modificado DEBE cumplirlo. Si una regla no cubre un caso, se agrega acá primero; no se inventa en el componente.

## 0. Reglas duras (prohibiciones)

1. Prohibido usar valores literales de color, tamaño de fuente, espaciado, radio o sombra. Solo tokens (`var(--...)`).
2. Prohibido escribir una tabla, encabezado de página, tarjeta KPI, botón, badge, input o select "a mano". Se usan los componentes de la sección 5.
3. Prohibido hardcodear el verde (ni ningún valor del color de acento). El acento sale siempre de `--color-primary` (sección 1).
4. Prohibido formatear montos, porcentajes o fechas con `toFixed`, `toLocaleString` suelto o concatenación. Solo los formateadores de la sección 6.
5. Prohibido usar elementos nativos sin estilizar (`<select>`, `<input type="date">`) fuera de los componentes `Select` y `DateInput`.
6. Todo texto visible va en español rioplatense, con acentos y ñ correctos.

## 1. Color

### 1.1 Acento configurable por el usuario

El color de acento lo elige el usuario/tenant en Configuración. Se inyecta en runtime en un único lugar (la raíz de la app) como:

```css
:root {
  --color-primary: <valor elegido>;   /* único valor que viene de configuración */
}
```

Todo lo demás se DERIVA de ese valor. Nunca se guarda un segundo color derivado en la base:

```css
:root {
  --color-primary-hover:  color-mix(in srgb, var(--color-primary) 88%, black);
  --color-primary-active: color-mix(in srgb, var(--color-primary) 76%, black);
  --color-primary-soft:   color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
  --color-primary-border: color-mix(in srgb, var(--color-primary) 35%, var(--color-surface));
  --color-on-primary: <blanco o casi negro, calculado por luminancia>;
}
```

- `--color-on-primary` (texto/ícono sobre fondos primarios) se calcula en JS al guardar o cargar la configuración: si la luminancia relativa del acento es mayor a ~0.5 se usa texto oscuro, si no, blanco. Nunca asumir texto blanco.
- Al guardar el color en Configuración, validar contraste mínimo 3:1 contra la superficie en modo claro y oscuro. Si no cumple, avisar o ajustar automáticamente la variante usada para texto/ícono (`--color-primary-text`).
- En modo oscuro, `--color-primary-soft` y `--color-primary-border` usan la misma fórmula sobre la superficie oscura.

### 1.2 Dónde se usa el acento (y dónde NO)

Usos permitidos: botón primario, ítem activo del sidebar, tab activo, foco de inputs, toggle activo, botón flotante (+), enlaces, estado "seleccionado".

El acento NO comunica estado. Los estados usan colores semánticos fijos que no dependen de la configuración, para que un usuario que elija rojo o verde como acento no confunda "activo" con "marca":

| Token | Uso |
|---|---|
| `--color-success` / `--color-success-soft` | Activo, pagado, ingreso, saldo a favor |
| `--color-warning` / `--color-warning-soft` | Aviso, vence pronto, deuda moderada |
| `--color-danger` / `--color-danger-soft` | Vencido, límite, egreso, error, acciones destructivas |
| `--color-info` / `--color-info-soft` | Informativo, etiquetas neutras de tipo (Cierre, Movimiento) |

### 1.3 Neutros (claro y oscuro)

`--color-bg`, `--color-surface`, `--color-surface-alt`, `--color-border`, `--color-border-strong`, `--color-text`, `--color-text-secondary`, `--color-text-muted`. Se redefinen para modo oscuro. Ningún componente decide por sí mismo cómo se ve en oscuro: solo usa tokens.

## 2. Tipografía

Una sola familia (la actual de la app). Escala fija; se usa por ROL, no por tamaño:

| Token | Tamaño | Peso | Uso |
|---|---|---|---|
| `--text-caption` | 12px | 400 | Notas, ayudas, texto secundario de celdas |
| `--text-label` | 12px | 600 | Encabezados de tabla, etiquetas de KPI (mayúsculas, `letter-spacing: .04em`) |
| `--text-body` | 14px | 400 | Texto general y celdas de tabla |
| `--text-body-strong` | 14px | 600 | Énfasis en celdas, ítems de menú |
| `--text-h3` | 16px | 600 | Título de card/sección |
| `--text-h2` | 20px | 600 | Subtítulos, números KPI secundarios |
| `--text-h1` | 24px | 700 | Título de página (uno por página) |
| `--text-kpi` | 28px | 700 | Número principal de tarjeta KPI |

Reglas: altura de línea 1.4 (1.2 en `h1` y KPI). Números en tablas y KPI con `font-variant-numeric: tabular-nums`. No hay tamaños intermedios ni "un poquito más chico".

## 3. Espaciado, radios, sombras, controles

- Espaciado (múltiplos de 4): `--space-1` 4, `--space-2` 8, `--space-3` 12, `--space-4` 16, `--space-6` 24, `--space-8` 32, `--space-12` 48.
- Radios: `--radius-sm` 6 (badges, inputs), `--radius-md` 10 (botones, cards), `--radius-lg` 14 (modales), `--radius-full` (pastillas, FAB).
- Sombras: `--shadow-sm` (cards), `--shadow-md` (menús, dropdowns), `--shadow-lg` (modales, FAB). Nada más.
- Alturas de control: `--control-h` 40px (botones, inputs, selects) y `--control-h-touch` 44px en tablet (`@media (pointer: coarse)`). Todos los controles de una misma fila tienen la misma altura.
- Íconos: un solo set, 16px en tablas y botones, 20px en navegación, 24px solo en KPI.

## 4. Layout de página

Todas las páginas usan `PageLayout`. No hay layouts propios por módulo.

```
[Topbar]
[Sidebar] [Contenido: max-width 1400px, padding --space-6, alineado a la izquierda]
            PageHeader
            Tabs (si hay)
            Fila de KPI (si hay)
            Barra de filtros/acciones (si hay)
            Contenido principal (tabla, form, etc.)
```

Reglas:
- Ancho máximo del contenido: `--content-max: 1400px`. En pantallas mayores, el contenido queda alineado a la izquierda del área de contenido (no centrado), salvo páginas de formulario angosto (`PageLayout narrow`, 720px).
- Gap vertical entre bloques: `--space-6`. Gap horizontal entre cards: `--space-4`.
- Los tabs van SIEMPRE debajo del `PageHeader` y arriba de los KPI. Nunca arriba del título.
- Contenido principal con `padding-bottom: 96px` para que el botón flotante nunca tape la última fila ni sus acciones.
- Sidebar: ítem activo = fondo `--color-primary-soft`, texto `--color-primary-text` y barra izquierda de 3px en `--color-primary`. Prohibido usar `outline` grueso para el estado activo. El foco de teclado usa un anillo de 2px (`--color-primary`, offset 2px) solo con `:focus-visible`.
- El logo aparece una sola vez (en el sidebar o en la topbar, no en ambos).

## 5. Componentes

### 5.1 PageHeader
Props: `title`, `description?`, `actions?`. Título `--text-h1`, descripción `--text-body` en `--color-text-secondary`, acciones alineadas a la derecha. Línea inferior `--color-border` y `margin-bottom: --space-6`. Sin ícono junto al título.

### 5.2 KpiCard / KpiGrid
- `KpiGrid`: `grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))`, gap `--space-4`. Prohibido armar filas con distintos anchos de tarjeta.
- `KpiCard`: alineada a la izquierda. Etiqueta (`--text-label`, mayúsculas, `--color-text-muted`) arriba, valor (`--text-kpi`) abajo, y opcionalmente variación o subtexto (`--text-caption`) y ícono de 24px a la derecha. Padding `--space-4`.
- Variante `tone`: `default | success | warning | danger` (cambia el color del valor o un borde izquierdo de 3px, nunca el fondo completo).
- No repetir métricas casi idénticas en la misma fila.

### 5.3 DataTable
Es el componente más importante. Props: `columns`, `rows`, `emptyState`, `onRowClick?`, `density?`.
- Altura de fila: 44px (default) o 36px (`density="compact"`). Una sola de las dos por tabla.
- Encabezado: `--text-label`, fondo `--color-surface-alt`, borde inferior `--color-border`.
- Celdas: `--text-body`, padding horizontal `--space-4`. Separador de fila `--color-border`. Hover de fila con `--color-surface-alt`.
- Alineación: texto a la izquierda; montos, cantidades y porcentajes a la derecha con `tabular-nums`; badges y acciones centrados o a la derecha.
- Columnas de monto: `white-space: nowrap` y ancho mínimo suficiente para el máximo monto esperado. Prohibido que un monto salte de línea.
- Columnas de texto largo: `text-overflow: ellipsis` con `title` con el texto completo. Prohibido dejar una columna de texto angosta con otra enorme vacía al lado: definir anchos con `minmax` o `width` explícitos.
- Columna de acciones: iconos de 16px en botones de 32px; orden fijo: ver, editar, acciones secundarias, eliminar (danger) al final.
- Estado vacío: ícono, título y texto de ayuda centrados dentro de la tabla (no una tabla con solo encabezado).
- Estados de carga: skeleton con la misma altura de fila.

### 5.4 Badge
Variantes por significado, no por pantalla: `success`, `warning`, `danger`, `info`, `neutral`. Altura 22px, `--text-caption`, `--radius-sm`. Toda columna de estado/tipo/medio de pago usa `Badge`. Prohibido mostrar un estado como texto plano en mayúsculas.

### 5.5 Button
Variantes: `primary` (fondo `--color-primary`, texto `--color-on-primary`), `secondary` (borde `--color-border-strong`, fondo `--color-surface`), `ghost` (sin borde, texto `--color-text-secondary`), `danger`, e `icon` (cuadrado de `--control-h`). Reglas de jerarquía:
- Máximo UN `primary` por zona de acciones.
- Las acciones del mismo nivel (CSV, Imprimir, Cierre) usan la misma variante.
- Botón flotante (+) solo para "crear" principal de la página; `--radius-full`, `--shadow-lg`, fondo `--color-primary`.

### 5.6 Input, Select, DateInput, Toggle
- Misma altura (`--control-h`), borde, radio y foco en todos. Prohibido el `<select>` nativo sin estilizar.
- Búsqueda: `Input` con ícono de lupa y placeholder descriptivo.
- Toggle/segmented (ej.: ABC / $$$): un único componente `SegmentedControl`, con opción activa en `--color-primary-soft` y texto `--color-primary-text`.
- `FormField`: label arriba (`--text-label`), control, ayuda o error debajo (`--text-caption`), gap fijo `--space-2`.

### 5.7 Tabs
Un único componente. Tab activo: texto `--color-primary-text` y borde inferior de 2px `--color-primary` (o fondo `--color-primary-soft`), no un fondo sólido distinto en cada pantalla.

### 5.8 Card / Section
Fondo `--color-surface`, borde `--color-border`, `--radius-md`, `--shadow-sm`, padding `--space-4`. Título opcional `--text-h3`.

### 5.9 Formularios (FormField, FormGrid)

- Todo control de formulario (`Input`, `Select`, `DateInput`, `Textarea`, `MoneyInput`) ocupa el 100% del ancho de su columna: `width: 100%` y `box-sizing: border-box` en todos. Prohibido que dos campos del mismo formulario terminen en anchos distintos.
- `Textarea` y todo control heredan la tipografía de la app: `font: inherit`. Prohibido el monoespaciado por defecto del navegador.
- Mismo fondo, borde, radio y altura (`--control-h`) en todos los controles. Fondo `--color-surface`; el estado deshabilitado usa `--color-surface-alt`.
- Espaciado vertical entre campos: `--space-4` (16px). Entre label y control: `--space-2` (8px). No se usan márgenes propios por campo.
- `FormGrid`: 1 columna por defecto, 2 columnas (`gap: --space-4`) cuando hay campos cortos relacionados (Tipo + Categoría, Precio + Ícono, Advertencia + Límite). Las dos columnas colapsan a una en ancho de modal menor a 480px.
- Obligatorios: asterisco en `--color-danger` junto al label, en TODOS los campos requeridos del formulario (si hay uno, se marcan todos). Si casi todos son requeridos, marcar los opcionales con "(opcional)".
- Unidades: campos de dinero usan `MoneyInput` con prefijo "$" dentro del control. Prohibido poner "($)" en el label.
- Validación: el error aparece debajo del campo (`--text-caption`, `--color-danger`) con el borde del control en `--color-danger`. Validar al salir del campo y al enviar; el foco va al primer campo con error.
- Placeholders: ejemplo o ayuda breve, nunca repiten el label ("Nombre" con placeholder "Nombre del producto" es redundante: usar un ejemplo real).

### 5.10 Modal

- Un único componente `Modal`. Tamaños: `sm` 480px, `md` 640px, `lg` 800px (default `sm` para formularios de hasta 6 campos). Ancho máximo `calc(100vw - 32px)`.
- Estructura fija: encabezado (título `--text-h2` + botón cerrar tipo `icon`), cuerpo con scroll interno, pie con acciones. Encabezado y pie siempre visibles; solo scrollea el cuerpo (`max-height: calc(100vh - 64px)`).
- Padding `--space-6`. Fondo `--color-surface` opaco, `--radius-lg`, `--shadow-lg`. Fondo del backdrop: `rgba(0,0,0,.45)`, sin blur.
- Pie: acciones alineadas a la derecha. `Cancelar` (ghost) a la izquierda del botón primario. La etiqueta del primario es un verbo concreto ("Guardar", "Crear producto"); el estado de envío muestra spinner y deshabilita el botón.
- Comportamiento: foco inicial en el primer campo, `Esc` cierra, `Enter` envía (salvo en `Textarea`), el foco queda atrapado dentro del modal y vuelve al disparador al cerrar. Si hay cambios sin guardar, pedir confirmación antes de cerrar con `Esc` o clic fuera.
- Acciones destructivas: usar `ConfirmDialog` (variante `danger`) que nombra lo que se elimina y su consecuencia; el botón destructivo no recibe el foco inicial.
- Un modal no abre otro modal encima, salvo `ConfirmDialog`.

## 6. Formateadores (único lugar para dar formato)

Archivo único `format.ts` (o equivalente) usado por toda la app. Locale `es-AR`.

- `formatMoney(value, { cents?: boolean })`: `$ 1.200` por defecto (sin decimales); con `cents: true`, `$ 1.200,00`. Siempre con "$" y un espacio. Negativos con signo: `-$ 20.000`.
  - Con decimales (`cents: true`) solo en contabilidad, cierres de caja y detalle de transacciones. En KPI, listados y tablas generales, sin decimales.
- `formatPercent(value)`: una decimal con coma, ej. `500,0%`. Variaciones con signo y flecha en un componente `Delta`.
- `formatDate(value)`: `dd/MM/yyyy`.
- `formatDateTime(value)`: `dd/MM/yyyy HH:mm` en 24 h. Prohibido 12 h con "p. m.".
- `formatNumber(value)`: separador de miles con punto.

## 7. Textos de interfaz

- Acentos y ñ siempre: Estadísticas, Categorías, Configuración, Administración, Gestión del padrón, Tesorería.
- Títulos de página y de columna en formato oración ("Estado del pago"), no TODO MAYÚSCULAS, salvo `--text-label` en etiquetas de KPI y encabezados de tabla, que se transforman con CSS (`text-transform: uppercase`), no escribiéndolos en mayúsculas en el código.
- Columnas con nombres distintos para datos distintos: no usar el mismo rótulo en dos columnas de una tabla (ej.: "Tipo" y "Estado" no pueden mostrar ambos "Activo").

## 8. Accesibilidad y tablet

- Targets táctiles de al menos 44×44px en pantallas táctiles.
- Contraste mínimo 4,5:1 para texto y 3:1 para íconos y bordes de controles.
- El estado no depende solo del color: acompañar con texto o ícono.
- Probar siempre con 3 colores de acento extremos (uno claro, uno oscuro, uno muy saturado) en modo claro y oscuro antes de dar por terminado un cambio de UI.

## 9. Proceso de migración de una pantalla

1. Importar `PageLayout` y `PageHeader`.
2. Reemplazar tarjetas de métricas por `KpiGrid` + `KpiCard`.
3. Reemplazar tablas por `DataTable`; estados por `Badge`.
4. Reemplazar botones, inputs y selects por los componentes de la sección 5.
5. Reemplazar todo formateo por las funciones de la sección 6.
6. Borrar estilos locales que ya no se usan.
7. Verificar que en la pantalla no queda ningún valor literal de color, tamaño o espaciado, y que se ve bien con distintos colores de acento y en modo oscuro.
8. No modificar lógica de negocio, endpoints ni permisos durante la migración visual.

## 10. Estado de implementación (v2.3.0, 2026-10-09)

- Tokens §1–3, `format.ts` §6 y librería `components/ui/` §5 implementados y en uso parcial.
- Accesibilidad §8 verificada en superficies, sidebar, topbar, tablas y formularios migrados.
- Pendiente: migrar tablas legacy (`.sales-table`) a `DataTable` y modales legacy a `Modal`
  (ver "Pendientes conocidos" en `AGENTS.md`). Hasta entonces rigen las reglas de compatibilidad
  en `global.css` (mapeo legacy → tokens) y el proceso §9 para cada pantalla que se toque.
