# Focus — contexto de traspaso para continuar con otra IA

Fecha de actualización: 15 de octubre de 2026.

Este documento reúne la guía del proyecto que compartió el usuario, el contexto de decisiones de este chat y una comprobación del código y QA actuales. Debe leerse junto con el código real: si este resumen y la implementación difieren, inspeccionar y confirmar antes de modificar.

## 1. Instrucción inicial para la IA que recibe este documento

Continúa en español. Antes de comenzar cualquier funcionalidad o cambio importante, inspecciona el código actual, explica un plan concreto y espera aprobación explícita. Implementa solamente el alcance aprobado y verifica el resultado. El usuario ya aprobó los cambios y el QA descritos como realizados abajo; no vuelvas a pedir aprobación para ellos. Para una tarea nueva, no asumas que la aprobación anterior cubre su alcance.

No pidas confirmación para detalles técnicos ordinarios que no cambien las reglas, los datos ni el comportamiento esperado. Sí consulta antes de cambiar decisiones de modelo de datos, reglas temporales, significado de una métrica, conservación o eliminación de datos, dependencias, servicios externos o compatibilidad importante. No empieces espontáneamente la versión siguiente al cerrar una tarea: informa y espera la instrucción.

El usuario quiere una IA activa: que analice, anticipe problemas, encuentre bugs y proponga soluciones. Prefiere QA real mediante Playwright e interacción visible, como una persona. En pruebas descritas como flujos de usuario no preparar datos con consola, scripts o escrituras directas en `localStorage`; puede haber tests aparte etiquetados claramente como datos preparados/preparación técnica.

## 2. Proyecto y entorno

- Nombre: **Focus**, aplicación web personal para registrar y comprender el tiempo realmente utilizado.
- Proyecto: `C:\Users\fabri\OneDrive\Escritorio\Proyectos propios\Pag-web-registros-de-0\react-prueba`
- Código fuente (directorio de trabajo habitual): `C:\Users\fabri\OneDrive\Escritorio\Proyectos propios\Pag-web-registros-de-0\react-prueba\src`
- Stack comprobado en `package.json`: React 19, React DOM 19, Vite 8, JavaScript/JSX y Playwright. No hay TypeScript. Las únicas dependencias runtime son React y React DOM; no añadir bibliotecas sin analizar la necesidad y obtener aprobación según el proceso del usuario.
- Los datos se guardan localmente en `localStorage`. La app se usa en una sola computadora y los datos son todavía de desarrollo.
- En PowerShell, usar `npm.cmd` si `npm` no se resuelve.
- Hay espacio limitado en C:. Playwright ya está configurado para navegadores en `D:/fabri/Playwright/Browsers` y resultados en `D:/fabri/Playwright/TestResults`.
- Playwright usa `http://127.0.0.1:5173`, directorio `src/tests/e2e`, configuración `src/playwright.config.js`, Chrome Desktop y trace `retain-on-failure`. La configuración tiene `fullyParallel: true`; en QA estable se ha usado `--headed --workers=1`.
- La carpeta raíz del proyecto aparece como no rastreada (`?? ./`) desde el repositorio Git detectado en el directorio padre. `git rev-parse --show-toplevel` indicó `C:/Users/fabri/OneDrive/Escritorio/Proyectos propios/Pag-web-registros-de-0`. Confirmar el límite real de Git y el estado antes de operaciones de Git; no asumir que el código está versionado ni hacer operaciones mutantes.

Comandos (desde la raíz `react-prueba`):

```powershell
npm.cmd run dev
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e -- --headed --workers=1
```

## 3. Propósito y principios de producto

Focus debe ayudar a conocer el uso real del tiempo. Integra calendario, registro temporal y, progresivamente, planificación y analítica. Su principio conceptual: “El primer paso para cambiar cómo usás tu tiempo es ser completamente consciente de cómo lo usás”. Evolucionar en versiones pequeñas con objetivos verificables; no anticipar todo el sistema con arquitectura compleja.

La aplicación debe describir hechos medibles. No debe inferir ni pedir atención, productividad, disciplina u otras valoraciones subjetivas. Las métricas futuras deben explicarse y no juzgar al usuario. La ausencia de un registro no prueba que una actividad no ocurrió. Planificación, realidad registrada y analítica derivada son conceptos diferentes.

### Decisiones de negocio y tiempo que no se deben cambiar sin aprobación

