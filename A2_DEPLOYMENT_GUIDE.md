# A2 VPS Deployment Guide - MPB Health IT

## 📦 What's Included

Your deployment package includes:
- **dist/** folder with production-optimized build
- **.htaccess** with Apache configuration for SPA routing
- **Security headers** and caching rules
- **HTTPS redirect** configuration
- **mpb-health-dist.tar.gz** - Ready to upload archive (375KB)

## 🚀 Deployment Steps

### Method 1: cPanel File Manager (Recommended for A2)

1. **Login to cPanel**
   - Go to your A2 Hosting cPanel
   - Navigate to File Manager

2. **Prepare Directory**
   ```bash
   # Navigate to public_html (or your domain's directory)
   # Delete existing files (backup first!)
   ```

3. **Upload Archive**
   - Upload `mpb-health-dist.tar.gz`
   - Right-click and select "Extract"
   - Verify files extracted correctly

4. **Verify Files**
   - Check that `.htaccess` is present
   - Verify `index.html` exists in root
   - Ensure `assets/` folder contains all JS/CSS

### Method 2: SSH/Terminal (Advanced)

1. **Upload via SCP**
   ```bash
   scp mpb-health-dist.tar.gz username@your-server.com:~/
   ```

2. **SSH into Server**
   ```bash
   ssh username@your-server.com
   ```

3. **Extract to Web Root**
   ```bash
   cd ~/public_html
   # Backup existing files
   mkdir -p ../backup
   mv * ../backup/

   # Extract new build
   tar -xzf ~/mpb-health-dist.tar.gz -C ./

   # Verify
   ls -la
   ```

4. **Set Permissions**
   ```bash
   find . -type f -exec chmod 644 {} \;
   find . -type d -exec chmod 755 {} \;
   chmod 644 .htaccess
   ```

### Method 3: FTP (FileZilla)

1. **Connect via FTP**
   - Host: your-domain.com
   - Username: your-cpanel-username
   - Password: your-cpanel-password
   - Port: 21 (or 22 for SFTP)

2. **Navigate to public_html**

3. **Upload dist folder contents**
   - Upload all files from `dist/` folder
   - Make sure `.htaccess` is uploaded
   - Preserve directory structure

## ⚙️ Environment Configuration

### Important: Update Environment Variables

After deployment, you may need to create a `.env` file or configure environment variables through cPanel:

```bash
VITE_SUPABASE_URL=https://hhikjgrttgnvojtunmla.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_DEMO_MODE=false
```

**Note:** Since this is a static build, environment variables are baked in at build time. If you need different values for production:

1. Update `.env` file in the project
2. Run `npm run build` again
3. Redeploy the new dist folder

## 🔐 SSL Certificate Setup (A2 Hosting)

1. **AutoSSL (Free - Recommended)**
   - Go to cPanel → SSL/TLS Status
   - Click "Run AutoSSL" for your domain
   - Wait 5-10 minutes for activation

2. **Let's Encrypt (Alternative)**
   - cPanel → Security → Let's Encrypt SSL
   - Select your domain
   - Click "Issue"

3. **Force HTTPS**
   - Already configured in `.htaccess`
   - Redirects HTTP → HTTPS automatically

## 🧪 Post-Deployment Testing

### 1. Basic Functionality
- [ ] Homepage loads correctly
- [ ] Navigation works (all routes)
- [ ] No console errors
- [ ] Assets (images, CSS, JS) load properly

### 2. Authentication
- [ ] Login page accessible
- [ ] Can login with test account
- [ ] Supabase connection working
- [ ] Session persists on refresh

### 3. API Connectivity
- [ ] Supabase API calls working
- [ ] Data loads from database
- [ ] Edge functions accessible
- [ ] No CORS errors

### 4. Security
- [ ] HTTPS enabled and working
- [ ] HTTP redirects to HTTPS
- [ ] Security headers present (check with: https://securityheaders.com)
- [ ] No sensitive data exposed

## 🔧 Troubleshooting

### 404 Errors on Refresh
**Symptom:** Routes work initially but 404 on page refresh

**Solution:**
1. Verify `.htaccess` file exists
2. Check if `mod_rewrite` is enabled
3. Contact A2 support to enable if needed

### Blank Page / White Screen
**Symptom:** Page loads but shows blank/white screen

**Solution:**
1. Check browser console for errors
2. Verify Supabase URL and keys are correct
3. Check network tab for failed requests
4. Ensure all asset paths are relative

### Assets Not Loading
**Symptom:** CSS/JS files return 404

**Solution:**
1. Verify `assets/` folder uploaded correctly
2. Check file permissions (644 for files, 755 for dirs)
3. Clear browser cache
4. Check `.htaccess` rules

### CORS Errors
**Symptom:** API requests blocked by CORS policy

**Solution:**
1. Check Supabase project settings
2. Add your domain to allowed origins
3. Verify API URLs in code match environment

## 📊 Performance Optimization

### Enable Gzip Compression
Already configured in `.htaccess`. Verify with:
```bash
curl -I -H "Accept-Encoding: gzip" https://your-domain.com
```

### Browser Caching
Configured for 1 year on static assets. Test with browser DevTools.

### CDN (Optional)
Consider using Cloudflare for:
- Additional caching
- DDoS protection
- Global CDN
- Free SSL

## 📱 Monitoring

### Setup Uptime Monitoring
- UptimeRobot (free)
- Pingdom
- StatusCake

### Error Tracking
- Sentry (recommended)
- LogRocket
- Rollbar

## 🆘 Support Resources

### A2 Hosting Support
- Support Portal: https://my.a2hosting.com/
- Live Chat: Available 24/7
- Phone: Check your account for number
- Knowledgebase: https://www.a2hosting.com/kb/

### Common A2 Commands
```bash
# Check disk usage
du -sh ~/public_html

# Check Apache error logs
tail -f ~/logs/error_log

# Test .htaccess syntax
apachectl configtest
```

## 🎯 Quick Checklist

- [ ] Backup existing site
- [ ] Upload `mpb-health-dist.tar.gz`
- [ ] Extract to public_html
- [ ] Verify `.htaccess` present
- [ ] Check file permissions
- [ ] Enable SSL certificate
- [ ] Test all routes
- [ ] Verify Supabase connection
- [ ] Check mobile responsiveness
- [ ] Monitor for errors

## 📞 Need Help?

If you encounter issues:
1. Check browser console for errors
2. Review Apache error logs in cPanel
3. Contact A2 support (excellent 24/7 support)
4. Check Supabase dashboard for API issues

---

**Deployment Package:** mpb-health-dist.tar.gz (375KB)
**Build Date:** 2025-11-12
**Vite Version:** 5.4.21
**Production Ready:** ✅

Good luck with your deployment! 🚀
