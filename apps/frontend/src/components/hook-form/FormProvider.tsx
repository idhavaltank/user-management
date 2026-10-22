import type { FormEventHandler, ReactNode } from 'react';
import { FormProvider as Form, type FieldValues, type UseFormReturn } from 'react-hook-form';

export interface FormProviderProps<TFieldValues extends FieldValues = FieldValues> {
  children: ReactNode;
  onSubmit: FormEventHandler<HTMLFormElement>;
  methods: UseFormReturn<TFieldValues>;
}

export default function FormProvider<TFieldValues extends FieldValues>({
  children,
  onSubmit,
  methods,
}: FormProviderProps<TFieldValues>): JSX.Element {
  return (
    <Form {...methods}>
      <form onSubmit={onSubmit}>{children}</form>
    </Form>
  );
}
