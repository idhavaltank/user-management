# Project Structure

> Historical reference only. The active application in this monorepo is
> `apps/frontend`, which uses Vite, Vitest, and TypeScript. The legacy CRA/JavaScript
> tree below is not the source of truth for the current implementation.

```
frontend/
├── public
│   └── index.html
├── src
│   ├── components
│   │   ├── hook-form
│   │   │   ├── FormProvider.js
│   │   │   ├── index.js
│   │   │   ├── RHFCheckbox.js
│   │   │   ├── RHFRadioGroup.js
│   │   │   └── RHFTextField.js
│   │   ├── iconify
│   │   │   └── Iconify.js
│   │   └── scrollbar
│   │       ├── index.js
│   │       ├── Scrollbar.js
│   │       └── styles.js
│   ├── layouts
│   │   └── dashboard
│   │       └── DashboardLayout.js
│   ├── modals
│   │   ├── AddEditUserModal.js
│   │   └── ConfirmationModal.js
│   ├── pages
│   │   └── UserPage.js
│   ├── redux
│   │   ├── actions
│   │   │   └── userAction.js
│   │   ├── reducers
│   │   │   ├── helper.js
│   │   │   └── userReducer.js
│   │   ├── Types
│   │   │   └── index.js
│   │   ├── rootReducer.js
│   │   └── store.js
│   ├── sections
│   │   └── user
│   │       ├── UserListHead.js
│   │       └── UserListToolbar.js
│   ├── theme
│   │   ├── customShadows.js
│   │   ├── globalStyles.js
│   │   ├── index.js
│   │   ├── palette.js
│   │   ├── shadows.js
│   │   └── typography.js
│   ├── utils
│   │   ├── localStorage.js
│   │   ├── NotistackProvider.js
│   │   ├── sortData.js
│   │   ├── TABLE_HEAD.js
│   │   └── uuid.js
│   ├── App.js
│   ├── index.js
│   ├── reportWebVitals.js
│   └── routes.js
├── jsconfig.json
├── package.json
└── README.md
```

# File Contents

## frontend/README.md

```markdown
## React CRUD Operation

## Using Following Library

- [React js](https://reactjs.org/)
- [Matirial UI](https://mui.com/)
- [React Redux](https://redux.js.org/)
- [React Hook Form](https://react-hook-form.com/)
- [NotiStack](https://notistack.com/)

## Getting started

- Recommended `node js 16.x` and `npm 6+`. (suggestion v16.15.0)
- Install dependencies: `npm install` / `yarn install`
- Start the project: `npm run start` / `yarn start`

## License

Distributed under the MIT License. See [LICENSE](https://github.com/minimal-ui-kit/minimal.free/blob/main/LICENSE.md) for more information.
```

## frontend/jsconfig.json

```json
{
  "compilerOptions": {
    "target": "es6",
    "module": "commonjs",
    "baseUrl": "."
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

## frontend/package.json

```json
{
  "name": "@minimal/material-kit-react",
  "author": "minimals.cc",
  "licence": "MIT",
  "version": "1.6.0",
  "private": false,
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject",
    "lint": "eslint --ext .js,.jsx ./src",
    "lint:fix": "eslint --fix --ext .js,.jsx ./src",
    "clear-all": "rm -rf build node_modules",
    "re-start": "rm -rf build node_modules && yarn install && yarn start",
    "re-build": "rm -rf build node_modules && yarn install && yarn build"
  },
  "eslintConfig": {
    "extends": ["react-app"]
  },
  "babel": {
    "presets": ["@babel/preset-react"]
  },
  "browserslist": {
    "production": [">0.2%", "not dead", "not op_mini all"],
    "development": ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
  },
  "dependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@hookform/resolvers": "^2.9.10",
    "@iconify/react": "^4.0.0",
    "@mui/lab": "^5.0.0-alpha.103",
    "@mui/material": "^5.10.9",
    "@mui/x-date-pickers": "^5.0.7",
    "axios": "^1.1.3",
    "lodash": "^4.17.21",
    "notistack": "^2.0.8",
    "prop-types": "^15.8.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hook-form": "^7.39.1",
    "react-redux": "^8.0.5",
    "react-router-dom": "^7.18.4",
    "react-scripts": "^5.0.1",
    "redux": "^4.2.0",
    "redux-devtools-extension": "^2.13.9",
    "simplebar-react": "^2.4.3",
    "web-vitals": "^3.0.3",
    "yup": "^0.32.11"
  },
  "devDependencies": {
    "@babel/core": "^7.19.3",
    "@babel/eslint-parser": "^7.19.1",
    "@svgr/webpack": "^6.5.0",
    "eslint": "^8.25.0",
    "eslint-config-airbnb": "^19.0.4",
    "eslint-config-prettier": "^8.5.0",
    "eslint-config-react-app": "^7.0.1",
    "eslint-plugin-flowtype": "^8.0.3",
    "eslint-plugin-import": "^2.26.0",
    "eslint-plugin-jsx-a11y": "^6.6.1",
    "eslint-plugin-prettier": "^4.2.1",
    "eslint-plugin-react": "^7.31.10",
    "eslint-plugin-react-hooks": "^4.6.0",
    "prettier": "^2.7.1"
  },
  "overrides": {
    "@svgr/webpack": "^6.5.0"
  }
}
```

## frontend/public/index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />

    <meta name="theme-color" content="#000000" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

    <!-- Using Google Font -->
    <link rel="preconnect" href="https://fonts.gstatic.com" />
    <link
      href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />

    <!-- Using Local Font -->
    <link rel="stylesheet" type="text/css" href="%PUBLIC_URL%/fonts/index.css" />

    <!-- Css simplebar -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/simplebar/5.3.9/simplebar.min.css" />

    <title>User Management</title>
    <meta name="author" content="User Management" />
  </head>

  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
```

## frontend/src/App.js

