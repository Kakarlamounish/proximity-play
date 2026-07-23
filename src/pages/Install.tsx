import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Smartphone, Check, X } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';
import Navigation from '@/components/Navigation';

const Install = () => {
  const { isInstallable, isInstalled, installPWA, isOnline } = usePWA();
  const [installSuccess, setInstallSuccess] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Detect Android
    const android = /Android/.test(navigator.userAgent);
    setIsAndroid(android);
  }, []);

  const handleInstall = async () => {
    const success = await installPWA();
    if (success) {
      setInstallSuccess(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-primary">
      <Navigation />
      <div className="container mx-auto px-4 py-8 pt-20">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <Smartphone className="h-16 w-16 mx-auto mb-4 text-primary" />
            <h1 className="text-4xl font-bold mb-4">Install Proximity Play</h1>
            <p className="text-lg text-muted-foreground">
              Get the app experience on your device
            </p>
          </div>

          {installSuccess && (
            <Card className="mb-6 border-green-500 bg-green-50 dark:bg-green-950">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-green-700 dark:text-green-300">
                  <Check className="h-6 w-6" />
                  <p className="font-medium">App installed successfully!</p>
                </div>
              </CardContent>
            </Card>
          )}

          {isInstalled ? (
            <Card className="backdrop-blur-sm bg-card/95 border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="h-6 w-6 text-green-500" />
                  Already Installed
                </CardTitle>
                <CardDescription>
                  Proximity Play is already installed on your device
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  You can access the app from your home screen or app drawer.
                </p>
                {/* "Works offline" removed from both lists on this page —
                    usePWA() (only invoked on this page) unconditionally
                    unregisters any service worker on mount, so visiting
                    /install to install the app also destroys the one
                    real offline caching mechanism the app has. Confirmed
                    live via a production preview build: service worker
                    registration count went 1 -> 0 after loading this exact
                    page. Removing the false claim rather than re-enabling
                    the service worker, since the unregister was a
                    deliberate choice ("disabled for better deployment
                    compatibility") this pass has no context to reverse. */}
                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">App Features:</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      Fast loading
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      Home screen access
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      Native app experience
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          ) : isInstallable ? (
            <Card className="backdrop-blur-sm bg-card/95 border-0">
              <CardHeader>
                <CardTitle>Install App</CardTitle>
                <CardDescription>
                  Add Proximity Play to your home screen for quick access
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-semibold mb-3">Benefits of Installing:</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Access from home screen
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Faster loading times
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Full-screen experience
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Push notifications
                    </li>
                  </ul>
                </div>

                <Button
                  onClick={handleInstall}
                  className="w-full bg-gradient-to-r from-secondary to-primary hover:from-secondary-dark hover:to-primary-dark"
                  size="lg"
                  disabled={!isOnline}
                >
                  <Download className="h-5 w-5 mr-2" />
                  Install Now
                </Button>

                {!isOnline && (
                  <p className="text-sm text-muted-foreground text-center">
                    Please connect to the internet to install
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="backdrop-blur-sm bg-card/95 border-0">
              <CardHeader>
                <CardTitle>Manual Installation</CardTitle>
                <CardDescription>
                  Follow these steps to install the app on your device
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isIOS && (
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Smartphone className="h-5 w-5" />
                      iOS / iPhone / iPad
                    </h3>
                    <ol className="space-y-2 text-sm list-decimal list-inside">
                      <li>Tap the Share button (square with arrow) in Safari</li>
                      <li>Scroll down and tap "Add to Home Screen"</li>
                      <li>Tap "Add" in the top right corner</li>
                      <li>The app icon will appear on your home screen</li>
                    </ol>
                  </div>
                )}

                {isAndroid && (
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Smartphone className="h-5 w-5" />
                      Android
                    </h3>
                    <ol className="space-y-2 text-sm list-decimal list-inside">
                      <li>Tap the menu button (three dots) in Chrome</li>
                      <li>Select "Add to Home screen" or "Install app"</li>
                      <li>Tap "Add" or "Install"</li>
                      <li>The app icon will appear on your home screen</li>
                    </ol>
                  </div>
                )}

                {!isIOS && !isAndroid && (
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Smartphone className="h-5 w-5" />
                      Desktop / Other
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Look for an install button in your browser's address bar or menu.
                      Different browsers may have different installation options.
                    </p>
                  </div>
                )}

                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>Note:</strong> The app must be opened in a supported browser
                    (Safari on iOS, Chrome on Android) to enable installation.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Install;
