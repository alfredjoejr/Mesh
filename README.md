# Mesh Chat

Mesh is a secure, modern chat application featuring an iOS-styled glassmorphism frontend, end-to-end encryption (E2EE), WebAuthn passkey authentication, and **Confidential Rooms with forensic message fingerprinting**.

## Features

* **Glassmorphism UI**: Beautiful, modern UI built with React, Tailwind CSS, and Framer Motion.
* **Passkey Authentication**: Secure, passwordless login using WebAuthn.
* **End-to-End Encryption (E2EE)**: Direct 1:1 messages are encrypted client-side using WebCrypto (RSA-OAEP and AES-GCM).
* **Confidential Rooms**: Group chats where every message is forensically fingerprinted per recipient. 
* **Screenshot Accountability**: Uses 5 layers of steganographic encoding (including AI linguistic paraphrasing via Gemini) so that any leaked screenshot or copy-pasted text can be traced back to the specific user who leaked it.

## Tech Stack

* **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide React
* **Backend**: Node.js, Express
* **Database**: PostgreSQL, Drizzle ORM
* **AI Layer**: Google GenAI SDK (Gemini)

## Getting Started

Follow these steps to run the project locally from scratch.

### 1. Prerequisites

* [Node.js](https://nodejs.org/) (v20+ recommended)
* A PostgreSQL database (e.g., local Postgres, [Aiven](https://aiven.io/), or Supabase)
* A [Google Gemini API Key](https://aistudio.google.com/app/apikey) (for the AI fingerprinting layer)

### 2. Installation

Clone the repository and install the dependencies:

```bash
npm install
```

### 3. Environment Variables

Create a `.env` file in the root of the project and add your database URL and Gemini API key:

```env
# PostgreSQL Connection String
# Example: postgres://username:password@host:port/dbname?sslmode=verify-full
DATABASE_URL=your_postgres_connection_string

# Gemini API Key for Layer 5 Linguistic Fingerprinting
GEMINI_API_KEY=your_gemini_api_key
```

### 4. Database Setup

Initialize the database schema by running the migration script. This will create all the necessary tables (users, messages, confidential rooms, fingerprint maps, etc.).

```bash
npx tsx migrate.ts
```
*(Alternatively, you can use `npx drizzle-kit push` if you prefer managing schemas directly through Drizzle).*

### 5. Running the Application

Start the development server. This single command boots up both the Express backend and the Vite frontend middleware.

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Usage Guide

1. **Register**: Create a new account. You can set up a WebAuthn passkey for secure passwordless login.
2. **Connect**: Add other users to your contacts using their username or a 6-digit Chat Key.
3. **E2EE Chat**: Standard 1:1 messages are automatically end-to-end encrypted.
4. **Confidential Rooms**: Click the Shield icon to create a room. Messages sent here will be processed by the fingerprinting engine, embedding invisible trackers into the text.
5. **Verify Leaks**: If someone leaks a message from a Confidential Room, click the "Verify Leak" button inside the room, paste the leaked text, and the system will attribute the leak to the source.

## Building for Production

To build the application for production deployment:

```bash
npm run build
```

This will bundle the React frontend into static assets and compile the server into `dist/server.cjs`. You can then start the production server with:

```bash
npm start
```
