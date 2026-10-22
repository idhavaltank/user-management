import { Box, Checkbox, FormControlLabel, FormGroup, FormLabel, type FormGroupProps } from '@mui/material';
import { Controller, useFormContext, type FieldValues } from 'react-hook-form';

export interface RHFMultiCheckboxProps extends Omit<FormGroupProps, 'name'> {
  name: string;
  label?: string;
  options: readonly string[];
}

export function RHFMultiCheckbox({ name, label, options, ...other }: RHFMultiCheckboxProps): JSX.Element {
  const { control } = useFormContext<FieldValues>();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const selectedOptions = Array.isArray(field.value) ? field.value : [];
        const onSelected = (option: string): string[] =>
          selectedOptions.includes(option)
            ? selectedOptions.filter((value) => value !== option)
            : [...selectedOptions, option];
        return (
          <FormGroup {...other}>
            <FormLabel>{label}</FormLabel>
            <Box sx={{ display: 'flex', flexDirection: 'row' }}>
              {options.map((option) => (
                <FormControlLabel
                  key={option}
                  control={
                    <Checkbox
                      checked={selectedOptions.includes(option)}
                      onChange={() => field.onChange(onSelected(option))}
                    />
                  }
                  label={option}
                />
              ))}
            </Box>
          </FormGroup>
        );
      }}
    />
  );
}
