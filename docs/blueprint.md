# **App Name**: PixelDungeon Dash

## Core Features:

- 16-bit Game Canvas: Render the D&D-themed runner game environment, player, and monsters using Canvas API primitives, respecting a 16-bit pixel art style and fixed 2:1 aspect ratio with adaptive scaling.
- Player & Obstacle Physics: Implement auto-run, jump mechanics (click/spacebar), monster movement (Beholder, Mimic), and precise collision detection in a virtual coordinate system.
- Score Tracking & Game State: Manage the game's score, game-over conditions, and reset game state upon restart.
- Telegram Web App Integration: Initialize and interact with the Telegram Web App, retrieving user data for score submission and adapting UI for mobile.
- Score Submission API: Server-side endpoint to validate and store game scores, including Telegram user ID, to a Firestore database via Firebase Admin SDK.
- Firebase Firestore Persistence: Store game scores in a Firebase Firestore collection with `score`, `userId`, `username`, and `createdAt` fields, initialized via Firebase Admin SDK.

## Style Guidelines:

- A dark color scheme that evokes a mystic 16-bit D&D dungeon. The primary color is a deep indigo (#6226B3) for main interactive elements and visual depth. The background is a very dark desaturated violet (#25202D), creating an immersive, slightly cool dungeon atmosphere. An accent color of vibrant blue (#6980CC) will be used for highlights and calls to action.
- Body and headline font: 'Press Start 2P' for an authentic 16-bit pixel art feel. Note: currently only Google Fonts are supported.
- All icons should adhere to the 16-bit pixel art style, designed with clear, blocky forms for visibility within the game's aesthetic.
- The main game canvas will occupy 100% width, maintaining a 2:1 aspect ratio across all devices. Game UI elements like the score display and restart button will be responsively placed below the canvas using Tailwind CSS, centered for optimal mobile viewing within Telegram Mini App.
- Animations will be minimal, following a 16-bit aesthetic (e.g., 2-frame running cycle for the character, subtle pulsing for monsters) to enhance game feel without sacrificing performance or pixel integrity.