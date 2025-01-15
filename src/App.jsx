import React, { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from './mapbox';
import { config } from './geographic-system-rules';
import 'mapbox-gl/dist/mapbox-gl.css';
import './styles/patterns';

import { 
  Card, 
  CardContent, 
  Typography, 
  Tabs, 
  Tab, 
  Box,
  Checkbox,
  FormControlLabel,
} from '@mui/material';

import MapContainer from './components/MapContainer';

const ProviderLocationMapWithLegend = () => {
  const [providerData, setProviderData] = useState([]);
  const [activeSpecialties, setActiveSpecialties] = useState({});
  const [activeServiceTypes, setActiveServiceTypes] = useState({});
  const [activeRegions, setActiveRegions] = useState({});
  const [countyBoundaries, setCountyBoundaries] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [facilityTypes, setFacilityTypes] = useState([]);
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef({});
  const serviceCircles = useRef({});

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

  // Create a stable mapping of facility types to colors
  const [facilityColorMap, setFacilityColorMap] = useState({});

  useEffect(() => {
    if (providerData.length > 0) {
      console.log('Initializing facility colors with data:', providerData);
      
      // Get unique facility types from the data
      const uniqueTypes = Array.from(new Set(providerData.map(item => item.facilityType)))
        .filter(type => type) // Remove null/undefined
        .sort(); // Sort alphabetically for stability

      console.log('Unique facility types:', uniqueTypes);

      // Create the mapping
      const colorMap = uniqueTypes.reduce((acc, type, index) => {
        acc[type] = facilityColorPalette[index % facilityColorPalette.length];
        return acc;
      }, {});

      // Add 'Other' as fallback
      colorMap['Other'] = '#6b7280';
      
      console.log('Created color map:', colorMap);
      setFacilityColorMap(colorMap);
      setFacilityTypes(uniqueTypes);
    }
  }, [providerData]);

  const getFacilityColor = useCallback((facilityType) => {
    return facilityColorMap[facilityType] || facilityColorMap['Other'];
  }, [facilityColorMap]);

  const getServicesString = (services) => {
    const serviceTypes = ['inpatient', 'outpatient', 'children', 'adults'];
    return serviceTypes.map(type => {
      const label = type.charAt(0).toUpperCase() + type.slice(1);
      const value = services[type];
      const color = value ? 'green' : 'red';
      return `<div><strong>${label}:</strong> <span style="color: ${color}">${value ? 'Yes' : 'No'}</span></div>`;
    }).join('');
  };

  const addProviderMarkers = useCallback((facilities) => {
    console.log('Adding provider markers with facilities:', facilities);
    console.log('Map reference:', map.current);
    console.log('Current color map:', facilityColorMap);
    
    if (!map.current || !facilities) {
      console.log('Map or facilities not ready');
      return;
    }

    console.log('Clearing existing markers');
    Object.values(markers.current).forEach(markerArray => {
      markerArray.forEach(marker => marker.remove());
    });
    markers.current = {};

    facilities.forEach((facility) => {
      if (facility.longitude && facility.latitude) {
        const color = getFacilityColor(facility.facilityType);
        console.log(`Creating marker for ${facility.facilityName} (${facility.facilityType}) with color ${color}`);
        
        const el = document.createElement('div');
        el.className = 'marker';
        el.style.backgroundColor = color;
        el.style.width = '10px';
        el.style.height = '10px';
        el.style.borderRadius = '50%';
        el.style.border = '1px solid rgba(0, 0, 0, 0.3)';

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
        marker.addTo(map.current);
        console.log('Marker added to map');
      }
    });
  }, [getFacilityColor, facilityColorMap]);

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

  const fetchData = async () => {
    try {
      const response = await fetch(
        'https://docs.google.com/spreadsheets/d/151zw22uDrD36sucJQEXKrviECu-rxsXGoTb8gy4xn5k/gviz/tq?gid=804300694'
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const text = await response.text();
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
              item[header] = cell?.v ? Number(cell.v) : null;
            } else {
              item[header] = cell?.v ?? null;
            }
          });
          return item;
        })
        .filter(item => item.FacilityName !== null);
      
      return data;
    } catch (error) {
      console.error('Error fetching data from Google Sheets:', error);
      return [];
    }
  };

  const findCountyFromCoordinates = (longitude, latitude, countyBoundaries) => {
    if (!countyBoundaries || !countyBoundaries.features) return null;

    const pointInPolygon = (point, polygon) => {
      if (polygon.type === 'MultiPolygon') {
        return polygon.coordinates.some(coords => 
          pointInSinglePolygon(point, coords[0])
        );
      }
      return pointInSinglePolygon(point, polygon.coordinates[0]);
    };

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
    
    const county = countyBoundaries.features.find(feature => {
      const geometry = feature.geometry;
      return pointInPolygon(point, geometry);
    });

    return county ? county.properties.COUNTY : null;
  };

  const flattenData = (data) => {
    if (!Array.isArray(data)) {
      console.error('Expected array of data but got:', typeof data);
      return [];
    }

    return data.map(item => {
      const longitude = item['Longitude(optional)'];
      const latitude = item['Latitude(optional)'];
      
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
        const geoJsonResponse = await fetch('./Colorado_County_Boundaries.geojson');
        if (!geoJsonResponse.ok) {
          throw new Error(`HTTP error! status: ${geoJsonResponse.status}`);
        }
        const geoJsonData = await geoJsonResponse.json();
        setCountyBoundaries(geoJsonData);

        const data = await fetchData();
        const enrichedData = flattenData(data);
        
        setProviderData(enrichedData);
        initMap();
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (mapLoaded && countyBoundaries && providerData.length > 0 && facilityColorMap) {
      console.log('Map loaded and data ready, adding features');
      addCountyBoundaries();
      addProviderMarkers(providerData);
      addServiceAreaCircles(providerData);
    }
  }, [mapLoaded, countyBoundaries, providerData, facilityColorMap, addProviderMarkers, addCountyBoundaries, addServiceAreaCircles]);

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

  const addCountyBoundaries = useCallback(() => {
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
  }, [countyBoundaries]);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Provider Location Map - Proof of Concept. NOT INTENDED FOR ANALYSIS.
        </Typography>
        <Box sx={{ display: 'flex', height: '600px' }}>
          <MapContainer mapRef={mapContainer} />
          <Box sx={{ width: '25%', pl: 2 }}>
            <Tabs
              value={tabValue}
              onChange={(e, newValue) => setTabValue(newValue)}
              aria-label="map controls"
            >
              <Tab label="Filters" />
              <Tab label="Legend" />
            </Tabs>
            <Box sx={{ mt: 2 }}>
              {tabValue === 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Facility Types
                  </Typography>
                  {Object.keys(activeSpecialties).map((specialty) => (
                    <FormControlLabel
                      key={specialty}
                      control={
                        <Checkbox
                          checked={activeSpecialties[specialty]}
                          onChange={() => toggleSpecialty(specialty)}
                        />
                      }
                      label={specialty}
                    />
                  ))}
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Service Types
                  </Typography>
                  {Object.keys(activeServiceTypes).map((service) => (
                    <FormControlLabel
                      key={service}
                      control={
                        <Checkbox
                          checked={activeServiceTypes[service]}
                          onChange={() => toggleServiceType(service)}
                        />
                      }
                      label={service}
                    />
                  ))}
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Regions
                  </Typography>
                  {Object.keys(activeRegions).map((region) => (
                    <FormControlLabel
                      key={region}
                      control={
                        <Checkbox
                          checked={activeRegions[region]}
                          onChange={() => toggleRegion(region)}
                        />
                      }
                      label={`Region ${region}`}
                    />
                  ))}
                </Box>
              )}
              {tabValue === 1 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Map Legend
                  </Typography>
                  {/* Add legend content here */}
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