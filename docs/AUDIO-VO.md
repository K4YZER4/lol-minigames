# Voces de campeones

El extractor genera 5 clips `es_MX` por campeón en:

```text
apps/web/public/audio/vo/es-mx/<Champion>/01.ogg
```

Los clips no se incluyen en Git; `.gitignore` mantiene los archivos locales y solo permite versionar el manifiesto.

## Regenerar

El script requiere `wadtools`, `vgmstream-cli` y `ffmpeg`. Se pueden indicar sus rutas mediante `WADTOOLS`, `VGMSTREAM`, `FFMPEG` y `FFPROBE`; la instalación de LoL mediante `LOL_CHAMPIONS_DIR`.

```powershell
$env:WADTOOLS = "C:\ruta\wadtools.exe"
$env:VGMSTREAM = "C:\ruta\vgmstream-cli.exe"
$env:FFMPEG = "C:\ruta\ffmpeg.exe"
$env:FFPROBE = "C:\ruta\ffprobe.exe"
npm run extract:vo
```

La salida usa Opus mono a 24 kbps para reducir el tamaño. El catálogo local está pensado para uso privado con los archivos de la instalación del usuario.
