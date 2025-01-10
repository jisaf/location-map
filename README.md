# Location Map with Google Sheets Integration

This application displays provider locations on a map, with data sourced from Google Sheets. Built with React + Vite.

## Google Sheets Setup

1. Create a Google Cloud Project:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Google Sheets API for your project

2. Create API Credentials:
   - In the Google Cloud Console, go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" and select "API Key"
   - Copy the generated API key

3. Create a Google Spreadsheet:
   - Create a new Google Spreadsheet
   - Create three sheets named:
     - `provider_data`
     - `jail_data`
     - `hospital_data`
   - Each sheet should have the following columns (matching the previous CSV format):
     - Provider sheet: Provider Last Name, Provider First Name, NPI, pri_spec, gndr, adr_ln_1, City, ZIP Code, longitude, latitude, county
     - Jail sheet: Name, Address, City, Zip Code, X, Y, county
     - Hospital sheet: Facility_Name, Facility_Type, Address_Full, longitude, latitude, County

4. Configure Environment Variables:
   Create a `.env` file in the project root with:
   ```
   REACT_APP_SPREADSHEET_ID=your_spreadsheet_id
   REACT_APP_GOOGLE_API_KEY=your_api_key
   ```
   The spreadsheet ID can be found in the URL of your Google Sheet:
   `https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit`

5. Share the Spreadsheet:
   - Make sure the spreadsheet is accessible to anyone with the link (View access is sufficient)

## Running the Application

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

## Data Format

Ensure your Google Sheets data follows the same format as the previous CSV files:

### provider_data Sheet
- Provider Last Name
- Provider First Name
- NPI
- pri_spec
- gndr
- adr_ln_1
- City
- ZIP Code
- longitude
- latitude
- county

### jail_data Sheet
- Name
- Address
- City
- Zip Code
- X (longitude)
- Y (latitude)
- county

### hospital_data Sheet
- Facility_Name
- Facility_Type
- Address_Full
- longitude
- latitude
- County

## Important Notes

- Make sure all required environment variables are set before running the application
- The Google Sheets API has quotas and rate limits. Monitor your usage in the Google Cloud Console
- Keep your API key secure and never commit it to version control

## Development

This project uses:
- React for the UI framework
- Vite for the build tool and development server
- Google Sheets API for data source
- Mapbox for map visualization
