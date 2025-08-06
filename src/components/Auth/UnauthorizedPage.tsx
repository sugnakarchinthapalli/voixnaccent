import React from 'react';
import { AlertCircle, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../UI/Button';

export function UnauthorizedPage() {
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="mx-auto h-16 w-16 flex items-center justify-center bg-red-100 rounded-full">
          <AlertCircle className="h-8 w-8 text-red-600" />
        </div>
        
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              This application is restricted to MediaMint employees only.
            </p>
            <p>
              You're currently signed in as: <span className="font-medium">{user?.email}</span>
            </p>
            <p>
              Please sign in with your @mediamint.com account to access the Voice Assessment Tool.
            </p>
          </div>
        </div>

        <Button
          onClick={signOut}
          variant="outline"
          className="flex items-center space-x-2"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </Button>
      </div>
    </div>
  );
}