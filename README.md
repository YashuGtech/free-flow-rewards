# Premium Access

Run This latest app with all previous fixs you made for previous app don't show ads for premium user



Remaining work from your request:

- Admin add-balance not crediting the wallet: the transaction row is written but the user's balance isn't recomputed on their device — needs the credit to flow through the ledger/refresh path in the store.

- Page gating: keep 4 free clicks, then auto-show ads (already partly in place; needs verification against the current build).

- Apply-to-ad flow: add a "Buy Premium or Watch Ad" choice before applying to a task, skipped entirely for premium users.

- Free-user posting limit: max 4 posts per day, unlimited for premium.

- Premium plans: verify purchase, expiry, and ad-free behaviour end to end.

- make sure test app before you launch connect with real Database check full f



eatures

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://free-flow-rewards.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/97c3e965-ef1e-4619-8926-25722d6f7402).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
