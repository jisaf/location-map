# Location Map with Google Sheets Integration

This application displays facility locations on a map, with data dynamically sourced from Google Sheets. Built with React + Vite and hosted on GitHub Pages.

## Live Demo
The application is hosted at: https://jisaf.github.io/location-map/

## Implementation Overview

This is a 100% client-side JavaScript application that runs entirely in the browser with no server requirements. The application features:

- Dynamic facility location mapping using Mapbox GL JS
- Real-time data integration with Google Sheets
- Facility type filtering with dynamic enumeration
- Service type filtering (inpatient, outpatient, children, adults)
- Regional visualization with county boundaries
- Interactive popups with facility details

## Data Source

The application pulls data from a [public Google Sheet](https://docs.google.com/spreadsheets/d/151zw22uDrD36sucJQEXKrviECu-rxsXGoTb8gy4xn5k/edit?gid=804300694#gid=804300694) using a stable but deprecated method that doesn't require API keys. The sheet includes:

- Facility information (name, type, address)
- Geographic coordinates (latitude/longitude)
- Available services (inpatient, outpatient, children, adults)
- Regional classification

### Geocoding
The Google Sheet includes an Apps Script function that automatically calculates latitude/longitude coordinates from addresses. The script is available [here](https://script.google.com/u/0/home/projects/1JTY0qNM_JApgpkkCxITfBaXF3V11JADxo6Z5BmVLnHKIQ4Zv6NCk4_8F/edit).

## Setup Requirements

1. Mapbox API Key:
   - Sign up for a free account at [Mapbox](https://www.mapbox.com/)
   - Create an API key
   - Add it to your environment configuration

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/jisaf/location-map.git
   cd location-map
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your Mapbox API key:
   ```
   VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_api_key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Data Structure

The Google Sheet must maintain the following structure:

### Required Columns
- FacilityName
- FacilityType
- StreetAddress
- City
- State
- Zip
- Longitude(optional)
- Latitude(optional)
- Inpatient (true/false)
- Outpatient (true/false)
- Children (true/false)
- Adults (true/false)

### Important Notes
- Column names must match exactly (case-sensitive)
- Adding or removing columns will break the map functionality
- Facility types are dynamically enumerated from Column A
- Service types (inpatient, outpatient, children, adults) are hardcoded in the application
- The spreadsheet must remain public with "Anyone with the link" view access

## Updating the Map

### Adding New Facilities
1. Add a new row to the Google Sheet
2. Fill in all required columns
3. The geocoding script will automatically populate coordinates
4. The map will update automatically on next load

### Adding New Facility Types
1. Add facilities with the new type to the sheet
2. The type will be automatically added to the map's legend
3. A new color will be assigned to the facility type

### Adding New Service Types
1. Requires code changes in `src/App.jsx`
2. Update the `serviceTypes` array in the `initLegend` function
3. Add corresponding column in the Google Sheet
4. Deploy the updated code

## Deployment

The application is automatically deployed to GitHub Pages when changes are pushed to the main branch. The deployment process:

1. Builds the application with Vite
2. Outputs static files to the `dist` directory
3. Deploys to the `gh-pages` branch
4. Updates https://jisaf.github.io/location-map/

## Technical Stack

- React 18+ for UI components
- Vite for build tooling and development
- Mapbox GL JS for map rendering
- Material-UI for interface components
- GitHub Pages for hosting
- Google Sheets as a data backend
