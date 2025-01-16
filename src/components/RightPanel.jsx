import React, { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { patterns } from '../patterns';

const createPatternCanvas = (pattern, size = 20) => {
  // First create a small canvas with the original pattern
  const smallCanvas = document.createElement('canvas');
  smallCanvas.width = pattern.width;
  smallCanvas.height = pattern.height;
  const smallCtx = smallCanvas.getContext('2d', { willReadFrequently: true });
  
  // Create the pattern data
  const imageData = smallCtx.createImageData(pattern.width, pattern.height);
  for (let i = 0; i < pattern.data.length; i += 4) {
    // If any channel is white (255), make the pixel black
    const isWhite = pattern.data[i] === 255;
    imageData.data[i] = isWhite ? 0 : 255;     // R
    imageData.data[i + 1] = isWhite ? 0 : 255; // G
    imageData.data[i + 2] = isWhite ? 0 : 255; // B
    imageData.data[i + 3] = isWhite ? 255 : 0; // A
  }
  smallCtx.putImageData(imageData, 0, 0);

  // Create the final scaled canvas
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(smallCanvas, 0, 0, size, size);
  
  return canvas;
};

const PatternBox = ({ pattern, size = 20 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current) {
      const patternCanvas = createPatternCanvas(pattern, size);
      const ctx = canvasRef.current.getContext('2d');
      ctx.drawImage(patternCanvas, 0, 0);
    }
  }, [pattern, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        border: '1px solid black',
        marginRight: '8px',
        backgroundColor: 'white'
      }}
    />
  );};

const RightPanel = ({
  facilityTypes,
  getFacilityColor
}) => {
  return (
    <Box sx={{ width: 300, p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Map Legend
      </Typography>
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Facility Types
        </Typography>
        {facilityTypes.map((type) => (
          <Box key={type} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                backgroundColor: getFacilityColor(type),
                borderRadius: '50%',
                border: '1px solid rgba(0, 0, 0, 0.3)',
                mr: 1
              }}
            />
            <Typography variant="body2">{type}</Typography>
          </Box>
        ))}
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" gutterBottom>
          BHASO Regions
        </Typography>
        {[
          { region: 'Region 1', color: '#87CEEB' },
          { region: 'Region 2', color: '#90EE90' },
          { region: 'Region 3', color: '#FFA500' },
          { region: 'Region 4', color: '#FF6347' }
        ].map(({ region, color }) => (
          <Box key={region} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                backgroundColor: color,
                mr: 1
              }}
            />
            <Typography variant="body2">{region}</Typography>
          </Box>
        ))}
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" gutterBottom>
          County Classifications
        </Typography>
        {[
          { name: 'Large Metro', pattern: 'large-metro' },
          { name: 'Metro', pattern: 'metro' },
          { name: 'Micro', pattern: 'micro' },
          { name: 'Rural', pattern: 'rural' },
          { name: 'CEAC', pattern: 'ceac' }
        ].map(({ name, pattern }) => (
          <Box key={name} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <PatternBox pattern={patterns[pattern]} size={20} />
            <Typography variant="body2">{name}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default RightPanel;
