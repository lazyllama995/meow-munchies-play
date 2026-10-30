# Paquetes de arte del mundo

`manifest.json` asigna seis regiones y 60 capítulos a los niveles 1–600. Cada región tiene una textura de terreno para el mapa, un atlas de seis motivos y una pareja de fondo/primer plano general. Cada capítulo tiene su propio fondo y primer plano; el centro del primer plano queda transparente para el dragón. El mapa escoge tres motivos del atlas regional para cada capítulo.

Los PNG son los originales editables. Las copias WebP son los archivos que carga el juego y se incluyen en `dist/`; reducen la descarga en móvil sin cambiar la composición. Para sustituir un capítulo, actualiza los dos originales, vuelve a exportarlos a WebP y ejecuta `node scripts/generate-world-manifest.mjs` desde la raíz. Los capítulos 1–20 tienen niveles jugables; los 21–60 ya tienen arte y pedidos diseñados, pero sus niveles permanecen bloqueados hasta implementar sus tableros.

## Gameplay restaurado y publicación

El gameplay conserva el dragón actual `glow-dragon` y sus dos expresiones. Recupera el fondo `glow-background` y las rocas `glow-foreground` que lo acompañaban antes de integrar los paquetes por capítulo. Todos los paquetes nuevos de regiones y capítulos siguen conservados en el repositorio.

El build publica los fondos y primeros planos de capítulos solo hasta el nivel 200 (capítulos 1–20). El manifiesto publicado mantiene los nombres y el recorrido de los 600 niveles, y el mapa conserva las texturas y motivos regionales compartidos. Los fondos generales regionales y los paquetes de capítulos 21–60 quedan fuera de `dist/`; no se borran los originales.