```javascript
import { useEffect } from 'react';

import { useDispatch } from 'react-redux';
import { getUser } from './redux/actions/userAction';
import Router from './routes';
import ThemeProvider from './theme';
import { createStorage } from './utils/localStorage';

const App = () => {
  const dispatch = useDispatch();

  // Create LocalStorage and get data from local Storage and store in redux.
  useEffect(() => {
    createStorage('userList');
    dispatch(getUser());
  }, [dispatch]);

  return (
    <ThemeProvider>
      <Router />
    </ThemeProvider>
  );
};

export default App;
```

## frontend/src/components/hook-form/FormProvider.js

```javascript
import PropTypes from 'prop-types';
import { FormProvider as Form } from 'react-hook-form';

export default function FormProvider({ children, onSubmit, methods }) {
  return (
    <Form {...methods}>
      <form onSubmit={onSubmit}>{children}</form>
    </Form>
  );
}
FormProvider.propTypes = {
  children: PropTypes.node,
  onSubmit: PropTypes.func,
  methods: PropTypes.object,
};
```

## frontend/src/components/hook-form/RHFCheckbox.js

```javascript
import { Box, Checkbox, FormControlLabel, FormGroup, FormLabel } from '@mui/material';
import PropTypes from 'prop-types';
import { Controller, useFormContext } from 'react-hook-form';

RHFMultiCheckbox.propTypes = {
  name: PropTypes.string,
  label: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.string),
};

export function RHFMultiCheckbox({ name, label, options, ...other }) {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const onSelected = (option) =>
          field.value.includes(option) ? field.value.filter((value) => value !== option) : [...field.value, option];
        return (
          <FormGroup {...other}>
            <FormLabel>{label}</FormLabel>
            <Box sx={{ display: 'flex', flexDirection: 'row' }}>
              {options.map((option) => (
                <FormControlLabel
                  key={option}
                  control={
                    <Checkbox
                      checked={field.value.includes(option)}
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
```

## frontend/src/components/hook-form/RHFRadioGroup.js

```javascript
import { Box, FormControlLabel, FormHelperText, FormLabel, Radio, RadioGroup } from '@mui/material';
import PropTypes from 'prop-types';
import { Controller, useFormContext } from 'react-hook-form';

RHFRadioGroup.propTypes = {
  name: PropTypes.string,
  label: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.string),
  getOptionLabel: PropTypes.arrayOf(PropTypes.string),
};

export default function RHFRadioGroup({ name, label, options, getOptionLabel, ...other }) {
  const { control } = useFormContext();

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
```

## frontend/src/components/hook-form/RHFTextField.js

```javascript
import { TextField } from '@mui/material';
import PropTypes from 'prop-types';
import { Controller, useFormContext } from 'react-hook-form';

RHFTextField.propTypes = {
  name: PropTypes.string,
};

export default function RHFTextField({ name, ...other }) {
  const { control } = useFormContext();

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
```

## frontend/src/components/hook-form/index.js

```javascript
export { default as FormProvider } from './FormProvider';
export * from './RHFCheckbox';
export { default as RHFRadioGroup } from './RHFRadioGroup';
export { default as RHFTextField } from './RHFTextField';
```

## frontend/src/components/iconify/Iconify.js

```javascript
import { Icon } from '@iconify/react';
import { Box } from '@mui/material';
import PropTypes from 'prop-types';
import { forwardRef } from 'react';

const Iconify = forwardRef(({ icon, width = 20, sx, ...other }, ref) => (
  <Box ref={ref} component={Icon} icon={icon} sx={{ width, height: width, ...sx }} {...other} />
));

Iconify.propTypes = {
  sx: PropTypes.object,
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  icon: PropTypes.oneOfType([PropTypes.element, PropTypes.string]),
};

export default Iconify;
```

## frontend/src/components/scrollbar/Scrollbar.js

```javascript
import { Box } from '@mui/material';
import PropTypes from 'prop-types';
import { StyledRootScrollbar, StyledScrollbar } from './styles';

Scrollbar.propTypes = {
  sx: PropTypes.object,
  children: PropTypes.node,
};

function Scrollbar({ children, sx, ...other }) {
  const userAgent = typeof navigator === 'undefined' ? 'SSR' : navigator.userAgent;

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  if (isMobile) {
    return (
      <Box sx={{ overflowX: 'auto', ...sx }} {...other}>
        {children}
      </Box>
    );
  }

  return (
    <StyledRootScrollbar>
      <StyledScrollbar timeout={500} clickOnTrack={false} sx={sx} {...other}>
        {children}
      </StyledScrollbar>
    </StyledRootScrollbar>
  );
}

export default Scrollbar;
```

## frontend/src/components/scrollbar/index.js

```javascript
export { default } from './Scrollbar';
```

## frontend/src/components/scrollbar/styles.js

```javascript
import { alpha, styled } from '@mui/material/styles';
import SimpleBar from 'simplebar-react';

export const StyledRootScrollbar = styled('div')(() => ({
  flexGrow: 1,
  height: '100%',
  overflow: 'hidden',
}));

export const StyledScrollbar = styled(SimpleBar)(({ theme }) => ({
  maxHeight: '100%',
  '& .simplebar-scrollbar': {
    '&:before': {
      backgroundColor: alpha(theme.palette.grey[600], 0.48),
    },
    '&.simplebar-visible:before': {
      opacity: 1,
    },
  },
  '& .simplebar-track.simplebar-vertical': {
    width: 10,
  },
  '& .simplebar-track.simplebar-horizontal .simplebar-scrollbar': {
    height: 6,
  },
  '& .simplebar-mask': {
    zIndex: 'inherit',
  },
}));
```

## frontend/src/index.js

