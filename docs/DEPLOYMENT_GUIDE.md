# Free-Tier Deployment Guide

This guide provides instructions for deploying the Intelligent Inventory & Demand Forecasting System on zero-cost free-tier infrastructure.

---

## 1. Architecture Infrastructure Plan

| Tier | Provider | Service Tier | Free Allowance & Limits |
| :--- | :--- | :--- | :--- |
| **Database** | **MongoDB Atlas** | M0 Shared Cluster | 512 MB storage, shared RAM, replica set. |
| **Backend REST API** | **Render** | Free Web Service | 512 MB RAM, 0.1 CPU, sleeps after 15 min idle. |
| **Frontend Client** | **Vercel** | Hobby Plan | 100 GB bandwidth, global edge CDN. |

---

## 2. Step 1: MongoDB Atlas Free Cluster Setup

1. Create a free account at [cloud.mongodb.com](https://cloud.mongodb.com).
2. Create an **M0 Free Cluster** in your preferred region (e.g., AWS us-east-1).
3. **Database Access:** Create a database user (e.g., `inventory_user`) with read/write privileges to `inventory_forecasting`.
4. **Network Access:** In the "Network Access" tab, add IP address `0.0.0.0/0` (Allow access from anywhere) so that Render free dynos can connect.
5. **Connection String:** Copy the SRV URI:
   `mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`

---

## 3. Step 2: Backend Deployment on Render

1. Create a free account at [render.com](https://render.com).
2. Click **New +** -> **Web Service**.
3. Connect your Git repository (or point to the `backend/` directory).
4. Configure service parameters:
   - **Name:** `inventory-forecasting-api`
   - **Runtime:** `Python 3`
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:**
     ```bash
     uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Instance Type:** `Free`
5. Configure Environment Variables in the Render dashboard:
   - `ENVIRONMENT` = `production`
   - `MONGODB_URI` = `mongodb+srv://<user>:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`
   - `MONGODB_DATABASE` = `inventory_forecasting`
   - `CORS_ALLOWED_ORIGINS` = `https://your-inventory-app.vercel.app,http://localhost:5173`
6. Click **Deploy Web Service**.
7. Note your public backend URL (e.g., `https://inventory-forecasting-api.onrender.com`).
8. Verify health endpoint: `https://inventory-forecasting-api.onrender.com/health`.

---

## 4. Step 3: Frontend Deployment on Vercel

1. Create a free account at [vercel.com](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Import your repository and set:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Add Environment Variable:
   - `VITE_API_BASE_URL` = `https://inventory-forecasting-api.onrender.com`
5. Click **Deploy**.
6. When deployment finishes, update the `CORS_ALLOWED_ORIGINS` environment variable on Render with your live Vercel URL to allow secure requests.

---

## 5. Free-Tier Operational Characteristics & Limitations

### 5.1 Render Cold Starts
- **Behavior:** Render free web services spin down after 15 minutes of inactivity.
- **Latency:** The initial request after spin-down incurs a 30 to 50 second wake-up delay.
- **Mitigation:** The React frontend includes built-in loading spinners, retry logic, and an offline fallback dataset so the user interface remains responsive and informative during cold starts.

### 5.2 MongoDB Atlas M0 Storage Limit
- **Limit:** 512 MB total storage quota.
- **Capacity:** A full 180-day dataset with 3,000+ sales records consumes approximately 4.2 MB of storage (less than 1% of the free allowance).
- **Maintenance:** The `/api/system/reset` endpoint can be triggered at any time to prune old test data and restore a clean 180-day baseline.

### 5.3 RAM Constraints
- The Render free tier provides 512 MB RAM. Our Random Forest model is configured with `n_estimators=60, max_depth=6`, keeping peak model memory consumption under 85 MB, safely within the free threshold.
