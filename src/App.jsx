import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from './mapbox';
import Papa from 'papaparse';

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
        const csvFiles = [
          '/provider_data.csv',
          '/jail_data.csv',
          '/hospital_data.csv',
        ];
        const parsedData = await Promise.all(csvFiles.map(async (file) => {
          const response = await fetch(file);
          const text = await response.text();
          return await parseCSVData(text);
        }));
        // const enrichedData = await enrichWithCoordinates(flattenData(parsedData));
        const enrichedData = flattenData(parsedData);
        setProviderData(enrichedData);
        initMap(enrichedData);
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

  const flattenData = (parsedData) => {
    return parsedData.reduce((acc, curr) => {
      return acc.concat(curr.map(item => ({
        'Provider Last Name': item['Provider Last Name'] || item['Facility_Name'] || item['Name'],
        'Provider First Name': item['Provider First Name'] || item['First Name'],
        NPI: item.NPI,
        'pri_spec': item.pri_spec || item['Facility_Type'] || 'Jail',
        gndr: item.gndr,
        address: item['Address_Full'] ? item['Address_Full'] : `${item['adr_ln_1'] || item['Address']}, ${item['City/Town'] || item.City}, 'CO' ${item['ZIP Code'] || item['Zip Code']}`,
        longitude: item.longitude,
        latitude: item.latitude
      })));
    }, []);
  };

  const enrichWithCoordinates = async (data) => {
    let hasEnrichedData = false;
    const enrichedData = await Promise.all(
      data.map(async (item) => {
        if (item.latitude === null || item.longitude === null) {
          hasEnrichedData = true;
          const address = item.address;
          try {
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
          } catch (error) {
            console.log(geocodingData)
            if (error.message.includes('429')) {
              console.error('Mapbox Geocoding API rate limit reached. Proceeding without geocoding.');
              return { ...item, longitude: null, latitude: null };
            } else {
              console.error(`Error geocoding address for item: ${item['Provider Last Name']}, ${item['Provider First Name']}, ${error}`);
              return { ...item, longitude: null, latitude: null };
            }
          }
        }
        return item;
      })
    );

    // if (hasEnrichedData) {
    //   // Create a downloadable CSV file with the enriched data
    //   const enrichedCsv = Papa.unparse(enrichedData, { header: true });
    //   const blob = new Blob([enrichedCsv], { type: 'text/csv' });
    //   const url = window.URL.createObjectURL(blob);
    //   const link = document.createElement('a');
    //   link.setAttribute('href', url);
    //   link.setAttribute('download', 'provider_data.csv');
    //   document.body.appendChild(link);
    //   link.click();
    //   document.body.removeChild(link);
    // }

    return enrichedData;
  };

  const initMap = (data) => {
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [-105.2705, 40.0150], // Set the initial map center to Colorado
      zoom: 6
    });

    data.forEach((provider) => {
      if (provider.longitude !== null && provider.latitude !== null) {
        // Create a DOM element for each marker.
        const el = document.createElement('div');
        el.className = 'marker';
        if (provider.pri_spec === 'Jail') {
          el.style.backgroundColor = 'green';
        } else if (provider.pri_spec === 'Hospital' || provider.pri_spec === 'Community Clinic') {
          el.style.backgroundColor = 'red';
        } else {
          el.style.backgroundColor = 'yellow';
        }
        el.style.width = `10px`;
        el.style.height = `10px`;
        el.style.backgroundSize = '100%';

        new mapboxgl.Marker(el)
          .setLngLat([provider.longitude, provider.latitude])
          .addClassName('.green')
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
        <div ref={mapContainer} className="h-600px"></div>
      </CardContent>
    </Card>
  );
};

export default ProviderLocationMap;