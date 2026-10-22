import {
  Box,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
  type RadioGroupProps,
} from '@mui/material';
import { Controller, useFormContext, type FieldValues } from 'react-hook-form';

export interface RHFRadioGroupProps extends Omit<RadioGroupProps, 'name'> {
  name: string;
  label?: string;
  options: readonly string[];
  getOptionLabel?: readonly string[];
}

export default function RHFRadioGroup({
  name,
  label,
  options,
  getOptionLabel,
  ...other
}: RHFRadioGroupProps): JSX.Element {
  const { control } = useFormContext<FieldValues>();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <Box>
          <RadioGroup {...field} {...other}>
            <FormLabel>{label}</FormLabel>
            <Box sx={{ display: 'flex', flexDirection: 'row' }}>
              {options.map((option, index) => (
                <FormControlLabel
                  key={option}
                  value={option}
                  control={<Radio />}
                  label={getOptionLabel?.length ? getOptionLabel[index] : option}
                />
              ))}
            </Box>
          </RadioGroup>

          {!!error && (
            <FormHelperText error sx={{ px: 2 }}>
              {error.message}
            </FormHelperText>
          )}
        </Box>
      )}
    />
  );
}
