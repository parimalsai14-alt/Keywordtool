# Deploy Keyword Tool on VPS (no domain – use IP only)

You can access the app at **http://YOUR_VPS_IP:3000** (replace `YOUR_VPS_IP` with your VPS IP).

---

## Option 1: Docker (recommended)

On your VPS:

```bash
# Install Docker if needed (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in, or run: newgrp docker

# Copy your project to the VPS (from your Mac, in Keywordtool folder):
# scp -r . user@YOUR_VPS_IP:~/Keywordtool
# Or use git: git clone <your-repo> && cd Keywordtool

cd ~/Keywordtool   # or wherever you copied the project

# Optional: set stronger passwords (edit .env or export before next command)
# export ADMIN_PASSWORD="your-secure-admin-password"
# export EMPLOYEE_PASSWORD="your-secure-employee-password"

docker compose up -d --build
```

Then open in browser: **http://YOUR_VPS_IP:3000**

- Stop: `docker compose down`
- Logs: `docker compose logs -f`
- Restart: `docker compose restart`

---

## Option 2: Node.js only (no Docker)

On your VPS:

```bash
# Install Node 18+ (Ubuntu/Debian example)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

cd ~/Keywordtool
npm ci --only=production

# Run (port 3000)
PORT=3000 NODE_ENV=production node server.js
```

To keep it running after you disconnect, use **pm2**:

```bash
sudo npm install -g pm2
cd ~/Keywordtool
pm2 start server.js --name keywordtool
pm2 save && pm2 startup   # start on reboot
```

Then open: **http://YOUR_VPS_IP:3000**

---

## Firewall

Allow port 3000 so the app is reachable:

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 3000/tcp
sudo ufw enable
sudo ufw status
```

---

## Use port 80 (optional – no :3000 in URL)

If you want **http://YOUR_VPS_IP** (no port), run the app on 80 or put Nginx in front.

**Quick way – bind to 80 with Docker:**

Edit `docker-compose.yml` and change ports to `"80:3000"`, then:

```bash
docker compose up -d --build
```

Open **http://YOUR_VPS_IP** (port 80). On Linux you may need: `sudo docker compose up -d --build` if port 80 requires root.

---

## Security notes (no domain)

- Change `ADMIN_PASSWORD` and `EMPLOYEE_PASSWORD` (and `SESSION_SECRET`) in production.
- Prefer HTTPS: without a domain you’d use a self-signed cert; browsers will show a warning but traffic will be encrypted. With a domain you can use Let’s Encrypt for free HTTPS.
