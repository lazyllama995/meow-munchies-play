# Región 1 · Diez escenas montadas

Abre index.html para ver los diez capítulos. El paquete conserva todos los PNG por separado.

## Montaje

- Fondos originales corregidos de region-01-fondos-originales-v3.
- Vegetación y decoración fija integradas en el fondo.
- Amigos y animales retirados del gameplay; sus sprites no se cargan.
- Globos y aspas en PNG independientes, con su movimiento suave de ambiente.
- Dragón existente del juego, capa delantera sutil, tablero e interfaz de referencia.
- La torre del molino ya está dibujada en el fondo. Se añade únicamente el rotor.

La página permite cambiar de capítulo, ocultar el gameplay para ver el ambiente, quitar la delantera y pausar el movimiento de globos y aspas.

Los globos flotan suavemente de forma continua. Las aspas completan una vuelta por minuto. El movimiento del ambiente se pausa al ocultar la pestaña, al pulsar «Pausar ambiente» o cuando el sistema solicita movimiento reducido.

## Archivos

- assembly-plan.json: colocación por capítulo.
- scene-data.js: datos de montaje y metadatos de los sprites.
- scenes.js: montaje, controles y movimiento del ambiente.
- scenes.bundle.js: versión autónoma para abrir index.html desde la carpeta descomprimida.
- scenes.css: capas y presentación.
- assets/: fondos, delanteras y sprites independientes, copiados intactos.
- manifest.json: trazabilidad, SHA-256 y posiciones.
- validation.json: comprobaciones de integridad de los assets.

Las posiciones usan porcentajes del lienzo vertical. El tamaño del ambiente se calcula a partir de su silueta, sin contar el margen transparente. El pivote pertenece al PNG completo.

Esta es una previsualización de montaje: el tablero y los controles reproducen la referencia visual.
