import { LoadingButton } from '@mui/lab';
import { Alert, Card, Container, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import type { LoginRequest } from '../api/client';
import { loginUser } from '../redux/actions/authAction';
import { useAppDispatch, useAppSelector } from '../redux/hooks';

const LoginPage = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { status, error } = useAppSelector((state) => state.auth);
  const form = useForm<LoginRequest>({
    defaultValues: { email: '', password: '' },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit: SubmitHandler<LoginRequest> = async (credentials) => {
    setIsSubmitting(true);

    try {
      await loginUser(dispatch, credentials);
      navigate('/dashboard', { replace: true });
    } catch {
      // The auth reducer exposes the normalized error to the form.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Card sx={{ p: { xs: 3, sm: 5 } }}>
        <Stack spacing={3} component="form" onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={1}>
            <Typography variant="h4">Sign in</Typography>
            <Typography color="text.secondary">Sign in to your FlowSync workspace.</Typography>
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Email address"
            type="email"
            autoComplete="email"
            error={Boolean(errors.email)}
            helperText={errors.email?.message}
            {...register('email', {
              required: 'Email is required',
              pattern: { value: /\S+@\S+\.\S+/, message: 'Enter a valid email address' },
            })}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            error={Boolean(errors.password)}
            helperText={errors.password?.message}
            {...register('password', { required: 'Password is required' })}
          />

          <LoadingButton type="submit" variant="contained" loading={isSubmitting || status === 'checking'}>
            Sign in
          </LoadingButton>
        </Stack>
      </Card>
    </Container>
  );
};

export default LoginPage;
