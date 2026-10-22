import { LoadingButton } from '@mui/lab';
import { Alert, Grid } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import * as Yup from 'yup';

import { useSnackbar } from 'notistack';

import { yupResolver } from '@hookform/resolvers/yup';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { FormProvider, RHFMultiCheckbox, RHFRadioGroup, RHFTextField } from '../components/hook-form';
import type { User, UserCreateRequest, UserUpdateRequest } from '../api/client';
import { getApiErrorMessage } from '../api/client';
import { saveUser } from '../redux/actions/userAction';
import { useAppDispatch } from '../redux/hooks';

const GENDER_OPTION = ['Men', 'Women'] as const;

type ModalClose = (payload: { key: 'addEditModal'; status?: boolean }) => void;
type FormValues = {
  name: string;
  birthDate: string | Date;
  address: string;
  gender: '' | 'Men' | 'Women';
  email: string;
  college: string;
  hobbies: string[];
  customHobbies: string;
  isCustomHobby: string[];
};

type AddEditUserModalProps = {
  open: boolean;
  handleClose: ModalClose;
  currentUser: User | null;
  onSaved?: () => void;
};

const AddEditUserModal = ({ open, handleClose, currentUser, onSaved }: AddEditUserModalProps): JSX.Element => {
  const userId = currentUser?.id || '';
  // local state
  const [isLoading, setIsLoading] = useState(false);
  const [customHobby, setCustomHobby] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  // hooks
  const dispatch = useAppDispatch();

  // user form validation using yup
  const userSchema = Yup.object().shape({
    name: Yup.string()
      .required('Name is required')
      .matches(/^([A-Za-z0-9]+\s?)*$/, 'Enter valid name.')
      .trim(),
    email: Yup.string().required('Email is required').email('Must be a valid email'),
    address: Yup.string()
      .required('Address is required')
      .matches(/^([A-Za-z0-9]+\s?)*$/, 'Enter valid address.'),
    gender: Yup.string().required('Gender is required'),
    birthDate: Yup.date()
      .typeError('Please enter a valid date')
      .required()
      .min('1960-01-01', 'Your birth year must be after 01-01-1960.')
      .max('2000-01-01', 'Your birth year must be before 01-01-2000.'),
    college: Yup.string()
      .required('College is required')
      .matches(/^([A-Za-z0-9]+\s?)*$/, 'Enter valid college Name'),
    hobbies: Yup.array().of(Yup.string()).required(),
    isCustomHobby: Yup.array().of(Yup.string()).required(),
    customHobbies: Yup.string().when('isCustomHobby', {
      is: (isCustomHobby: string[] | undefined) => isCustomHobby?.includes('other'),
      then: (schema) => schema.required('Custom hobby is required, otherwise uncheck "Other" from hobbies.'),
    }),
  });

  // form default values
  const defaultValues = useMemo<FormValues>(
    () => ({
      name: '',
      birthDate: '',
      address: '',
      gender: '',
      email: '',
      college: '',
      hobbies: [],
      customHobbies: '',
      isCustomHobby: [],
    }),
    []
  );

  const methods = useForm<FormValues>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    // Yup validates the date as a Date while the form also accepts the HTML date input string.
    resolver: yupResolver(userSchema) as unknown as Resolver<FormValues>,
    defaultValues,
  });

  const {
    reset,
    resetField,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    setIsLoading(true);

    const customHobbies = values.customHobbies
      .split(',')
      .map((hobby) => hobby.trim())
      .filter(Boolean);
    const userPayload: UserCreateRequest | UserUpdateRequest = {
      name: values.name.trim(),
      email: values.email.trim(),
      address: values.address.trim(),
      college: values.college.trim(),
      birthDate:
        values.birthDate instanceof Date
          ? values.birthDate.toISOString().slice(0, 10)
          : String(values.birthDate).slice(0, 10),
      gender: values.gender as 'Men' | 'Women',
      hobbies: Array.isArray(values.hobbies) ? values.hobbies : [],
      customHobbies: values.isCustomHobby.includes('other') ? customHobbies : [],
    };

    try {
      await saveUser(dispatch, userId, userPayload);
      onSaved?.();
      setCustomHobby(false);
      handleClose({ key: 'addEditModal' });
      enqueueSnackbar(`User ${!userId ? 'Created' : 'Updated'} Successfully`);
      reset(defaultValues);
    } catch (error: unknown) {
      enqueueSnackbar(getApiErrorMessage(error), { variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Update form values based on userId
  useEffect(() => {
    const customHobbies = currentUser && Array.isArray(currentUser.customHobbies)
      ? currentUser.customHobbies
      : [];
    reset(userId && currentUser
      ? {
          name: currentUser.name,
          birthDate: currentUser.birthDate,
          address: currentUser.address,
          gender: currentUser.gender,
          email: currentUser.email,
          college: currentUser.college,
          hobbies: Array.isArray(currentUser.hobbies) ? currentUser.hobbies : [],
          customHobbies: customHobbies.join(', '),
          isCustomHobby: customHobbies.length ? ['other'] : [],
        }
      : { ...defaultValues });
    setCustomHobby(Boolean(customHobbies.length));
  }, [currentUser, defaultValues, reset, userId]);

  return (
    <Dialog fullWidth open={open} onClose={() => handleClose({ key: 'addEditModal' })}>
      <FormProvider methods={methods} onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{!userId ? 'Add User' : 'Update User'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={1} sx={{ height: '500px', maxHeight: '500px', overflow: 'auto' }}>
            <Grid item xs={12} sm={6} sx={{ marginTop: 1 }}>
              <RHFTextField name="name" label="Full Name" />
            </Grid>
            <Grid item xs={12} sm={6} sx={{ marginTop: 1 }}>
              <RHFTextField name="email" label="Email Address" />
            </Grid>
            <Grid item xs={12} sx={{ marginTop: 1 }}>
              <RHFTextField name="address" label="Address" />
            </Grid>
            <Grid item xs={12} sx={{ marginTop: 1 }}>
              <RHFTextField name="college" label="College Name" />
            </Grid>
            <Grid item xs={12} sx={{ marginTop: 1 }}>
              <RHFTextField
                name="birthDate"
                label="Birth Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                sx={{ cursor: 'pointer' }}
              />
            </Grid>
            <Grid item xs={12} sx={{ marginTop: 1, display: 'flex', alignItems: 'flex-end' }}>
              <RHFMultiCheckbox
                name="hobbies"
                label="Hobbies"
                sx={{ display: 'flex', flexDirection: 'column' }}
                options={['Reading', 'Gaming', 'Traveling', 'Drawing']}
              />
              <RHFMultiCheckbox
                label="Other"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setCustomHobby(e.target.checked);
                  if (!e.target.checked) resetField('customHobbies');
                }}
                name="isCustomHobby"
                options={['other']}
              />
            </Grid>
            <Grid item xs={12} sx={{ marginTop: 1 }}>
              {customHobby && (
                <>
                  <Alert variant="outlined" severity="info" sx={{ fontSize: '12px', my: 1, py: 0 }}>
                    Please add multiple hobbies with ","(comma). | Like: hobby1,hobby2
                  </Alert>
                  <RHFTextField name="customHobbies" label="Custom hobby" />
                </>
              )}
            </Grid>
            <Grid item xs={12} sx={{ marginTop: 1 }}>
              <RHFRadioGroup
                name="gender"
                label="Gender"
                options={[...GENDER_OPTION]}
                getOptionLabel={[...GENDER_OPTION]}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            name="reset"
            type="reset"
            variant="outlined"
            disabled={isLoading}
            onClick={() => {
              setCustomHobby(false);
              handleClose({ key: 'addEditModal' });
              reset(defaultValues);
            }}
          >
            Cancel
          </Button>
          <LoadingButton type="submit" variant="contained" name="submit" loading={isLoading || isSubmitting}>
            {!userId ? 'Create' : 'Save'}
          </LoadingButton>
        </DialogActions>
      </FormProvider>
    </Dialog>
  );
};

export default AddEditUserModal;
