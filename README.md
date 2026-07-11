# 🍺 Domaslavská olympiáda 2026

Malá webovka na akci „hospodská olympiáda" - živý žebříček týmů (hospodský pětiboj,
tajné mise, pub kvíz) a heslem chráněný admin na zadávání bodů.

Postavené na **Cloudflare Workers + D1** (SQLite na edge, zdarma). Doména: **olympiada.mmaxa.cz**.

## Bodování

| Část              | Max    | Jak                                                              |
| ----------------- | ------ | ---------------------------------------------------------------- |
| Hospodský pětiboj | 15     | 5 disciplín, umístění 1./2./3./4. = 3/2/1/0 b                    |
| Tajné mise        | 15     | 0–3 splněné mise × 5 b                                           |
| Pub kvíz          | 15     | 0–15 b (1 b/otázka)                                              |
| **Celkem**        | **45** | při shodě rozhoduje rozstřelová otázka (nejbližší číselný odhad) |

## Struktura

- `src/index.ts` - Worker (Hono): veřejné `/api/leaderboard` + chráněné `/api/admin/*`.
- `public/` - `index.html` (žebříček), `admin.html` (zadávání), styly a JS.
- `migrations/` - SQL schéma D1.
- `.github/workflows/deploy.yml` - auto-deploy při pushi do `main`.

## Jednorázové nastavení

Provádí se jen jednou (potřebuješ účet Cloudflare a zónu `mmaxa.cz` v něm).

```bash
npm install
npx wrangler login                       # přihlášení do Cloudflare

# 1) vytvoř D1 databázi a zkopíruj database_id do wrangler.toml
npx wrangler d1 create olympiada

# 2) nastav admin heslo (Worker secret)
npx wrangler secret put ADMIN_PASSWORD

# 3) první deploy + migrace (dál už jede přes GitHub Actions)
npm run db:migrate
npm run deploy
```

### GitHub Actions (automatický deploy)

V GitHubu → **Settings → Secrets and variables → Actions** přidej:

- `CLOUDFLARE_API_TOKEN` - token s oprávněním _Edit Workers_ + _D1 edit_ (Account → API Tokens).
- `CLOUDFLARE_ACCOUNT_ID` - ID účtu (v Cloudflare dashboardu).

Poté každý `git push` do `main` spustí migrace i deploy.

## Lokální vývoj

```bash
npm install
npm run db:migrate:local     # připraví lokální SQLite
npm run dev                  # http://localhost:8787
```

Admin je na `/admin`. V lokálním dev nastav heslo přes soubor `.dev.vars`:

```
ADMIN_PASSWORD=tajneheslo
```

## Použití na akci

1. V adminu pojmenuj akci a 5 disciplín pětiboje, zadej správnou odpověď rozstřelu.
2. Přidej týmy.
3. Průběžně zadávej body - žebříček na `/` se sám obnovuje každých 5 s.
