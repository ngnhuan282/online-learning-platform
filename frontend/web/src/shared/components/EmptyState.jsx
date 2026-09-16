import { Stack, Typography } from '@mui/material';
export default function EmptyState({ title = 'Chưa có dữ liệu', description, action }) {
  return (
    <Stack alignItems="center" spacing={2} sx={{ p: 4, textAlign: 'center' }}>
      <Typography variant="h6" component="h2">
        {title}
      </Typography>
      {description && <Typography color="text.secondary">{description}</Typography>}
      {action}
    </Stack>
  );
}
