import React, { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from './mapbox';
import { config } from './geographic-system-rules';
import 'mapbox-gl/dist/mapbox-gl.css';
// Using direct Google Sheets API instead of googleapis

import { 
  Card, 
  CardContent, 
  Typography, 
  Tabs, 
  Tab, 
  Box,
  Checkbox,
  FormControlLabel
} from '@mui/material';

const ProviderLocationMapWithLegend = () => {
  const [providerData, setProviderData] = useState([]);
  const [activeSpecialties, setActiveSpecialties] = useState({});
  const [activeServiceTypes, setActiveServiceTypes] = useState({
    inpatient: true,
    outpatient: true,
    children: true,
    adults: true
  });
  const [activeRegions, setActiveRegions] = useState({});
  const [countyBoundaries, setCountyBoundaries] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef({});
  const serviceCircles = useRef({});

  // Google Sheets configuration
  const SPREADSHEET_ID = '151zw22uDrD36sucJQEXKrviECu-rxsXGoTb8gy4xn5k';
  const GID = '804300694';

  const parseGoogleSheetsResponse = (responseText) => {
    // Remove the Google Visualization API callback wrapper
    const jsonString = responseText.replace('/*O_o*/', '')
      .replace('google.visualization.Query.setResponse(', '')
      .replace(');', '');
    
    try {
      const jsonData = JSON.parse(jsonString);
      console.log(1, jsonData)
      
      // Extract headers and rows from the response
      const headers = jsonData.table.cols.map(col => col.label);
      const rows = jsonData.table.rows.map(row => {
        const rowData = {};
        row.c.forEach((cell, index) => {
          rowData[headers[index]] = cell ? cell.v : null;
        });
        return rowData;
      });
      
      return rows;
    } catch (error) {
      console.error('Error parsing Google Sheets response:', error);
      throw error;
    }
  };

  const fetchData = async () => {
    try {
      const SPREADSHEET_ID = '151zw22uDrD36sucJQEXKrviECu-rxsXGoTb8gy4xn5k';
      const GID = '804300694';
      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&tq&gid=${GID}`;
      console.log('Fetching data from:', url);

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const responseText = await response.text();
      const rows = parseGoogleSheetsResponse(responseText);
      console.log(2, rows)
      if (!rows || rows.length === 0) {
        throw new Error('No data found in the sheet.');
      }

      return rows;
    } catch (error) {
      console.error('Error fetching data from Google Sheets:', error);
      // Return empty array in case of error to prevent app from crashing
      return [];
    }
  };

  const findCountyFromCoordinates = (longitude, latitude, countyBoundaries) => {
    if (!countyBoundaries || !countyBoundaries.features) return null;

    // Function to check if a point is inside a polygon
    const pointInPolygon = (point, polygon) => {
      // Handle MultiPolygon
      if (polygon.type === 'MultiPolygon') {
        return polygon.coordinates.some(coords => 
          pointInSinglePolygon(point, coords[0])
        );
      }
      // Handle single Polygon
      return pointInSinglePolygon(point, polygon.coordinates[0]);
    };

    // Ray casting algorithm for point in polygon
    const pointInSinglePolygon = (point, polygon) => {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        
        const intersect = ((yi > point[1]) !== (yj > point[1])) &&
          (point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    };

    const point = [longitude, latitude];
    
    // Find the county that contains this point
    const county = countyBoundaries.features.find(feature => {
      const geometry = feature.geometry;
      return pointInPolygon(point, geometry);
    });

    return county ? county.properties.COUNTY : null;
  };

  const getFacilityColor = (facilityType) => {
    const colorMap = {
      'Hospital': '#ef4444',
      'Community Clinic': '#22c55e',
      'Mental Health Center': '#3b82f6',
      'Crisis Center': '#f59e0b',
      'Substance Use Disorder': '#8b5cf6',
      'Other': '#6b7280'
    };
    return colorMap[facilityType] || colorMap['Other'];
  };

  const getServicesString = (services) => {
    return `
      Inpatient: ${services.inpatient ? 'Yes' : 'No'}
      Outpatient: ${services.outpatient ? 'Yes' : 'No'}
      Children: ${services.children ? 'Yes' : 'No'}
      Adults: ${services.adults ? 'Yes' : 'No'}
    `;
  };

  const flattenData = (data) => {
    if (!Array.isArray(data)) {
      console.error('Expected array of data but got:', typeof data);
      return [];
    }

    // Filter out rows where Facility Name is null, undefined, or empty string
    return data.filter(item => item['Facility Name']).map(item => {
      const longitude = Number(item['Longitude (optional)']);
      const latitude = Number(item['Latitude (optional)']);
      
      // Get county from coordinates if available
      let county = '';
      if (longitude && latitude && countyBoundaries) {
        county = findCountyFromCoordinates(longitude, latitude, countyBoundaries);
        if (county) {
          console.log(`Found county from coordinates for ${item['Facility Name']}: ${county}`);
        }
      }
      console.log(3, item)
      return {
        facilityName: item['Facility Name'],
        facilityType: item['Facility Type'],
        address: `${item['Street Address']}, ${item['City']}, ${item['State']} ${item['Zip']}`,
        longitude,
        latitude,
        county,
        services: {
          inpatient: String(item['Inpatient'] || '').toLowerCase() === 'true',
          outpatient: String(item['Outpatient'] || '').toLowerCase() === 'true',
          children: String(item['Children'] || '').toLowerCase() === 'true',
          adults: String(item['Adults'] || '').toLowerCase() === 'true'
        }
      };
    });
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch county boundaries first
        const geoJsonResponse = await fetch('./Colorado_County_Boundaries.geojson');
        if (!geoJsonResponse.ok) {
          throw new Error(`HTTP error! status: ${geoJsonResponse.status}`);
        }
        const geoJsonData = await geoJsonResponse.json();
        setCountyBoundaries(geoJsonData);

        // Get provider data
        const data = await fetchData();
        const enrichedData = flattenData(data);
        
        setProviderData(enrichedData);
        initMap();
        initLegend(enrichedData);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (mapLoaded && countyBoundaries && providerData.length > 0) {
      addCountyBoundaries();
      addProviderMarkers(providerData);
      addServiceAreaCircles(providerData);
    }
  }, [mapLoaded, countyBoundaries, providerData]);

  const initMap = () => {
    if (map.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v10',
        center: [-105.2705, 40.0150],
        zoom: 6
      });

      map.current.on('load', () => {
        console.log('Map loaded');
        setMapLoaded(true);
      });
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  };

  const addCountyBoundaries = () => {
    if (!map.current || !countyBoundaries) return;

    if (!map.current.getSource('counties')) {
      const regionLookup = config.counties.reduce((acc, county) => {
        if (county && county.name) {
          acc[county.name.toUpperCase()] = county.region;
        }
        return acc;
      }, {});

      const updatedGeoJSON = {
        ...countyBoundaries,
        features: countyBoundaries.features.map(feature => ({
          ...feature,
          properties: {
            ...feature.properties,
            REGION: feature.properties?.COUNTY ? regionLookup[feature.properties.COUNTY] || 0 : 0
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
        if (e.features?.length > 0) {
          const feature = e.features[0];
          const countyName = feature.properties?.COUNTY;
          const countyData = countyName && config.counties.find(county => 
            county?.name?.toUpperCase() === countyName
          );
          
          new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
              <h3>${countyName || 'Unknown County'}</h3>
              <p>Classification: ${countyData?.classification || 'N/A'}</p>
              <p>BHASO Region: ${feature.properties?.REGION || 'N/A'}</p>
            `)
            .addTo(map.current);
        }
      });
    }
  };

  const addProviderMarkers = useCallback((facilities) => {
    if (!map.current || !facilities) return;

    Object.values(markers.current).forEach(markerArray => {
      markerArray.forEach(marker => marker.remove());
    });
    markers.current = {};

    facilities.forEach((facility) => {
      if (facility.longitude && facility.latitude) {
        const el = document.createElement('div');
        el.className = 'marker';
        el.style.backgroundColor = getFacilityColor(facility.facilityType);
        el.style.width = '8px';
        el.style.height = '8px';
        el.style.borderRadius = '50%';

        // Create marker and store facility data with it
        const marker = new mapboxgl.Marker(el)
          .setLngLat([facility.longitude, facility.latitude]);
        
        // Store the facility data directly on the marker
        marker.facilityData = facility;
        
        // Set the popup
        marker.setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <h3>${facility.facilityName}</h3>
            <p><strong>Type:</strong> ${facility.facilityType}</p>
            <p><strong>Address:</strong> ${facility.address}</p>
            <p><strong>Services:</strong></p>
            <pre style="margin: 0; white-space: pre-wrap;">${getServicesString(facility.services)}</pre>
          `)
        );

        if (!markers.current[facility.facilityType]) {
          markers.current[facility.facilityType] = [];
        }
        
        markers.current[facility.facilityType].push(marker);

        // Check if facility should be shown based on both specialty and services
        const shouldShow = activeSpecialties[facility.facilityType] && 
          (!activeServiceTypes.inpatient || facility.services.inpatient) &&
          (!activeServiceTypes.outpatient || facility.services.outpatient) &&
          (!activeServiceTypes.children || facility.services.children) &&
          (!activeServiceTypes.adults || facility.services.adults);

        if (shouldShow) {
          marker.addTo(map.current);
        }
      }
    });
  }, [activeSpecialties, activeServiceTypes]);

  const addServiceAreaCircles = useCallback((providers) => {
    if (!map.current || !providers) return;

    Object.values(serviceCircles.current).forEach(circles => {
      circles.forEach(circle => circle.remove());
    });
    serviceCircles.current = {};

    providers.forEach(provider => {
      if (provider.longitude && provider.latitude && provider.county && provider.pri_spec) {
        const countyData = config.counties.find(c => 
          c?.name?.toUpperCase() === provider.county?.toUpperCase()
        );
        
        if (!countyData?.classification) return;

        const serviceType = provider.pri_spec;
        const distance = config.distances?.[serviceType]?.[countyData.classification];
        if (!distance) return;

        const radiusInKm = distance * 1.60934;

        const circle = new mapboxgl.Circle({
          lat: provider.latitude,
          lng: provider.longitude,
          radius: radiusInKm * 1000,
          properties: {
            serviceType: serviceType
          },
          paint: {
            'circle-color': '#3B82F6',
            'circle-opacity': 0.2,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#2563EB'
          }
        });

        if (!serviceCircles.current[serviceType]) {
          serviceCircles.current[serviceType] = [];
        }
        
        serviceCircles.current[serviceType].push(circle);
        
        if (activeServiceTypes[serviceType]) {
          circle.addTo(map.current);
        }
      }
    });
  }, [activeServiceTypes]);

  const initLegend = (data) => {
    const uniqueFacilityTypes = Array.from(new Set(data.map(item => item.facilityType).filter(Boolean)));
    
    setActiveSpecialties(
      uniqueFacilityTypes.reduce((acc, type) => ({ ...acc, [type]: true }), {})
    );

    // Initialize service types - all checked by default
    const serviceTypes = ['Inpatient', 'Outpatient', 'Children', 'Adults'];
    setActiveServiceTypes(
      serviceTypes.reduce((acc, service) => ({ ...acc, [service.toLowerCase()]: true }), {})
    );

    const uniqueRegions = Array.from(
      new Set(config.counties.map(county => county?.region).filter(Boolean))
    );
    setActiveRegions(
      uniqueRegions.reduce((acc, region) => ({ ...acc, [region.toString()]: true }), {})
    );
  };

  const toggleSpecialty = useCallback((specialty) => {
    setActiveSpecialties(prev => {
      const newState = { ...prev, [specialty]: !prev[specialty] };
      
      const specMarkers = markers.current[specialty] || [];
      specMarkers.forEach(marker => {
        if (newState[specialty]) {
          marker.addTo(map.current);
        } else {
          marker.remove();
        }
      });
      
      return newState;
    });
  }, []);

  const toggleServiceType = useCallback((serviceType) => {
    setActiveServiceTypes(prev => {
      const newState = { ...prev, [serviceType.toLowerCase()]: !prev[serviceType.toLowerCase()] };
      
      // Remove all markers
      Object.values(markers.current).forEach(markerArray => {
        markerArray.forEach(marker => marker.remove());
      });

      // Re-add markers that match the current filters
      Object.entries(markers.current).forEach(([facilityType, markerArray]) => {
        if (activeSpecialties[facilityType]) {
          markerArray.forEach(marker => {
            const facility = marker.facilityData;
            const services = facility.services;
            
            const shouldShow = 
              (!newState.inpatient || services.inpatient) &&
              (!newState.outpatient || services.outpatient) &&
              (!newState.children || services.children) &&
              (!newState.adults || services.adults);

            if (shouldShow) {
              marker.addTo(map.current);
            }
          });
        }
      });
      
      return newState;
    });
  }, [activeSpecialties]);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Provider Location Map - Proof of Concept. NOT INTENDED FOR ANALYSIS.
        </Typography>
        <Box sx={{ display: 'flex', height: '600px' }}>
          <Box
            ref={mapContainer}
            sx={{ 
              width: '75%', 
              border: 1, 
              borderColor: 'grey.300',
              borderRadius: 1,
              overflow: 'hidden'
            }}
          />
          <Box sx={{ width: '25%', pl: 2 }}>
            <Tabs
              value={tabValue}
              onChange={(e, newValue) => setTabValue(newValue)}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="Facilities" />
              <Tab label="Services - TODO" />
            </Tabs>
            
            <Box sx={{ mt: 2 }}>
              {tabValue === 0 && (
                <Box>
                  {Object.entries(activeSpecialties).map(([specialty, isActive]) => (
                    <Box key={specialty} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={isActive}
                            onChange={() => toggleSpecialty(specialty)}
                            size="small"
                          />
                        }
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                mr: 1,
                                bgcolor: getFacilityColor(specialty)
                              }}
                            />
                            <Typography variant="body2">{specialty}</Typography>
                          </Box>
                        }
                      />
                    </Box>
                  ))}
                </Box>
              )}
              
              {tabValue === 1 && (
                <Box>
                  {Object.entries(activeServiceTypes).map(([type, isActive]) => (
                    <Box key={type} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={isActive}
                            onChange={() => toggleServiceType(type)}
                            size="small"
                          />
                        }
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                mr: 1,
                                bgcolor: 'primary.main',
                                opacity: 0.2
                              }}
                            />
                            <Typography variant="body2">{type}</Typography>
                          </Box>
                        }
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ProviderLocationMapWithLegend;