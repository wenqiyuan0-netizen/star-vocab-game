
class FeatureFlagService {
  constructor() {
    this.flags = {
      enableListeningSpeaking: false // Default to false
    };
    this.init();
  }

  async init() {
    // Simulate fetching from backend
    // In a real app, this would be an API call
    // For now, we can check localStorage to allow testing or default to hardcoded
    try {
        // Simulating network delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Mock backend response
        // You can toggle this to true to test the feature
        const mockBackendResponse = {
            enableListeningSpeaking: false
        };
        
        this.flags = { ...this.flags, ...mockBackendResponse };
    } catch (e) {
        console.error("Failed to fetch feature flags", e);
    }
  }

  isEnabled(flagName) {
    return !!this.flags[flagName];
  }
}

export const featureFlagService = new FeatureFlagService();