```javascript
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { Provider } from 'react-redux';
import App from './App';
import store from './redux/store';
import reportWebVitals from './reportWebVitals';
import NotistackProvider from './utils/NotistackProvider';

const root = ReactDOM.createRoot(document.getElementById('root'));

// Wrap App component with Redux store and notistack(use for display toast).
root.render(
  <BrowserRouter>
    <Provider store={store}>
      <NotistackProvider>
        <App />
      </NotistackProvider>
    </Provider>
  </BrowserRouter>
);
// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
```

## frontend/src/layouts/dashboard/DashboardLayout.js

```javascript
import { styled } from '@mui/material/styles';
import { Outlet } from 'react-router-dom';

const Main = styled('div')(() => ({
  flexGrow: 1,
  overflow: 'auto',
  minHeight: '100%',
  paddingTop: 24,
}));

// Used Dashboard Layout as container.
const DashboardLayout = () => (
  <Main>
    <Outlet />
  </Main>
);
export default DashboardLayout;
```

## frontend/src/modals/AddEditUserModal.js

```javascript
import { LoadingButton } from '@mui/lab';
import { Alert, Grid } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import PropTypes from 'prop-types';
import { useEffect, useMemo, useState } from 'react';
import * as Yup from 'yup';

import { useSnackbar } from 'notistack';

import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { FormProvider, RHFMultiCheckbox, RHFRadioGroup, RHFTextField } from '../components/hook-form';
import { addUpdateUser } from '../redux/actions/userAction';

import uuid from '../utils/uuid';

const GENDER_OPTION = ['Men', 'Women'];

const AddEditUserModal = (props) => {
  const { open, handleClose, currentUser } = props;
  const userId = currentUser?.userId || '';
  // local state
  const [isLoading, setIsLoading] = useState(false);
  const [customHobby, setCustomHobby] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  // hooks
  const dispatch = useDispatch();

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
    customHobbies: Yup.string().when('isCustomHobby', {
      is: (isCustomHobby) => isCustomHobby,
      then: Yup.string().required('Custom hobby is required,  otherwise unchecked "Other" from hobbies.'),
    }),
  });

  // form default values
  const defaultValues = useMemo(
    () => ({
      name: '',
      birthDate: '',
      address: '',
      gender: '',
      email: '',
      college: '',
      hobbies: '',
      customHobbies: '',
      isCustomHobby: '',
    }),
    []
  );

  const methods = useForm({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    resolver: yupResolver(userSchema),
    defaultValues,
  });

  const {
    reset,
    resetField,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = methods;
  const values = watch();

  const onSubmit = () => {
    setIsLoading(true);
    setTimeout(() => {
      setCustomHobby(false);
      handleClose({ key: 'addEditModal' });
      setIsLoading(false);
      const userObject = {
        ...values,
        userId: userId || uuid(),
        name: values.name.trim(),
        address: values.address.trim(),
        customHobbies: values.customHobbies.trim(),
        college: values.college.trim(),
      };
      dispatch(addUpdateUser({ ...userObject }));
      enqueueSnackbar(`User ${!userId ? 'Created' : 'Updated'} Successfully`);
      reset(defaultValues);
    }, 1000);
  };

  // Update form values based on userId
  useEffect(() => {
    reset(userId ? { ...currentUser } : { ...defaultValues });
    if (currentUser.isCustomHobby) {
      setCustomHobby(currentUser.isCustomHobby);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

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
                onChange={(e) => {
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
              <RHFRadioGroup name="gender" label="Gender" options={GENDER_OPTION} />
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

AddEditUserModal.propTypes = {
  open: PropTypes.bool,
  handleClose: PropTypes.func,
  currentUser: PropTypes.object,
};
export default AddEditUserModal;
```

## frontend/src/modals/ConfirmationModal.js

```javascript
import { Typography } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import * as React from 'react';
import Iconify from '../components/iconify/Iconify';

const ConfirmationModal = ({ open, handleClose, handleConfirm }) => (
  <Dialog open={open} onClose={() => handleClose({ key: 'confirmationModal' })}>
    <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Iconify icon="emojione-v1:warning" width={50} />
      <Typography> Are you sure you want to remove this user?</Typography>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 3 }}>
      <Button variant="outlined" color="primary" autoFocus onClick={() => handleClose({ key: 'confirmationModal' })}>
        Cancel
      </Button>
      <Button variant="contained" color="error" onClick={handleConfirm} autoFocus>
        YES
      </Button>
    </DialogActions>
  </Dialog>
);

export default ConfirmationModal;
```

## frontend/src/pages/UserPage.js

