import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { SignInPage } from './SignInPage';
import { UnauthorizedPage } from './UnauthorizedPage';
import { LoadingSpinner } from '../UI/LoadingSpinner';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { user, loading, isAuthorized } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <SignInPage />;
  }

  if (!isAuthorized) {
    return <UnauthorizedPage />;
  }

  return <>{children}</>;
}