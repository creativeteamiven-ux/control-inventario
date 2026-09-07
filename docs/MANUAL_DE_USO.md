# The Warehouse — Manual de uso

Gestión de inventario de audio. Este manual está escrito para quien usa la aplicación
en el día a día: no hace falta saber nada de programación.

Última actualización: 7 de septiembre de 2026.

---

## Índice

1. [Primeros pasos](#1-primeros-pasos)
2. [Cómo moverse por la aplicación](#2-cómo-moverse-por-la-aplicación)
3. [Qué puede hacer cada usuario](#3-qué-puede-hacer-cada-usuario)
4. [Configura tu PIN o tu huella (hazlo primero)](#4-configura-tu-pin-o-tu-huella-hazlo-primero)
5. [Inventario](#5-inventario)
6. [Escanear un equipo](#6-escanear-un-equipo)
7. [Movimientos: trasladar equipos](#7-movimientos-trasladar-equipos)
8. [Eventos: sacar equipos y traerlos de vuelta](#8-eventos-sacar-equipos-y-traerlos-de-vuelta)
9. [Mantenimientos](#9-mantenimientos)
10. [Préstamos](#10-préstamos)
11. [Gastos y presupuestos](#11-gastos-y-presupuestos)
12. [Reportes](#12-reportes)
13. [Alertas y notificaciones](#13-alertas-y-notificaciones)
14. [Categorías y lugares](#14-categorías-y-lugares)
15. [Usuarios (solo administradores)](#15-usuarios-solo-administradores)
16. [Configuración y auditoría](#16-configuración-y-auditoría)
17. [Problemas frecuentes](#17-problemas-frecuentes)
18. [Límites del sistema](#18-límites-del-sistema)

---

## 1. Primeros pasos

### Entrar

1. Abre la dirección de la aplicación en el navegador.
2. Escribe tu **Email** y tu **Contraseña**.
3. Pulsa **Iniciar sesión**.

Verás el mensaje *Bienvenido a The Warehouse* y entrarás al **Dashboard**.

Si no tienes cuenta, pídesela a un administrador: no hay registro abierto. Si olvidaste
la contraseña, también tiene que cambiarla un administrador desde el módulo de usuarios.

### El Dashboard

Es la pantalla de inicio y funciona como resumen del día:

- **Total equipos**, **Operativos**, **En mantenimiento**, **En préstamo** y, si tienes
  permiso para ver precios, **Valor inventario**.
- Gráficas de reparto por categoría, por estado y por lugar.
- Avisos de lo que necesita atención (garantías, préstamos vencidos, condición baja).

### Usarla en el móvil

Funciona igual en teléfono que en computador. En el móvil tienes una barra inferior con
los cinco accesos más usados —**Inicio**, **Inventario**, **Escanear**, **Eventos** y
**Movim.**— y el resto de módulos está en el menú que se abre con el icono de las tres
líneas, arriba a la izquierda.

Para escanear códigos con la cámara del teléfono la aplicación tiene que estar servida
por HTTPS (la dirección empieza por `https://`). La primera vez el navegador pedirá
permiso para usar la cámara: acéptalo.

---

## 2. Cómo moverse por la aplicación

El menú lateral lista todos los módulos. Solo verás los que tu usuario tenga permitidos:

| Módulo | Para qué sirve |
| --- | --- |
| **Dashboard** | Resumen general y avisos |
| **Inventario** | El listado de equipos y todo lo que se hace con ellos |
| **Papelera** | Equipos dados de baja, para restaurar o borrar del todo |
| **Escanear** | Consultar un equipo con la cámara o armar la lista de un evento |
| **Categorías** | Organizar los tipos de equipo |
| **Lugares** | Las ubicaciones físicas donde están los equipos |
| **Mantenimientos** | Enviar equipos a mantenimiento y registrar lo que se hizo |
| **Préstamos** | Equipos entregados a una persona concreta |
| **Movimientos** | Traslados de equipos y su autorización |
| **Eventos** | Listas de equipos para una actividad, con control de salida y regreso |
| **Reportes** | Descargar información en Excel o PDF |
| **Gastos** | Lo que se gasta en equipos, reparaciones y servicios |
| **Presupuestos** | Cuánto hay previsto gastar y cuánto queda |
| **Auditoría** | Quién hizo qué y cuándo |
| **Usuarios** | Crear cuentas y decidir qué puede hacer cada una |
| **Seguridad** | Tu PIN y tu huella o Face ID |
| **Configuración** | Correo de alertas y destinatarios |

Arriba a la derecha tienes la **campana de notificaciones** con los avisos pendientes, y
el botón para **Salir**.

---

## 3. Qué puede hacer cada usuario

Hay cuatro roles. Cada uno trae un juego de permisos por defecto que un administrador
puede ajustar usuario por usuario.

| Rol | Qué puede hacer |
| --- | --- |
| **Administrador** | Todo, incluido crear usuarios, borrarlos y cambiar la configuración |
| **Gestor** | Casi todo: gestiona inventario, eventos, finanzas y usuarios, pero no puede borrar usuarios |
| **Técnico** | Trabaja con los equipos: alta, edición, traslados, mantenimientos, préstamos y escaneo en eventos. No crea eventos ni gestiona usuarios |
| **Solo lectura** | Consulta y descarga reportes, sin modificar nada |

Dos permisos merecen mención aparte porque se conceden a mano:

- **Ver precios y costos**: sin él, los precios de compra y los costos de mantenimiento
  no aparecen en ninguna pantalla ni en los reportes.
- **Gestionar eventos**: hace falta para crear un evento y armar sus listas. Escanear en
  un evento ya activo es un permiso distinto (**Escanear en eventos**), que sí tiene el
  rol Técnico.

> Si un administrador te acaba de dar un permiso nuevo y la aplicación sigue diciendo que
> no lo tienes, cierra sesión y vuelve a entrar.

---

## 4. Configura tu PIN o tu huella (hazlo primero)

Los traslados de equipos se confirman con un segundo factor: un PIN o la biometría del
dispositivo (Face ID, huella). **Sin uno de los dos no podrás registrar ni autorizar
traslados.** Se configura una sola vez, en **Seguridad**.

### Crear el PIN

1. Entra en **Seguridad**.
2. Escribe un PIN de **4 a 6 dígitos**.
3. Confirma con **Tu contraseña actual**.
4. Pulsa **Guardar PIN**.

Después podrás **Cambiar PIN** o **Quitar PIN** desde la misma pantalla, siempre
escribiendo tu contraseña.

### Registrar la huella o Face ID

1. En **Seguridad**, pulsa **Registrar biometría**.
2. Sigue lo que pida el dispositivo (huella, cara o PIN del sistema).
3. Comprueba que quedó bien con el botón **Probar**.

Puedes registrar varios dispositivos con **Agregar otro dispositivo**: es útil si usas
el teléfono y el computador. Recuerda que la biometría necesita HTTPS.

Al confirmar una operación, la autorización queda válida **3 minutos**. Pasado ese rato,
la aplicación volverá a pedirla.

---

## 5. Inventario

Es el módulo central. Cada equipo tiene una ficha con su estado, su ubicación, sus fotos
y su historial.

### Buscar y filtrar

El buscador mira en el nombre, la marca, el modelo, el número de serie y el código
interno. Además puedes filtrar por categoría, lugar y estado.

En el móvil los filtros están recogidos para no tapar la lista: pulsa **Filtros** para
abrirlos y se cierran al aplicarlos.

Hay un filtro que conviene revisar cada semana: **Con observación**, que reúne los
equipos que siguen operativos pero tienen una novedad apuntada o una condición por
debajo del 70 %.

Puedes ver la lista como tabla o como cuadrícula de tarjetas, y cambiar cuántos equipos
se muestran por página.

### Dar de alta un equipo

1. Pulsa **Agregar equipo**.
2. Rellena los cuatro campos obligatorios: **Nombre**, **Marca**, **Modelo** y
   **Categoría**.
3. Completa lo que sepas del resto:
   - **Número de serie**: el que lleva impreso el equipo. Conviene ponerlo siempre,
     porque es lo que se imprime en la etiqueta y lo que se escanea.
   - **Estado**: por defecto *Operativo*.
   - **Ubicación**: por defecto *Cuarto de almacenamiento*.
   - **Condición (0-100)**: el porcentaje de estado físico. Empieza en 100.
   - **Observación / Novedad**: para lo que funciona pero hay que vigilar. Máximo 500
     caracteres.
   - **Precio de compra (COP)** y **Proveedor**, si los conoces.
   - **Imágenes del equipo**: hasta 5 fotos en JPG, PNG o WebP, de 5 MB como máximo cada
     una. La primera será la principal.
4. Pulsa **Agregar equipo**.

El sistema le asigna un **código interno** automáticamente. No hace falta inventarlo.

### Los estados de un equipo

| Estado | Qué significa |
| --- | --- |
| **Operativo** | Disponible para usarse |
| **En mantenimiento** | Está siendo revisado o reparado |
| **En préstamo** | Entregado a una persona, con fecha de devolución |
| **Dañado** | No sirve hasta que se repare |
| **Extraviado** | No se sabe dónde está |
| **Dado de baja** | Fuera de servicio de forma definitiva |

### La condición y las observaciones

La **condición** es un número del 0 al 100 que resume el desgaste. Se ve como una barra
de color: verde a partir del 70 %, ámbar a partir del 40 %, rojo por debajo. Cuando baja
del 40 % el sistema genera un aviso, y por debajo del 20 % lo marca como crítico.

La **observación** es texto libre para las novedades que no justifican cambiar el estado:
«el cable de alimentación está flojo», «hace un zumbido al subir la ganancia». Es lo que
permite arreglar las cosas antes de que se rompan.

### La ficha del equipo

Se abre pulsando el **nombre** del equipo en la lista. Dentro encontrarás:

- Los datos completos y las fotos, que puedes ampliar.
- Su **código de barras**, con **Descargar código de barras** para imprimirlo.
- El historial: movimientos, mantenimientos y préstamos de ese equipo.
- Los botones para **Editar** o **Eliminar equipo**.

### Etiquetas de código de barras

Cada equipo lleva su etiqueta pegada para poder escanearlo. La etiqueta contiene el
número de serie o, si el equipo no tiene, su código interno.

- Para uno solo: desde su ficha, **Descargar código de barras**.
- Para muchos: en **Inventario**, genera un PDF con las etiquetas de todos los equipos o
  solo de los que hayas seleccionado. Salen 10 etiquetas por página, en dos columnas.

### Cargar muchos equipos de golpe con Excel

1. En **Inventario**, pulsa **Plantilla** y descarga
   `plantilla-equipos-thewarehouse.xlsx`.
2. Rellena una fila por equipo. El archivo trae una hoja llamada **Valores validos** con
   las categorías, los estados y las ubicaciones que se aceptan: cópialos tal cual.
3. Pulsa **Importar** y elige el archivo.
4. La aplicación revisa el archivo antes de guardar nada y te muestra cuántas filas están
   bien y cuántas tienen error, con el motivo.
5. Si te convence, confirma la importación.

Las columnas son: `Nombre`, `Marca`, `Modelo`, `Serie`, `Categoria_Slug`, `Estado`,
`Ubicacion`, `Precio`, `Proveedor`, `Notas`, `Observacion`, `Condicion`.

> En el Excel los estados y los lugares se escriben con su clave en inglés
> (`ACTIVE`, `MAINTENANCE`, `STORAGE_ROOM`…). La hoja **Valores validos** los lista todos.

### Dar de baja y la papelera

Los equipos no se borran de golpe: primero van a la papelera.

1. En la ficha del equipo, pulsa **Eliminar equipo** y confirma. Pasa a la **Papelera**.
2. Desde la **Papelera** puedes **Restaurar** el equipo, que vuelve al inventario tal
   como estaba.
3. **Borrar del todo** lo elimina de forma definitiva, junto con sus movimientos,
   mantenimientos y préstamos. Esto no se puede deshacer.

---

## 6. Escanear un equipo

El módulo **Escanear** apunta la cámara al código de barras de la etiqueta. También sirve
para escribir a mano el número de serie si la etiqueta está estropeada.

Tiene dos modos:

- **Consultar equipo**: muestra la ficha rápida de lo que escaneas.
- **Armar evento**: escaneo continuo para llenar la lista de un evento en borrador.

Cuando encuentra el equipo verás su estado, su ubicación, su condición y su observación,
y desde ahí puedes:

- **Cambiar estado** a *Operativo*, *Mantenimiento* o *Dañado*.
- **Agregar al carrito de traslado**, para moverlo después desde Movimientos.
- **Agregar a evento**, si estás armando uno.
- **Ver ficha completa**, **Editar** o **Escanear otro**.

Si no reconoce el código verás *No se encontró ningún equipo*, con la opción de
**Escanear de nuevo** o **Buscar en inventario**. Los códigos QR antiguos siguen
funcionando.

---

## 7. Movimientos: trasladar equipos

Un movimiento registra que un equipo cambió de sitio o de estado. Es lo que mantiene el
inventario diciendo la verdad sobre dónde está cada cosa.

Hay cuatro tipos: **Entrada**, **Salida**, **Traslado** y **Cambio estado**.

### Trasladar equipos paso a paso

1. **Junta los equipos.** Desde **Inventario** o desde **Escanear**, añade cada equipo al
   carrito. Verás el aviso *Agregado al carrito de traslado*.
2. **Ve a Movimientos.** Arriba aparece **Equipos para trasladar** con la cuenta. Puedes
   quitar los que sobren o vaciar el carrito.
3. **Describe el movimiento** en *Registrar traslado en página*:
   - **Tipo**: normalmente *Traslado*.
   - **Razón**: obligatoria. Escribe algo que se entienda dentro de seis meses, por
     ejemplo «Traslado a auditorio para evento del domingo».
   - **Hasta**: el lugar de destino.
4. Pulsa **Registrar para N equipo(s)**.
5. **Confirma con tu PIN o tu huella.** Solo entonces se aplica el cambio de ubicación.

Si cancelas la confirmación, no se registra nada.

### Autorizar los traslados pendientes

Los traslados que llegan desde un evento quedan esperando aprobación en **Pendientes de
autorización**. Mientras estén ahí, la ubicación del equipo **no** ha cambiado.

- **Autorizar** aplica el traslado y actualiza la ubicación.
- **Rechazar** lo descarta; el evento podrá volver a enviarlo.
- **Autorizar todos** resuelve la lista completa con una sola confirmación.

En ambos casos hay que confirmar con PIN o biometría. Si dos personas autorizan lo mismo
a la vez, la segunda recibe un aviso de que ya estaba resuelto en lugar de aplicarlo dos
veces.

### Traslados masivos con Excel

Para mover muchos equipos a la vez: **Plantilla traslados** (o **Descargar plantilla con
carrito**, que la trae ya rellena con lo que tengas en el carrito), completas el archivo,
**Importar traslados**, revisas la validación y confirmas. La confirmación con PIN se
pide una sola vez para todo el archivo.

### Historial

Abajo está el **Historial de movimientos**, filtrable por fechas y por tipo. Es la
respuesta a «¿quién movió esto y cuándo?». Borrar una línea del historial no cambia la
ubicación actual del equipo.

---

## 8. Eventos: sacar equipos y traerlos de vuelta

Un evento es la lista de equipos que salen para una actividad —un culto, una grabación,
un concierto fuera— con un control de salida y otro de regreso. Sirve para que no se
quede nada olvidado.

Un evento pasa por cuatro estados: **Borrador**, **En curso**, **Completado** y
**Cancelado**. Y mientras está en curso tiene dos fases: primero la **Salida** y después
la **Devolución**.

### Paso 1: crear el evento

1. En **Eventos**, pulsa **Nuevo evento**.
2. Escribe el **Nombre del evento** y la **Fecha y hora**.
3. Indica el **Origen**, el lugar de donde salen los equipos.
4. Elige el **Destino**:
   - **Lugar habitual**, si es uno de los sitios registrados.
   - **Lugar temporal**, para escribir a mano un sitio de una sola vez, como un teatro
     alquilado. No hace falta darlo de alta en el sistema.
5. Pulsa **Crear evento**. Queda en **Borrador**.

### Paso 2: armar la lista

Con el evento en borrador, añade los equipos escaneándolos uno tras otro, o búscalos a
mano si no tienes la etiqueta a la vista.

Puedes organizar el evento en varias **listas** —por ejemplo «Escenario», «Cabina»,
«Cables»— con **Nueva lista**, personalizada o generada por categoría. Es lo que hace
manejable un evento de doscientos equipos.

### Paso 3: activar

Cuando la lista esté completa, pulsa **Activar evento**. Verás *Evento activado — ya
pueden escanear*. Desde ese momento el evento está **En curso**, en fase de **Salida**.

### Paso 4: checklist de salida

Al cargar los equipos, cada persona escanea lo que va metiendo. La pantalla muestra el
avance (**verificados** sobre el total y el porcentaje) y avisa si un equipo ya se había
escaneado.

Cuando el checklist esté completo, pulsa **Enviar lista a Movimientos** (o **Enviar todo
a Movimientos**). Los traslados quedan **pendientes de autorización**: el responsable los
aprueba desde Movimientos y ahí es cuando los equipos cambian de ubicación.

### Paso 5: checklist de devolución

Cuando todas las salidas estén autorizadas, aparece **Iniciar devolución (checklist de
regreso)**. A partir de ahí se escanea cada equipo que vuelve y verás *Retorno
verificado* por cada uno.

Al terminar, **Enviar devolución completa a Movimientos**. Con la última autorización el
evento pasa a **Completado**.

### Si algo no volvió

Si quedaron equipos en el lugar del evento, el sistema los muestra en un panel aparte:
**Equipos aún en...**, con la opción de **Devolver todos** al origen o devolverlos uno a
uno. Así el inventario no se queda diciendo que un equipo sigue en un sitio donde ya no
está.

> Solo un administrador puede borrar un evento, y no se puede borrar mientras esté en
> curso.

---

## 9. Mantenimientos

Registra las revisiones y reparaciones. Los tipos son **preventivo**, **correctivo** y
**calibración**, y cada registro pasa por **Programado**, **En progreso** y
**Completado**.

Para uno suelto, **Agregar mantenimiento** y rellenas el formulario.

Para enviar varios equipos a mantenimiento a la vez está el circuito con Excel:

1. **Plantilla** → rellenas los equipos que entran a mantenimiento → **Importar**. Los
   equipos quedan **En mantenimiento**.
2. Cuando el trabajo termine, **Reporte datos** te descarga los registros en curso para
   que anotes el costo y el técnico.
3. **Cargar datos** sube ese archivo y actualiza todo de una vez.

---

## 10. Préstamos

Para cuando un equipo sale con una persona concreta y hay que reclamarlo.

1. Pulsa **Agregar préstamo**.
2. Elige el **Equipo** (los que ya están prestados no aparecen).
3. Anota el **Prestatario**, su email y su teléfono, y el **Propósito**.
4. Indica la **Fecha préstamo** y la **Devolución esperada**.

El equipo queda **En préstamo**. Cuando lo traigan, pulsa **Marcar devuelto** y volverá a
estar operativo.

Los préstamos pasados de fecha se marcan como **Vencido** y entran en las alertas y en el
resumen por correo, así que no hace falta ir a buscarlos.

---

## 11. Gastos y presupuestos

**Gastos** guarda lo que se paga: compras de equipo, reparaciones, mantenimientos,
accesorios, alquileres y servicios. Puedes registrar el importe en COP o USD y adjuntar
el comprobante en PDF o imagen.

En la misma pantalla está el **Valor del inventario**, con el valor de compra, el valor en
libros y la depreciación acumulada.

**Presupuestos** te deja fijar cuánto hay previsto gastar por categoría y periodo. La
aplicación va mostrando lo **Gastado**, el porcentaje usado y lo **Disponible**, o avisa
si está **Excedido**.

Ambos módulos requieren el permiso de finanzas, y los importes solo se ven con el permiso
de precios.

---

## 12. Reportes

Desde **Reportes** puedes descargar:

| Reporte | Formatos | Se puede filtrar por |
| --- | --- | --- |
| **Historial de movimientos** | Excel y PDF | Fechas, tipo y responsable |
| **Inventario** | Excel y PDF | Categoría, lugar y evento |
| **Mantenimientos** | Excel | Rango de fechas |
| **Préstamos** | Excel | Rango de fechas |

Descargar requiere el permiso **Exportar reportes**; sin él verás el módulo pero no
podrás bajar los archivos.

---

## 13. Alertas y notificaciones

La **campana** de la barra superior reúne lo que necesita atención:

- **Garantía por vencer** y **Garantía vencida**.
- **Préstamo vencido**.
- **Mantenimiento pendiente** y **Mantenimiento en progreso**.
- **Condición baja**, cuando un equipo baja del 40 %.

Pulsando un aviso vas directo al equipo o al registro que lo provocó.

Además, un administrador puede configurar en **Configuración** una lista de
**Destinatarios de alertas** que reciben el resumen por correo, y probarlo con **Enviar
prueba** o **Enviar resumen de alertas**.

---

## 14. Categorías y lugares

**Categorías** organiza los equipos en un árbol: puedes tener «Micrófonos» y dentro
«Inalámbricos» y «De condensador». Es lo que ordena los filtros, las gráficas del
dashboard y los reportes.

**Lugares** son las ubicaciones físicas. Vienen seis por defecto —**Auditorio
principal**, **Estudio de grabación**, **Cuarto de almacenamiento**, **Salón de
jóvenes**, **Capilla** y **En préstamo**— y puedes añadir las que necesites. Solo un
administrador o un gestor puede editarlas.

Para un sitio de una sola vez no crees un lugar: usa la opción **Lugar temporal** al
crear el evento.

---

## 15. Usuarios (solo administradores)

En **Usuarios** se crean las cuentas y se decide qué puede hacer cada una.

Para crear una: nombre, email, contraseña (mínimo 6 caracteres) y rol. El rol ya trae
unos permisos razonables; desde ahí puedes marcar o desmarcar los que quieras para esa
persona.

Para cambiarle la contraseña a alguien, edita su usuario y escribe la nueva en **Nueva
contraseña**. Si dejas el campo vacío, la contraseña no se toca. El icono del ojo te deja
comprobar lo que has escrito antes de guardar.

Dos reglas de seguridad que conviene conocer:

- Solo un administrador puede dar el rol de administrador o editar una cuenta que ya lo
  tenga.
- Nadie puede concederle a otro un permiso que él mismo no tenga.

---

## 16. Configuración y auditoría

**Configuración** (solo administradores) tiene los ajustes del envío de correo y la lista
de destinatarios de las alertas.

**Auditoría** (administradores y gestores) registra quién creó, actualizó o eliminó cada
cosa, quién inició sesión y quién cambió un estado. Cuando aparece una diferencia entre
lo que dice el sistema y lo que hay en la bodega, es el primer sitio donde mirar.

---

## 17. Problemas frecuentes

**No puedo autorizar un traslado.** Te falta configurar el PIN o la biometría. Ve a
**Seguridad**. Si el módulo dice que no tienes permiso, necesitas **Registrar
movimientos**.

**La aplicación me pide el PIN otra vez.** La autorización caduca a los 3 minutos. Es
normal.

**Dice «Este dispositivo no soporta biometría».** El navegador o el equipo no tienen
WebAuthn, o la dirección no es HTTPS. Usa el PIN.

**Trasladé un equipo y sigue apareciendo en el sitio anterior.** Lo más probable es que
el movimiento esté esperando autorización. Míralo en **Movimientos**, en *Pendientes de
autorización*.

**No veo los precios.** Necesitas el permiso **Ver precios y costos**.

**No me deja crear un evento.** Necesitas **Gestionar eventos**. Si te lo acaban de dar,
cierra sesión y vuelve a entrar.

**La cámara no arranca.** Da permiso de cámara al navegador, comprueba que la dirección
sea `https://` y que ninguna otra aplicación esté usando la cámara.

**El escáner no lee la etiqueta.** Limpia la etiqueta, mejora la luz y mantén el código
dentro del recuadro. Si está muy dañada, escribe el número de serie a mano en el buscador
del inventario.

**La importación de Excel falla.** Revisa que las categorías, los estados y los lugares
estén escritos como en la hoja **Valores validos** de la plantilla, y que el archivo no
pase de 5 MB. La pantalla de validación te dice qué fila tiene el problema.

**Borré un equipo por error.** Está en la **Papelera**: pulsa **Restaurar**.

**La primera carga del día tarda mucho.** El servidor se duerme cuando nadie lo usa y la
primera petición lo despierta. Puede tardar de 30 a 60 segundos, solo esa vez.

---

## 18. Límites del sistema

| Qué | Límite |
| --- | --- |
| Fotos por equipo | 5, en JPG, PNG o WebP, de 5 MB cada una |
| Archivos de Excel | 5 MB |
| Equipos por operación masiva | 500 |
| Traslados por importación | 500 |
| Etiquetas en un PDF | 500 |
| Texto de la observación | 500 caracteres |
| Condición | Un número entero del 0 al 100 |
| PIN | De 4 a 6 dígitos |
| Duración de la autorización | 3 minutos |
| Contraseña | Mínimo 6 caracteres |
| Filas por reporte | 20.000 |

---

## Recomendaciones de uso

Cuatro costumbres que evitan la mayoría de los líos:

1. **Pon el número de serie desde el principio.** Es lo que se imprime en la etiqueta y
   lo que se escanea; sin él, todo se vuelve más lento.
2. **Escribe razones que se entiendan solas.** «Traslado a auditorio para el evento del
   domingo» sirve dentro de un año; «traslado» no.
3. **Usa las observaciones en cuanto notes algo raro.** Revisar el filtro **Con
   observación** una vez por semana es lo que evita que un equipo llegue dañado a un
   evento.
4. **Cierra los eventos.** Un evento que se queda a medias deja equipos en un sitio donde
   ya no están y el inventario deja de ser fiable.
