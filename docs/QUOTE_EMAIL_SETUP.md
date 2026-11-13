# GastroSky 2.0 — éles ajánlatkérő e-mail beállítása

A weboldal API-ja készen áll az ajánlatkérések fogadására a Cloudflare Workerben. **Az e-mailküldés nem működik addig, amíg a küldő domain nincs hitelesítve és a szükséges titkok nincsenek beállítva.** A rendszer ezalatt a látogatóknak egy `mailto:` alapú, ellenőrizhető alternatívát mutat.

## 1. E-mail szolgáltató
1. Hozz létre egy [Resend](https://resend.com) fiókot a vállalkozás jogosult üzemeltetőjeként.
2. Hitelesítsd az általad ellenőrzött küldő domaint (DNS rekordokkal).
3. Készíts API-kulcsot a levelek küldéséhez.

## 2. Cloudflare Worker titkok
A `gastrosky2-0` Workernél a következő környezeti változókat állítsd be:
- `RESEND_API_KEY`: Resend API-kulcs, **secret**.
- `QUOTE_FROM_EMAIL`: a Resendben ellenőrzött domainhez tartozó küldő cím, pl. `GastroSky <ajanlat@a-hitelesitett-domain.hu>`.
- `QUOTE_TO_EMAIL`: a valóban használt vállalkozási postaláda, ahová az ajánlatkérések mennek.
- `TURNSTILE_SITE_KEY`: Cloudflare Turnstile widget publikus site key.
- `TURNSTILE_SECRET_KEY`: Cloudflare Turnstile titkos kulcs, **secret**.

Az adatokat kizárólag a Cloudflare Worker környezeti változóiban / secretjeiben tárold, soha ne GitHub fájlban vagy a weboldal HTML-kódjában.

A Turnstile widgetben a GastroSky 2.0 publikus hosztnevét add meg. Amíg a konfiguráció hiányos, a `GET /api/quote-config` válaszban `enabled: false` lesz, a böngésző pedig csak az e-mail-alkalmazásos küldést kínálja.

## 3. Teszt
- Nyisd meg a preview weboldalt, adj legalább egy terméket az ajánlatkérő listához.
- Írd be a tesztnevet, válaszcímet, üzenetet és oldd meg a Turnstile ellenőrzést.
- Kattints **Ajánlatkérés elküldése**.
- Ellenőrizd, hogy a megadott vállalkozási postaláda ténylegesen megkapta-e a levelet.
- Ellenőrizd, hogy a válasz gomb az ajánlatkérő e-mail címére válaszol-e.
- Ellenőrizd a hibás e-mail, üres terméklista és sikertelen Turnstile esetén megjelenő hibaüzeneteket.
- Ellenőrizd, hogy hiányzó API kulccsal a weboldal nem állítja, hogy a levelet elküldte.

Az API csak a jelenlegi katalógusban szereplő, érvényes termékazonosítókat fogad el, maximum 40 termékkel. Az ügyfél e-mail címét kizárólag reply-to-ként kezeli. A secretet sosem adja ki a böngészőnek.

## 4. Adatkezelés
Mielőtt élesben fogadnád a neveket és e-mail címeket, ellenőrizd az adatkezelési tájékoztatót a vállalkozás valós adataival, a külső szolgáltató (Resend) kezelésével és a megőrzési szabályokkal. Ha szükséges, kérj jogi ellenőrzést.

## Fejlesztői korlát
Ez a rendszer Resend HTTP API-ra és Cloudflare Turnstile-ra épül. Az API-végpont és a front-end kód elkészült, de a fiók- és DNS-beállításokat a domain tulajdonosának kell elvégeznie. Az éles levélkézbesítés nincs igazolva, amíg a valós próba meg nem érkezik a vállalkozás postaládájába.
