import mapboxgl from '../mapbox';
import { config } from '../geographic-system-rules';

export const findCountyFromCoordinates = (longitude, latitude, countyBoundaries) => {
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

export const getServicesString = (services) => {
  const serviceTypes = ['inpatient', 'outpatient', 'children', 'adults'];
  return serviceTypes.map(type => {
    const label = type.charAt(0).toUpperCase() + type.slice(1);
    const value = services[type];
    const color = value ? 'green' : 'red';
    return `<div><strong>${label}:</strong> <span style="color: ${color}">${value ? 'Yes' : 'No'}</span></div>`;
  }).join('');
};

export const addCountyBoundaries = (map, countyBoundaries) => {
  if (!map || !countyBoundaries) return;

  if (!map.getSource('counties')) {
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

    map.addSource('counties', {
      type: 'geojson',
      data: updatedGeoJSON
    });

    // Add base fill layer for region colors
    map.addLayer({
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
    map.addLayer({
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

    map.addLayer({
      'id': 'county-borders',
      'type': 'line',
      'source': 'counties',
      'paint': {
        'line-color': '#000',
        'line-width': 1
      }
    });

    map.addLayer({
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

    map.on('click', 'county-fills', (e) => {
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
          .addTo(map);
      }
    });
  }
};