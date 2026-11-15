# Run SigmaGPT Revision 2 locally

## Requirements

- Node.js 22 or newer
- MongoDB running on `127.0.0.1:27017` (or a MongoDB URI you control)
- A Groq API key for real responses

## Configure the backend

1. Copy `Backend/.env.example` to `Backend/.env`.
2. Set `OPENAI_API_KEY` in `Backend/.env` to your Groq key. Keep this file private; it is ignored by Git and should not be included in a shared ZIP.
3. Set `MONGODB_URI` to the app database. Set `TEST_MONGODB_URI` to a separate disposable test database. The integration tests clear and drop the database named by `TEST_MONGODB_URI`.
4. Install dependencies once, in separate terminals or commands:

   ```powershell
   cd Backend
   npm ci
   cd ..\Frontend
   npm ci
   ```

## Start MongoDB

Start the MongoDB service, or run a local server using a dedicated data directory. Keep its terminal open while using the app.

## Start the backend

Open a PowerShell terminal in `Backend`. Port 8081 is used in this example to avoid a common local port conflict. The frontend origin must match the URL Vite prints.

```powershell
$env:PORT="8081"
$env:FRONTEND_ORIGIN="http://localhost:5173"
npm start
```

Check [http://localhost:8081/health](http://localhost:8081/health). It should report `status: ok` and `database: connected`.

## Start the frontend

Open another PowerShell terminal in `Frontend`:

```powershell
$env:VITE_API_URL="http://localhost:8081"
npm run dev -- --host localhost --port 5173
```

Open [http://localhost:5173](http://localhost:5173). Keep the MongoDB, backend, and frontend terminals open.

If port 5173 is occupied, select an unused Vite port (for example 5178) and set `FRONTEND_ORIGIN` in the backend terminal to the matching origin, such as `http://localhost:5178`. Restart the backend after changing `FRONTEND_ORIGIN`.

Stop each foreground server with Ctrl+C.
