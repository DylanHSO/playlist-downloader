# Handleiding — Playlist Downloader

Een lokale app om een lijst nummers als MP3 te downloaden via YouTube. Alles draait op je eigen laptop — geen cloud, geen account.

Er zijn twee manieren om de app te gebruiken:

- **Voor gebruikers** — installeer de kant-en-klare app (`.exe`). Geen Node, geen Python, niks technisch.
- **Voor ontwikkelaars** — draai de broncode met Node, of bouw zelf een nieuwe `.exe`.

---

## Voor gebruikers — de app installeren

### Installeren (1 minuut)

1. Vraag Dylan om het installatiebestand **`Playlist Downloader Setup x.x.x.exe`** (of download het van de afgesproken plek).
2. Dubbelklik het bestand.
3. Krijg je een blauw **"Windows heeft je pc beschermd"**-scherm (SmartScreen)? Dat komt omdat de app niet ondertekend is. Klik **"Meer informatie"** → **"Toch uitvoeren"**.
4. Kies eventueel een installatiemap en klik **Installeren**. Klaar — er staat nu een snelkoppeling **Playlist Downloader** in je Startmenu en op je bureaublad.

### Gebruiken

1. Open **Playlist Downloader** (Startmenu of bureaublad). Er opent één venster — geen browser nodig.
2. Plak je lijst in het tekstvak, één regel per nummer als `Artiest - Nummer`. Bijvoorbeeld:
   ```
   Taylor Swift - Shake It Off
   Volbeat - Lola Montez
   Metallica - Nothing Else Matters
   ```
   Je kunt ook een `.txt`-bestand in het tekstvak slepen.
3. Klik op **🔍 Zoek nummer(s)**.
4. Kies je kwaliteit (bitrate) en of je alles als één **ZIP** wil. Klik per nummer op **⬇ MP3**, of in één keer op **Download alles**.
5. Windows vraagt waar je het bestand wil opslaan.

Naast de songs-lijst zijn er tabs voor een heel **kanaal**, een **album** (tracklist via Discogs) en een **YouTube-playlist**.

### Album-tab aanzetten (Discogs-token)

De Album-tab haalt tracklists op via de Discogs API. Dat vereist een gratis, persoonlijke token:

1. Maak een gratis account op **https://www.discogs.com/** (als je die nog niet hebt).
2. Ga naar **https://www.discogs.com/settings/developers** → **"Generate new token"** en kopieer de reeks.
3. Klik in de app rechtsboven op **⚙️** (Instellingen), plak je token en klik **Opslaan**.

De token wordt lokaal op jouw computer bewaard en blijft bewaard na updates. Zonder token werken de songs-, kanaal- en playlist-tabs gewoon; alleen de Album-tab geeft dan een nette melding.

---

## Voor ontwikkelaars

### Broncode draaien

Vereist **Node.js 18+** (https://nodejs.org/, LTS).

```
npm install
npm start
```

Open daarna **http://localhost:3000** in je browser. In deze modus kun je de Discogs-token ook via een `.env`-bestand zetten (`DISCOGS_TOKEN=...`); die heeft dan voorrang en is niet via de ⚙️-instellingen te wijzigen.

### Een `.exe` bouwen

```
npm install
npm run dist
```

De NSIS-installer komt in de map **`dist/`** te staan (`Playlist Downloader Setup x.x.x.exe`). yt-dlp en ffmpeg worden automatisch meegebundeld — de eindgebruiker hoeft niets extra's te installeren.

> De build is niet code-signed; eindgebruikers krijgen daarom eenmalig een SmartScreen-melding (zie hierboven). Code signing kan later toegevoegd worden met een certificaat.
>
> In de build-config staat `signAndEditExecutable: false`. Dat slaat de `winCodeSign`/`rcedit`-stap over (die op Windows zonder Developer Mode of admin-rechten faalt op symlink-extractie). Gevolg: de app gebruikt voorlopig het standaard Electron-icoon. Wil je een eigen icoon? Zet een `build/icon.ico` neer, schakel `signAndEditExecutable` weer in en bouw vanuit een terminal met admin-rechten (of met Windows Developer Mode aan).

---

## Iets werkt niet?

| Probleem | Oplossing |
|---|---|
| "Windows heeft je pc beschermd" bij installeren | Normaal voor een niet-ondertekende app. Klik "Meer informatie" → "Toch uitvoeren". |
| De app opent niet / scherm blijft leeg | Sluit 'm volledig af (ook in de taakbalk) en start opnieuw. |
| YouTube vindt een nummer niet | Probeer een specifiekere zoekterm, bijv. `Artiest - Nummer (Official Audio)`. |
| "Sign in to confirm you're not a bot" | YouTube vermoedt een bot. Stuur Dylan een berichtje, dan helpt 'ie met een cookie-bestand. |
| "Discogs is niet geconfigureerd" | Token ontbreekt. Klik op ⚙️ en plak je Discogs-token (zie hierboven). |
| (ontwikkelaar) `Cannot find module ...` | Draai `npm install` opnieuw. |

Vragen? Stuur Dylan een berichtje.
