# Quick Start: Railway Deployment

## Railway is BETTER than Render for bot spawning! 🚀

**Why Railway?**
- ✅ 500 hours free trial (no credit card needed)
- ✅ Better resources (512MB-8GB RAM)
- ✅ Faster CPU (better than Render's 0.1 CPU)
- ✅ No spin-down issues
- ✅ Perfect for spawning 90 bots

---

## 5-Minute Setup

### 1. Push to GitHub (if not already done)
```bash
git init
git add .
git commit -m "Initial commit"
git push
```

### 2. Deploy on Railway
1. Go to [Railway.app](https://railway.app/)
2. Login with GitHub (no credit card!)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repo
5. Railway auto-detects and deploys!

### 3. Add Environment Variables
In Railway dashboard → Variables:
```
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=1521765557064695858
GUILD_ID=1523633039534940220
PORT=7860
```

### 4. Generate Public Domain
Railway Settings → Networking → "Generate Domain"

Copy your URL (e.g., `your-bot.up.railway.app`)

### 5. Setup UptimeRobot (Keep it alive 24/7)
1. Go to [UptimeRobot.com](https://uptimerobot.com/)
2. Add New Monitor:
   - Type: HTTP(s)
   - URL: `https://your-bot.up.railway.app/health`
   - Interval: 5 minutes

### 6. Register Commands
```bash
node register_commands.js
```

---

## That's it! Your bot is live! 🎉

**Test it:**
- `/verify` - Verification system
- `/dashboard` - View your stats
- `/farm` - Spawn bots

**Monitor:**
- Health: `https://your-bot.up.railway.app/health`
- Logs: Railway Dashboard → Logs
- Metrics: Railway Dashboard → Metrics

---

**See `RAILWAY_DEPLOYMENT.md` for detailed guide.**