```javascript
import {
  Button,
  Card,
  Container,
  IconButton,
  MenuItem,
  Paper,
  Popover,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Iconify from '../components/iconify/Iconify';
import Scrollbar from '../components/scrollbar';
import AddEditUserModal from '../modals/AddEditUserModal';
import ConfirmationModal from '../modals/ConfirmationModal';
import { removeUser } from '../redux/actions/userAction';
import UserListHead from '../sections/user/UserListHead';
import UserListToolbar from '../sections/user/UserListToolbar';
import { applySortFilter, getComparator } from '../utils/sortData';
import TABLE_HEAD from '../utils/TABLE_HEAD';

const UserPage = () => {
  // local state for use maintain functionality.
  const [opens, setOpens] = useState({
    actionMenu: null,
    addEditModal: false,
    confirmationModal: false,
  });
  const [page, setPage] = useState(0);
  const [order, setOrder] = useState('asc');
  const [selectedUser, setSelectedUser] = useState({});
  const [orderBy, setOrderBy] = useState('');
  const [filterName, setFilterName] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [userList, setUserList] = useState([]);
  const dispatch = useDispatch();

  // fetch user data from redux
  const users = useSelector((state) => state?.user?.list);

  // maintain modal and action menu for open and close
  // ------------------- START -------------------------
  const handleOpen = (props) => {
    const key = props?.key;
    if (props.event || props.status) {
      setOpens({ ...opens, [key]: props.status || props.event.currentTarget });
    }
    if (props.data) {
      setSelectedUser({ ...props?.data });
    }
  };

  const handleClose = ({ key, status }) => {
    setOpens({ ...opens, [key]: status || false });
  };
  // -------------------- END --------------------------

  // This function for sorting data
  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // This function  display users based on page.
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // This function set number of users at one page.
  const handleChangeRowsPerPage = (event) => {
    setPage(0);
    setRowsPerPage(parseInt(event.target.value, 10));
  };

  // Filter users based on searchQuery.
  const handleFilterByName = (event) => {
    setPage(0);
    setFilterName(event.target.value);
  };

  // This function is used for remove user from localStorage and redux.
  const removedUser = () => {
    handleClose({ key: 'actionMenu', status: null });
    handleClose({ key: 'confirmationModal' });
    dispatch(removeUser(selectedUser?.userId));
  };

  // This useEffect update user list while trigger dispatch and users.
  useEffect(() => {
    setUserList([...users]);
  }, [dispatch, users]);

  const filteredUsers = applySortFilter(userList, getComparator(order, orderBy), filterName);
  const isNotFound = !filteredUsers.length && !!filterName;

  return (
    <>
      <Container>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={5}>
          <Typography variant="h4">User Management</Typography>
          <Button
            variant="contained"
            startIcon={<Iconify icon="eva:plus-fill" />}
            onClick={() => handleOpen({ key: 'addEditModal', status: true })}
          >
            New User
          </Button>
        </Stack>

        <Card>
          <UserListToolbar filterName={filterName} onFilterName={handleFilterByName} />
          <Scrollbar>
            <TableContainer sx={{ minWidth: 400 }}>
              <Table>
                <UserListHead
                  order={order}
                  orderBy={orderBy}
                  headLabel={TABLE_HEAD}
                  onRequestSort={handleRequestSort}
                />
                <TableBody>
                  {filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row) => (
                    <TableRow hover key={row?.userId} tabIndex={-1} role="checkbox">
                      <TableCell component="th" scope="row">
                        {row?.name || '-'}
                      </TableCell>

                      <TableCell align="left">{row?.email || '-'}</TableCell>
                      <TableCell align="left">{row?.gender || '-'}</TableCell>
                      <TableCell align="left">
                        {(row?.birthDate && new Date(row?.birthDate).toLocaleDateString('en-IN')) || '-'}
                      </TableCell>
                      <TableCell align="left">{row?.college || '-'}</TableCell>
                      <TableCell align="left">{row?.address || '-'}</TableCell>
                      <TableCell align="left">
                        {(row?.isCustomHobby
                          ? row?.hobbies.toString().concat(',', row?.customHobbies)
                          : row?.hobbies.toString()) || '-'}
                      </TableCell>

                      <TableCell align="right">
                        <IconButton
                          size="large"
                          color="inherit"
                          onClick={(event) => handleOpen({ key: 'actionMenu', event, data: row })}
                        >
                          <Iconify icon={'eva:more-vertical-fill'} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>

                {isNotFound && (
                  <TableBody>
                    <TableRow>
                      <TableCell align="center" colSpan={TABLE_HEAD.length + 1} sx={{ py: 5 }}>
                        <Paper
                          sx={{
                            textAlign: 'center',
                            boxShadow: 'none',
                          }}
                        >
                          <Typography gutterBottom align="center" variant="h4">
                            Not found
                          </Typography>
                        </Paper>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                )}
              </Table>
            </TableContainer>
          </Scrollbar>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={userList.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Card>
      </Container>

      <Popover
        open={Boolean(opens?.actionMenu)}
        anchorEl={opens?.actionMenu}
        onClose={() => handleClose({ key: 'actionMenu', status: null })}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            p: 1,
            width: 140,
            '& .MuiMenuItem-root': {
              px: 1,
              typography: 'body2',
              borderRadius: 0.75,
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            handleClose({ key: 'actionMenu', status: null });
            handleOpen({ key: 'addEditModal', status: true });
          }}
        >
          <Iconify icon={'eva:edit-fill'} sx={{ mr: 2 }} />
          Edit
        </MenuItem>

        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={() => {
            handleClose({ key: 'actionMenu', status: null });
            handleOpen({ key: 'confirmationModal', status: true });
          }}
        >
          <Iconify icon={'eva:trash-2-outline'} sx={{ mr: 2 }} />
          Delete
        </MenuItem>
      </Popover>
      <AddEditUserModal currentUser={selectedUser} open={opens?.addEditModal} handleClose={handleClose} />
      <ConfirmationModal open={opens?.confirmationModal} handleClose={handleClose} handleConfirm={removedUser} />
    </>
  );
};
export default UserPage;
```

## frontend/src/redux/Types/index.js

```javascript
export const GET_USER = 'GET_USER';
export const ADD_UPDATE_USER = 'ADD_UPDATE_USER';
export const DELETE_USER = 'DELETE_USER';
export const GET_COLLEGE_LIST = 'GET_COLLEGE_LIST';
```

## frontend/src/redux/actions/userAction.js

```javascript
import { ADD_UPDATE_USER, DELETE_USER, GET_USER } from '../Types';

export const getUser = () => ({
  type: GET_USER,
});
export const addUpdateUser = (data) => ({
  type: ADD_UPDATE_USER,
  payload: data,
});

export const removeUser = (userId) => ({
  type: DELETE_USER,
  payload: userId,
});
```

## frontend/src/redux/reducers/helper.js

```javascript
import axios from 'axios';

export const fetchColleges = async (name) => {
  const API_URL = 'http://universities.hipolabs.com/search?name=';
  try {
    return await axios
      .get(API_URL + name)
      .then((res) => res)
      .catch((err) => err);
  } catch (err) {
    return err;
  }
};
```

## frontend/src/redux/reducers/userReducer.js

