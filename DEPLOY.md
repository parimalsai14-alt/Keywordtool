# Deploy Keyword Finalization Tool on a VPS

Step-by-step guide to run the app on a Linux VPS (Ubuntu/Debian) with Nginx and PM2.

---

## 1. Prepare your VPS

SSH into your server:

```bash
ssh root@YOUR_VPS_IP
# or: ssh youruser@YOUR_VPS_IP
```

Update the system:

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 2. Install Node.js 18+

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # should show v18.x or v20.x
```

---

## 3. Upload the project to the VPS

**Option A – Git (if the project is in a repo)**

```bash
cd /var/www   # or any folder you prefer
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
git clone https://github.com/YOUR_USER/Keywordtool.git keywordtool
cd keywordtool
```

**Option B – Upload from your Mac (rsync)**

On your **local Mac**, from the project folder:

```bash
rsync -avz --exclude node_modules --exclude data . youruser@YOUR_VPS_IP:/var/www/keywordtool/
```

Then on the **VPS**:

```bash
cd /var/www/keywordtool
```

---

## 4. Install dependencies

On the VPS:

```bash
cd /var/www/keywordtool
npm install --production
```

---

## 5. Set environment variables

Create a `.env` file (do **not** commit this):

```bash
nano .env
```

Add (change the secret and passwords for production):

```env
NODE_ENV=production
PORT=3000

# Use a long random string (e.g. openssl rand -hex 32)
SESSION_SECRET=your-long-random-secret-here

# Optional: override default passwords
ADMIN_PASSWORD=yfdjafiGYUFTV3778
EMPLOYEE_PASSWORD=emphubhbh878#HJ

# Optional: default Serper API key (admin can change from Settings)
# SERPER_API_KEY=your_serper_key
```

Save and exit (`Ctrl+X`, then `Y`, then `Enter`).

The app loads `.env` automatically when it starts (via `dotenv`).

---

## 6. Run the app with PM2

Install PM2 and start the app:

```bash
sudo npm install -g pm2
cd /var/www/keywordtool
NODE_ENV=production pm2 start server.js --name keywordtool
pm2 save
pm2 startup   # run the command it prints so PM2 starts on server reboot
```

Check:

```bash
pm2 status
pm2 logs keywordtool
```

The app runs on port **3000** (localhost only until Nginx is set up).

---

## 7. Install Nginx and proxy to the app

```bash
sudo apt install -y nginx
```

Create a site config:

```bash
sudo nano /etc/nginx/sites-available/keywordtool
```

Paste (replace `YOUR_DOMAIN` with your domain, e.g. `keyword.yourdomain.com`):

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and reload Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/keywordtool /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

If you don’t have a domain yet, use the server’s public IP as `server_name` or leave the default server and open `http://YOUR_VPS_IP` in the browser.

---

## 8. (Recommended) Add HTTPS with Let’s Encrypt

Only if you have a domain pointing to the VPS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

Follow the prompts. Certbot will adjust Nginx for HTTPS and auto-renew the certificate.

After that, set `NODE_ENV=production` and use HTTPS so the session cookie is set with `secure: true`.

---

## 9. Open firewall

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
sudo ufw status
```

Port **3000** does not need to be open; Nginx proxies to it locally.

---

## 10. Verify

- With domain + HTTPS: `https://YOUR_DOMAIN`
- With IP only: `http://YOUR_VPS_IP`

You should see the login page. Log in with admin or employee password.

---

## Quick reference

| Task              | Command |
|-------------------|--------|
| View logs         | `pm2 logs keywordtool` |
| Restart app       | `pm2 restart keywordtool` |
| Stop app          | `pm2 stop keywordtool` |
| Reload Nginx      | `sudo systemctl reload nginx` |
| Check Nginx       | `sudo nginx -t` |

---

## Troubleshooting

- **502 Bad Gateway** – App not running or wrong port. Check `pm2 status` and that the app listens on `PORT` (default 3000).
- **Can’t log in** – Ensure `SESSION_SECRET` is set and the same on every run. Clear cookies and try again.
- **Invalid API key on checks** – Log in as admin, open **Settings**, and save the correct Serper API key.
