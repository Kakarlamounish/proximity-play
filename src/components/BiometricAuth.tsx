import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Fingerprint,
  Smartphone,
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

interface BiometricAuthProps {
  onSuccess?: (credential: any) => void;
  onError?: (error: string) => void;
  mode?: 'register' | 'authenticate';
  requireBiometric?: boolean;
}

interface AuthenticatorInfo {
  credentialId: string;
  name: string;
  type: 'fingerprint' | 'face' | 'pin' | 'password';
  createdAt: string;
  lastUsed?: string;
  counter: number;
}

export const BiometricAuth: React.FC<BiometricAuthProps> = ({
  onSuccess,
  onError,
  mode = 'authenticate',
  requireBiometric = false,
}) => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [authenticators, setAuthenticators] = useState<AuthenticatorInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check WebAuthn support
  useEffect(() => {
    const checkSupport = async () => {
      if (!window.PublicKeyCredential) {
        setIsSupported(false);
        return;
      }

      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setIsSupported(true);
        setIsAvailable(available);
      } catch (err) {
        setIsSupported(false);
        console.warn('WebAuthn not supported:', err);
      }
    };

    checkSupport();
  }, []);

  // Load user's registered authenticators (shown in both modes so Settings
  // can manage devices even though it renders mode="register").
  useEffect(() => {
    if (user) {
      loadAuthenticators();
    }
  }, [user]);

  const loadAuthenticators = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('webauthn_credentials')
        .select('credential_id, name, type, created_at, last_used, counter')
        .eq('user_id', user.id);

      if (error) throw error;

      setAuthenticators(
        (data || []).map((row: any) => ({
          credentialId: row.credential_id,
          name: row.name,
          type: row.type,
          createdAt: row.created_at,
          lastUsed: row.last_used,
          counter: row.counter,
        }))
      );
    } catch (err) {
      console.error('Failed to load authenticators:', err);
      setAuthenticators([]);
    }
  };

  // Register new biometric credential
  const handleRegister = async () => {
    if (!user || !isSupported) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Get registration options from server
      const { data: options, error: optionsError } = await supabase.functions.invoke(
        'webauthn-register-options',
        { body: { username: user.email } },
      );
      if (optionsError) throw optionsError;

      // Start WebAuthn registration
      const credential = await startRegistration(options);

      // Verify registration with server
      const { data: verification, error: verifyError } = await supabase.functions.invoke(
        'webauthn-register-verify',
        { body: { credential } },
      );
      if (verifyError) throw verifyError;

      if (verification.verified) {
        setSuccess('Biometric authentication registered successfully!');
        await loadAuthenticators();
        onSuccess?.(credential);
      } else {
        throw new Error('Registration verification failed');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Registration failed';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Authenticate with biometric
  const handleAuthenticate = async () => {
    if (!user || !isSupported) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Get authentication options from server
      const { data: options, error: optionsError } = await supabase.functions.invoke(
        'webauthn-authenticate-options',
        { body: {} },
      );
      if (optionsError) throw optionsError;

      // Start WebAuthn authentication
      const credential = await startAuthentication(options);

      // Verify authentication with server
      const { data: verification, error: verifyError } = await supabase.functions.invoke(
        'webauthn-authenticate-verify',
        { body: { credential } },
      );
      if (verifyError) throw verifyError;

      if (verification.verified) {
        setSuccess('Authentication successful!');
        onSuccess?.(credential);
        // The edge function already bumps counter/last_used server-side.
        await loadAuthenticators();
      } else {
        throw new Error('Authentication verification failed');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Authentication failed';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Remove authenticator
  const handleRemoveAuthenticator = async (credentialId: string) => {
    try {
      const { error } = await supabase
        .from('webauthn_credentials')
        .delete()
        .eq('user_id', user?.id)
        .eq('credential_id', credentialId);

      if (error) throw error;

      setAuthenticators(prev => prev.filter(auth => auth.credentialId !== credentialId));
      setSuccess('Authenticator removed successfully');
    } catch (err: any) {
      setError('Failed to remove authenticator');
    }
  };

  // Get authenticator type icon
  const getAuthenticatorIcon = (type: string) => {
    switch (type) {
      case 'fingerprint':
        return <Fingerprint className="h-4 w-4" />;
      case 'face':
        return <Smartphone className="h-4 w-4" />;
      case 'pin':
        return <Lock className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  // Get authenticator type label
  const getAuthenticatorLabel = (type: string) => {
    switch (type) {
      case 'fingerprint':
        return 'Fingerprint';
      case 'face':
        return 'Face ID / Facial Recognition';
      case 'pin':
        return 'PIN';
      case 'password':
        return 'Password';
      default:
        return 'Biometric';
    }
  };

  if (!isSupported) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Biometric authentication is not supported on this device or browser.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5" />
          Biometric Authentication
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Messages */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Device Support Info */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            <span className="text-sm">Device Support</span>
          </div>
          <Badge variant={isAvailable ? "default" : "secondary"}>
            {isAvailable ? 'Available' : 'Not Available'}
          </Badge>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {mode === 'register' && (
            <Button
              onClick={handleRegister}
              disabled={!isAvailable || isLoading}
              className="w-full"
            >
              {isLoading ? (
                'Registering...'
              ) : (
                <>
                  <Fingerprint className="h-4 w-4 mr-2" />
                  Register Biometric
                </>
              )}
            </Button>
          )}

          {mode === 'authenticate' && (
            <Button
              onClick={handleAuthenticate}
              disabled={!isAvailable || isLoading || authenticators.length === 0}
              className="w-full"
            >
              {isLoading ? (
                'Authenticating...'
              ) : (
                <>
                  <Fingerprint className="h-4 w-4 mr-2" />
                  Authenticate
                </>
              )}
            </Button>
          )}
        </div>

        {/* Registered Authenticators */}
        {authenticators.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Registered Devices</h4>
            {authenticators.map((auth) => (
              <div
                key={auth.credentialId}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-2">
                  {getAuthenticatorIcon(auth.type)}
                  <div>
                    <p className="text-sm font-medium">{auth.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {getAuthenticatorLabel(auth.type)} • Used {auth.counter} times
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRemoveAuthenticator(auth.credentialId)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Security Notice */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Biometric authentication provides enhanced security by using your device's built-in sensors.
            Your biometric data never leaves your device.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

// Biometric authentication hook
export const useBiometricAuth = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    const checkSupport = async () => {
      if (!window.PublicKeyCredential) {
        setIsSupported(false);
        return;
      }

      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setIsSupported(true);
        setIsAvailable(available);
      } catch (err) {
        setIsSupported(false);
      }
    };

    checkSupport();
  }, []);

  const authenticate = async (userId: string): Promise<boolean> => {
    if (!isSupported || !isAvailable) {
      throw new Error('Biometric authentication not supported');
    }

    try {
      // Get authentication options
      const { data: options, error: optionsError } = await supabase.functions.invoke(
        'webauthn-authenticate-options',
        { body: {} },
      );
      if (optionsError) throw optionsError;

      // Start authentication
      const credential = await startAuthentication(options);

      // Verify with server
      const { data: verification, error: verifyError } = await supabase.functions.invoke(
        'webauthn-authenticate-verify',
        { body: { credential } },
      );
      if (verifyError) throw verifyError;
      return verification.verified;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  };

  const register = async (userId: string, username: string): Promise<boolean> => {
    if (!isSupported || !isAvailable) {
      throw new Error('Biometric registration not supported');
    }

    try {
      // Get registration options
      const { data: options, error: optionsError } = await supabase.functions.invoke(
        'webauthn-register-options',
        { body: { username } },
      );
      if (optionsError) throw optionsError;

      // Start registration
      const credential = await startRegistration(options);

      // Verify with server
      const { data: verification, error: verifyError } = await supabase.functions.invoke(
        'webauthn-register-verify',
        { body: { credential } },
      );
      if (verifyError) throw verifyError;
      return verification.verified;
    } catch (error) {
      console.error('Biometric registration failed:', error);
      return false;
    }
  };

  return {
    isSupported,
    isAvailable,
    authenticate,
    register,
  };
};