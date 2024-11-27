// public/geoJsonWorker.js
self.onmessage = function(e) {
    const geojson = e.data;
    const processedFeatures = geojson.features.map(feature => ({
      ...feature,
      properties: {
        ...feature.properties,
        REGION: feature.properties.REGION || 0
      }
    }));
    self.postMessage({ ...geojson, features: processedFeatures });
  };