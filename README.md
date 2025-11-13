# Customer Portal - React Frontend

This is the React frontend for the Customer Portal application.

## Development

### Installation

```bash
npm install
```

### Running the Development Server

```bash
npm start
```

This will start the development server on `http://localhost:3000` with hot reload enabled.

### Testing

Run the test suite:
```bash
npm test
```

## Building for Production

### Build and Deploy

To build the React app and automatically deploy it to the `../build` folder:

```bash
npm run build
```

This command will:
1. Build the React app (creates `frontend/build`)
2. Copy the build output to `../build` (production folder)

### Build Only (without deployment)

If you just want to build without deploying:

```bash
npm run build:dev
```

## Project Structure

```
frontend/
├── public/          # Static files
├── src/
│   ├── App.js      # Main app component (makes direct API calls)
│   ├── App.css     # App styles
│   ├── index.js    # Entry point
│   └── index.css   # Global styles
├── scripts/        # Build scripts
└── package.json    # Dependencies and scripts
```

## Backend Integration

The frontend makes direct API calls to the PHP backend at `/web/*` endpoints. All backend logic is handled by `portal.php` and files in the `_private/` folder. The frontend simply calls these endpoints using fetch API.

## Features

- Load and display users from TeamOB API
- Modern React 18 with hooks
- Responsive styling
- Error handling
- Loading states

