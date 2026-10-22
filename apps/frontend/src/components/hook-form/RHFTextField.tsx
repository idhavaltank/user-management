import { TextField, type TextFieldProps } from '@mui/material';
import { Controller, useFormContext, type FieldValues } from 'react-hook-form';

export interface RHFTextFieldProps extends Omit<TextFieldProps, 'name'> {
  name: string;
}

export default function RHFTextField({ name, ...other }: RHFTextFieldProps): JSX.Element {
  const { control } = useFormContext<FieldValues>();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <TextField {...field} fullWidth error={!!error} helperText={error?.message} {...other} />
      )}
    />
  );
}
