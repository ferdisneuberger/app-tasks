# Backend v3

Backend simples em Node.js + Express + JavaScript puro, com autenticacao JWT e persistencia em arquivos JSON.

## Rodando

```bash
copy .env.example .env
npm install
npm run dev
```

## Endpoints

- `GET /api/health`
- `POST /api/users`
- `GET /api/users/me`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/tasks`
- `GET /api/tasks`
- `GET /api/tasks/:taskId`
- `PUT /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`
