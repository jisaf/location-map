import React, { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from './mapbox';
import { config } from './geographic-system-rules';
import 'mapbox-gl/dist/mapbox-gl.css';

const legendStyles = `
  .large-metro-pattern {
    background-image: linear-gradient(45deg, #000 25%, transparent 25%),
                      linear-gradient(-45deg, #000 25%, transparent 25%),
                      linear-gradient(transparent 50%, #000 50%);
    background-size: 4px 4px;
  }
  
  .metro-pattern {
    background-image: linear-gradient(45deg, #000 25%, transparent 25%),
                      linear-gradient(-45deg, #000 25%, transparent 25%);
    background-size: 4px 4px;
  }
  
  .micro-pattern {
    background-image: linear-gradient(0deg, #000 1px, transparent 1px),
                      linear-gradient(90deg, #000 1px, transparent 1px);
    background-size: 4px 4px;
  }
  
  .rural-pattern {
    background-image: linear-gradient(0deg, #000 1px, transparent 1px);
    background-size: 4px 4px;
  }
  
  .ceac-pattern {
    background-image: linear-gradient(45deg, #000 1px, transparent 1px);
    background-size: 4px 4px;
  }
`;

const styleSheet = document.createElement('style');
styleSheet.type = 'text/css';
styleSheet.innerText = legendStyles;
document.head.appendChild(styleSheet);
// Using direct Google Sheets API instead of googleapis

import { 
  Card, 
  CardContent, 
  Typography, 
  Tabs, 
  Tab, 
  Box,
  Checkbox,
  FormControlLabel,
  Grid,
  Paper,
  IconButton,
  Collapse,
  Button
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const MapContainer = ({ mapRef }) => {
  const [showLegend, setShowLegend] = useState(false);

  return (
    <Box
      ref={mapRef}
      sx={{
        width: '75%',
        border: 1,
        borderColor: 'grey.300',
        borderRadius: 1,
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 1,
          display: 'flex',
          alignItems: 'flex-start'
        }}
      >
        <Collapse 
          in={showLegend} 
          orientation="horizontal"
          timeout={300}
        >
          <Paper
            elevation={3}
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              position: 'relative'
            }}
          >
            <MapLegend />
            <IconButton
              onClick={() => setShowLegend(!showLegend)}
              sx={{
                position: 'absolute',
                top: 0,
                right: -40,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 1)'
                },
                transform: showLegend ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.3s ease-in-out'
              }}
            >
              <ChevronRightIcon />
            </IconButton>
          </Paper>
        </Collapse>
        {!showLegend && (
          <Button
            onClick={() => setShowLegend(true)}
            startIcon={<ChevronRightIcon />}
            variant="contained"
            size="small"
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              color: 'black',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 1)'
              },
              textTransform: 'none'
            }}
          >
            Legend
          </Button>
        )}
      </Box>

    </Box>
  );
};



