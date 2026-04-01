# Proximity Play - Social Location-Based App

A modern social application that connects people based on proximity, featuring real-time location sharing, interactive maps, and community-driven experiences.

## Features

- **Interactive Maps**: Real-time location sharing with Leaflet integration
- **Live User Presence**: See nearby users and their activities
- **Geofencing**: Create virtual boundaries for events and meetups
- **Emoji Reactions**: React to locations and activities
- **Weather Integration**: Real-time weather overlays on maps
- **Route Planning**: Get directions between locations
- **Annotation System**: Add notes and markers to maps
- **Responsive Design**: Works seamlessly on desktop and mobile
- **PWA Support**: Installable as a progressive web app
- **Offline Sync**: Continue using the app even without internet
- **Push Notifications**: Stay updated with nearby activities
- **Biometric Authentication**: Secure login with fingerprint/face recognition
- **Video Calling**: Connect with nearby users via WebRTC
- **Collaborative Editing**: Work together on documents in real-time
- **Story Sharing**: Share location-based stories and experiences

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI Framework**: shadcn/ui, Tailwind CSS
- **Maps**: Leaflet, React-Leaflet, Mapbox GL
- **Backend**: Supabase (PostgreSQL, Real-time subscriptions)
- **State Management**: Zustand
- **Routing**: React Router
- **Forms**: React Hook Form, Zod validation
- **Real-time**: Socket.io, WebRTC
- **PWA**: Workbox, Service Workers
- **Testing**: Vitest, React Testing Library
- **Deployment**: Vercel

## Project info

**URL**: https://lovable.dev/projects/f2623349-59e4-45c4-b335-edfd930572a1

## How can I edit this code?

There are several ways of editing your application.


**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Getting Started

### Prerequisites

- Node.js 18+ and npm installed ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Git

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd proximity-play

# Install dependencies
npm install

# Start the development server
npm run dev
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build for development
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run test:ui` - Run tests with UI

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   ├── Map.tsx         # Main map component
│   └── ...
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── contexts/           # React contexts
├── stores/             # Zustand stores
├── utils/              # Utility functions
├── integrations/       # External service integrations
└── schemas/            # Validation schemas
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token
VITE_OPENWEATHERMAP_API_KEY=your_weather_api_key
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## What technologies are used for this project?

This project is built with:

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Framework**: shadcn/ui with Tailwind CSS
- **Maps**: Leaflet, React-Leaflet, Mapbox GL
- **Backend**: Supabase (PostgreSQL + Real-time)
- **State Management**: Zustand
- **Routing**: React Router v6
- **Forms**: React Hook Form with Zod validation
- **Real-time Communication**: Socket.io, WebRTC
- **PWA**: Workbox, Service Workers
- **Testing**: Vitest, React Testing Library
- **Deployment**: Vercel

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on every push

### Manual Build

```sh
# Build for production
npm run build

# Preview the build
npm run preview
```

## API Documentation

### Supabase Schema

The app uses the following main tables:
- `user_locations` - Real-time location data
- `bubbles` - Community events/groups
- `stories` - Location-based stories
- `messages` - Chat messages
- `notifications` - Push notifications

### Environment Setup

1. Create a Supabase project
2. Run the migrations in `supabase/migrations/`
3. Configure Row Level Security (RLS) policies
4. Set up real-time subscriptions

## Troubleshooting

### Common Issues

1. **Map not loading**: Check Mapbox token in environment variables
2. **Real-time features not working**: Verify Supabase connection
3. **Build failing**: Ensure all dependencies are installed
4. **TypeScript errors**: Run `npm run lint` to check for issues

### Performance Tips

- Use code splitting for large components
- Implement lazy loading for routes
- Optimize images and assets
- Use service workers for caching

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- UI components from [shadcn/ui](https://ui.shadcn.com)
- Maps powered by [Leaflet](https://leafletjs.com) and [Mapbox](https://mapbox.com)
- Backend by [Supabase](https://supabase.com)
