# Mahita Website

Personal website for mahita.ai hosted via Cloudflare Tunnel.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Access locally:**
   - Website: http://localhost:3000
   - Admin: http://localhost:3000/admin
   - **Login:** user: `nirav`, password: `kothari_n`

---

## Cloudflare Tunnel Setup

### Option 1: Quick Tunnel (Temporary)

For testing, run this command while the server is running:

```bash
cloudflared tunnel --url http://localhost:3000
```

This creates a temporary tunnel URL you can use for testing.

### Option 2: Permanent Tunnel (Production)

#### Step 1: Install cloudflared

**macOS (Homebrew):**
```bash
brew install cloudflared
```

**Linux:**
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
```

#### Step 2: Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser window to authorize Cloudflare access to your account.

#### Step 3: Create a tunnel

```bash
cloudflared tunnel create mahita
```

Note the tunnel ID in the output (looks like: `uuid-here`).

#### Step 4: Configure DNS

```bash
cloudflared tunnel route dns mahita mahita.ai
cloudflared tunnel route dns mahita www.mahita.ai
```

#### Step 5: Create config file

Create `cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /Users/rmehta01/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: mahita.com
    service: http://localhost:3000
  - hostname: www.mahita.com
    service: http://localhost:3000
  - service: http_status:404
```

Replace `<TUNNEL_ID>` with your tunnel ID from Step 3.

#### Step 6: Run the tunnel

```bash
cloudflared tunnel --config cloudflared/config.yml run mahita
```

#### Step 7: Start automatically on boot (Optional)

```bash
# Create launch agent
mkdir -p ~/Library/LaunchAgents
```

Create `~/Library/LaunchAgents/com.cloudflared.mahita.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cloudflared.mahita</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/cloudflared</string>
        <string>tunnel</string>
        <string>--config</string>
        <string>/Users/rmehta01/Sites/mahita/cloudflared/config.yml</string>
        <string>run</string>
        <string>mahita</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

Load the service:
```bash
launchctl load ~/Library/LaunchAgents/com.cloudflared.mahita.plist
```

---

## Project Structure

```
mahita/
├── server.js          # Main Express server with auth
├── package.json      # Node dependencies
├── public/           # Static files
├── cloudflared/      # Tunnel config
└── README.md         # This file
```

---

## Admin Access

- **URL:** `/admin`
- **Username:** `nirav`
- **Password:** `kothari_n`

The admin panel shows server status and tunnel information.

---

## Troubleshooting

### Check if port is in use
```bash
lsof -i :3000
```

### Kill process on port 3000
```bash
kill $(lsof -t -i:3000)
```

### Check cloudflared logs
```bash
cloudflared tunnel logs mahita
```

### Verify tunnel status
```bash
cloudflared tunnel list
```

---

## Error 1016: Origin DNS Error Fix

If you're seeing Error 1016 (Origin DNS error), follow these steps:

### Step 1: Check if cloudflared is installed
```bash
which cloudflared
```
If not installed: `brew install cloudflared`

### Step 2: Login to Cloudflare
```bash
cloudflared tunnel login
```

### Step 3: Create tunnel (if not exists)
```bash
cloudflared tunnel create mahita
```

### Step 4: Configure DNS
```bash
cloudflared tunnel route dns mahita mahita.ai
```

### Step 5: Create config file
```bash
mkdir -p cloudflared
```

Create `cloudflared/config.yml`:
```yaml
tunnel: <TUNNEL_ID>
credentials-file: ~/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: mahita.ai
    service: http://localhost:3000
  - service: http_status:404
```

### Step 6: Run tunnel
```bash
cloudflared tunnel --config cloudflared/config.yml run mahita
```

### Step 7: Verify DNS is working
```bash
dig mahita.ai
```
Should return a CNAME pointing to your tunnel.
