# Guía de trabajo del proyecto Focus

## Propósito de la aplicación

Focus es una aplicación personal para planificar actividades y registrar qué se hizo realmente y cuánto tiempo se dedicó. Reúne plantillas de eventos, planes y secuencias, sesiones Focus, tareas y objetivos, calendario, historial y analítica. Debe ayudar a organizar y consultar información medible; no debe inferir productividad, atención ni otras valoraciones subjetivas.

La implementación y las decisiones de producto pueden cambiar: inspeccioná el proyecto actual antes de dar por vigente cualquier descripción de chats anteriores. El almacenamiento actual usa `localStorage`; confirmá el código antes de asumir sus límites o su comportamiento. Cuando se edita una planificación ya aplicada o seguida, respetá la relación con los planes guardados en el calendario como fuente de verdad, según el comportamiento actual.

## Antes de trabajar

- Leé esta guía al empezar cada tarea en el repositorio.
- Revisá el código y los recorridos existentes antes de proponer o implementar cambios.
- Comprobá la raíz real del repositorio y `git status` antes de usar Git para modificar, comparar, confirmar o publicar.
- Tratá el código actual como fuente de verdad cuando contradiga resúmenes anteriores.

## Colaboración

- Conversá en español y explicá las decisiones con palabras concretas.
- Entendé el resultado que busca el usuario y el recorrido que hace en la interfaz; no traduzcas una idea ambigua directamente a código. Cuando ayude a entender el problema y elegir una solución adecuada, preguntá también por qué quiere esa funcionalidad o qué situación concreta intenta resolver.
- Podés cuestionar respetuosamente el motivo, el enfoque o una instrucción de implementación cuando detectes que quizá no resuelve el problema de fondo, duplica algo existente, agrega complejidad evitable o puede causar efectos no deseados. Explicá qué observaste, por qué importa y qué alternativa proponés; hacé preguntas concretas y dejá que el usuario decida. No conviertas esto en objeciones rutinarias cuando el pedido sea claro y no haya un riesgo o una alternativa relevante.
- Preguntá antes de implementar cuando una duda pueda cambiar el comportamiento visible, el significado o la integridad de los datos, la persistencia, las eliminaciones, los horarios o duraciones, los solapamientos, los estados o el alcance entre secciones.
- Hacé preguntas breves y específicas, y ofrecé una recomendación con sus motivos cuando ayude a decidir.
- No interrumpas por detalles rutinarios de implementación. Si una decisión es menor y reversible, elegí una opción razonable, declará la suposición y seguí.
- En cambios de producto sustanciales, primero inspeccioná y presentá qué entendiste, las dudas relevantes, el alcance y un plan. Esperá aprobación antes de implementar ese plan. Si el usuario autoriza directamente un arreglo acotado, resolvelo sin agregar una aprobación innecesaria.
- No amplíes silenciosamente el alcance aprobado. Conservá las funciones existentes que el usuario no pidió cambiar.
- Podés proponer alternativas de producto, formas de implementar una función y mejoras en la manera de organizar el trabajo. Explicá qué problema resuelve cada sugerencia y sus ventajas o costos; distinguí la recomendación del alcance pedido y no implementes cambios opcionales sin autorización.

## Eficiencia, calidad y errores

- Buscá completar el trabajo autorizado de punta a punta, con el menor retrabajo razonable. Inspeccioná primero las áreas relacionadas, elegí el cambio más acotado que resuelva el problema completo y aprovechá lógica compartida cuando evite duplicaciones.
- Cuando una solicitud amplíe una función o modo que ya existe, identificá primero su flujo y sus controles actuales e incorporá ahí la capacidad nueva. No crees otra sección, formulario o diseñador que repita el mismo propósito con opciones adicionales si se puede extender el existente. Antes de separar una función en otro lugar, explicá qué diferencia de uso lo justifica y proponé esa estructura para que el usuario la decida.
- Diseñá cada función pensando en la comodidad de la persona: recorré mentalmente cómo la va a usar, cuántos pasos requiere, qué espera que ocurra y qué puede salir mal. La interfaz debe ser intuitiva, clara y coherente con el resto de Focus; no alcanza con que la lógica funcione. Revisá los textos, controles, estados vacíos y resultados visibles desde la perspectiva del usuario. Preguntá cuando estas decisiones puedan cambiar el comportamiento o los datos.
- Si encontrás un error o una inconcordancia, hacelo saber con claridad. Si está dentro del alcance y la autorización, corregilo; si queda fuera, explicá su impacto y proponé cómo abordarlo.
- No ocultes fallas de pruebas, advertencias, incertidumbres ni limitaciones, y no asegures que todo está libre de errores sin evidencia suficiente.
- Evitá dependencias nuevas si una solución clara con la arquitectura actual alcanza. Si una dependencia cambia costos, mantenimiento o despliegue, explicalo antes de agregarla.

