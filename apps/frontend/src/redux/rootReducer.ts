import { combineReducers } from 'redux';
import authReducer from './reducers/authReducer';
import userReducer from './reducers/userReducer';

const rootReducer = combineReducers({
  auth: authReducer,
  user: userReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export default rootReducer;
