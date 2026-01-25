# Deployment Guide

This guide covers deploying your MPB Health IT ServiceOps application to production hosting platforms.

## Prerequisites

1. Git repository initialized (✅ Done)
2. Code committed to GitHub, GitLab, or Bitbucket
3. Supabase project configured with production credentials
4. Hosting platform account (Vercel or Netlify recommended)

## Quick Deploy Options

### Option 1: Deploy to Vercel (Recommended)

#### Step 1: Push to Git
```bash
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

#### Step 2: Deploy on Vercel
1. Visit [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your Git repository
4. Vercel will auto-detect the `vercel.json` configuration
5. Add environment variables:
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
   - `VITE_DEMO_MODE`: Set to `false`
   - `VITE_AI_ASSIST_ENABLE`: Set to `true` or `false`
   - `VITE_GEMINI_API_KEY`: (Optional) Your Gemini API key
   - `VITE_N8N_WEBHOOK_URL`: (Optional) Your n8n webhook URL
   - `VITE_CRM_BASE_URL`: (Optional) Your CRM base URL
6. Click "Deploy"

#### Step 3: Configure Domain (Optional)
- Go to Project Settings > Domains
- Add your custom domain
- Update DNS records as instructed

---

### Option 2: Deploy to Netlify

#### Step 1: Push to Git
```bash
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

#### Step 2: Deploy on Netlify
1. Visit [netlify.com](https://netlify.com) and sign in
2. Click "Add new site" > "Import an existing project"
3. Connect your Git repository
4. Netlify will auto-detect the `netlify.toml` configuration
5. Add environment variables in Site Settings > Environment Variables:
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
   - `VITE_DEMO_MODE`: Set to `false`
   - `VITE_AI_ASSIST_ENABLE`: Set to `true` or `false`
   - `VITE_GEMINI_API_KEY`: (Optional) Your Gemini API key
   - `VITE_N8N_WEBHOOK_URL`: (Optional) Your n8n webhook URL
   - `VITE_CRM_BASE_URL`: (Optional) Your CRM base URL
6. Click "Deploy site"

---

### Option 3: Manual Build & Deploy

If you prefer to deploy to your own server or use a different platform:

#### Step 1: Build the Application
```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

#### Step 2: Upload to Your Server
- Upload the contents of `dist/` to your web server
- Configure your web server to:
  - Serve `index.html` for all routes (SPA fallback)
  - Set proper cache headers for assets
  - Enable HTTPS

#### Step 3: Environment Variables
Create a production `.env` file or set variables on your server:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_DEMO_MODE=false
VITE_AI_ASSIST_ENABLE=true
```

---

## Configuration Files Included

### `vercel.json`
Configures Vercel deployment with:
- SPA routing fallback
- Asset caching headers
- Environment variable mapping

### `netlify.toml`
Configures Netlify deployment with:
- Build commands
- Redirect rules for SPA routing
- Cache control headers
- Node.js version specification

### `vite.config.ts` (Optimized)
Enhanced build configuration with:
- Code splitting for optimal chunk sizes
- Vendor bundles separated by category
- Console statement removal in production
- Terser minification for smaller bundles

---

## Post-Deployment Checklist

After deploying, verify the following:

- [ ] Application loads without errors
- [ ] Authentication works (login/logout)
- [ ] Supabase connection is successful
- [ ] All routes are accessible (no 404s)
- [ ] Environment variables are properly set
- [ ] SSL/HTTPS is enabled
- [ ] Custom domain is configured (if applicable)
- [ ] Performance metrics are acceptable (Lighthouse score)

---

## Supabase Configuration

### Required Environment Variables
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Getting Supabase Credentials
1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Copy the "Project URL" and "anon public" key
4. Add these to your hosting platform's environment variables

### Important Security Notes
- Never commit `.env` to Git (it's in `.gitignore`)
- Use platform-specific environment variable management
- Rotate keys if accidentally exposed
- Use Supabase Row Level Security (RLS) policies

---

## Troubleshooting

### Build Fails
- Run `npm run build` locally to test
- Check for TypeScript errors
- Verify all dependencies are installed

### White Screen After Deploy
- Check browser console for errors
- Verify environment variables are set correctly
- Ensure Supabase URL and keys are valid
- Check SPA routing is configured (see config files)

### Authentication Doesn't Work
- Verify Supabase credentials in environment variables
- Check Supabase project is not paused
- Ensure redirect URLs are configured in Supabase Auth settings

### Large Bundle Size Warning
- The optimized `vite.config.ts` includes code splitting
- Rebuild after configuration changes: `npm run build`
- Monitor bundle size in build output

---

## Continuous Deployment

Both Vercel and Netlify support automatic deployments:

1. Any push to your main branch triggers a new deployment
2. Pull requests create preview deployments
3. Rollback to previous deployments from the dashboard

---

## Support & Resources

- **Vercel Docs**: https://vercel.com/docs
- **Netlify Docs**: https://docs.netlify.com
- **Vite Docs**: https://vitejs.dev
- **Supabase Docs**: https://supabase.com/docs

---

## Next Steps

1. Push your code to a Git repository
2. Choose a hosting platform (Vercel or Netlify)
3. Connect your repository
4. Configure environment variables
5. Deploy!

Your application is now ready for production deployment.
