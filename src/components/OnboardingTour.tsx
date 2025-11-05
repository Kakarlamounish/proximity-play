import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingStep {
  title: string;
  description: string;
  icon: string;
  target?: string;
}

const onboardingSteps: OnboardingStep[] = [
  {
    title: 'Welcome to Social Bubble! 🎉',
    description: 'Discover and connect with people who share your interests in real-time. Let\'s get you started!',
    icon: '👋',
  },
  {
    title: 'Create Bubbles',
    description: 'Bubbles are location-based interest groups. Create your own or join existing ones to meet people nearby who share your passions.',
    icon: '💭',
    target: 'bubbles',
  },
  {
    title: 'Share Stories',
    description: 'Post location-tagged stories with photos and text. Your stories are visible to people within your chosen radius.',
    icon: '📸',
    target: 'stories',
  },
  {
    title: 'Live Locations',
    description: 'Share your real-time location with friends and see who\'s around you. Perfect for spontaneous meetups!',
    icon: '📍',
    target: 'live',
  },
  {
    title: 'Connect & Chat',
    description: 'Send friend requests, chat with connections, and engage with people in your bubbles.',
    icon: '💬',
    target: 'messages',
  },
  {
    title: 'You\'re All Set!',
    description: 'Start exploring, create your first bubble, or share a story. Have fun connecting with your community!',
    icon: '🚀',
  },
];

export function OnboardingTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Check if user has seen the onboarding
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      // Show onboarding after a short delay
      setTimeout(() => setIsOpen(true), 1000);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completeOnboarding = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setIsOpen(false);
  };

  const skipOnboarding = () => {
    completeOnboarding();
  };

  if (!isOpen) return null;

  const step = onboardingSteps[currentStep];
  const progress = ((currentStep + 1) / onboardingSteps.length) * 100;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="relative overflow-hidden border-primary/20 shadow-2xl">
            {/* Progress bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-secondary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10"
              onClick={skipOnboarding}
            >
              <X className="h-4 w-4" />
            </Button>

            <CardHeader className="text-center pt-8">
              <motion.div
                key={currentStep}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', duration: 0.5 }}
                className="text-6xl mb-4"
              >
                {step.icon}
              </motion.div>
              <CardTitle className="text-2xl">{step.title}</CardTitle>
              <CardDescription className="text-base mt-2">
                {step.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="pb-6">
              {/* Step indicators */}
              <div className="flex justify-center gap-2 mb-6">
                {onboardingSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 rounded-full transition-all ${
                      index === currentStep
                        ? 'w-8 bg-primary'
                        : index < currentStep
                        ? 'w-2 bg-primary/50'
                        : 'w-2 bg-muted'
                    }`}
                  />
                ))}
              </div>

              {/* Navigation buttons */}
              <div className="flex gap-2">
                {currentStep > 0 && (
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    className="flex-1"
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                )}
                <Button
                  onClick={handleNext}
                  className="flex-1"
                  variant={currentStep === onboardingSteps.length - 1 ? 'default' : 'default'}
                >
                  {currentStep === onboardingSteps.length - 1 ? (
                    <>
                      Get Started
                      <Check className="h-4 w-4 ml-2" />
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>

              {/* Skip button */}
              {currentStep < onboardingSteps.length - 1 && (
                <Button
                  variant="ghost"
                  onClick={skipOnboarding}
                  className="w-full mt-2"
                >
                  Skip Tour
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