## Coherencia de toda la aplicación

Antes de cambiar una función, identificá sus puntos de entrada, sus datos compartidos y todas las secciones que muestran o modifican esos datos. Considerá, según corresponda, Calendario, Focus, Historial, Eventos, Planificaciones, Analítica y Tareas.

- Determiná qué vista o entidad es la fuente de verdad y mantené sincronizadas las demás representaciones.
- Revisá crear, consultar, editar y eliminar; incluí relaciones, recargas, errores de persistencia y registros ya existentes cuando sean pertinentes.
- Pensá en los recorridos completos y también en casos poco habituales, no solo en la pantalla donde se solicita el cambio.
- Evitá implementar la misma regla de negocio de maneras distintas en cada sección. Preferí componentes, funciones y validaciones compartidas cuando corresponda.
- Conservá una navegación global predecible. El usuario expresó molestia porque el panel de secciones cambia de tamaño o posición, y dijo que el texto introductorio de Focus no es necesario para su uso personal. Considerá esas preferencias al proponer cambios de interfaz y preguntá antes de convertirlas en una modificación global.
- Revisá computadora y celular cuando el cambio afecte diseño, controles o recorridos que difieren entre dispositivos.

## Principios de producto confirmados

- Planificar algo y registrar que ocurrió son conceptos distintos. La falta de un registro no demuestra que la actividad no haya ocurrido.
- Aplicar una plantilla de planificación al calendario no cuenta como usarla. Al iniciar un registro siguiendo una de sus aplicaciones, esa plantilla queda inhabilitada para el resto de la fecha de aplicación; otras plantillas pueden usarse aunque sus horarios se superpongan.
- En general se permiten actividades superpuestas. La concentración de una sesión Focus es una excepción deliberada: no debe coexistir con otro registro activo; revisá el comportamiento actual para descansos, pausas y tiempo muerto antes de tocar esa regla.
- Focus sirve para registrar períodos de concentración vinculados a tareas cuando corresponda; no conviertas actividades cotidianas en sesiones de concentración.
- La duración de cada actividad es individual. Al mostrar el tiempo de un día, distinguí entre sumar duraciones de actividades y medir cobertura del reloj; no confundas esos conceptos ni elimines solapamientos silenciosamente.
- La precisión visible es hasta segundos; no hace falta mostrar milisegundos.
- Los intervalos manuales deben tener duración positiva. Un fin al día siguiente debe indicarse explícitamente; no infieras un cruce de medianoche solo porque la hora final sea anterior a la inicial.
- Cambiar una plantilla o un plan no debe reescribir registros reales ya guardados, salvo que el usuario solicite explícitamente editar esos registros.
- No elimines una plantilla de evento que siga vinculada a planes o registros sin preservar sus relaciones y explicar el efecto.
- La persistencia actual es local. No des por existentes sincronización entre dispositivos, copias de seguridad, migración o recuperación sin comprobar el código.

## Verificación

- Ajustá la verificación al pedido y al alcance autorizado. No afirmes que un recorrido pasó si no lo ejecutaste.
- Si se pide probar un flujo de usuario, operá los controles visibles de la interfaz. Distinguí esas pruebas de las que preparan datos directamente en `localStorage`.
- Para cambios que afecten varias secciones o modos, cubrí cada recorrido afectado y los casos límite relevantes; no supongas que probar un modo valida los demás.
- Informá qué verificaste, el resultado, advertencias y cualquier limitación. Nunca prometas que no hay errores sin evidencia suficiente.