```javascript
import { storeData, getData, deleteById } from '../../utils/localStorage';
import { ADD_UPDATE_USER, DELETE_USER, GET_USER } from '../Types';

const initState = {
  list: [],
  selectedUser: {},
};

const reducer = (state = initState, action) => {
  const { type, payload } = action;
  switch (type) {
    case GET_USER:
      return {
        ...state,
        list: getData(),
      };
    case ADD_UPDATE_USER:
      storeData(payload);
      return {
        ...state,
        list: getData(),
      };
    case DELETE_USER:
      deleteById(payload);
      return {
        ...state,
        list: getData(),
      };
    default:
      return state;
  }
};

export default reducer;
```

## frontend/src/redux/rootReducer.js

```javascript
import { combineReducers } from 'redux';
import userReducer from './reducers/userReducer';

export default combineReducers({
  user: userReducer,
});
```

## frontend/src/redux/store.js

```javascript
import { createStore } from 'redux';
import { composeWithDevTools } from 'redux-devtools-extension';
import mainReducer from './rootReducer';

const store = createStore(mainReducer, composeWithDevTools());

export default store;
```

## frontend/src/reportWebVitals.js

```javascript
const reportWebVitals = (onPerfEntry) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(onPerfEntry);
      getFID(onPerfEntry);
      getFCP(onPerfEntry);
      getLCP(onPerfEntry);
      getTTFB(onPerfEntry);
    });
  }
};

export default reportWebVitals;
```

## frontend/src/routes.js

```javascript
import { Navigate, useRoutes } from 'react-router-dom';
import DashboardLayout from './layouts/dashboard/DashboardLayout';

import UserPage from './pages/UserPage';

// Here I maintain project routing
const Router = () =>
  useRoutes([
    {
      path: '/',
      element: <DashboardLayout />,
      children: [
        { element: <Navigate to="/user" />, index: true },
        { path: 'user', element: <UserPage /> },
      ],
    },
  ]);

export default Router;
```

## frontend/src/sections/user/UserListHead.js

```javascript
import PropTypes from 'prop-types';
import { TableRow, TableCell, TableHead, TableSortLabel } from '@mui/material';

UserListHead.propTypes = {
  order: PropTypes.oneOf(['asc', 'desc']),
  orderBy: PropTypes.string,
  headLabel: PropTypes.array,
  onRequestSort: PropTypes.func,
};

export default function UserListHead({ order, orderBy, headLabel, onRequestSort }) {
  const createSortHandler = (property) => (event) => {
    onRequestSort(event, property);
  };

  return (
    <TableHead>
      <TableRow>
        {headLabel.map((headCell) => (
          <TableCell
            disabled={!!headCell?.disabled}
            key={headCell.id}
            align={headCell.alignRight ? 'right' : 'left'}
            sortDirection={orderBy === headCell.id ? order : false}
          >
            <TableSortLabel
              hideSortIcon
              active={orderBy === headCell.id}
              direction={orderBy === headCell.id ? order : 'asc'}
              onClick={() => !headCell?.disabled && createSortHandler(headCell.id)}
            >
              {headCell.label}
            </TableSortLabel>
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
}
```

## frontend/src/sections/user/UserListToolbar.js

```javascript
import { InputAdornment, OutlinedInput, Toolbar } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import PropTypes from 'prop-types';
import Iconify from '../../components/iconify/Iconify';

const StyledRoot = styled(Toolbar)(({ theme }) => ({
  height: 96,
  display: 'flex',
  justifyContent: 'space-between',
  padding: theme.spacing(0, 1, 0, 3),
}));

const StyledSearch = styled(OutlinedInput)(({ theme }) => ({
  width: 240,
  transition: theme.transitions.create(['box-shadow', 'width'], {
    easing: theme.transitions.easing.easeInOut,
    duration: theme.transitions.duration.shorter,
  }),
  '&.Mui-focused': {
    width: 320,
    boxShadow: theme.customShadows.z8,
  },
  '& fieldset': {
    borderWidth: `1px !important`,
    borderColor: `${alpha(theme.palette.grey[500], 0.32)} !important`,
  },
}));

const UserListToolbar = ({ filterName, onFilterName }) => (
  <>
    <StyledRoot>
      <StyledSearch
        value={filterName}
        onChange={onFilterName}
        placeholder="Search user..."
        startAdornment={
          <InputAdornment position="start">
            <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled', width: 20, height: 20 }} />
          </InputAdornment>
        }
      />
    </StyledRoot>
  </>
);
UserListToolbar.propTypes = {
  filterName: PropTypes.string,
  onFilterName: PropTypes.func,
};

export default UserListToolbar;
```

## frontend/src/theme/customShadows.js

```javascript
import { alpha } from '@mui/material/styles';
import palette from './palette';

const color = palette.grey[500];

export default function customShadows() {
  const transparent = alpha(color, 0.16);
  return {
    z1: `0 1px 2px 0 ${transparent}`,
    z4: `0 4px 8px 0 ${transparent}`,
    z8: `0 8px 16px 0 ${transparent}`,
    z12: `0 12px 24px -4px ${transparent}`,
    z16: `0 16px 32px -4px ${transparent}`,
    z20: `0 20px 40px -4px ${transparent}`,
    z24: `0 24px 48px 0 ${transparent}`,
    //
    primary: `0 8px 16px 0 ${alpha(palette.primary.main, 0.24)}`,
    info: `0 8px 16px 0 ${alpha(palette.info.main, 0.24)}`,
    secondary: `0 8px 16px 0 ${alpha(palette.secondary.main, 0.24)}`,
    success: `0 8px 16px 0 ${alpha(palette.success.main, 0.24)}`,
    warning: `0 8px 16px 0 ${alpha(palette.warning.main, 0.24)}`,
    error: `0 8px 16px 0 ${alpha(palette.error.main, 0.24)}`,
    //
    card: `0 0 2px 0 ${alpha(color, 0.2)}, 0 12px 24px -4px ${alpha(color, 0.12)}`,
    dialog: `-40px 40px 80px -8px ${alpha(color, 0.24)}`,
    dropdown: `0 0 2px 0 ${alpha(color, 0.24)}, -20px 20px 40px -4px ${alpha(color, 0.24)}`,
  };
}
```