- Se permiten varias actividades simultáneas. No prohibir solapamientos ni tratarlos automáticamente como errores.
- La duración de cada actividad es individual. Si se informa “tiempo total del día”, explicar si es suma de duraciones o cobertura de reloj; no confundirlos ni contar tiempo simultáneo como si fuese una sola actividad.
- Precisión visible hasta segundos; milisegundos no son necesarios para el usuario.
- En registro manual, inicio igual a fin es inválido, no un registro de 24 horas.
- Fin anterior al inicio es inválido; no pasar automáticamente al día siguiente. Si se pretende cruzar medianoche, pedir/usar fecha de fin explícita.
- No modificar datos históricos al cambiar planes o plantillas. Una planificación no es un registro real.
- No eliminar una plantilla de evento vinculada a registros o planes existentes.
- Persistencia local por ahora. Sin sincronización entre pestañas/dispositivos, backup ni portabilidad de Playwright como prioridades inmediatas.
- Ya se aprobó evitar que cada tic del reloj actualice toda la app/calendario y separar componentes del calendario.

## 4. Funcionalidad que existe actualmente (verificada en fuente)

La app tiene navegación principal entre **Calendario** y **Eventos**, usa tema oscuro por defecto y alternancia claro/oscuro (clave local `focus.tema.v1`), y explica que sirve para registrar actividades y consultar duraciones.

### Calendario, registros y temporizadores

- Vistas de día y semana, navegación de fechas, “Hoy”, fecha elegida, escala/zoom.
- Representación de registros por segmentos y franjas temporales; fragmentos semanales para intervalos que cruzan medianoche.
- Crear registros manuales, abrir detalles, consultar segmentos, editar, eliminar con confirmación y revisar historial.
- Registros cronometrados: iniciar, pausar, continuar y finalizar; pueden coexistir varios temporizadores/actividades.
- Cálculo separado de tiempo efectivo, pausado y transcurrido.
- Pausas en registros manuales; la UI describe segmentos y pausas.
- Edición visual directa de registros con control que activa/desactiva drag/resize para prevenir cambios accidentales. Mouse y teclado tienen recorridos E2E.
- Los cambios visuales pasan por reglas de dominio y muestran mensajes de error específicos según el caso.
- Se conserva localmente y se manejan errores/datos dañados de persistencia con estados que deshabilitan operaciones dependientes y mensajes.

### Planificación

- Existe entidad de planificación separada de registros, con persistencia propia, creación/edición/eliminación y enlace opcional a plantilla de evento.
- Se pueden planificar intervalos superpuestos.
- Los planes se pueden editar visualmente desde el calendario; está aprobada la interacción directa de mover y cambiar inicio/fin.
- Hay vista de detalle ampliado de plan y zoom que llega a intervalos de pocos segundos.
- Si la planificación cruza medianoche, debe estar indicada explícitamente con fecha de fin. Horas iguales o invertidas se rechazan.
- La edición de detalle de plan reemplaza el calendario mientras está abierta, y al cerrarla se vuelve a la cuadrícula. Esto corrige que el detalle aparecía debajo y rompía el espacio/calendario.

### Eventos

- Biblioteca separada con alta, edición y eliminación de plantillas de eventos, nombre y color.
- Identidad estable por ID; nombres repetidos permitidos.
- Se impide eliminar una plantilla con registros o planes vinculados.
- Los registros pueden referenciar plantilla. No asumir sin inspección si el nombre/color se copia como snapshot en cada registro.

## 5. Estructura comprobada de `src`

- `src/app/`: `App.jsx`, CSS global, contexto/reloj compartido (`ContextoReloj.js`, `ProveedorReloj.jsx`, `useReloj.js`). `App` integra estado, eventos, planes y calendario.
- `src/domain/eventos/`: reglas y persistencia de eventos más tests.
- `src/domain/planificacion/`: reglas de planes (`planes.js`) y persistencia (`persistenciaPlanes.js`) más tests.
- `src/domain/registros/`: reglas, persistencia y tests.
- `src/domain/tiempo/`: calendario/fechas, cálculos de duración, historial y tests.
- `src/features/calendario/`: calendario día/semana, fragmentos, bloques visuales de plan/registro, edición directa, formularios, detalles, zoom y tests de utilidades.
- `src/features/eventos/`: biblioteca de eventos y estilos.
- `src/features/registros/`: controles, temporizadores/estado, historial y hook `usoRegistro.js`.
- `src/tests/e2e/`: recorridos Playwright por accesibilidad, calendario, edición visual, eventos, responsividad, persistencia, planificación, QA de V8, recorridos generales, registro manual y temporizador.

Archivos clave actuales:

