/*
 * IG Cleanup — slow, careful mass-unfollow for YOUR OWN account.
 *
 * HOW TO USE
 *  1. Open instagram.com in a desktop browser, logged in. Stay on the tab.
 *  2. Open DevTools -> Console. (Chrome may make you type "allow pasting" first.)
 *  3. Paste this whole file, hit Enter.
 *  4. Run commands below one at a time.
 *
 * COMMANDS
 *  await IGCleanup.scan()            // pulls your following + followers (slow on purpose)
 *  IGCleanup.export()                // downloads following.csv so you can eyeball it
 *  IGCleanup.mode('nonfollowers')    // default: queue = people who DON'T follow you back
 *  IGCleanup.mode('all')             // queue = everyone you follow (minus keeps)
 *  IGCleanup.only(['spam1','spam2']) // queue = ONLY these usernames (hand-picked slop list)
 *  IGCleanup.keep(['bestfriend'])    // never unfollow these
 *  IGCleanup.keepVerified(true)      // never unfollow verified accounts (default false)
 *  IGCleanup.preview()               // shows who would be unfollowed, touches nothing
 *  await IGCleanup.run({max: 100})   // unfollow up to 100 this session, then stop
 *  IGCleanup.stop()                  // abort a running run()
 *  IGCleanup.stats()                 // progress
 *
 * State lives in localStorage so you can come back tomorrow and keep going.
 * It bails instantly on any rate-limit / action-block response. Don't fight that,
 * just wait a day.
 */
(() => {
  const LS = 'igcleanup_v1';
  const APP_ID = '936619743392459';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const cookie = (n) => (document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')) || [])[1];

  const load = () => {
    try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; }
  };
  const save = () => localStorage.setItem(LS, JSON.stringify(S));
  const S = Object.assign(
    { following: [], followers: [], done: [], keep: [], only: null, mode: 'nonfollowers', keepVerified: false },
    load()
  );
  let aborted = false;

  const headers = () => ({
    'x-csrftoken': cookie('csrftoken'),
    'x-ig-app-id': APP_ID,
    'x-requested-with': 'XMLHttpRequest',
    'x-asbd-id': '129477',
  });

  async function api(path, method = 'GET') {
    const res = await fetch(path, {
      method,
      credentials: 'include',
      headers: method === 'POST'
        ? { ...headers(), 'content-type': 'application/x-www-form-urlencoded' }
        : headers(),
      body: method === 'POST' ? '' : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status, json };
  }

  async function pull(kind) {
    const uid = cookie('ds_user_id');
    if (!uid) throw new Error('Not logged in (no ds_user_id cookie). Open instagram.com first.');
    const out = [];
    let maxId = '';
    let page = 0;
    while (true) {
      const q = `/api/v1/friendships/${uid}/${kind}/?count=100${maxId ? '&max_id=' + maxId : ''}`;
      const { status, json } = await api(q);
      if (status === 429 || !json || json.status === 'fail') {
        console.warn(`[scan] ${kind}: stopped at ${out.length} (status ${status}). Wait a bit and re-run scan().`);
        break;
      }
      for (const u of json.users || []) {
        out.push({ pk: String(u.pk), username: u.username, name: u.full_name || '', verified: !!u.is_verified, private: !!u.is_private });
      }
      page++;
      console.log(`[scan] ${kind}: ${out.length}`);
      if (!json.next_max_id) return out;
      maxId = json.next_max_id;
      await sleep(rand(2500, 5000));
    }
    return out;
  }

  function queue() {
    const followerSet = new Set(S.followers.map((u) => u.pk));
    const keep = new Set(S.keep.map((s) => s.toLowerCase()));
    const done = new Set(S.done);
    const only = S.only ? new Set(S.only.map((s) => s.toLowerCase())) : null;
    return S.following.filter((u) => {
      if (done.has(u.pk)) return false;
      if (keep.has(u.username.toLowerCase())) return false;
      if (S.keepVerified && u.verified) return false;
      if (only) return only.has(u.username.toLowerCase());
      if (S.mode === 'nonfollowers') return !followerSet.has(u.pk);
      return true; // 'all'
    });
  }

  const IGCleanup = {
    async scan() {
      S.following = await pull('following');
      await sleep(rand(4000, 8000));
      S.followers = await pull('followers');
      save();
      console.log(`[scan] done. following=${S.following.length} followers=${S.followers.length}`);
      console.log(`Queue right now (${S.mode}): ${queue().length}`);
    },
    export() {
      const fset = new Set(S.followers.map((u) => u.pk));
      const rows = [['username', 'full_name', 'verified', 'private', 'follows_you']].concat(
        S.following.map((u) => [u.username, u.name.replace(/"/g, '""'), u.verified, u.private, fset.has(u.pk)])
      );
      const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'following.csv';
      a.click();
    },
    mode(m) { S.mode = m; S.only = null; save(); console.log(`mode=${m}, queue=${queue().length}`); },
    only(list) { S.only = list; save(); console.log(`only-list set, queue=${queue().length}`); },
    keep(list) { S.keep = [...new Set(S.keep.concat(list))]; save(); console.log(`keeping ${S.keep.length}, queue=${queue().length}`); },
    keepVerified(b) { S.keepVerified = !!b; save(); console.log(`keepVerified=${S.keepVerified}, queue=${queue().length}`); },
    preview() {
      const q = queue();
      console.table(q.slice(0, 300).map((u) => ({ username: u.username, name: u.name, verified: u.verified })));
      console.log(`${q.length} would be unfollowed.`);
    },
    stats() {
      console.log({ following: S.following.length, followers: S.followers.length, unfollowed_so_far: S.done.length, queue: queue().length, mode: S.mode });
    },
    stop() { aborted = true; console.log('stopping after current action...'); },
    async run({ max = 100, minDelay = 25, maxDelay = 60 } = {}) {
      aborted = false;
      const q = queue().slice(0, max);
      if (!q.length) return console.log('Queue empty. scan() first, or adjust mode/only/keep.');
      console.log(`Unfollowing ${q.length} accounts. Keep this tab open. ~${Math.round((q.length * (minDelay + maxDelay)) / 2 / 60)} min.`);
      let n = 0;
      for (const u of q) {
        if (aborted) break;
        const { status, json } = await api(`/api/v1/friendships/destroy/${u.pk}/`, 'POST');
        const msg = JSON.stringify(json || {}).toLowerCase();
        const blocked = status === 429 || status === 400 || status === 403 ||
          msg.includes('feedback_required') || msg.includes('action blocked') || msg.includes('try again later') || msg.includes('spam') ||
          (json && json.status === 'fail');
        if (blocked) {
          console.error(`[STOP] Instagram pushed back (status ${status}) on @${u.username}. Do NOT retry today. Come back in 24h and use a lower max.`);
          break;
        }
        S.done.push(u.pk);
        n++;
        save();
        console.log(`[${n}/${q.length}] unfollowed @${u.username}`);
        await sleep(rand(minDelay, maxDelay) * 1000);
        if (n % 10 === 0) {
          const long = rand(180, 360);
          console.log(`...cooldown ${Math.round(long)}s`);
          await sleep(long * 1000);
        }
      }
      console.log(`Done this session: ${n}. Remaining in queue: ${queue().length}`);
    },
  };

  window.IGCleanup = IGCleanup;
  console.log('IGCleanup loaded. Start with: await IGCleanup.scan()');
})();
