# Deploying to Render with UptimeRobot

**⚠️ IMPORTANT:** Render's free tier has very limited resources (512MB RAM, 0.1 CPU) which may not be sufficient for spawning many bots. **For better performance, see `RAILWAY_DEPLOYMENT.md` instead.** Railway offers a better free trial with more resources.

---

## Step 1: Prepare Your Files

Your bot is ready to deploy! Make sure you have:
- ✅ `discord_bot.js` - Main bot file
- ✅ `package.json` - Dependencies
- ✅ `index2.js` - Bot spawning logic (if needed)
- ✅ `server.js` - Additional server (if needed)

## Step 2: Deploy to Render

### 2.1 Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up or log in with GitHub

### 2.2 Create New Web Service
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository (or upload files)
3. Configure the service:

**Settings:**
```
Name: arras-bot (or your preferred name)
Region: Choose closest to you
Branch: main (or your branch name)
Root Directory: (leave blank if files are in root)
Environment: Node
Build Command: npm install
Start Command: node discord_bot.js
```

### 2.3 Set Environment Variables

Click **"Environment"** and add:

```
PORT=7860
DISCORD_TOKEN=your_bot_token_here
```

Optional (Render auto-detects):
```
NODE_VERSION=18
```

### 2.4 Choose Plan
- **Free Plan**: Perfect for testing
  - Spins down after 15 min of inactivity
  - UptimeRobot keeps it alive!
- **Paid Plan**: Always on, no spin down

### 2.5 Deploy
1. Click **"Create Web Service"**
2. Wait for build to complete
3. Your bot will be deployed at: `https://your-app-name.onrender.com`

## Step 3: Set Up UptimeRobot

### 3.1 Create UptimeRobot Account
1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Sign up for free account

### 3.2 Create New Monitor
1. Click **"+ Add New Monitor"**
2. Configure:

```
Monitor Type: HTTP(s)
Friendly Name: Arras Bot
URL: https://your-app-name.onrender.com/health
Monitoring Interval: 5 minutes
```

**Why `/health`?**
- Returns JSON with bot status
- Confirms bot is online
- Shows active sessions and users
- Faster response than loading full pages

### 3.3 Alert Contacts (Optional)
1. Add your email
2. Get notified if bot goes down
3. Set up Discord webhook for alerts

### 3.4 Save Monitor
Click **"Create Monitor"** - Done!

## Step 4: Verify Everything Works

### 4.1 Check Render Logs
1. Go to your Render dashboard
2. Click on your service
3. Check **"Logs"** tab
4. Look for:
```
[system] bot ready: YourBot#1234
[system] health check: [ port 7860 ]
[system] Render detected: your-app.onrender.com
```

### 4.2 Test Health Endpoint
Open in browser: `https://your-app-name.onrender.com/health`

You should see:
```json
{
  "status": "online",
  "uptime": 1234.56,
  "timestamp": 1234567890123,
  "bot": "YourBot#1234",
  "sessions": 0,
  "verifiedUsers": 1
}
```

### 4.3 Test Discord Bot
1. Go to Discord
2. Run `/verify`
3. You should get the verification code and link
4. The link should be your Render URL

### 4.4 Check UptimeRobot
1. Go to UptimeRobot dashboard
2. Your monitor should show **"Up"** status
3. Response time should be < 1000ms

## How It Works

### Free Render Plan
- Spins down after 15 minutes of no requests
- Takes 30-60 seconds to wake up
- UptimeRobot pings every 5 minutes
- Keeps bot alive 24/7! ⚡

### The Magic
```
UptimeRobot (every 5 min)
    ↓
GET /health
    ↓
Render server responds
    ↓
Bot stays awake
    ↓
Repeat forever
```

## Health Check Endpoints

Your bot now has multiple endpoints for monitoring:

### `/health` (Recommended for UptimeRobot)
Returns JSON with detailed status:
```json
{
  "status": "online",
  "uptime": 1234.56,
  "timestamp": 1234567890123,
  "bot": "YourBot#1234",
  "sessions": 2,
  "verifiedUsers": 5
}
```

### `/ping`
Same as `/health` - alias for convenience

### `/` (Root)
Same as `/health` - works with any URL

### Other Pages Still Work
- `/verify` - Verification page
- `/dashboard` - User dashboard
- `/leaderboards` - Public rankings
- `/settings` - User settings
- `/logout` - Logout

## Render Environment Variables

