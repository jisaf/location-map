import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from './mapbox';
import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';

const Card = ({ children }) => (
  <div className="bg-white shadow-md rounded-md p-4">
    {children}
  </div>
);

const CardHeader = ({ children }) => (
  <div className="mb-4 border-b pb-2">
    {children}
  </div>
);

const CardTitle = ({ children }) => (
  <h3 className="text-lg font-medium">{children}</h3>
);

const CardContent = ({ children }) => (
  <div>{children}</div>
);

const ProviderLocationMap = () => {
  const [providerData, setProviderData] = useState([]);
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/example data.csv');
        const text = await response.text();
        const parsedData = await parseCSVData(text);
        const enrichedData = await enrichWithCoordinates(parsedData);
        console.log(1, enrichedData)
        setProviderData(enrichedData);
        initMap();
      } catch (error) {
        console.error('Error reading file:', error);
      }
    };

    fetchData();
  }, []);

  const parseCSVData = (csvContent) => {
    return new Promise((resolve, reject) => {
      Papa.parse(csvContent, {
        download: false,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          resolve(results.data);
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  };

  const enrichWithCoordinates = async (data, csvFilePath) => {
    const enrichedData = await Promise.all(
      data.map(async (item) => {
        if (item.latitude === undefined || item.longitude === undefined) {
          const address = `${item['adr_ln_1']}, ${item['City/Town']}, ${item['State']} ${item['ZIP Code']}`;
          console.log(address)
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxgl.accessToken}`
          );
          const geocodingData = await response.json();
          if (geocodingData.features.length > 0) {
            const [longitude, latitude] = geocodingData.features[0].center;
            return { ...item, longitude, latitude };
          } else {
            console.error(`Unable to geocode address for item: ${item['Provider Last Name']}, ${item['Provider First Name']}`);
            return { ...item, longitude: null, latitude: null };
          }
        }
        return item;
      })
    );
  
    // Write the enriched data back to the CSV file
    const enrichedCsv = Papa.unparse(enrichedData, { header: true });
    // fs.writeFileSync(csvFilePath, enrichedCsv);
  
    return enrichedData;
  };

  const initMap = () => {
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [-105.2705, 40.0150], // Set the initial map center to Colorado
      zoom: 6
    });

    providerData.forEach((provider) => {
      if (provider.longitude !== null && provider.latitude !== null) {
        new mapboxgl.Marker()
          .setLngLat([provider.longitude, provider.latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              `
                <h3>${provider['Provider Last Name']}, ${provider['Provider First Name']}</h3>
                <p>NPI: ${provider.NPI}</p>
                <p>Primary Specialty: ${provider.pri_spec}</p>
                <p>Gender: ${provider.gndr}</p>
              `
            )
          )
          .addTo(map.current);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider Location Map</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={mapContainer} className="h-[600px]"></div>
      </CardContent>
    </Card>
  );
};

export default ProviderLocationMap;