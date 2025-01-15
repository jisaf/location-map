import React from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  FormControlLabel,
  Checkbox,
  Divider
} from '@mui/material';

const RightPanel = ({
  tabValue,
  setTabValue,
  facilityTypes,
  getFacilityColor,
  activeSpecialties,
  toggleSpecialty,
  activeServiceTypes,
  toggleServiceType,
  activeRegions,
  toggleRegion
}) => {
  return (
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
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={activeSpecialties[type]}
                      onChange={() => toggleSpecialty(type)}
                    />
                  }
                  label={type}
                />
              </Box>
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
                    width: 10,
                    height: 10,
                    border: '1px solid #000',
                    mr: 1
                  }}
                />
                <Typography variant="body2">{name}</Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default RightPanel;
