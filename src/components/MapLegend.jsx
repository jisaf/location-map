import React from 'react';
import { 
  Typography, 
  Box,
  Grid,
} from '@mui/material';

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

export default MapLegend;