## frontend/src/theme/globalStyles.js

```javascript
import { GlobalStyles as MUIGlobalStyles } from '@mui/material';

const GlobalStyles = () => (
  <MUIGlobalStyles
    styles={{
      '*': {
        boxSizing: 'border-box',
      },
      html: {
        margin: 0,
        padding: 0,
        width: '100%',
        height: '100%',
        WebkitOverflowScrolling: 'touch',
      },
      body: {
        margin: 0,
        padding: 0,
        width: '100%',
        height: '100%',
      },
      '#root': {
        width: '100%',
        height: '100%',
      },
      input: {
        '&[type=number]': {
          MozAppearance: 'textfield',
          '&::-webkit-outer-spin-button': {
            margin: 0,
            WebkitAppearance: 'none',
          },
          '&::-webkit-inner-spin-button': {
            margin: 0,
            WebkitAppearance: 'none',
          },
        },
      },
      img: {
        display: 'block',
        maxWidth: '100%',
      },
      ul: {
        margin: 0,
        padding: 0,
      },
    }}
  />
);

export default GlobalStyles;
```

## frontend/src/theme/index.js

```javascript
import { CssBaseline } from '@mui/material';
import { createTheme, StyledEngineProvider, ThemeProvider as MUIThemeProvider } from '@mui/material/styles';
import { useMemo } from 'react';
import customShadows from './customShadows';
import GlobalStyles from './globalStyles';
import palette from './palette';
import shadows from './shadows';
import typography from './typography';

export default function ThemeProvider({ children }) {
  const themeOptions = useMemo(
    () => ({
      palette,
      shape: { borderRadius: 6 },
      typography,
      shadows: shadows(),
      customShadows: customShadows(),
    }),
    []
  );

  const theme = createTheme(themeOptions);

  return (
    <StyledEngineProvider injectFirst>
      <MUIThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles />
        {children}
      </MUIThemeProvider>
    </StyledEngineProvider>
  );
}
```

## frontend/src/theme/palette.js

```javascript
import { alpha } from '@mui/material/styles';

const GREY = {
  0: '#FFFFFF',
  100: '#F9FAFB',
  200: '#F4F6F8',
  300: '#DFE3E8',
  400: '#C4CDD5',
  500: '#919EAB',
  600: '#637381',
  700: '#454F5B',
  800: '#212B36',
  900: '#161C24',
};
const PRIMARY = {
  lighter: '#C8FACD',
  light: '#5BE584',
  main: '#00AB55',
  dark: '#007B55',
  darker: '#005249',
};
const SECONDARY = {
  lighter: '#D6E4FF',
  light: '#84A9FF',
  main: '#3366FF',
  dark: '#1939B7',
  darker: '#091A7A',
};
const INFO = {
  lighter: '#D0F2FF',
  light: '#74CAFF',
  main: '#1890FF',
  dark: '#0C53B7',
  darker: '#04297A',
};
const SUCCESS = {
  lighter: '#E9FCD4',
  light: '#AAF27F',
  main: '#54D62C',
  dark: '#229A16',
  darker: '#08660D',
};
const WARNING = {
  lighter: '#FFF7CD',
  light: '#FFE16A',
  main: '#FFC107',
  dark: '#B78103',
  darker: '#7A4F01',
};
const ERROR = {
  lighter: '#FFE7D9',
  light: '#FFA48D',
  main: '#FF4842',
  dark: '#B72136',
  darker: '#7A0C2E',
};

const palette = {
  common: { black: '#000', white: '#fff' },
  primary: PRIMARY,
  secondary: SECONDARY,
  info: INFO,
  success: SUCCESS,
  warning: WARNING,
  error: ERROR,
  grey: GREY,
  divider: alpha(GREY[500], 0.24),
  text: {
    primary: GREY[800],
    secondary: GREY[600],
    disabled: GREY[500],
  },
  background: {
    paper: '#fff',
    default: GREY[100],
    neutral: GREY[200],
  },
  action: {
    active: GREY[600],
    hover: alpha(GREY[500], 0.08),
    selected: alpha(GREY[500], 0.16),
    disabled: alpha(GREY[500], 0.8),
    disabledBackground: alpha(GREY[500], 0.24),
    focus: alpha(GREY[500], 0.24),
    hoverOpacity: 0.08,
    disabledOpacity: 0.48,
  },
};

export default palette;
```

## frontend/src/theme/shadows.js

