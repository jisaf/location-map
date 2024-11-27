import React, { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from './mapbox';
import Papa from 'papaparse';
import { config } from './geographic-system-rules';
import 'mapbox-gl/dist/mapbox-gl.css';

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

  // Define parseCSVData before it's used
  const parseCSVData = (csvContent) => {
    return new Promise((resolve, reject) => {
      Papa.parse(csvContent, {
        download: false,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          console.log('Sample row:', results.data[0]);
          console.log('Available columns:', Object.keys(results.data[0]));
          resolve(results.data);
        },
        error: (error) => reject(error)
      });
    });
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

  const flattenData = (parsedData) => {
    return parsedData.reduce((acc, curr) => {
      return acc.concat(curr.map(item => {
        // Handle different types of records (hospitals vs providers)
        const isHospital = item.Facility_Name && item.Facility_Type;
        const longitude = Number(item.longitude || item.X);
        const latitude = Number(item.latitude || item.Y);
        
        // Get county from data or find it from coordinates
        let county = item.County || item.county || '';
        if (!county && longitude && latitude && countyBoundaries) {
          county = findCountyFromCoordinates(longitude, latitude, countyBoundaries);
          console.log(`Found county from coordinates for ${isHospital ? item.Facility_Name : item['Provider Last Name']}: ${county}`);
        }
        
        return {
          'Provider Last Name': isHospital ? item.Facility_Name : (item['Provider Last Name'] || item['Name'] || ''),
          'Provider First Name': isHospital ? '' : (item['Provider First Name'] || item['First Name'] || ''),
          NPI: item.NPI,
          'pri_spec': item.Facility_Type || item.pri_spec || 'Jail',
          gndr: item.gndr,
          address: item.Address_Full || `${item['adr_ln_1'] || item['Address'] || ''}, ${item['City/Town'] || item.City || ''}, CO ${item['ZIP Code'] || item['Zip Code'] || ''}`,
          longitude,
          latitude,
          county,
          facilityType: item.Facility_Type || item.Facility_Type_Detail || ''
        };
      }));
    }, []);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch county boundaries first
        const geoJsonResponse = await fetch('./Colorado_County_Boundaries.geojson', {
          cache: 'no-store'
        });
        if (!geoJsonResponse.ok) {
          throw new Error(`HTTP error! status: ${geoJsonResponse.status}`);
        }
        const geoJsonData = await geoJsonResponse.json();
        setCountyBoundaries(geoJsonData);

        // Then fetch and process provider data
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
        
        // Debug log to verify county data
        console.log('Sample of processed data:', 
          enrichedData.slice(0, 3).map(item => ({
            name: item['Provider Last Name'],
            county: item.county,
            pri_spec: item.pri_spec,
            location: [item.longitude, item.latitude]
          }))
        );
        
        setProviderData(enrichedData);
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

  const addProviderMarkers = useCallback((providers) => {
    if (!map.current || !providers) return;

    Object.values(markers.current).forEach(markerArray => {
      markerArray.forEach(marker => marker.remove());
    });
    markers.current = {};

    providers.forEach((provider) => {
      if (provider.longitude && provider.latitude) {
        const el = document.createElement('div');
        el.className = 'marker';
        el.style.backgroundColor = provider.pri_spec === 'Jail' 
          ? '#22c55e'
          : provider.pri_spec === 'Hospital' || provider.pri_spec === 'Community Clinic'
            ? '#ef4444'
            : '#eab308';
        el.style.width = '8px';
        el.style.height = '8px';
        el.style.borderRadius = '50%';

        const marker = new mapboxgl.Marker(el)
          .setLngLat([provider.longitude, provider.latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <h3>${provider['Provider Last Name']}, ${provider['Provider First Name']}</h3>
              <p>NPI: ${provider.NPI || 'N/A'}</p>
              <p>Primary Specialty: ${provider.pri_spec || 'N/A'}</p>
              <p>Gender: ${provider.gndr || 'N/A'}</p>
            `)
          );

        if (!markers.current[provider.pri_spec]) {
          markers.current[provider.pri_spec] = [];
        }
        
        markers.current[provider.pri_spec].push(marker);

        if (activeSpecialties[provider.pri_spec]) {
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
    const uniqueSpecialties = Array.from(new Set(data.map(item => item.pri_spec).filter(Boolean)));
    
    setActiveSpecialties(
      uniqueSpecialties.reduce((acc, spec) => ({ ...acc, [spec]: true }), {})
    );

    setActiveServiceTypes(
      uniqueSpecialties.reduce((acc, spec) => ({ ...acc, [spec]: false }), {})
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
      
      const typeCircles = serviceCircles.current[serviceType] || [];
      typeCircles.forEach(circle => {
        if (newState[serviceType]) {
          circle.addTo(map.current);
        } else {
          circle.remove();
        }
      });
      
      return newState;
    });
  }, []);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Provider Location Map
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
                                bgcolor: specialty === 'Jail' 
                                  ? 'success.main'
                                  : specialty === 'Hospital' || specialty === 'Community Clinic'
                                    ? 'error.main'
                                    : 'warning.main'
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