const MapLegend = () => {
  const regionColors = [
    { region: 'Region 1', color: '#87CEEB' },
    { region: 'Region 2', color: '#90EE90' },
    { region: 'Region 3', color: '#FFA500' },
    { region: 'Region 4', color: '#FF6347' }
  ];

  const classificationPatterns = [
    { name: 'Large Metro', pattern: 'large-metro-pattern' },
    { name: 'Metro', pattern: 'metro-pattern' },
    { name: 'Micro', pattern: 'micro-pattern' },
    { name: 'Rural', pattern: 'rural-pattern' },
    { name: 'CEAC', pattern: 'ceac-pattern' }
  ];

  return (
    <Box sx={{ padding: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>BHASO Regions</Typography>
          <Grid container spacing={1}>
            {regionColors.map(({ region, color }) => (
              <Grid item xs={3} key={region} sx={{ display: 'flex', alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    backgroundColor: color,
                    marginRight: 1
                  }}
                />
                <Typography variant="caption">{region}</Typography>
              </Grid>
            ))}
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>County Classifications</Typography>
          <Grid container spacing={1}>
            {classificationPatterns.map(({ name, pattern }) => (
              <Grid item xs={12} sm={2.4} key={name} sx={{ display: 'flex', alignItems: 'center' }}>
                <Box
                  className={pattern}
                  sx={{
                    width: 10,
                    height: 10,
                    border: '1px solid #000',
                    marginRight: 1
                  }}
                />
                <Typography variant="caption">{name}</Typography>
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

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
      console.log(jsonText)
      const jsonData = JSON.parse(jsonText);
      console.log('Parsed JSON data:', jsonData);
      const table = jsonData.table;
      const headers = table.cols.map(col => col.label.trim());
      console.log('Headers:', headers);
      
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
      
      console.log('Processed data:', data);
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

  // Stable color palette for facility types
  const facilityColorPalette = [
    '#2E7D32', // Green
    '#1565C0', // Blue
    '#C62828', // Red
    '#6A1B9A', // Purple
    '#EF6C00', // Orange
    '#2E7D7D', // Teal
    '#283593', // Indigo
    '#8E24AA', // Pink
    '#558B2F', // Light Green
    '#D84315', // Deep Orange
    '#4527A0', // Deep Purple
    '#00838F', // Cyan
    '#4E342E', // Brown
    '#37474F', // Blue Grey
    '#FF8F00', // Amber
  ];

  // Create a stable mapping of facility types to colors
  const [facilityColorMap, setFacilityColorMap] = useState({});

  useEffect(() => {
    if (providerData.length > 0) {
      // Get unique facility types from the data
      const uniqueTypes = Array.from(new Set(providerData.map(item => item.facilityType)))
        .filter(type => type) // Remove null/undefined
        .sort(); // Sort alphabetically for stability

      // Update the facility types state
      setFacilityTypes(uniqueTypes);

      // Create the mapping
      const colorMap = uniqueTypes.reduce((acc, type, index) => {
        acc[type] = facilityColorPalette[index % facilityColorPalette.length];
        return acc;
      }, {});

      // Add 'Other' as fallback
      colorMap['Other'] = '#6b7280';
      
      setFacilityColorMap(colorMap);
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

  const flattenData = (data) => {
    if (!Array.isArray(data)) {
      console.error('Expected array of data but got:', typeof data);
      return [];
    }

    return data.map(item => {
      console.log(item)
      // Coordinates should already be numbers from fetchData
      const longitude = item['Longitude(optional)'];
      const latitude = item['Latitude(optional)'];
      console.log('Using coordinates:', { longitude, latitude });
      
      // Get county from coordinates if available
      let county = '';
      if (longitude && latitude && countyBoundaries) {
        county = findCountyFromCoordinates(longitude, latitude, countyBoundaries);
        if (county) {
          console.log(`Found county from coordinates for ${item['FacilityName']}: ${county}`);
        }
      }
      console.log('Processing item:', item);
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
        console.log('Raw data from fetchData:', data);
        const enrichedData = flattenData(data);
        console.log('Enriched data:', enrichedData);
        
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
    console.log('Initializing map, current map ref:', map.current);
    if (map.current) return;

    try {
      console.log('Creating new map instance');
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v10',
        center: [-105.2705, 40.0150],
        zoom: 6
      });

      map.current.on('load', () => {
        console.log('Map loaded successfully');
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
      map.current.addImage('pattern-large-metro', {
        width: 8,
        height: 8,
        data: new Uint8Array(256).map((_, i) => {
          const x = i % 8;
          const y = Math.floor(i / 8);
          // Dense crosshatch (diagonal lines + horizontal line)
          return (x === y || x === (7 - y) || y === 4) ? 255 : 0;
        })
      });

      map.current.addImage('pattern-metro', {
        width: 8,
        height: 8,
        data: new Uint8Array(256).map((_, i) => {
          const x = i % 8;
          const y = Math.floor(i / 8);
          // Crosshatch (diagonal lines)
          return (x === y || x === (7 - y)) ? 255 : 0;
        })
      });

      map.current.addImage('pattern-micro', {
        width: 8,
        height: 8,
        data: new Uint8Array(256).map((_, i) => {
          const x = i % 8;
          const y = Math.floor(i / 8);
          // Grid (vertical and horizontal lines)
          return (x % 4 === 0 || y % 4 === 0) ? 255 : 0;
        })
      });

      map.current.addImage('pattern-rural', {
        width: 8,
        height: 8,
        data: new Uint8Array(256).map((_, i) => {
          const y = Math.floor(i / 8);
          // Single horizontal line
          return y === 4 ? 255 : 0;
        })
      });

      map.current.addImage('pattern-ceac', {
        width: 8,
        height: 8,
        data: new Uint8Array(256).map((_, i) => {
          const x = i % 8;
          const y = Math.floor(i / 8);
          // Single diagonal line
          return x === y ? 255 : 0;
        })
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
    console.log('Adding provider markers with facilities:', facilities);
    console.log('Map reference:', map.current);
    if (!map.current || !facilities) return;

    console.log('Clearing existing markers');
    Object.values(markers.current).forEach(markerArray => {
      markerArray.forEach(marker => marker.remove());
    });
    markers.current = {};

    facilities.forEach((facility) => {
      console.log('Processing facility for marker:', facility);
      if (facility.longitude && facility.latitude) {
        console.log('Creating marker for facility:', facility.facilityName);
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

        console.log('Marker created:', marker);
        if (!markers.current[facility.facilityType]) {
          markers.current[facility.facilityType] = [];
        }
        
        markers.current[facility.facilityType].push(marker);
        marker.addTo(map.current);
      }
    });
  }, [getFacilityColor]);

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
    console.log('Initializing legend with data:', data);
    const uniqueFacilityTypes = Array.from(new Set(data.map(item => item.facilityType).filter(Boolean)));
    console.log('Unique facility types:', uniqueFacilityTypes);
    
    const specialties = uniqueFacilityTypes.reduce((acc, type) => ({ ...acc, [type]: true }), {});
    console.log('Setting active specialties:', specialties);
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
          <MapContainer mapRef={mapContainer} />
          <Box sx={{ width: '25%', pl: 2 }}>
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
