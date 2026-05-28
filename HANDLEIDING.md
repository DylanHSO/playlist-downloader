# Handleiding — Playlist Downloader lokaal draaien

Een lokale app om een lijst nummers als MP3 te downloaden via YouTube. Alles draait op je eigen laptop — geen cloud, geen account.

## Wat je nodig hebt

Een Windows-laptop met internet. De installatie regelt verder alles zelf (ook de YouTube-downloader en ffmpeg — niks handmatig).

---

## Eerste keer installeren (~5 minuten)

### Stap 1 — Node.js installeren

1. Ga naar **https://nodejs.org/**
2. Klik op de groene knop met **"LTS"** (de aanbevolen, stabiele versie)
3. Open het gedownloade `.msi`-bestand en klik telkens "Next" tot 'ie klaar is. Alle standaardinstellingen kunnen zo blijven.
4. **Herstart je laptop** na de installatie (anders herkent Windows `npm` nog niet)

### Stap 2 — De app downloaden

1. Ga naar **https://github.com/DylanHSO/playlist-downloader**
2. Klik op de groene knop **`<> Code`**
3. Klik **"Download ZIP"**
4. Pak de ZIP uit op een handige plek, bijv. `C:\Users\<jouwnaam>\playlist-downloader`

### Stap 3 — Eenmalig benodigdheden installeren

1. Open de uitgepakte map in Verkenner
2. Klik bovenaan in de **adresbalk** (waar het pad staat), typ `powershell` en druk **Enter** → er opent een blauw terminal-venster
3. In dat venster, typ:
   ```
   npm install
   ```
   Druk Enter en wacht 1-2 minuten. De terminal downloadt alle benodigdheden. Klaar als je weer een lege regel ziet met je map-pad.

---

## App starten en gebruiken

### Starten

1. Open de app-map in Verkenner
2. Klik in de adresbalk → typ `powershell` → Enter
3. Typ:
   ```
   npm start
   ```
4. Je ziet: `Playlist Downloader → http://localhost:3000`
5. Open je browser en ga naar **http://localhost:3000**

### Nummers downloaden

1. Plak je lijst in het tekstvak, één regel per nummer als `Artiest - Nummer`. Bijvoorbeeld:
   ```
   Taylor Swift - Shake It Off
   Volbeat - Lola Montez
   Metallica - Nothing Else Matters
   ```
2. Klik op **"🔍 Zoek nummers"**
3. Per nummer kan je op **"⬇ MP3"** klikken, of in één keer op **"Download alles"**
4. De MP3's komen in je standaard **Downloads**-map van je browser

### Stoppen

Druk **Ctrl+C** in het PowerShell-venster, of sluit het venster gewoon. De app is dan uit.

---

## Iets werkt niet?

| Probleem | Oplossing |
|---|---|
| `npm is not recognized` | Node.js niet (correct) geïnstalleerd. Herstart de laptop na installatie. |
| `Cannot GET /api/file/...` in de browser | Een oude versie van de app draait nog. Sluit PowerShell, open opnieuw, `npm start`. |
| Browser zegt "Site can't be reached" | App draait niet meer — start opnieuw met `npm start`. |
| YouTube vindt een nummer niet | Probeer een specifiekere zoekterm, bijv. `Artiest - Nummer (Official Audio)`. |
| "Sign in to confirm you're not a bot" | YouTube vermoedt een bot. Stuur Dylan een berichtje, dan helpt 'ie met een cookie-bestand. |

Vragen? Stuur Dylan een berichtje.
