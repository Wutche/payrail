---
description: How to deploy Payrail to Vercel
---

# Deploying to Vercel 🚀

Since your code is already on GitHub, deploying to Vercel is incredibly straightforward. Follow these steps:

### 1. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account.
2. Click **"Add New"** -> **"Project"**.
3. Import your `payrail` repository.

### 2. Configure Environment Variables

Before clicking "Deploy", you **must** add your environment variables. Vercel needs these to talk to Supabase.

Copy these from your local `.env.local` and paste them into the **Environment Variables** section in Vercel:

| Key                             | Value                                                                                              |
| :------------------------------ | :------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | _Your Supabase URL_                                                                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | _Your Supabase Anon Key_                                                                           |
| `SUPABASE_SERVICE_ROLE_KEY`     | _Your Supabase Service Role Key_                                                                   |
| `NEXT_PUBLIC_SITE_URL`          | `https://your-project-name.vercel.app` (Add this _after_ it's generated, or use the temporary one) |

### 3. Deploy

1. Click **Deploy**.
2. Once finished, Vercel will give you a production URL (e.g., `https://payrail-xyz.vercel.app`).

### 4. Update Supabase Redirects (Crucial! ⚠️)

For your email confirmation links to work in production, you must tell Supabase about your new URL:

1. Go to your **Supabase Dashboard** -> **Authentication** -> **URL Configuration**.
2. Update **Site URL** to your new Vercel URL.
3. Add your Vercel URL to **Redirect URLs** (e.g., `https://your-app.vercel.app/**`).

---

**I've updated your code to automatically detect your Vercel URL, so you won't have to manually change it in the code for every deployment!**
