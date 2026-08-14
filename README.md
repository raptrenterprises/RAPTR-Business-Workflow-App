# RAPTR Ops

A shared Tasks, Threads, Calendar, and Gym-challenge app for Cathy and
Evan, backed by Supabase with real email/password login so both of you
see the same live data.

## 1. Create your Supabase project (~5 min)

1. Go to https://supabase.com and sign up (free tier is plenty).
2. Click **New project**. Pick a name, a region close to you, and set a
   database password (save it somewhere).
3. Wait ~2 minutes for the project to finish provisioning.

## 2. Create the database tables

1. In your Supabase project, open **SQL Editor** in the left sidebar.
2. Click **New query**, paste in the entire contents of `schema.sql`
   (in this folder), and click **Run**.
3. You should see "Success. No rows returned." — the `tasks`, `threads`,
   `events`, and `gym_challenges` tables now exist.

## 3. Create the two logins

1. In Supabase, go to **Authentication → Users** in the left sidebar.
2. Click **Add user → Create new user**.
3. Create the first account:
   - Email: `cathy@raptrmysteries.com`
   - Password: (set the one you two agreed on)
   - Check **Auto Confirm User** so it doesn't require email verification.
4. Repeat for the second account:
   - Email: `evan@raptrmysteries.com`
   - Password: (set the one you two agreed on)
   - Check **Auto Confirm User**.

These two exact emails are what the app maps to "Cathy" and "Evan" —
see `USER_DIRECTORY` in `src/constants.js` if you ever need to change
that mapping.

## 4. Get your API keys

1. In Supabase, go to **Project Settings** (gear icon) → **API**.
2. Copy the **Project URL** and the **anon public** key.

## 5. Configure this project

1. In this folder, copy `.env.example` to a new file named `.env`.
2. Paste your Project URL and anon key into it:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

## 6. Run it locally

```bash
npm install
npm run dev
```

Open the printed localhost URL, sign in as Cathy in one browser tab and
Evan in another (or a private/incognito window) to see live sync
between the two.

## 7. Deploy it for real

1. Push this folder to a new GitHub repository.
2. Go to https://vercel.com, sign up, click **Add New → Project**, and
   import that repo.
3. In the project's **Environment Variables** settings, add the same
   two variables from your `.env` file.
4. Click **Deploy**. You'll get a URL like `raptr-app.vercel.app`.

## 8. Install it on your phones

Open your deployed URL on each phone:

- **iOS (Safari)**: tap the Share icon → **Add to Home Screen**.
- **Android (Chrome)**: tap the ⋮ menu → **Add to Home Screen** / **Install app**.

## What's in this version

- **Tasks** — shared + individual to-dos, importance/urgency, due dates,
  recurrence, inline editing, an "All Tasks" view.
- **Threads** — task-style messaging that volleys between "open for
  you" and "waiting on [them]" until either of you marks it complete;
  manual seen/unseen tracking; optional due date.
- **Calendar** — Day / Week / Month views, shared events, plus tasks
  and threads surfaced automatically by urgency:
  - **Critical** → shown on today
  - **High** → shown 2 days after creation
  - **Medium** → shown in a "This Week" panel (Week view only)
  - **Low** → shown in a "This Month" panel (Month view only)
  - **N/A** → never shown on the calendar
  - Anything with an explicit due date is shown on that date regardless
    of urgency.
- **RAPTR Gym** — start a challenge (dates + weekly workout target,
  editable after creation), each person sets a starting/target weight
  with weekly targets calculated automatically, weekly weigh-ins and
  daily workout check-offs, all color-coded (green on track, amber
  drifting, red off track) and visible to both of you.

## Security note

Both accounts now require a real password to sign in, and the
database policies require a valid login (`auth.role() = 'authenticated'`)
before any read or write. There's still no per-person restriction
beyond that — either of you can see and edit everything, which matches
what you asked for ("no need to privacy"). Don't share your Supabase
keys or the deployed URL outside the two of you.

## What's next

Reminders/push notifications and the Squarespace/budget/KPI
integrations from the original spec aren't built yet — they're the
natural next layer once you've lived with this version for a bit.
