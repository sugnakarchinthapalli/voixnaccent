import React, { useState } from 'react';
import { Mic, Shield, Zap } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../UI/Button';

export function SignInPage() {
  const { signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center bg-blue-600 rounded-full mb-6">
            <Mic className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Voice Assessment Tool
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            AI-powered voice evaluation for MediaMint
          </p>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center space-x-3 p-4 bg-white rounded-lg shadow-sm border">
              <Zap className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-gray-900">Automated Assessment</h3>
                <p className="text-sm text-gray-500">AI-powered voice analysis with detailed scoring</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-4 bg-white rounded-lg shadow-sm border">
              <Shield className="h-5 w-5 text-teal-600 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-gray-900">Secure Access</h3>
                <p className="text-sm text-gray-500">Restricted to @mediamint.com accounts only</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Button
              onClick={handleSignIn}
              disabled={isLoading}
              className="w-full flex justify-center items-center space-x-3 bg-blue-600 hover:bg-blue-700 text-white"
              size="lg"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Sign in with Google</span>
                </>
              )}
            </Button>
            
            <div className="text-center">
              <p className="text-xs text-gray-500">
                Only @mediamint.com accounts are authorized to access this application
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}