- `src/app/App.jsx`
- `src/app/ProveedorReloj.jsx`
- `src/features/registros/usoRegistro.js`
- `src/features/calendario/CalendarioDiario.jsx`
- `src/features/calendario/VistaCalendarioDia.jsx`
- `src/features/calendario/VistaCalendarioSemana.jsx`
- `src/features/calendario/BloqueRegistro.jsx`
- `src/features/calendario/BloquePlan.jsx`
- `src/features/calendario/DetalleTramo.jsx`
- `src/features/calendario/DetalleTramoPlan.jsx`
- `src/features/calendario/FormularioRegistro.jsx`
- `src/features/calendario/FormularioPlan.jsx`
- `src/domain/registros/registros.js`
- `src/domain/planificacion/planes.js`
- `src/playwright.config.js`

## 6. Decisiones/cambios ya aprobados y realizados

### Reloj y renderizados

`ProveedorReloj` produce ticks solamente cuando existen registros activos. Los consumidores del tiempo vivo (temporizadores, bloques abiertos, totales) se suscriben al contexto. El paso de cada segundo no vuelve a renderizar toda la app desde `App`.

### Componentización del calendario

Las vistas día/semana, bloques, total y detalles se extrajeron a componentes. Los elementos que dependen del reloj actualizan localmente.

### Validación temporal y mensajes de error

Se revisaron mensajes de error para que distingan la causa real (fechas invertidas/iguales, duración no válida, límite de hora actual, entidad vinculada faltante, problemas de almacenamiento, etc.) en vez de usar una explicación general cuando la UI puede identificar el motivo. Seguir contrastando mensaje con condición exacta al añadir o corregir reglas.

### Edición directa V8

Se añadió posibilidad de activar/desactivar la edición directa visual para evitar mover/redimensionar registros accidentalmente. Dentro de “ampliar tramo en detalle”, los registros admiten mover y redimensionar. También hay interacción por teclado.

### Estado/representación de segmentos

Los segmentos de actividad en curso y pausados se distinguen en sus bloques calendario mediante tratamiento visual y texto, sin dejar que la leyenda dependa solo de color o borde punteado.

### Tema y claridad de la UI

Tema oscuro y claro alternables y persistidos localmente. Se hicieron ajustes de jerarquía y guías para que se entienda que la app mide registros de actividades. La app evita lenguaje subjetivo sobre productividad/atención.

### Planificaciones (V9 / trabajo ya introducido)

Planes separados de actividad real, edición directa, ampliación de detalle/zoom para planes breves y pausas en registros manuales. Se agregó QA de plan ampliado y formularios relacionados. No hay base para afirmar que V10 (plantillas de planificación y aplicaciones/instancias) exista: eso permanece en hoja de ruta.

### Detalle de tramo de planificación debajo del calendario (hallazgo corregido)

Se reportó que al activar detalle de una planificación, este aparecía por debajo y provocaba problemas. En `src/features/calendario/CalendarioDiario.jsx` ahora la vista de detalle de plan ocupa el lugar de la cuadrícula; al cerrarla, la cuadrícula vuelve. Un E2E verifica que `.calendario-dia-scroll` desaparece mientras el detalle está abierto y se restaura al volver. La suite completa pasó.

En QA de V9 también se agregó un recorrido Playwright que confirma que cancelar la eliminación conserva el plan y que cambiar fecha o vista cierra el detalle sin borrar el plan ni mostrarlo en otro día.

## 7. Hallazgo visual original V8 y QA relacionado

El usuario reportó que al arrastrar/estirar el último registro hacia horas posteriores aparecía “La operación produciría intervalos temporales inválidos”, incluso a partir de las 16:00, y que no permitía crear registros en ese horario. La captura mostraba un registro 14:20–16:06 con aviso genérico en calendario de 14 oct 2026. Este fue el detonante de una revisión amplia de V8 y de la precisión de los errores. No inferir que la regla de negocio prohíbe horarios posteriores: se debe diagnosticar según hora actual, estado del registro y posición exacta.

Se agregaron pruebas de QA V8 y recorridos por arrastre de registros, horas futuras (rechazo explicado cuando corresponde), medianoche, redimensionamiento con duración inválida, modo edición apagado/encendido y teclado. Consultar `src/tests/e2e/qa-v8-repro.spec.js` y `edicion-visual-calendario.spec.js` para el comportamiento/casos exactos.

Un recorrido existente de mover al día siguiente falló una vez durante una regresión completa; pasó aislado, pasó tres repeticiones y pasó en la siguiente ejecución completa. La suite no volvió a fallar. Por ahora fue intermitente/no reproducible, no evidencia de bug consistente. Si reaparece, inspeccionar trace y coordenadas de soltado antes de concluir.

