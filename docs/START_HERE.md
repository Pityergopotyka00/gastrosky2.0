# GastroSky 2.0 — fejlesztői útmutató

Ez a repository a **különálló GastroSky 2.0 prototípus**. A gastrosky.hu élő oldalhoz nem nyúl.

## Jelenlegi állapot
- A React nélküli Vite katalógus prototípus elkészült.
- A `data/supplier-products.json` 12, hivatalos gyártói termékoldal alapján azonosított Maxima és HENDI mintaterméket tartalmaz, cikkszámmal és EAN-nel.
- A katalógus név, kategória, gyártó, cikkszám és EAN alapján kereshető.
- **Nincs készletkezelés, készletszinkron, ár vagy online fizetés.**
- **Nincs éles Cloudflare-deploy**, a kód futtatását még ellenőrizni kell.

## Futtatás
Node.js 20+:

```bash
npm install
npm run dev
```

Az építés ellenőrzése:

```bash
npm run build
```

## Adatimport
A `scripts/import-existing.mjs` egy előzetes, nem teljes körű importáló. Csak az oldaltulajdonos engedélyével futtassuk. Nem bizonyított, hogy az összes meglévő oldalt be tudja gyűjteni. A teljes átálláshoz ajánlott a jelenlegi weboldal adatbázis-exportja vagy termék-CSV-je.

Maxima és HENDI teljes katalógushoz beszállítói partner-feed vagy licencelt export szükséges. Ne másoljunk automatikusan képeket, árakat vagy hosszú gyártói leírásokat engedély nélkül.

A mostani termékleírások rövid, saját megfogalmazású összefoglalók. A forrásoldal minden rekordban megtalálható.

## Ellenőrzőlista
- [x] GitHub projekt létrejött
- [x] Alap katalógus UI
- [x] Maxima + HENDI mintatermékek
- [x] Gyártó és cikkszám keresés
- [ ] Teljes GastroSky termékexport importja
- [ ] Teljes beszállítói katalógusimport
- [ ] Képhasználati jogosultságok / termékfotók
- [ ] Ajánlatkérő űrlap és értesítések
- [ ] Cloudflare D1 és teszt-deploy
- [ ] Ügyfél által ellenőrzött élesítés
