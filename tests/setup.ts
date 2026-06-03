import os from 'os';
import path from 'path';

// Isoleer de instellingen-opslag van de echte ~/.playlist-downloader-map en
// zorg dat geen .env-token uit de omgeving lekt in de tests. Deze setup draait
// vóór de test-modules (en dus vóór server/app.ts) worden geïmporteerd.
process.env.APP_CONFIG_DIR = path.join(os.tmpdir(), `pl-test-${process.pid}`);
// Wijs dotenv naar een niet-bestaand pad zodat een lokale .env (met evt. een
// echte DISCOGS_TOKEN) de tests niet beïnvloedt.
process.env.DOTENV_CONFIG_PATH = path.join(os.tmpdir(), `pl-test-no.env`);
delete process.env.DISCOGS_TOKEN;
delete process.env.APP_PASSWORD;
