# TransfertPro

Gestion de transferts d'argent avec une équipe : un admin supervise, les employés enregistrent.
Le MAD est la devise mère ; chaque zone (GNF, XOF, XAF, EUR, USD) s'échange uniquement avec lui.

Next.js 16 · React 19 · Tailwind 4 · Supabase (Postgres, Auth).

## Rôles

| | Admin | Employé |
|---|---|---|
| Enregistrer un transfert | non | oui, dans sa zone |
| Modifier, supprimer | toujours | ses transferts, jusqu'à minuit, journée non clôturée |
| Voir | tout | ses transferts et son bénéfice |
| Comptes, zones, mots de passe, taux, crédits, mois, relevés | oui | non |

Les règles sont imposées par la base (RLS, fonctions et déclencheurs), pas seulement par l'écran.
« Supprimer » retire un transfert des comptes ; l'admin en garde la trace.

## Installation

1. `npm install`
2. Copier `.env.example` vers `.env.local` et renseigner les trois clés.
3. Exécuter une fois, dans l'ordre de leur nom, les scripts de `supabase/migrations`
   dans Supabase (SQL Editor). Ils supposent les tables d'origine `transactions`, `periodes`,
   `credits` et `remboursements`, ainsi que les fonctions `rembourser_credit` et
   `supprimer_remboursement`.
4. Dans Supabase (Authentication), désactiver « Allow new users to sign up ».
5. `npm run dev`

`SUPABASE_SECRET_KEY` contourne toutes les règles d'accès : uniquement côté serveur, jamais avec
le préfixe `NEXT_PUBLIC_`, jamais dans Git.

## Vérifications

```bash
npx next typegen && npx tsc --noEmit
npm run lint
npm run build
```