```javascript
import { alpha } from '@mui/material/styles';
import palette from './palette';

const color = palette.grey[500];

export default function shadows() {
  const transparent1 = alpha(color, 0.2);
  const transparent2 = alpha(color, 0.14);
  const transparent3 = alpha(color, 0.12);
  return [
    'none',
    `0px 2px 1px -1px ${transparent1},0px 1px 1px 0px ${transparent2},0px 1px 3px 0px ${transparent3}`,
    `0px 3px 1px -2px ${transparent1},0px 2px 2px 0px ${transparent2},0px 1px 5px 0px ${transparent3}`,
    `0px 3px 3px -2px ${transparent1},0px 3px 4px 0px ${transparent2},0px 1px 8px 0px ${transparent3}`,
    `0px 2px 4px -1px ${transparent1},0px 4px 5px 0px ${transparent2},0px 1px 10px 0px ${transparent3}`,
    `0px 3px 5px -1px ${transparent1},0px 5px 8px 0px ${transparent2},0px 1px 14px 0px ${transparent3}`,
    `0px 3px 5px -1px ${transparent1},0px 6px 10px 0px ${transparent2},0px 1px 18px 0px ${transparent3}`,
    `0px 4px 5px -2px ${transparent1},0px 7px 10px 1px ${transparent2},0px 2px 16px 1px ${transparent3}`,
    `0px 5px 5px -3px ${transparent1},0px 8px 10px 1px ${transparent2},0px 3px 14px 2px ${transparent3}`,
    `0px 5px 6px -3px ${transparent1},0px 9px 12px 1px ${transparent2},0px 3px 16px 2px ${transparent3}`,
    `0px 6px 6px -3px ${transparent1},0px 10px 14px 1px ${transparent2},0px 4px 18px 3px ${transparent3}`,
    `0px 6px 7px -4px ${transparent1},0px 11px 15px 1px ${transparent2},0px 4px 20px 3px ${transparent3}`,
    `0px 7px 8px -4px ${transparent1},0px 12px 17px 2px ${transparent2},0px 5px 22px 4px ${transparent3}`,
    `0px 7px 8px -4px ${transparent1},0px 13px 19px 2px ${transparent2},0px 5px 24px 4px ${transparent3}`,
    `0px 7px 9px -4px ${transparent1},0px 14px 21px 2px ${transparent2},0px 5px 26px 4px ${transparent3}`,
    `0px 8px 9px -5px ${transparent1},0px 15px 22px 2px ${transparent2},0px 6px 28px 5px ${transparent3}`,
    `0px 8px 10px -5px ${transparent1},0px 16px 24px 2px ${transparent2},0px 6px 30px 5px ${transparent3}`,
    `0px 8px 11px -5px ${transparent1},0px 17px 26px 2px ${transparent2},0px 6px 32px 5px ${transparent3}`,
    `0px 9px 11px -5px ${transparent1},0px 18px 28px 2px ${transparent2},0px 7px 34px 6px ${transparent3}`,
    `0px 9px 12px -6px ${transparent1},0px 19px 29px 2px ${transparent2},0px 7px 36px 6px ${transparent3}`,
    `0px 10px 13px -6px ${transparent1},0px 20px 31px 3px ${transparent2},0px 8px 38px 7px ${transparent3}`,
    `0px 10px 13px -6px ${transparent1},0px 21px 33px 3px ${transparent2},0px 8px 40px 7px ${transparent3}`,
    `0px 10px 14px -6px ${transparent1},0px 22px 35px 3px ${transparent2},0px 8px 42px 7px ${transparent3}`,
    `0px 11px 14px -7px ${transparent1},0px 23px 36px 3px ${transparent2},0px 9px 44px 8px ${transparent3}`,
    `0px 11px 15px -7px ${transparent1},0px 24px 38px 3px ${transparent2},0px 9px 46px 8px ${transparent3}`,
  ];
}
```

## frontend/src/theme/typography.js

```javascript
export function remToPx(value) {
  return Math.round(parseFloat(value) * 16);
}

export function pxToRem(value) {
  return `${value / 16}rem`;
}

export function responsiveFontSizes({ sm, md, lg }) {
  return {
    '@media (min-width:600px)': {
      fontSize: pxToRem(sm),
    },
    '@media (min-width:900px)': {
      fontSize: pxToRem(md),
    },
    '@media (min-width:1200px)': {
      fontSize: pxToRem(lg),
    },
  };
}

// ----------------------------------------------------------------------

const FONT_PRIMARY = 'Public Sans, sans-serif'; // Google Font
// const FONT_SECONDARY = 'CircularStd, sans-serif'; // Local Font

const typography = {
  fontFamily: FONT_PRIMARY,
  fontWeightRegular: 400,
  fontWeightMedium: 600,
  fontWeightBold: 700,
  h1: {
    fontWeight: 800,
    lineHeight: 80 / 64,
    fontSize: pxToRem(40),
    ...responsiveFontSizes({ sm: 52, md: 58, lg: 64 }),
  },
  h2: {
    fontWeight: 800,
    lineHeight: 64 / 48,
    fontSize: pxToRem(32),
    ...responsiveFontSizes({ sm: 40, md: 44, lg: 48 }),
  },
  h3: {
    fontWeight: 700,
    lineHeight: 1.5,
    fontSize: pxToRem(24),
    ...responsiveFontSizes({ sm: 26, md: 30, lg: 32 }),
  },
  h4: {
    fontWeight: 700,
    lineHeight: 1.5,
    fontSize: pxToRem(20),
    ...responsiveFontSizes({ sm: 20, md: 24, lg: 24 }),
  },
  h5: {
    fontWeight: 700,
    lineHeight: 1.5,
    fontSize: pxToRem(18),
    ...responsiveFontSizes({ sm: 19, md: 20, lg: 20 }),
  },
  h6: {
    fontWeight: 700,
    lineHeight: 28 / 18,
    fontSize: pxToRem(17),
    ...responsiveFontSizes({ sm: 18, md: 18, lg: 18 }),
  },
  subtitle1: {
    fontWeight: 600,
    lineHeight: 1.5,
    fontSize: pxToRem(16),
  },
  subtitle2: {
    fontWeight: 600,
    lineHeight: 22 / 14,
    fontSize: pxToRem(14),
  },
  body1: {
    lineHeight: 1.5,
    fontSize: pxToRem(16),
  },
  body2: {
    lineHeight: 22 / 14,
    fontSize: pxToRem(14),
  },
  caption: {
    lineHeight: 1.5,
    fontSize: pxToRem(12),
  },
  overline: {
    fontWeight: 700,
    lineHeight: 1.5,
    fontSize: pxToRem(12),
    textTransform: 'uppercase',
  },
  button: {
    fontWeight: 700,
    lineHeight: 24 / 14,
    fontSize: pxToRem(14),
    textTransform: 'capitalize',
  },
};

export default typography;
```

## frontend/src/utils/NotistackProvider.js

