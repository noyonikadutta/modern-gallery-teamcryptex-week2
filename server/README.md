# Modern Gallery Server

Express + MongoDB + AWS S3 backend for the image gallery.

## Features
- JWT auth: register/login
- Upload image to S3 and save metadata in MongoDB
- Gallery listing with pagination
- Like/Unlike and Comment
- Delete own images
- CORS enabled

## Routes
- POST `/auth/register`
- POST `/auth/login`
- POST `/upload` (multipart, field `image`, headers `Authorization: Bearer <token>`)
- GET `/gallery` (headers `Authorization`)
- DELETE `/image/:id` (headers `Authorization`, owner only)
- POST `/image/:id/like` (headers `Authorization`)
- POST `/image/:id/comment` (json `{ text }`, headers `Authorization`)

## Setup
1. Copy `.env.example` to `.env` and fill values
2. Install deps

```powershell
cd server
npm install
```

3. Run dev

```powershell
npm run dev
```

Server runs on `http://localhost:5000`.

## Notes
- Configure your frontend to call these endpoints at the server origin.
- Ensure the S3 bucket has public-read object ACL if you want direct image URLs.
