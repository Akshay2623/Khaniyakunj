# Society Management

Full-stack project with:
- React (Vite) frontend
- Node.js + Express backend
- MongoDB Atlas database

## Project Structure

- `client/` React app
- `server/` Express API + Mongoose

## Setup

1. Configure backend env:
   - Copy `server/.env.example` to `server/.env`
   - Set `JWT_SECRET` to a long random value
   - Set your MongoDB Atlas connection string in `MONGODB_URI`

2. Configure frontend env (optional):
   - Copy `client/.env.example` to `client/.env`
   - Update `VITE_API_URL` if your backend is not `http://localhost:5000`

3. Install dependencies:

```bash
npm install
npm --prefix server install
npm --prefix client install
```

## Run in Development

From project root:

```bash
npm run dev
```

This starts:
- Backend: `http://localhost:5000`
- Frontend: `http://localhost:5173`

## API Endpoints

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` (protected)
- `GET /api/societies` (protected)
- `POST /api/societies` (protected)
- `GET /api/residents?societyId=<id>` (protected)
- `POST /api/residents` (protected)
- `PUT /api/residents/:id` (protected)
- `DELETE /api/residents/:id` (protected)

`POST /api/auth/register` body:

```json
{
  "name": "Admin User",
  "email": "admin@example.com",
  "password": "secret123"
}
```

`POST /api/societies` body:

```json
{
  "name": "Green Valley Residency",
  "address": "Sector 21, Noida",
  "totalFlats": 120
}
```
