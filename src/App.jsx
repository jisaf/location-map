import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from './mapbox';
import Papa from 'papaparse';
import { config } from './geographic-system-rules';
import 'mapbox-gl/dist/mapbox-gl.css';

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

const ProviderLocationMapWithLegend = () => {
  const [providerData, setProviderData] = useState([]);
  const [activeSpecialties, setActiveSpecialties] = useState({});
  const [activeRegions, setActiveRegions] = useState({});
  const [countyBoundaries, setCountyBoundaries] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef({});

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
        const enrichedData = flattenData(parsedData);
        setProviderData(enrichedData);

        if (!countyBoundaries) {
          const geoJsonResponse = await fetch('/Colorado_County_Boundaries.geojson', {
            cache: 'no-store'
          });
          if (!geoJsonResponse.ok) {
            throw new Error(`HTTP error! status: ${geoJsonResponse.status}`);
          }
          const geoJsonData = await geoJsonResponse.json();
          setCountyBoundaries(geoJsonData);
        }

        initMap();
        initLegend(enrichedData);
      } catch (error) {
        console.error('Error reading file:', error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (mapLoaded && countyBoundaries && providerData.length > 0) {
      addCountyBoundaries();
      addProviderMarkers(providerData);
    }
  }, [mapLoaded, countyBoundaries, providerData]);

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

  const initMap = () => {
    if (map.current) return; // Initialize map only once

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v10',
      center: [-105.2705, 40.0150], // Set the initial map center to Colorado
      zoom: 6
    });

    map.current.on('style.load', () => {
      console.log('Map style loaded successfully');
      setMapLoaded(true);
    });
  };

  const addCountyBoundaries = () => {
    if (!map.current || !countyBoundaries) return;
  
    if (!map.current.getSource('counties')) {
      // Create a lookup object for quick region access
      const regionLookup = config.counties.reduce((acc, county) => {
        acc[county.name.toUpperCase()] = county.region;
        return acc;
      }, {});
  
      // Add a new property to each feature in the GeoJSON
      const updatedGeoJSON = {
        ...countyBoundaries,
        features: countyBoundaries.features.map(feature => ({
          ...feature,
          properties: {
            ...feature.properties,
            REGION: regionLookup[feature.properties.COUNTY] || 0
          }
        }))
      };
  
      map.current.addSource('counties', {
        type: 'geojson',
        data: updatedGeoJSON
      });
  
      map.current.addLayer({
        'id': 'county-fills',
        'type': 'fill',
        'source': 'counties',
        'paint': {
          'fill-color': [
            'match',
            ['get', 'REGION'],
            1, '#87CEEB',
            2, '#90EE90',
            3, '#FFA500',
            4, '#FF6347',
            '#ccc'
          ],
          'fill-opacity': 0.5
        }
      });

      map.current.addLayer({
        'id': 'county-borders',
        'type': 'line',
        'source': 'counties',
        'paint': {
          'line-color': '#000',
          'line-width': 1
        }
      });

      map.current.addLayer({
        'id': 'county-labels',
        'type': 'symbol',
        'source': 'counties',
        'layout': {
          'text-field': ['get', 'COUNTY'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': 12,
          'text-transform': 'uppercase',
          'text-offset': [0, 0.6],
          'text-anchor': 'top'
        },
        'paint': {
          'text-color': '#333',
          'text-halo-color': '#fff',
          'text-halo-width': 2
        }
      });

      map.current.on('click', 'county-fills', (e) => {
        if (e.features.length > 0) {
          const feature = e.features[0];
          const countyName = feature.properties.COUNTY;
          const countyData = config.counties.find(county => county.name.toUpperCase() === countyName);
          new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
              <h3>${countyName}</h3>
              <p>Classification: ${countyData ? countyData.classification : 'N/A'}</p>
              <p>BHASO Region: ${feature.properties.REGION || 'N/A'}</p>
            `)
            .addTo(map.current);
        }
      });
    }
  };

  const addProviderMarkers = (data) => {
    if (!map.current || !data) return;

    data.forEach((provider) => {
      if (provider.longitude !== null && provider.latitude !== null) {
        const el = getMarkerElement(provider);
        const marker = new mapboxgl.Marker(el)
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

        const spec = provider.pri_spec;
        markers.current[spec] = markers.current[spec] || [];
        markers.current[spec].push(marker);
      }
    });
  };

  const getMarkerElement = (provider) => {
    const markerConfig = {
      'Jail': { backgroundColor: 'green' },
      'Hospital': { backgroundColor: 'red' },
      'Community Clinic': { backgroundColor: 'red' },
      'default': { backgroundColor: 'yellow' }
    };

    const spec = provider.pri_spec;
    const config = markerConfig[spec] || markerConfig['default'];

    const el = document.createElement('div');
    el.className = 'marker';
    el.style.backgroundColor = config.backgroundColor;
    el.style.width = '10px';
    el.style.height = '10px';
    el.style.borderRadius = '50%';

    return el;
  };

  const initLegend = (data) => {
    const uniqueSpecialties = Array.from(new Set(data.map(item => item.pri_spec)));
    const initialActiveState = uniqueSpecialties.reduce((acc, spec) => {
      acc[spec] = true;
      return acc;
    }, {});
    setActiveSpecialties(initialActiveState);

    const uniqueRegions = Array.from(new Set(config.counties.map(county => county.region)));
    const initialActiveRegions = uniqueRegions.reduce((acc, region) => {
      acc[region.toString()] = true;
      return acc;
    }, {});
    setActiveRegions(initialActiveRegions);
  };

  const toggleSpecialty = (specialty) => {
    setActiveSpecialties((prev) => ({
      ...prev,
      [specialty]: !prev[specialty]
    }));

    const specMarkers = markers.current[specialty] || [];
    specMarkers.forEach((marker) => {
      if (activeSpecialties[specialty]) {
        marker.remove();
      } else {
        marker.addTo(map.current);
      }
    });
  };

  const toggleRegion = (region) => {
    setActiveRegions((prev) => {
      const newActiveRegions = {
        ...prev,
        [region]: !prev[region]
      };
      
      if (map.current) {
        const activeRegionNumbers = Object.entries(newActiveRegions)
          .filter(([_, isActive]) => isActive)
          .map(([region, _]) => parseInt(region));
  
        let filter;
        if (activeRegionNumbers.length === 0) {
          filter = ['==', ['get', 'REGION'], -1];  // This ensures no counties are shown if no regions are selected
        } else if (activeRegionNumbers.length === Object.keys(newActiveRegions).length) {
          filter = null;  // Show all regions if all are selected
        } else {
          // Use a series of '==' comparisons joined by 'any'
          filter = ['any', ...activeRegionNumbers.map(num => ['==', ['get', 'REGION'], num])];
        }
        
        map.current.setFilter('county-fills', filter);
        map.current.setFilter('county-borders', filter);
        map.current.setFilter('county-labels', filter);
      }
      
      return newActiveRegions;
    });
  };

  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      <Card>
        <CardHeader>
          <CardTitle>Provider Location Map</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: 'flex', height: '600px' }}>
            <div ref={mapContainer} style={{ flex: '3', height: '100%' }}></div>
            <div style={{ flex: '1', marginLeft: '16px', overflow: 'auto' }}>
              <Card>
                <CardHeader>
                  <CardTitle>Legend</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(activeSpecialties).map((specialty) => (
                    <div key={specialty} className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        checked={activeSpecialties[specialty]}
                        onChange={() => toggleSpecialty(specialty)}
                        className="mr-2"
                      />
                      <div
                        className={`w-4 h-4 mr-2 rounded-full ${
                          specialty === 'Jail'
                            ? 'bg-green-500'
                            : specialty === 'Hospital' || specialty === 'Community Clinic'
                              ? 'bg-red-500'
                              : 'bg-yellow-500'
                        }`}
                      ></div>
                      <span className="text-sm">{specialty}</span>
                    </div>
                  ))}
                  {Object.keys(activeRegions).map((region) => (
                    <div key={region} className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        checked={activeRegions[region]}
                        onChange={() => toggleRegion(region)}
                        className="mr-2"
                      />
                      <div
                        className={`w-4 h-4 mr-2 ${
                          region === '1'
                            ? 'bg-blue-300'
                            : region === '2'
                              ? 'bg-green-300'
                              : region === '3'
                                ? 'bg-orange-300'
                                : 'bg-red-300'
                        }`}
                      ></div>
                      <span className="text-sm">Region {region}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProviderLocationMapWithLegend;