# Blob Jump: guía de despliegue para el agente

Proyecto: juego hipercasual para Telegram Mini App (bot: BlobbyJumpBot).
Entorno del usuario: Windows. El CLI de Turso se usa desde WSL; node, npm, git y wrangler pueden usarse en Windows.

## Reglas obligatorias
1. NUNCA imprimas, registres, copies a archivos ni subas a git tokens o secretos (token del bot, token de Turso, tokens de GitHub o Cloudflare). Tampoco .env ni .dev.vars.
2. Cuando un comando pida un secreto (`wrangler secret put`, logins), PARA y dile al usuario que lo escriba él mismo en la terminal.
3. Antes de cada comando que cree, publique o borre algo (base de datos, Worker, repositorio, push), muestra el comando y espera confirmación.
4. No modifiques la lógica del juego. Solo cambia las constantes y la etiqueta de Monetag indicadas abajo.
5. No instales dependencias distintas de `@libsql/client` y `wrangler`.
6. Si un paso falla, muestra el error resumido, di qué crees que pasó y pregunta. No improvises soluciones alternativas.

## Estructura
```
blob-jump/
  index.html           juego (versión Telegram, va en la raíz del repo)
  blob-jump-640x360.png imagen para BotFather
  backend/worker.js    API del ranking (Cloudflare Worker)
  backend/schema.sql   tabla de Turso
  backend/wrangler.toml
```

## Fase 0: requisitos
Comprueba `node -v`, `npm -v`, `git --version` y `wsl --status`. Si falta algo, explica cómo instalarlo y espera.

## Fase 1: base de datos Turso (en WSL)
```
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login                     # lo hace el usuario en el navegador
turso db create blobjump             # elige la región más cercana (turso db locations)
turso db show blobjump --url         # guarda esta URL (no es secreta)
turso db shell blobjump < backend/schema.sql
turso db shell blobjump "SELECT name FROM sqlite_master"   # debe listar la tabla scores
```
Para el token: el usuario ejecuta `turso db tokens create blobjump` y lo guarda él mismo. No lo leas.

## Fase 2: backend (carpeta backend)
```
npm init -y
npm i @libsql/client
npx wrangler login                   # lo hace el usuario
npx wrangler secret put TURSO_URL    # el usuario pega la URL de la fase 1
npx wrangler secret put TURSO_TOKEN  # el usuario pega el token
npx wrangler secret put BOT_TOKEN    # el usuario pega el token del bot (BotFather)
npx wrangler deploy                  # anota la URL https://blobjump-api.<cuenta>.workers.dev
```
Verificación (sustituye la URL):
- `curl <URL>/top` debe devolver `[]` o una lista JSON.
- `curl -X POST <URL>/score -d "{\"score\":10}"` debe devolver 403 (sin firma de Telegram es lo correcto).

## Fase 3: conectar el juego
En index.html existe esta línea:
`const API='',ADSGRAM_BLOCK='',MONETAG_ZONE='';`
Pon la URL del Worker (sin barra final) en `API`. Ejemplo: `const API='https://blobjump-api.xxx.workers.dev',...`.

## Fase 4: GitHub Pages
1. Crea un repositorio público `blob-jump` (con `gh repo create` si está instalado y con sesión; si no, que el usuario lo cree en la web).
2. `git init`, `git add .`, `git commit -m "Blob Jump"`, `git branch -M main`, añade el remoto y `git push -u origin main`.
3. Activa Pages: Settings > Pages > rama main, carpeta / (root). Espera 1–2 minutos.
4. Comprueba que `https://<usuario>.github.io/blob-jump/` abre el juego y dime esa URL.

## Fase 5: BotFather (lo hace el usuario en Telegram)
`/newapp`, elige BlobbyJumpBot y rellena:
- Título: Blob Jump
- Descripción: Un blob, un dedo y una torre infinita. Toca para cambiar de dirección, mantén para rebotar más alto y esquiva los pinchos. Parte rápida de 30 segundos, se reinicia al instante. ¿Cuántos metros puedes subir?
- Imagen: blob-jump-640x360.png (GIF: /empty)
- URL: la de la fase 4
- Nombre corto: blobjump
Opcional: /mybots > Bot Settings > Menu Button, con la misma URL.

## Fase 6: anuncios (opcional; el usuario aporta los datos)
- Adsgram: el usuario crea un bloque de tipo Reward en su panel de editor y te da el blockId. Ponlo en `ADSGRAM_BLOCK`.
- Monetag: el usuario copia su etiqueta `<script ... data-sdk="show_XXX">` y la pegas en el comentario marcado del `<head>`. Pon `XXX` (solo el número) en `MONETAG_ZONE`. Formato a activar: Rewarded Interstitial.
- Con ambos vacíos el juego usa un anuncio de prueba de 2,5 s.
- Haz commit y push después de cada cambio.

## Fase 7: pruebas (las hace el usuario en Telegram)
Abrir el enlace t.me/BlobbyJumpBot/blobjump desde el móvil y comprobar:
- Pantalla completa y sin cierre al deslizar hacia abajo.
- Se puede jugar, morir y reiniciar con un toque.
- Revivir (máx. 2) y escudo inicial funcionan.
- Tras una partida, el ranking muestra el nombre y el puntaje del usuario.
Si Telegram muestra una versión vieja, añade `?v=2` a la URL en BotFather.

## Pendiente conocido
- El Worker no limita partidas por minuto; el tope de 3000 m en worker.js es provisional.
- Las recompensas de anuncios se conceden en el cliente (no hay postback del servidor).
