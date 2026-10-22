import axios from 'axios';

export interface University {
  name: string;
  country: string;
  alpha_two_code?: string;
  domains?: string[];
  web_pages?: string[];
}

export const fetchColleges = async (name: string): Promise<University[]> => {
  const API_URL = 'http://universities.hipolabs.com/search?name=';
  const response = await axios.get<University[]>(`${API_URL}${encodeURIComponent(name)}`);
  return response.data;
};
