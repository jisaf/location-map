import React, { useState } from 'react';
import { 
  Box,
  IconButton,
  Button,
  Paper,
  Collapse
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MapLegend from './MapLegend';

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

export default MapContainer;