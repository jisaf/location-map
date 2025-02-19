import React, { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from './mapbox';
import { config } from './geographic-system-rules';
import { patterns } from './patterns';
import 'mapbox-gl/dist/mapbox-gl.css';
import RightPanel from './components/RightPanel';
// Using direct Google Sheets API instead of googleapis

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import MenuIcon from '@mui/icons-material/Menu';

const ProviderLocationMapWithLegend = () => {
  const [providerData, setProviderData] = useState([]);
  const [activeSpecialties, setActiveSpecialties] = useState({});
  const [activeServiceTypes, setActiveServiceTypes] = useState({});
  const [activeRegions, setActiveRegions] = useState({
    1: true,
    2: true,
    3: true,
    4: true
  });
  const [countyBoundaries, setCountyBoundaries] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [facilityTypes, setFacilityTypes] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  // Stable color palette for facility types - using darker, more saturated colors
  // to contrast with the lighter, pastel region colors
  const facilityColorPalette = [
    '#D32F2F', // Red
    '#1976D2', // Blue
    '#388E3C', // Green
    '#7B1FA2', // Purple
    '#F57C00', // Orange
    '#0097A7', // Cyan
    '#512DA8', // Deep Purple
    '#C2185B', // Pink
    '#FBC02D', // Yellow
    '#455A64', // Blue Grey
    '#2E7D32', // Dark Green
    '#1565C0', // Dark Blue
    '#6D4C41', // Brown
    '#B71C1C', // Dark Red
    '#004D40', // Dark Teal
  ];

  useEffect(() => {
    if (providerData.length > 0) {
      // Get unique facility types from the data
      const uniqueTypes = Array.from(new Set(providerData.map(item => item.facilityType)))
        .filter(type => type) // Remove null/undefined
        .sort(); // Sort alphabetically for stability
      
      setFacilityTypes(uniqueTypes);
    }
  }, [providerData]);

  const getFacilityColor = useCallback((facilityType) => {
    if (!facilityType) return '#6b7280'; // Default color for undefined/null

    // Get unique facility types and create color mapping on demand
    const uniqueTypes = Array.from(new Set(providerData.map(item => item.facilityType)))
      .filter(type => type)
      .sort();

    const typeIndex = uniqueTypes.indexOf(facilityType);
    if (typeIndex !== -1) {
      return facilityColorPalette[typeIndex % facilityColorPalette.length];
    }

    return '#6b7280'; // Default color for unknown types
  }, [providerData]);

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
      // Coordinates should already be numbers from fetchData
      const longitude = item['Longitude(optional)'];
      const latitude = item['Latitude(optional)'];
      
      // Get county from coordinates if available
      let county = '';
      if (longitude && latitude && countyBoundaries) {
        county = findCountyFromCoordinates(longitude, latitude, countyBoundaries);
        if (county) {
        }
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
      const regionLookup = config.counties.reduce((acc, county) => {
        if (county && county.name) {
          acc[county.name.toUpperCase()] = county.region;
        }
        return acc;
      }, {});

      const classificationLookup = config.counties.reduce((acc, county) => {
        if (county && county.name) {
          acc[county.name.toUpperCase()] = county.classification;
        }
        return acc;
      }, {});

      const updatedGeoJSON = {
        ...countyBoundaries,
        features: countyBoundaries.features.map(feature => ({
          ...feature,
          properties: {
            ...feature.properties,
            REGION: feature.properties?.COUNTY ? regionLookup[feature.properties.COUNTY] || 0 : 0,
            CLASSIFICATION: feature.properties?.COUNTY ? classificationLookup[feature.properties.COUNTY] || 'Unknown' : 'Unknown'
          }
        }))
      };

      // Add patterns
      Object.entries(patterns).forEach(([name, pattern]) => {
        map.current.addImage(`pattern-${name}`, pattern);
      });

      map.current.addSource('counties', {
        type: 'geojson',
        data: updatedGeoJSON
      });

      // Add base fill layer for region colors
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
          'fill-opacity': 0.7
        }
      });

      // Add pattern layer on top
      map.current.addLayer({
        'id': 'county-patterns',
        'type': 'fill',
        'source': 'counties',
        'paint': {
          'fill-pattern': [
            'match',
            ['get', 'CLASSIFICATION'],
            'Large Metro', 'pattern-large-metro',
            'Metro', 'pattern-metro',
            'Micro', 'pattern-micro',
            'Rural', 'pattern-rural',
            'CEAC', 'pattern-ceac',
            'pattern-rural' // default pattern
          ]
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

  const toggleRegion = useCallback((region) => {
    setActiveRegions(prev => {
      const newState = { ...prev, [region]: !prev[region] };
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
          <Box sx={{ position: 'relative', flex: 1 }}>
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
            <IconButton
              sx={{
                position: 'absolute',
                top: 10,
                left: 10,
                backgroundColor: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                },
                boxShadow: 1
              }}
              onClick={() => setDrawerOpen(true)}
            >
              <MenuIcon />
            </IconButton>
            <Drawer
              anchor="left"
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              PaperProps={{
                sx: { width: 300 }
              }}
            >
              <RightPanel
                facilityTypes={facilityTypes}
                getFacilityColor={getFacilityColor}
              />
            </Drawer>
          </Box>
          <Box sx={{ width: '300px', pl: 2, overflowY: 'auto' }}>
            <Tabs
              value={tabValue}
              onChange={(e, newValue) => setTabValue(newValue)}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="Facilities" />
              <Tab label="Services" />
            </Tabs>
            <Box sx={{ mt: 2 }}>
              {tabValue === 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Facility Types
                  </Typography>
                  {facilityTypes.map((type) => (
                    <Box key={type} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: getFacilityColor(type),
                          border: '1px solid rgba(0, 0, 0, 0.3)',
                          mr: 1
                        }}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={activeSpecialties[type]}
                            onChange={() => toggleSpecialty(type)}
                            size="small"
                          />
                        }
                        label={type}
                        sx={{ flex: 1 }}
                      />
                    </Box>
                  ))}
                </Box>
              )}
              {tabValue === 1 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Service Types
                  </Typography>
                  {Object.entries(activeServiceTypes).map(([type, isActive]) => (
                    <Box key={type} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: 'primary.main',
                          opacity: isActive ? 1 : 0.3,
                          mr: 1
                        }}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={isActive}
                            onChange={() => toggleServiceType(type)}
                            size="small"
                          />
                        }
                        label={type}
                        sx={{ flex: 1 }}
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
