import { Stack, Typography } from '@mui/material';
export default function PageHeader({ title, description, action }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
      <div>
        <Typography component="h1" variant="h4">
          {title}
        </Typography>
        {description && (
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {description}
          </Typography>
        )}
      </div>
      {action}
    </Stack>
  );
}