```javascript
import { Box, GlobalStyles } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { SnackbarProvider } from 'notistack';
import PropTypes from 'prop-types';
import { useRef } from 'react';
import Iconify from '../components/iconify/Iconify';

const SnackbarStyles = () => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  return (
    <GlobalStyles
      styles={{
        '#root': {
          '& .SnackbarContent-root': {
            width: '100%',
            padding: theme.spacing(1),
            margin: theme.spacing(0.25, 0),
            borderRadius: theme.shape.borderRadius,
            color: theme.palette.grey[isLight ? 0 : 800],
            backgroundColor: theme.palette.grey[isLight ? 900 : 0],
            '&.SnackbarItem-variantSuccess, &.SnackbarItem-variantError, &.SnackbarItem-variantWarning, &.SnackbarItem-variantInfo':
              {
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.background.paper,
              },
            [theme.breakpoints.up('md')]: {
              minWidth: 240,
            },
          },
          '& .SnackbarItem-message': {
            padding: '0 !important',
            fontWeight: theme.typography.fontWeightMedium,
          },
          '& .SnackbarItem-action': {
            marginRight: 0,
            color: theme.palette.action.active,
            '& svg': { width: 20, height: 20 },
          },
        },
      }}
    />
  );
};

const SnackbarIcon = ({ icon, color }) => (
  <Box
    component="span"
    sx={{
      mr: 1.5,
      width: 40,
      height: 40,
      display: 'flex',
      borderRadius: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      color: `${color}.main`,
      bgcolor: (theme) => alpha(theme.palette[color].main, 0.16),
    }}
  >
    <Iconify icon={icon} width={24} height={24} />
  </Box>
);

const NotistackProvider = ({ children }) => {
  const notistackRef = useRef(null);

  const onClose = (key) => () => {
    notistackRef.current.closeSnackbar(key);
  };

  return (
    <>
      <SnackbarStyles />
      <SnackbarProvider
        ref={notistackRef}
        dense
        maxSnack={5}
        preventDuplicate
        autoHideDuration={3000}
        variant="success" // Set default variant
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        iconVariant={{
          info: <SnackbarIcon icon={'eva:info-fill'} color="info" />,
          success: <SnackbarIcon icon={'eva:checkmark-circle-2-fill'} color="success" />,
          warning: <SnackbarIcon icon={'eva:alert-triangle-fill'} color="warning" />,
          error: <SnackbarIcon icon={'eva:alert-circle-fill'} color="error" />,
        }}
        // With close as default
        action={(key) => <Iconify icon={'eva:close-fill'} onClick={onClose(key)} sx={{ cursor: 'pointer', mx: 1 }} />}
      >
        {children}
      </SnackbarProvider>
    </>
  );
};

NotistackProvider.propTypes = {
  children: PropTypes.any,
};
SnackbarIcon.propTypes = {
  icon: PropTypes.string,
  color: PropTypes.oneOf(['primary', 'secondary', 'info', 'success', 'warning', 'error']),
};

export default NotistackProvider;
```

## frontend/src/utils/TABLE_HEAD.js

```javascript
const TABLE_HEAD = [
  { id: 'name', label: 'Name', alignRight: false },
  { id: 'email', label: 'Email', alignRight: false },
  { id: 'gender', label: 'gender', alignRight: false },
  { id: 'birthDate', label: 'Birth Date', alignRight: false },
  { id: 'college', label: 'College', alignRight: false },
  { id: 'address', label: 'Address', alignRight: false },
  { id: 'hobbies', label: 'Hobbies', alignRight: false },
  { id: 'action', label: 'Action', alignRight: true, disabled: true },
];
export default TABLE_HEAD;
```

## frontend/src/utils/localStorage.js

```javascript
let storageName = '';
const createStorage = (storage) => {
  if (!localStorage.getItem(storage)) {
    localStorage.setItem(storage, '[]');
  }
  storageName = storage || 'userList';
};

// fetch data from storage
const getData = () => {
  const data = localStorage.getItem(storageName);
  return data ? JSON.parse(data) : [];
};

// store and update data in localStorage
const storeData = (user) => {
  const storageObj = JSON.parse(localStorage.getItem(storageName));
  if (storageObj.length === null) {
    localStorage.setItem(storageName, JSON.stringify(user));
  } else {
    const position = storageObj.findIndex((e) => e?.userId === user?.userId);
    if (position > -1) {
      storageObj.splice(position, 1, user);
    } else {
      storageObj.unshift(user);
    }
  }
  localStorage.setItem(storageName, JSON.stringify(storageObj));
};

// delete specific user from user list.
const deleteById = (userId) => {
  const storageObj = JSON.parse(localStorage.getItem(storageName));
  const index = storageObj.findIndex((e) => e.userId === userId);
  storageObj.splice(index, 1);
  localStorage.setItem(storageName, JSON.stringify(storageObj));
};

export { createStorage, getData, storeData, deleteById };
```

## frontend/src/utils/sortData.js

```javascript
import { filter } from 'lodash';

const descendingComparator = (a, b, orderBy) => (b[orderBy] < a[orderBy] ? -1 : b[orderBy] > a[orderBy] ? 1 : 0);

const getComparator = (order, orderBy) => (a, b) =>
  order === 'desc' ? descendingComparator(a, b, orderBy) : -descendingComparator(a, b, orderBy);

const applySortFilter = (array, comparator, query) => {
  const stabilizedThis = array.map((el, index) => [el, index]);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });
  if (query) {
    return filter(array, (_user) => _user.name.toLowerCase().indexOf(query.toLowerCase()) !== -1);
  }
  return stabilizedThis.map((el) => el[0]);
};

export { getComparator, applySortFilter };
```

## frontend/src/utils/uuid.js

```javascript
// generate unique Id which is used while add new user.
const uuid = () => 'xxxxxxxx-xxxx-xxx'.replace(/[x]/g, () => Math.random() * 15).toString(15);

export default uuid;
```