## 8. Estado más reciente de QA (15 oct 2026)

Después del cambio que coloca el detalle de plan en lugar del calendario:

- `npm.cmd run lint`: aprobado.
- `npm.cmd test`: **76 pruebas aprobadas, 0 fallidas**.
- `npm.cmd run test:e2e -- --headed --workers=1`: **58/58 E2E aprobados** en la ejecución final; incluye el recorrido de cancelación de borrado y cambios de fecha/vista.
- Recorrido de mover registro con teclado y arrastre entre días pasó aislado y en 3 repeticiones; suite final también pasó.
- Recorrido móvil en viewport de 375×812, detalle de plan, pausa y cambio tema claro/oscuro: aprobado; comprueba ausencia de desbordamiento horizontal y que el contenido siga dentro del ancho.
- Los reportes locales temporales `.playwright-results` se limpiaron después de QA. Playwright también usa la carpeta indicada por configuración en D:.
- **Build de producción no se volvió a ejecutar en esta última ronda**. La guía/contexto anterior dice que builds previos habían pasado antes de algunos cambios; no presentar eso como verificación posterior actual. Puede correrse cuando una tarea lo requiera y el usuario haya pedido verificar/build; tener en cuenta que `dist` está en la raíz, fuera de `src` en el entorno actual.
- No se encontró otro bug reproducible que requiriera corrección en la última ronda. Esto describe el alcance de QA cubierto, no garantiza que no existan bugs.

Los nombres de E2E distinguen expresamente: `Flujo de usuario: ...`, `Datos preparados + interacción UI: ...`, `Preparación técnica de almacenamiento: ...`. Conservar esa claridad.

### QA de planificación básica, 15 oct 2026

- Se recorrieron con la UI creación, edición, recarga, eliminación confirmada, cancelación del borrado, solapamientos, mover/redimensionar, detalle/zoom, validación de fechas iguales e invertidas, cruce explícito de medianoche, asociación con evento y prevención de borrado de evento vinculado, cambio de fecha/vista y modo móvil/temas.
- No apareció un bug reproducible en estas rutas. La cancelación conserva el plan; cambiar de contexto cierra el detalle y la planificación permanece en su fecha.
- Alcance actual: se pueden crear planes desde la vista diaria; la semanal muestra registros y no planes. La primera implementación de V9 admite planificar un día concreto, por lo que no se amplió en esta QA. Si el usuario espera ver planificación semanal, acordar ese cambio antes de implementarlo.
- Verificación final: lint correcto, 76/76 unitarias, 58/58 E2E. No se ejecutó build de producción en esta ronda.

## 9. Preferencias de QA funcional del usuario

Al hacer QA interactivo, recorrer la app como usuario y usar controles visibles. No presentar datos inyectados por consola como experiencia real de usuario. Separar claramente pruebas que preparan almacenamiento. Interesa cubrir, entre otras cosas:

- Temporizadores simultáneos y operaciones independientes de pausa/reanudación/detención.
- Crear/editar/eliminar registros y sus confirmaciones.
- Registros breves y consecutivos, segundos y límites temporales.
- Solapamiento legítimo.
- Cruce explícito de medianoche y cambios día/semana.
- Edición visual activada/desactivada; drag, resize, teclado; detalle ampliado tanto de registro como de plan.
- Creación/edición de planes breves, intervalos superpuestos, errores de horas iguales/invertidas.
- Pausas manuales y diferencia entre efectivo/pausado/transcurrido.
- Plantillas vinculadas; no borrado accidental de entidades relacionadas.
- Navegación, mensajes de error, persistencia/recarga, teclado y tamaños estrechos; temas claro/oscuro.

## 10. Hoja de ruta entregada por el usuario (no equivale a aprobación de cada etapa)

Esta es la dirección del proyecto, no una autorización para implementarla automáticamente. Los hitos históricos no se deben declarar completados solo por la lista; el estado se comprueba en código. En términos generales, hasta el estado actual existen calendario, eventos, persistencia, registros, historial, edición visual V8 y planificación básica (V9 en parte). El siguiente paso concreto debe acordarse con el usuario tras inspeccionar qué alcance de planificación ya considera cerrado.

