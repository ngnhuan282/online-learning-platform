import { CircularProgress, Stack, Typography } from '@mui/material';
export default function AppLoading({ label = 'Đang tải…' }) {
  return (
    <Stack role="status" aria-live="polite" spacing={2} sx={{ p: 4, alignItems: 'center' }}>
      <CircularProgress aria-label={label} />
      <Typography>{label}</Typography>
    </Stack>
  );
}