### Ejecución eficiente de pruebas

- Empezá por la prueba más acotada que cubra el cambio: dominio para reglas de datos y una sola especificación E2E para el recorrido de interfaz. Ampliá a suites mayores cuando cambien reglas compartidas o el resultado focalizado lo justifique.
- En E2E, usá la interfaz para afirmar recorridos de usuario; prepará datos directamente en almacenamiento solo cuando el caso requiera una combinación difícil de crear, y dejá claro qué parte no recorrió la interfaz. Mantené perfiles de navegador descartables.
- Para duraciones y vencimientos, usá el reloj simulado de Playwright en lugar de esperas reales.
- Si falla una prueba, separá defecto de producto, fixture inválido y selector desactualizado. Actualizá fixtures o selectores según el contrato vigente; no borres una regresión solo para dejar verde la suite.
- Ejecutá Playwright con la configuración existente y esperá su resultado final. En Windows, el `globalSetup` y `globalTeardown` de `src/playwright.config.js` administran Vite en el puerto 5187; no arranques otro servidor en paralelo ni cierres procesos genéricos de Node o Chrome. Si una prueba se atasca, detené solo esa ejecución e identificá el paso que espera antes de repetir.
- Una viewport móvil de Playwright verifica el diseño adaptable, pero no reemplaza una comprobación en teléfono real cuando el problema depende del navegador o del tacto.

## Entorno y comandos actuales

Confirmá `package.json` y la configuración de Playwright antes de depender de estos detalles:

- En PowerShell usá `npm.cmd` si `npm` no se resuelve.
- Comandos habituales desde la raíz: `npm.cmd run dev`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build` y `npm.cmd run test:e2e -- --headed --workers=1`.
- Playwright está configurado para guardar navegadores y resultados en D:, porque el espacio de C: es limitado. Respetá las rutas configuradas y no escribas artefactos grandes en C:.

## Mantener esta guía

Actualizá `AGENTS.md` cuando aparezca una preferencia estable del usuario, una regla de producto confirmada, una limitación permanente, una nueva forma acordada de colaborar o una lección de un error que deba evitarse en trabajos futuros. No hace falta esperar a que un problema se repita si ya quedó clara una regla duradera.

Mantené la guía breve, vigente y sin contradicciones: corregí o reemplazá la instrucción antigua en vez de acumular variantes. No agregues el estado temporal de una tarea ni conviertas una sugerencia no aprobada en una regla. Al actualizarla, informá qué cambió y por qué.

## Git y archivos

- Antes de cualquier operación Git, comprobá raíz, rama, remoto y estado actual; preservá cambios locales que no pertenezcan a la tarea.
- No descartes, restaures ni sobrescribas cambios de trabajo sin autorización explícita.
- Confirmar, subir a GitHub o publicar son acciones separadas: hacelas cuando el usuario las pida.

## Cómo plantear una idea

El usuario no necesita escribir una especificación técnica. Para reducir idas y vueltas, puede describir:

1. Qué quiere lograr.
2. Qué hace el usuario paso a paso.
3. Qué debería ocurrir y qué no debería ocurrir.
4. Qué datos o secciones podrían verse afectados, si lo sabe.
5. Qué casos especiales ya tiene en mente.
6. Si quiere primero una explicación, un plan, una implementación o pruebas.

Completá los detalles faltantes con preguntas concretas cuando puedan cambiar la experiencia o los datos. Devolvé una recomendación cuando haya alternativas y explicá brevemente sus ventajas o costos.

## Ideas para desarrollar Focus

Cuando revises una función o una propuesta, podés señalar oportunidades para hacerla más sencilla de entender, consistente entre secciones y dispositivos, fácil de mantener o menos propensa a errores. Priorizá sugerencias concretas que ahorren pasos o eviten fallas observables; explicá qué recorrido o problema mejorarían y qué otras partes tocarían. Presentalas como opciones para decidir, no como cambios ya aprobados.
