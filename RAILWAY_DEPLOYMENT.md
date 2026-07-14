# Railway Deployment Guide

## Railway Setup (FREE 500 Hours Trial)

Railway provides a better free trial than Render for bot spawning tasks with more resources and better performance.

---

## Step 1: Prepare Your Code

### 1.1 Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

**IMPORTANT:** Make sure your `.env` file is in `.gitignore` and NOT pushed to GitHub!

---

## Step 2: Deploy to Railway

### 2.1 Create Account
1. Go to [Railway.app](https://railway.app/)
2. Click "Login" → Sign in with GitHub (no credit card needed for trial)
3. Authorize Railway to access your GitHub

### 2.2 Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect it's a Node.js project

### 2.3 Configure Environment Variables
Click on your service → "Variables" tab → Add these:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=1521765557064695858
GUILD_ID=1523633039534940220
PORT=7860
```

**Railway automatically provides:**
- `RAILWAY_PUBLIC_DOMAIN` - Your public URL (auto-detected by bot)
- `PORT` - Railway will override this if needed

### 2.4 Configure Build Settings (Optional)
If Railway doesn't auto-detect:
- **Build Command:** (leave empty, uses package.json)
- **Start Command:** `node discord_bot.js`

### 2.5 Deploy
1. Click "Deploy"
2. Wait for deployment to complete (check logs)
3. Your bot should come online!

---

## Step 3: Get Your Public URL

After deployment:
1. Go to your service settings
2. Click "Settings" → "Networking"
3. Click "Generate Domain"
4. Copy your public domain (e.g., `your-bot-production.up.railway.app`)

**Railway automatically sets `RAILWAY_PUBLIC_DOMAIN` environment variable**, so your bot will detect it automatically!

---

## Step 4: Keep Bot Alive with UptimeRobot

Railway's free trial doesn't spin down like Render, but you can still monitor it:

### 4.1 Create UptimeRobot Monitor
1. Go to [UptimeRobot.com](https://uptimerobot.com/)
2. Sign up for free account
3. Click "Add New Monitor"

**Settings:**
- **Monitor Type:** HTTP(s)
- **Friendly Name:** Arras Discord Bot
- **URL:** `https://your-bot-production.up.railway.app/health`
- **Monitoring Interval:** 5 minutes

4. Click "Create Monitor"

---

## Step 5: Register Discord Commands

After deployment, register your slash commands:

```bash
# On your local machine
npm install
node register_commands.js
```

Or run it on Railway:
1. Railway Dashboard → Your service → "Settings"
2. Add a "One-off Command": `node register_commands.js`
3. Run it once

---

## Verification & Testing

### Test Health Endpoint
```bash
curl https://your-bot-production.up.railway.app/health
```

Should return:
```json
{
  "status": "ok",
  "bot": "online",
  "uptime": "...",
  "activeSessions": 0,
  "verifiedUsers": 1
}
```

### Test Verification System
1. Go to Discord
2. Type `/verify`
3. Click the verification link
4. Enter the code
5. You should be redirected to the dashboard

### Test Dashboard
1. Type `/dashboard` in Discord
2. Click the dashboard link
3. You should see your stats

---

## Railway Resources (Free Trial)

Railway free trial includes:
- **500 hours** of usage (~20 days if running 24/7)
- **512 MB - 8GB RAM** (depends on plan, trial is flexible)
- **Shared CPU** (better than Render free tier)
- **No spin-down** during trial period
- **Better performance** for bot spawning

After trial ends, you can:
- Add a credit card for $5/month
- Switch to another service
- Use local hosting with ngrok

---

## Monitoring Your Bot

### View Logs
Railway Dashboard → Your service → "Logs" tab

### View Metrics
Railway Dashboard → Your service → "Metrics" tab
- CPU usage
- Memory usage
- Network traffic

### Restart Service
Railway Dashboard → Your service → "Settings" → "Restart"

---

## Troubleshooting

### Commands Not Appearing
- Wait 1-2 minutes for guild commands
- Wait up to 1 hour for global commands
- Run `node register_commands.js` again
- Check bot has proper permissions in Discord

### Bot Offline
- Check Railway logs for errors
- Verify environment variables are set
- Check DISCORD_TOKEN is valid
- Make sure bot is invited to your server

### Can't Spawn Bots / Out of Memory
- Check Railway metrics for memory usage
- Railway trial is better than Render, but still has limits
- Consider upgrading plan or using VPS

### Verification Not Working
- Check `RAILWAY_PUBLIC_DOMAIN` is set (automatic)
- Check health endpoint: `/health`
- Check logs for URL detection
- Make sure PORT environment variable matches

---

## Updating Your Bot

### Push Updates to GitHub
```bash
git add .
git commit -m "Update bot"
git push
```

Railway will **automatically redeploy** when you push to GitHub!

---

## Cost After Free Trial

Railway charges based on usage:
- **$5/month** gets you plenty of resources
- Pay only for what you use
- Much better value than most hosting providers

---

## Alternative: Run Locally with ngrok

If you don't want to use Railway, run locally:

```bash
# Terminal 1: Start bot
node discord_bot.js

# Terminal 2: Expose to public with ngrok
npm install -g ngrok
ngrok http 7860
```

Use the ngrok URL for verification system.

---

## Support

If you encounter issues:
1. Check Railway logs
2. Check Discord bot logs
3. Verify environment variables
4. Make sure bot is invited with correct permissions
5. Check UptimeRobot is pinging `/health` endpoint

**Your bot is now ready for Railway deployment!** 🚀
