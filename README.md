# Constructional Scenery

Full-stack application with a Next.js (TypeScript) frontend and a .NET 9 Web API backend.

## Structure

```
Constructional-scenery/
├── frontend/          # Next.js 15 · TypeScript · Tailwind CSS · App Router
└── backend/           # ASP.NET Core Web API · .NET 9
```

## Getting Started

### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

### Backend

```bash
cd backend
dotnet restore
dotnet run           # https://localhost:5001  |  http://localhost:5000
```

Swagger UI is available at `/swagger` in development.
