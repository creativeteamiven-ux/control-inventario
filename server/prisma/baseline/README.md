# Baseline del esquema inicial

`0_init.sql` es el volcado del esquema con el que nació la base de datos. **No
es una migración activa**: vivía en `prisma/migrations/0_init/` y se sacó de ahí
porque el entorno de build de Render no conseguía leer ese archivo, lo que
rompía `prisma migrate deploy` con los errores P3017 y P3015.

Sacarlo no tiene efecto sobre producción: esas tablas ya existen en la base
desde antes de que hubiera migraciones versionadas, así que `0_init` nunca se
llegó a ejecutar ni estaba registrada en `_prisma_migrations`.

Se conserva aquí como referencia histórica y por si hiciera falta levantar una
base desde cero, en cuyo caso se puede aplicar a mano antes del primer
`prisma migrate deploy`.
