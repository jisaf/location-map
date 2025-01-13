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
  const [activeServiceTypes, setActiveServiceTypes] = useState({});
  const [activeRegions, setActiveRegions] = useState({});
  const [countyBoundaries, setCountyBoundaries] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef({});
  const serviceCircles = useRef({});


  const fetchData = async () => {
    try {
      const response = await fetch(
        'https://docs.google.com/spreadsheets/d/151zw22uDrD36sucJQEXKrviECu-rxsXGoTb8gy4xn5k/gviz/tq?gid=804300694'
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const text = await response.text();
      // Extract the JSON part from the response (it's wrapped in a callback)
      const jsonText = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/)?.[1];
      if (!jsonText) {
        throw new Error('Invalid response format');
      }
      const jsonData = JSON.parse(jsonText);
      const table = jsonData.table;
      const headers = table.cols.map(col => col.label.trim());
      
      const data = table.rows
        .map(row => {
          const item = {};
          row.c.forEach((cell, index) => {
            const header = headers[index].replace(/\s+/g, '');
            if (header === 'Longitude' || header === 'Latitude') {
              // Parse coordinates as numbers
              item[header] = cell?.v ? Number(cell.v) : null;
            } else {
              item[header] = cell?.v ?? null;
            }
          });
          return item;
        })
        .filter(item => item.FacilityName !== null); // Drop rows with null Facility Name
      
      return data;
    } catch (error) {
      console.error('Error fetching data from Google Sheets:', error);
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
    const serviceTypes = ['inpatient', 'outpatient', 'children', 'adults'];
    return serviceTypes.map(type => {
      const label = type.charAt(0).toUpperCase() + type.slice(1);
      const value = services[type];
      const color = value ? 'green' : 'red';
      return `<div><strong>${label}:</strong> <span style="color: ${color}">${value ? 'Yes' : 'No'}</span></div>`;
    }).join('');
  };

  const flattenData = (data) => {
    if (!Array.isArray(data)) {
      console.error('Expected array of data but got:', typeof data);
      return [];
    }

    return data.map(item => {
      const longitude = item['Longitude(optional)'];
      const latitude = item['Latitude(optional)'];
      
      // Get county from coordinates if available
      let county = '';
      if (longitude && latitude && countyBoundaries) {
        county = findCountyFromCoordinates(longitude, latitude, countyBoundaries);
      }
      return {
        facilityName: item['FacilityName'],
        facilityType: item['FacilityType'],
        address: `${item['StreetAddress']}, ${item['City']}, ${item['State']} ${item['Zip']}`,
        longitude,
        latitude,
        county,
        services: {
          inpatient: String(item['Inpatient']).toLowerCase() === 'true' || item['Inpatient'] === true,
          outpatient: String(item['Outpatient']).toLowerCase() === 'true' || item['Outpatient'] === true,
          children: String(item['Children']).toLowerCase() === 'true' || item['Children'] === true,
          adults: String(item['Adults']).toLowerCase() === 'true' || item['Adults'] === true
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

      // Add pattern images when the map loads
      map.current.on('style.load', () => {
        // Large Metro - Dense crosshatch pattern
        const largeMetroCanvas = document.createElement('canvas');
        largeMetroCanvas.width = 12;
        largeMetroCanvas.height = 12;
        const largeMetroCtx = largeMetroCanvas.getContext('2d');
        largeMetroCtx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        largeMetroCtx.lineWidth = 1;
        largeMetroCtx.beginPath();
        largeMetroCtx.moveTo(0, 12);
        largeMetroCtx.lineTo(12, 0);
        largeMetroCtx.moveTo(0, 0);
        largeMetroCtx.lineTo(12, 12);
        largeMetroCtx.moveTo(0, 6);
        largeMetroCtx.lineTo(12, 6);
        largeMetroCtx.stroke();
        map.current.addImage('large-metro-pattern', { width: 12, height: 12, data: largeMetroCtx.getImageData(0, 0, 12, 12).data });

        // Metro - Crosshatch pattern
        const metroCanvas = document.createElement('canvas');
        metroCanvas.width = 16;
        metroCanvas.height = 16;
        const metroCtx = metroCanvas.getContext('2d');
        metroCtx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        metroCtx.lineWidth = 1;
        metroCtx.beginPath();
        metroCtx.moveTo(0, 16);
        metroCtx.lineTo(16, 0);
        metroCtx.moveTo(0, 0);
        metroCtx.lineTo(16, 16);
        metroCtx.stroke();
        map.current.addImage('metro-pattern', { width: 16, height: 16, data: metroCtx.getImageData(0, 0, 16, 16).data });

        // Micro - Grid pattern
        const microCanvas = document.createElement('canvas');
        microCanvas.width = 16;
        microCanvas.height = 16;
        const microCtx = microCanvas.getContext('2d');
        microCtx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        microCtx.lineWidth = 1;
        microCtx.beginPath();
        microCtx.moveTo(8, 0);
        microCtx.lineTo(8, 16);
        microCtx.moveTo(0, 8);
        microCtx.lineTo(16, 8);
        microCtx.stroke();
        map.current.addImage('micro-pattern', { width: 16, height: 16, data: microCtx.getImageData(0, 0, 16, 16).data });

        // Rural - Horizontal lines
        const ruralCanvas = document.createElement('canvas');
        ruralCanvas.width = 16;
        ruralCanvas.height = 16;
        const ruralCtx = ruralCanvas.getContext('2d');
        ruralCtx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ruralCtx.lineWidth = 1;
        ruralCtx.beginPath();
        ruralCtx.moveTo(0, 8);
        ruralCtx.lineTo(16, 8);
        ruralCtx.stroke();
        map.current.addImage('rural-pattern', { width: 16, height: 16, data: ruralCtx.getImageData(0, 0, 16, 16).data });

        // CEACs - Diagonal lines
        const ceacsCanvas = document.createElement('canvas');
        ceacsCanvas.width = 16;
        ceacsCanvas.height = 16;
        const ceacsCtx = ceacsCanvas.getContext('2d');
        ceacsCtx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ceacsCtx.lineWidth = 1;
        ceacsCtx.beginPath();
        ceacsCtx.moveTo(0, 16);
        ceacsCtx.lineTo(16, 0);
        ceacsCtx.stroke();
        map.current.addImage('ceacs-pattern', { width: 16, height: 16, data: ceacsCtx.getImageData(0, 0, 16, 16).data });
      });

      map.current.on('load', () => {
        setMapLoaded(true);
      });
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  };

  const addCountyBoundaries = () => {
    if (!map.current || !countyBoundaries) return;

    if (!map.current.getSource('counties')) {
      const countyLookup = config.counties.reduce((acc, county) => {
        if (county && county.name) {
          acc[county.name.toUpperCase()] = {
            region: county.region,
            classification: county.classification
          };
        }
        return acc;
      }, {});

      const updatedGeoJSON = {
        ...countyBoundaries,
        features: countyBoundaries.features.map(feature => {
          const countyInfo = feature.properties?.COUNTY ? countyLookup[feature.properties.COUNTY] : null;
          return {
            ...feature,
            properties: {
              ...feature.properties,
              REGION: countyInfo?.region || 0,
              CLASSIFICATION: countyInfo?.classification || 'Frontier'
            }
          };
        })
      };

      map.current.addSource('counties', {
        type: 'geojson',
        data: updatedGeoJSON
      });

      // Add base fill layer
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
          'fill-opacity': 0.3
        }
      });

      // Add pattern fill layer
      map.current.addLayer({
        'id': 'county-patterns',
        'type': 'fill',
        'source': 'counties',
        'paint': {
          'fill-pattern': [
            'match',
            ['get', 'CLASSIFICATION'],
            'Large Metro', 'large-metro-pattern',
            'Metro', 'metro-pattern',
            'Micro', 'micro-pattern',
            'Rural', 'rural-pattern',
            'CEACs', 'ceacs-pattern',
            'rural-pattern' // default pattern
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

        const marker = new mapboxgl.Marker(el)
          .setLngLat([facility.longitude, facility.latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <h3>${facility.facilityName}</h3>
              <p><strong>Type:</strong> ${facility.facilityType}</p>
              <p><strong>Address:</strong> ${facility.address}</p>
              <p><strong>Services:</strong> ${getServicesString(facility.services)}</p>
            `)
          );

        if (!markers.current[facility.facilityType]) {
          markers.current[facility.facilityType] = [];
        }
        
        markers.current[facility.facilityType].push(marker);
        
        if (activeSpecialties[facility.facilityType]) {
          marker.addTo(map.current);
        }
      }
    });
  }, [activeSpecialties]);

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
    const specialties = uniqueFacilityTypes.reduce((acc, type) => ({ ...acc, [type]: true }), {});
    setActiveSpecialties(specialties);

    // Initialize service types based on available services - all checked by default
    const serviceTypes = ['Inpatient', 'Outpatient', 'Children', 'Adults'];
    setActiveServiceTypes(
      serviceTypes.reduce((acc, service) => ({ ...acc, [service]: true }), {})
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
      const newState = { ...prev, [serviceType]: !prev[serviceType] };
      
      // Get all active service types after the toggle
      const activeTypes = Object.entries(newState)
        .filter(([_, isActive]) => isActive)
        .map(([type]) => type.toLowerCase());
      
      // Show markers for facilities that offer any of the active services
      Object.entries(markers.current).forEach(([facilityType, facilityMarkers]) => {
        facilityMarkers.forEach(marker => {
          // Find facility by coordinates since they're unique
          const coords = marker.getLngLat();
          const facility = providerData.find(f => 
            f.longitude === coords.lng && f.latitude === coords.lat
          );
          
          if (!facility) {
            console.warn('Could not find facility for marker at', coords);
            return;
          }
          
          // Show marker if facility offers any of the active services
          const shouldShow = activeTypes.length === 0 || // Show all if no services selected
            activeTypes.some(type => facility.services[type]);
          
          if (shouldShow && activeSpecialties[facilityType]) {
            marker.addTo(map.current);
          } else {
            marker.remove();
          }
        });
      });
      
      return newState;
    });
  }, [providerData, activeSpecialties]);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Provider Location Map - Proof of Concept. NOT INTENDED FOR ANALYSIS.
        </Typography>
        <Box sx={{ display: 'flex', height: '600px' }}>
          <Box sx={{ width: '75%', display: 'flex', flexDirection: 'column' }}>
            <Box
              ref={mapContainer}
              sx={{ 
                width: '100%', 
                height: '100%',
                border: 1, 
                borderColor: 'grey.300',
                borderRadius: 1,
                overflow: 'hidden'
              }}
            />
            <Box sx={{ mt: 1, textAlign: 'right' }}>
              <a 
                href="https://docs.google.com/spreadsheets/d/151zw22uDrD36sucJQEXKrviECu-rxsXGoTb8gy4xn5k/edit?gid=804300694#gid=804300694"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#666', textDecoration: 'none' }}
              >
                Source Data
              </a>
            </Box>
          </Box>
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