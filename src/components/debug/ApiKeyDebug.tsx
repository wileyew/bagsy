import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ApiKeyDebug() {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const apiKeyPresent = !!apiKey;
  const apiKeyLength = apiKey?.length || 0;
  const apiKeyPreview = apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : 'Not found';

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>API Key Debug Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div>
          <strong>API Key Present:</strong> {apiKeyPresent ? '✅ Yes' : '❌ No'}
        </div>
        <div>
          <strong>API Key Length:</strong> {apiKeyLength}
        </div>
        <div>
          <strong>API Key Preview:</strong> {apiKeyPreview}
        </div>
        <div>
          <strong>Environment:</strong> {import.meta.env.MODE}
        </div>
        <div>
          <strong>All VITE_ vars:</strong>
          <pre className="text-xs mt-1 bg-gray-100 p-2 rounded">
            {JSON.stringify(
              Object.keys(import.meta.env)
                .filter(key => key.startsWith('VITE_'))
                .reduce((obj, key) => {
                  obj[key] = key.includes('KEY') ? '[HIDDEN]' : import.meta.env[key];
                  return obj;
                }, {} as Record<string, string>),
              null,
              2
            )}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
