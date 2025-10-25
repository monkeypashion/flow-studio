# Flow Studio - Digital Time-Series Workstation

A React-based digital workstation for time-series data, inspired by DAW (Digital Audio Workstation) interfaces like Propellerhead Reason. Manage time-series data with an intuitive timeline, tracks, and clips interface.

## Features

### Timeline Interface
- **Multi-track Timeline**: Create and manage multiple tracks for organizing data
- **Draggable Clips**: Move clips freely along the timeline and between tracks
- **Resizable Clips**: Adjust clip duration by dragging edges
- **Grid Snap**: Toggle grid snapping for precise positioning
- **Zoom Controls**: Zoom in/out for detailed or overview work
- **Playhead**: Visual indicator of current time position

### Clip Management
- **Visual States**: Different colors for clip states (idle, uploading, processing, complete, error)
- **Progress Bars**: Real-time progress indication for active operations
- **Multi-selection**: Select multiple clips with Shift-click or marquee selection
- **Copy/Paste**: Full clipboard support for duplicating clips

### Inspector Panel
- **Clip Properties**: Edit selected clip properties in real-time
- **Time Range Control**: Precise control over clip timing
- **Status Display**: Current state and progress information
- **Batch Operations**: Apply changes to multiple selected clips

### Job Queue
- **Real-time Updates**: Live progress tracking for all operations
- **Job History**: View completed and failed jobs
- **Statistics**: Track active, completed, and failed operations
- **Clear Function**: Remove completed jobs from the queue

### Mock Backend
- **Simulated Operations**: Realistic upload/download/processing simulations
- **Progress Events**: Real-time progress updates via event system
- **Random Failures**: 10% failure rate for realistic testing
- **Batch Operations**: Support for multiple simultaneous operations

## Keyboard Shortcuts

- **Ctrl+C / Cmd+C**: Copy selected clips
- **Ctrl+V / Cmd+V**: Paste clips at playhead position
- **Ctrl+X / Cmd+X**: Cut selected clips
- **Ctrl+A / Cmd+A**: Select all clips
- **Ctrl+D / Cmd+D**: Duplicate selected clips
- **Delete / Backspace**: Delete selected clips
- **Escape**: Clear selection
- **G**: Toggle grid snap
- **Ctrl++ / Cmd++**: Zoom in
- **Ctrl+- / Cmd+-**: Zoom out

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
cd flow-studio

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will open at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The production build will be in the `dist` directory.

## Usage

### Creating Clips
- **Double-click** on any track to create a new clip at that position
- New clips automatically start uploading with simulated progress

### Moving Clips
- **Click and drag** clips to move them along the timeline
- Drag clips to different tracks to reorganize your data

### Resizing Clips
- **Drag the edges** of clips to adjust their duration
- Minimum clip duration is enforced to prevent invalid states

### Selection
- **Click** a clip to select it
- **Shift-click** to add to selection
- **Click empty space** to clear selection
- **Marquee select** by clicking and dragging on empty timeline space

### Track Controls
- **Mute**: Disable track (visual indicator only in this version)
- **Lock**: Prevent modifications to track
- **Delete**: Remove track and all its clips
- **Rename**: Click track name to edit

## Technology Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Zustand** for state management
- **Framer Motion** for smooth animations
- **Tailwind CSS** for styling
- **PostCSS** for CSS processing

## Architecture

### State Management
- Global state managed by Zustand store
- Separate concerns for tracks, clips, selection, timeline, and jobs
- Optimized re-renders through selective subscriptions

### Component Structure
- **Timeline**: Main container coordinating all timeline elements
- **Track**: Individual track managing its clips
- **Clip**: Self-contained clip component with drag/resize logic
- **Inspector**: Property editor for selected clips
- **JobQueue**: Background job monitoring

### Mock Backend
- Event-based architecture simulating real backend operations
- Progress events emitted at regular intervals
- Configurable duration and failure rates

## Development

### Project Structure
```
src/
├── components/          # React components
│   ├── Timeline/
│   ├── Track/
│   ├── Clip/
│   ├── Inspector/
│   └── JobQueue/
├── store/              # Zustand store
├── services/           # Mock backend service
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

### Adding New Features
1. Define types in `src/types/index.ts`
2. Update store actions in `src/store/appStore.ts`
3. Create/modify components in `src/components/`
4. Add mock backend support if needed

## License

MIT

## Acknowledgments

- Inspired by professional DAW interfaces
- Built with modern React best practices
- Designed for extensibility and real-world integration