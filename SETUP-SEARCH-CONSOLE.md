# Setting up the Google Search Console sync (about 15 minutes)

The app reads your Search Console numbers through a Google "service account": a robot login that can only read. You do this once.

## 1. Google Cloud (console.cloud.google.com)
1. Create a project (any name, e.g. "RAPTR").
2. **APIs & Services > Library**, search for **Google Search Console API**, press **Enable**.
3. **IAM & Admin > Service Accounts > Create service account**. Name it e.g. `raptr-search`. Skip the optional role and user steps.
4. Open the new service account, go to **Keys > Add key > Create new key > JSON**. A file downloads. Keep it private.
5. Copy the service account's email (it ends in `.iam.gserviceaccount.com`).

> If step 4 says key creation is blocked by an organization policy (common on Google Workspace accounts), tell me. There's a different sign-in method I can build instead.

## 2. Search Console (search.google.com/search-console)
1. Pick your RAPTR site's property.
2. **Settings > Users and permissions > Add user**. Paste the service account email and choose **Restricted**. That's read-only, which is all it needs.
3. Note how your property is named. A domain property is written `sc-domain:raptrmysteries.com`. A URL-prefix property is the full address with the trailing slash, e.g. `https://www.raptrmysteries.com/`.

## 3. Vercel (your project > Settings > Environment Variables)
Add these four, for Production:

| Name | Value |
|---|---|
| `GSC_SERVICE_ACCOUNT_JSON` | Open the downloaded JSON file in a text editor, select everything, and paste it in |
| `GSC_SITE_URL` | The property name from step 2.3, exactly |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard > Project Settings > API Keys > the `service_role` (or "secret") key. Not the anon/publishable one |
| `CRON_SECRET` | Any long random string you make up (20+ characters) |

Keep these out of chat, email, and the app's code. They're only meant to live in Vercel.

## 4. Deploy and sync
1. Upload the new files to GitHub as usual. Vercel redeploys. (New environment variables only take effect on a new deployment.)
2. In the app, go to **Marketing > Search** and press **Sync now**. The first sync pulls the last 90 days. After that it refreshes itself every morning (about 7 am Eastern).
3. For each blog post, paste its published address into **Published blog post address**. Its keywords then fill in automatically.

## If the sync shows an error
The message on the Search tab says what's wrong, for example a missing variable, or "Search Console refused access" (the service account email wasn't added as a user, or `GSC_SITE_URL` doesn't match the property name).