- **V0–V4 (base React, calendario día/semana, eventos, persistencia local):** base React funcional; calendario diario y semanal; plantillas de eventos; LocalStorage con manejo de errores.
- **V5–V8 (registros y edición visual):** temporizador real con inicio/pausa/continuación/fin; historial y edición manual; registros en calendario; mover y redimensionar intervalos con reglas coherentes.
- **V9 (planificación básica):** representar por separado lo que se esperaba hacer y permitir planificar por fecha/horario.
- **V10 (plantillas de planificación e instancias):** reutilizar planes y aplicarlos a fechas; no alterar registros reales.
- **V11 (analítica básica):** tiempo registrado y asociaciones con evento por día/semana; evitar duplicar datos derivados.
- **V12 (categorías):** entidades de categoría y filtros/agrupación, sin duplicar duraciones.
- **V13 (Focus):** sesiones usan el sistema de registros ya existente, sin otro modelo temporal.
- **V14 (tareas básicas):** entidad diferente de evento; estados iniciales Boceto, Pendiente, En curso, Completada, Cancelada.
- **V15 (relación tareas-registros-Focus):** como máximo una tarea por registro; el tiempo de tarea y evento es la misma duración real.
- **V16 (pausas avanzadas):** motivos (Descanso, Comer, Baño, Interrupción externa, Distracción), voluntarias/externas; tiempo efectivo separado de pausado y transcurrido.
- **V17 (analítica avanzada):** métricas descriptivas: efectivos, pausados, conteos, promedios, evolución.
- **V18 (comparación plan-realidad):** diferencias horarias y tiempo registrado dentro/fuera de planes; sin etiquetar ausencia como incumplimiento.
- **V19 (auditoría de planificación):** estados con reglas explícitas, tolerancia inicialmente de 5 minutos y conservar la tolerancia histórica usada.
- **V20 (recurrencias):** series, excepciones y alcance de cambios (ocurrencia, esta y siguientes, todas) definidos antes de implementar.
- **V21 (tareas avanzadas):** subtareas/prioridad/dificultad/energía/estimaciones e historial, evitando doble conteo jerárquico.
- **V22 (moods):** marcas puntuales, sin duración ni confusión con actividad.
- **V23 (exclusiones/cobertura):** tiempo excluido, registrable y no registrado distintos; resolver superposición correctamente.
- **V24 (historial de cambios):** cambios relevantes y versión original de planes.
- **V25 (papelera/eliminación lógica):** consulta/restauración y relaciones sin borrar historia accidentalmente.
- **V26 (importación/exportación/backups):** JSON versionado, validación atómica de IDs, relaciones, fechas, duplicados y temporalidad.
- **V27 (consolidación local):** integración y calidad de funciones desarrolladas; no añadir gran funcionalidad nueva.
- **V28 (separación de persistencia):** contratos/repositorio si aportan valor; mantener LocalStorage. Sin backend todavía.
- **V29 (backend/PostgreSQL):** solo cuando se planifique y apruebe; evaluar API, almacenamiento y cada dependencia necesaria por separado; migrar/validar datos locales.
- **V30 (multiusuario/sincronización):** autenticación, autorización, concurrencia y conflictos; comenzar solo cuando la necesidad esté confirmada.

## 11. Lo que no se debe asumir como hecho/alcance aprobado

- No asumir que todas las versiones V0–V30 están completas ni que el usuario aprobó implementarlas todas.
- No asumir que ya existen plantillas de planificación, tareas, categorías, recurrencia, analítica, exportación, backup, backend, cuentas o sincronización. Revisar el código antes de afirmar disponibilidad.
- No reintroducir conversión silenciosa a día siguiente para fin anterior al inicio.
- No introducir reglas contra solapamientos.
- No hacer cambios de datos históricos al editar planes/eventos.
- No añadir dependencias, reorganizar la arquitectura global o cambiar el alcance de una versión sin plan y aprobación.
- No presentar la intermitencia de arrastre observada una sola vez como bug confirmado, aunque sí dejarla en observación si reaparece.
- README todavía es el template inicial React/Vite y no se consideró prioridad; si el usuario plantea documentación del producto, hacer un plan específico.

## 12. Próximo trabajo / cómo continuar

El QA reciente de planificación básica quedó cerrado: 58/58 E2E, 76/76 unitarias y lint correcto; no queda un bug reproducible de esas rutas. El usuario debe indicar qué sigue o pedir un plan. Si solicita avanzar con versiones, la IA debe primero comprobar la hoja de ruta frente a las funcionalidades actuales, decidir con el usuario qué versión funcional va a cerrarse y presentar el plan antes de tocar código.

No hay que usar este documento como sustituto de inspeccionar el repo. La ruta de los archivos puede enlazarse desde la raíz de proyecto; el código está bajo `src/`.