Render automatically provides:
- `RENDER=true` - Detect if running on Render
- `RENDER_SERVICE_NAME` - Your service name
- `RENDER_EXTERNAL_URL` - Your public URL

The bot uses `REPL_SLUG` and `REPL_OWNER` for Replit, or falls back to PORT-based URL.

For Render, you might want to set:
```
RENDER_EXTERNAL_URL=https://your-app.onrender.com
```

Then update the bot to use it for verification URLs.

## Updating the Bot for Render

The verification URL detection needs Render support. Let me update it:

In `discord_bot.js`, find the URL generation and add Render detection:

```javascript
// Get the verification URL
let verifyUrl;
if (process.env.RENDER_EXTERNAL_URL) {
    // Render deployment
    verifyUrl = `${process.env.RENDER_EXTERNAL_URL}/verify`;
} else if (process.env.REPLIT_DEV_DOMAIN) {
    // Replit deployment
    verifyUrl = `https://${process.env.REPLIT_DEV_DOMAIN}/verify`;
} else if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    // Replit legacy
    verifyUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/verify`;
} else {
    // Local development
    verifyUrl = `http://localhost:${PORT}/verify`;
}
```

Or simply set it in Render environment variables:
```
REPL_SLUG=your-app-name
REPL_OWNER=onrender
```

This will generate: `https://your-app-name.onrender.repl.co/verify`

Actually, that won't work. Let's use a custom env var:

**Set in Render:**
```
BASE_URL=https://your-app-name.onrender.com
```

## Troubleshooting

### Bot Shows as Offline
- Check Render logs for errors
- Verify `PORT` environment variable is set
- Check Discord token is correct
- Make sure bot has proper intents

### UptimeRobot Shows Down
- Verify URL is correct
- Check Render service is running
- Test `/health` endpoint in browser
- Increase UptimeRobot timeout to 30 seconds

### Verification Links Don't Work
- Check Render logs for the generated URL
- Set `BASE_URL` environment variable in Render
- Test verification page directly in browser

### Bot Spins Down Anyway
- Check UptimeRobot interval (should be 5 min or less)
- Verify monitor is active (not paused)
- Free Render plan has 750 hours/month limit
- Multiple services share the 750 hours

### Sessions Lost on Restart
- This is normal - sessions are in memory
- Users need to re-verify after bot restarts
- Consider using Redis for persistence (paid add-on)

## Cost Breakdown

### Free Tier (Perfect for personal use)
- **Render**: Free plan with 750 hours/month
- **UptimeRobot**: Free plan with 50 monitors
- **Total**: $0/month! 🎉

### Paid Tier (For serious projects)
- **Render**: $7/month for always-on
- **UptimeRobot**: Free (50 monitors enough)
- **Total**: $7/month

## Render vs Replit

### Render Advantages
- ✅ Better performance
- ✅ More reliable uptime
- ✅ Free SSL certificates
- ✅ Better for production
- ✅ More professional
- ✅ GitHub integration

### Replit Advantages
- ✅ Online IDE
- ✅ Easy to edit code
- ✅ Built-in terminal
- ✅ Better for development
- ✅ Easier for beginners

## Pro Tips

### 1. Use Git for Deployment
- Push code to GitHub
- Render auto-deploys on push
- Easy rollbacks
- Version control

### 2. Monitor Logs
- Check Render logs regularly
- Set up log alerts
- Watch for errors
- Monitor resource usage

### 3. Set Up Alerts
- UptimeRobot email alerts
- Discord webhook for downtime
- Render deployment notifications

### 4. Keep Dependencies Updated
- Run `npm audit fix` locally
- Push updates to GitHub
- Render auto-rebuilds

### 5. Optimize Cold Starts
- Health check keeps it warm
- First request after spin-down is slow
- Users won't notice with UptimeRobot

## Next Steps

1. ✅ Deploy to Render
2. ✅ Set up UptimeRobot monitor
3. ✅ Test verification flow
4. ✅ Invite bot to your server
5. ✅ Register commands with `/register_commands.js`
6. ✅ Test all commands
7. ✅ Monitor in UptimeRobot dashboard
8. ✅ Enjoy your 24/7 bot! 🚀

## Support

Having issues? Check:
1. Render dashboard logs
2. UptimeRobot status page
3. Discord Developer Portal
4. Bot permissions in Discord server

Everything should work perfectly with the health check endpoint now set up! 🎉
