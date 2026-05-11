# Rebel AI Backend Setup Guide for Alwaysdata

## Prerequisites
- Alwaysdata account with MySQL support
- Node.js installed (or use SSH to run on server)
- MySQL database access

## Installation Steps

### 1. Create Database

```bash
mysql -u your_username -p < backend/database.sql
```

Or use Alwaysdata's phpMyAdmin:
1. Go to **Admin > Databases**
2. Create database: `rebel_ai_admin`
3. Import `database.sql` file

### 2. Install Dependencies

```bash
cd backend
npm install
```

Or on Alwaysdata SSH:
```bash
cd ~/apps/rebel-ai/backend
npm install
```

### 3. Configure Environment

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your Alwaysdata MySQL details:

```env
DB_HOST=your-db.alwaysdata.net
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=rebel_ai_admin
DB_PORT=3306

PORT=3000
NODE_ENV=production
JWT_SECRET=your_random_secret_key_here
ADMIN_PASSWORD=rebel@admin123
```

### 4. Start Server

**Local Development:**
```bash
cd backend
node server.js
```

**On Alwaysdata (via SSH):**
```bash
cd ~/apps/rebel-ai/backend
node server.js &
```

**Check if running:**
```bash
curl http://localhost:3000/api/stats
```

### 5. Update Frontend Configuration

In `main.js`, update `BACKEND_URL`:

```javascript
const BACKEND_URL = 'https://your-app.alwaysdata.net';
```

## Alwaysdata Deployment

### Option A: Using Alwaysdata's Node.js Support

1. Upload `backend/` folder to `/home/youruser/www/api/`
2. Create `web_app.json`:

```json
{
  "private": false,
  "port": 3000,
  "run": "node /home/youruser/www/api/server.js"
}
```

3. Go to **Admin > Web Apps** and create new app
4. Set command: `node /home/youruser/www/api/server.js`
5. Point domain to app

### Option B: Keep Frontend + Backend Together

All files in one directory:
```
/home/youruser/www/
├── index.html
├── main.js
├── style.css
├── backend/
│   ├── server.js
│   ├── package.json
│   └── .env
```

Then update `BACKEND_URL` in frontend:

```javascript
const BACKEND_URL = window.location.origin; // Same domain
```

## API Endpoints (Backend Ready)

### Auth
- `POST /api/auth/verify` - Admin login
- `POST /api/auth/logout` - Logout

### Stats
- `GET /api/stats` - Dashboard statistics
- `GET /api/stats/poll` - Real-time polling

### Users
- `GET /api/users` - List all users
- `POST /api/users/add` - Add new user
- `PUT /api/users/:id/toggle` - Enable/Disable user
- `DELETE /api/users/:id` - Delete user

### API Keys
- `GET /api/keys` - List all keys
- `POST /api/keys/generate` - Generate new key
- `PUT /api/keys/:id/toggle` - Toggle key
- `DELETE /api/keys/:id` - Delete key

### Logs
- `GET /api/logs` - Get system logs (with optional ?filter=info|warn|error)
- `POST /api/logs/add` - Add log entry
- `DELETE /api/logs` - Clear all logs

### Settings
- `GET /api/settings` - Get all settings
- `PUT /api/settings` - Update setting
- `PUT /api/settings/password` - Change admin password

### Tracking
- `POST /api/track/message` - Track message
- `POST /api/track/api-call` - Track API call
- `POST /api/analytics/session` - Track session

## Troubleshooting

### Connection refused
- Check MySQL is running
- Verify .env credentials
- Check firewall/port access

### Module not found
- Run `npm install` again
- Delete `node_modules` and reinstall

### Database errors
- Import `database.sql` properly
- Check database name in .env matches

### Port already in use
- Change PORT in .env
- Or kill process: `lsof -i :3000`

## Security Notes

1. Change `JWT_SECRET` in production
2. Change `ADMIN_PASSWORD` immediately
3. Use HTTPS only on Alwaysdata
4. Keep `.env` out of git (already in .gitignore)
5. Regularly backup database

## Monitoring

Check logs:
```bash
tail -f ~/apps/rebel-ai/logs.txt
```

Restart app:
```bash
npm restart
```

## Support

For issues, check:
- Database connection
- Port availability
- Environment variables
- API endpoint URLs in frontend

---

✅ Backend is ready! Connect your frontend and enjoy admin panel! 🚀
