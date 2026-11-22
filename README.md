# ig-cleanup

Slow, careful mass-unfollow for **your own** Instagram account. Runs entirely in your browser console while you're logged in. No passwords, no servers, nothing leaves your machine.

## Use

1. Open instagram.com (logged in), open DevTools -> Console.
2. Paste the contents of `ig-cleanup.js` (type `allow pasting` first if Chrome asks).
3. Run:

```js
await IGCleanup.scan()            // pull following + followers
IGCleanup.export()                // optional: download following.csv to review
IGCleanup.keep(['friend1'])       // protect people
IGCleanup.keepVerified(true)      // optional: never unfollow verified accounts
IGCleanup.preview()               // dry run, touches nothing
await IGCleanup.run({max: 100})   // unfollow up to 100, then stop
```

Modes: `IGCleanup.mode('nonfollowers')` (default), `IGCleanup.mode('all')`, or `IGCleanup.only(['spam1','spam2'])` for a hand-picked list.

Progress is saved in localStorage, so you can resume the next day.

## Disclaimer

This is automation, which is against Instagram's Terms of Use. Use at your own risk. It paces itself (25-60s between actions, cooldowns, stops on any rate-limit response), but accounts can still get temporarily action-blocked. Keep `max` low (~100/day). Instagram's internal endpoints change often, so it may break without notice. Not affiliated with Instagram or Meta.
