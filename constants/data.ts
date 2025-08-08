import { NavItem } from '@/types';

export type User = {
  id: number;
  token: string;
  pool: string;
  package: number;
  verified: boolean;
  status: string;
};
export const users: User[] = [
  {
    id: 1,
    token: 'BMWHHe4Lvrhvkq4s3voPnaRVHXWUXstiZmyhkNE9PtRQ',
    pool: 'StonFi',
    package: 7, // Random number
    verified: false,
    status: 'Active'
  },
  {
    id: 2,
    token: '5F4AhYjUEfV9hVh2STzszGqV5nX9H4UEenHfQtRhtucX',
    pool: 'DeDust',
    package: 3, // Random number
    verified: true,
    status: 'Active'
  },
  {
    id: 3,
    token: '2ViJ42o9JUNHiD5upQrMVNrRm8FPYBoXKT8fGPMyz2YX',
    pool: 'StonFi',
    package: 9, // Random number
    verified: true,
    status: 'Active'
  },
  {
    id: 4,
    token: '7gDtk4E5JoDRAJv1EWo6uBzhRJXxGAm9NptpW6KwFi54',
    pool: 'DeDust',
    package: 2, // Random number
    verified: false,
    status: 'Inactive'
  },
  {
    id: 5,
    token: 'EHHXkBz6HxvG2B5MEa7i5sh57QhvJTPiQFiKKthknLD5',
    pool: 'StonFi',
    package: 5, // Random number
    verified: true,
    status: 'Active'
  },
  {
    id: 6,
    token: 'D9Hqz5rZZ5Q5gFNa2uEX9fZY6PC25TzXTWtDkZvP1F7g',
    pool: 'DeDust',
    package: 4, // Random number
    verified: false,
    status: 'Active'
  },
  {
    id: 7,
    token: '4K4gxFGHpPfAFsZdchJeR5xrYjJyxJm8yRQmcXtGvDFm',
    pool: 'StonFi',
    package: 8, // Random number
    verified: true,
    status: 'Active'
  },
  {
    id: 8,
    token: 'GfRzqg54hXUz7Xzhj7WjR8zvJgYXyThXkpPZf5h5k2Aa',
    pool: 'DeDust',
    package: 6, // Random number
    verified: false,
    status: 'Active'
  },
  {
    id: 9,
    token: '3WLRFkq1iUuohXXjJfDxuXwRBM1i4k8zYMCsk4e9VP3y',
    pool: 'StonFi',
    package: 1, // Random number
    verified: true,
    status: 'Active'
  },
  {
    id: 10,
    token: 'A1bBxG2xL3RdJc4HYY9jE5Q2WyPGf75S5JZoRbgDKXtD',
    pool: 'DeDust',
    package: 10, // Random number
    verified: false,
    status: 'Active'
  }
];

export type Employee = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  gender: string;
  date_of_birth: string; // Consider using a proper date type if possible
  street: string;
  city: string;
  state: string;
  country: string;
  zipcode: string;
  longitude?: number; // Optional field
  latitude?: number; // Optional field
  job: string;
  profile_picture?: string | null; // Profile picture can be a string (URL) or null (if no picture)
};

export const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: 'dashboard',
    label: 'Dashboard'
  },
  {
    title: 'Ethereum Controls',
    href: '/dashboard/ethereum',
    icon: 'ethereum',
    label: 'ethereum'
  },
  {
    title: 'Tron Controls',
    href: '/dashboard/tron',
    icon: 'tron',
    label: 'tron'
  },
  {
    title: 'Solana Controls',
    href: '/dashboard/solana',
    icon: 'solana',
    label: 'solana'
  },
  {
    title: 'Team Management',
    href: '/dashboard/teams',
    icon: 'users',
    label: 'users'
  },
  {
    title: 'API Tokens',
    href: '/dashboard/api-tokens',
    icon: 'key',
    label: 'api-tokens'
  },
];