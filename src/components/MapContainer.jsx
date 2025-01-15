import React from 'react';
import { Box } from '@mui/material';

const MapContainer = ({ mapRef }) => {
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
    />
  );
};

export default MapContainer;