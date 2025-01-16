import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';

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
          { name: 'Large Metro', pattern: 'large-metro-pattern' },
          { name: 'Metro', pattern: 'metro-pattern' },
          { name: 'Micro', pattern: 'micro-pattern' },
          { name: 'Rural', pattern: 'rural-pattern' },
          { name: 'CEAC', pattern: 'ceac-pattern' }
        ].map(({ name, pattern }) => (
          <Box key={name} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Box
              className={pattern}
              sx={{
                width: 20,
                height: 20,
                border: '1px solid #000',
                mr: 1,
                backgroundColor: 'white'
              }}
            />
            <Typography variant="body2">{name}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default RightPanel;
