// Debug utilities for enhanced logging and debugging
interface DebugConfig {
  enabled: boolean;
  level: 'error' | 'warn' | 'info' | 'debug';
  components: string[];
  showTimestamps: boolean;
  showComponentNames: boolean;
  showStackTraces: boolean;
}

class DebugLogger {
  private config: DebugConfig = {
    enabled: import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true',
    level: 'debug',
    components: ['all'],
    showTimestamps: true,
    showComponentNames: true,
    showStackTraces: false,
  };

  private logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  };

  private formatMessage(level: string, component: string, message: string, data?: any): string {
    const parts: string[] = [];
    
    if (this.config.showTimestamps) {
      parts.push(`[${new Date().toISOString()}]`);
    }
    
    parts.push(`[${level.toUpperCase()}]`);
    
    if (this.config.showComponentNames) {
      parts.push(`[${component}]`);
    }
    
    parts.push(message);
    
    return parts.join(' ');
  }

  private shouldLog(level: string, component: string): boolean {
    if (!this.config.enabled) return false;
    
    const levelNum = this.logLevels[level as keyof typeof this.logLevels];
    const configLevelNum = this.logLevels[this.config.level];
    
    if (levelNum > configLevelNum) return false;
    
    if (this.config.components.includes('all') || this.config.components.includes(component)) {
      return true;
    }
    
    return false;
  }

  private log(level: string, component: string, message: string, data?: any): void {
    if (!this.shouldLog(level, component)) return;
    
    const formattedMessage = this.formatMessage(level, component, message);
    
    if (data) {
      console[level as keyof Console](formattedMessage, data);
    } else {
      console[level as keyof Console](formattedMessage);
    }
    
    if (this.config.showStackTraces && level === 'error') {
      console.trace();
    }
  }

  error(component: string, message: string, data?: any): void {
    this.log('error', component, message, data);
  }

  warn(component: string, message: string, data?: any): void {
    this.log('warn', component, message, data);
  }

  info(component: string, message: string, data?: any): void {
    this.log('info', component, message, data);
  }

  debug(component: string, message: string, data?: any): void {
    this.log('debug', component, message, data);
  }

  // Specialized logging methods
  apiCall(component: string, method: string, url: string, data?: any): void {
    this.debug(component, `API Call: ${method} ${url}`, data);
  }

  apiResponse(component: string, method: string, url: string, status: number, data?: any): void {
    const level = status >= 400 ? 'error' : 'info';
    this.log(level, component, `API Response: ${method} ${url} - ${status}`, data);
  }

  stateChange(component: string, stateName: string, oldValue: any, newValue: any): void {
    this.debug(component, `State Change: ${stateName}`, { from: oldValue, to: newValue });
  }

  userAction(component: string, action: string, data?: any): void {
    this.info(component, `User Action: ${action}`, data);
  }

  performance(component: string, operation: string, duration: number, data?: any): void {
    this.info(component, `Performance: ${operation} took ${duration}ms`, data);
  }

  // Configuration methods
  setConfig(config: Partial<DebugConfig>): void {
    this.config = { ...this.config, ...config };
  }

  enableComponent(component: string): void {
    if (!this.config.components.includes(component)) {
      this.config.components.push(component);
    }
  }

  disableComponent(component: string): void {
    this.config.components = this.config.components.filter(c => c !== component);
  }

  // Debug helpers
  logFormData(component: string, formData: any): void {
    this.debug(component, 'Form Data', formData);
  }

  logApiKey(component: string, keyName: string, hasKey: boolean): void {
    this.debug(component, `API Key Check: ${keyName}`, { present: hasKey, length: hasKey ? '***' : 0 });
  }

  logError(component: string, error: Error, context?: any): void {
    this.error(component, `Error: ${error.message}`, {
      name: error.name,
      stack: error.stack,
      context,
    });
  }

  // Performance monitoring
  timeStart(component: string, operation: string): number {
    const startTime = performance.now();
    this.debug(component, `Starting: ${operation}`, { timestamp: startTime });
    return startTime;
  }

  timeEnd(component: string, operation: string, startTime: number, data?: any): void {
    const duration = performance.now() - startTime;
    this.performance(component, operation, duration, data);
  }

  // Async operation wrapper
  async wrapAsync<T>(
    component: string,
    operation: string,
    asyncFn: () => Promise<T>,
    data?: any
  ): Promise<T> {
    const startTime = this.timeStart(component, operation);
    
    try {
      const result = await asyncFn();
      this.timeEnd(component, operation, startTime, { success: true, ...data });
      return result;
    } catch (error) {
      this.timeEnd(component, operation, startTime, { success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      this.logError(component, error instanceof Error ? error : new Error(String(error)), data);
      throw error;
    }
  }
}

// Create singleton instance
export const debugLogger = new DebugLogger();

// Component-specific debug helpers
export const createComponentDebugger = (componentName: string) => ({
  error: (message: string, data?: any) => debugLogger.error(componentName, message, data),
  warn: (message: string, data?: any) => debugLogger.warn(componentName, message, data),
  info: (message: string, data?: any) => debugLogger.info(componentName, message, data),
  debug: (message: string, data?: any) => debugLogger.debug(componentName, message, data),
  
  apiCall: (method: string, url: string, data?: any) => debugLogger.apiCall(componentName, method, url, data),
  apiResponse: (method: string, url: string, status: number, data?: any) => debugLogger.apiResponse(componentName, method, url, status, data),
  stateChange: (stateName: string, oldValue: any, newValue: any) => debugLogger.stateChange(componentName, stateName, oldValue, newValue),
  userAction: (action: string, data?: any) => debugLogger.userAction(componentName, action, data),
  performance: (operation: string, duration: number, data?: any) => debugLogger.performance(componentName, operation, duration, data),
  
  logFormData: (formData: any) => debugLogger.logFormData(componentName, formData),
  logApiKey: (keyName: string, hasKey: boolean) => debugLogger.logApiKey(componentName, keyName, hasKey),
  logError: (error: Error, context?: any) => debugLogger.logError(componentName, error, context),
  
  timeStart: (operation: string) => debugLogger.timeStart(componentName, operation),
  timeEnd: (operation: string, startTime: number, data?: any) => debugLogger.timeEnd(componentName, operation, startTime, data),
  wrapAsync: <T>(operation: string, asyncFn: () => Promise<T>, data?: any) => debugLogger.wrapAsync(componentName, operation, asyncFn, data),
});

// Global debug configuration
export const configureDebug = (config: Partial<DebugConfig>) => {
  debugLogger.setConfig(config);
};

// Debug component for React
export const DebugPanel = ({ component, data }: { component: string; data: any }) => {
  if (!debugLogger['shouldLog']('debug', component)) return null;
  
  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg text-xs max-w-sm max-h-64 overflow-auto z-50">
      <div className="font-bold mb-2">Debug: {component}</div>
      <pre className="whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};
