import { apiRequest, apiRequestNoResponse } from './base';

export interface SignUpData {
  email: string;
  password: string;
  displayName: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface VerifyOTPData {
  email: string;
  token: string;
}

export interface SessionResponse {
  session: {
    access_token: string;
    user: {
      email: string;
      user_metadata: {
        display_name?: string;
      };
    };
  };
}

export const authApi = {
  signUp: (data: SignUpData) =>
    apiRequest<SessionResponse>('/auth/signup', {
      method: 'POST',
      body: data
    }),
    
  signIn: (data: SignInData) =>
    apiRequest<SessionResponse>('/auth/signin', {
      method: 'POST',
      body: data
    }),
    
  verifyOTP: (data: VerifyOTPData) =>
    apiRequest<SessionResponse>('/auth/verify-otp', {
      method: 'POST',
      body: data
    }),
    
  getSession: (token: string) =>
    apiRequest<SessionResponse>('/auth/session', {
      token
    }),
    
  signOut: (token: string) =>
    apiRequestNoResponse('/auth/signout', {
      method: 'POST',
      token
    })
};
