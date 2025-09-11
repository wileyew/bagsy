import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bug, 
  X, 
  Copy, 
  Trash2, 
  Download, 
  Eye, 
  EyeOff,
  Filter,
  Search
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { debugLogger } from '@/lib/debug-utils';

interface DebugLog {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  component: string;
  message: string;
  data?: any;
}

interface DebugPanelProps {
  component?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ 
  component, 
  isOpen = false, 
  onClose 
}) => {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<DebugLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [componentFilter, setComponentFilter] = useState<string>('all');
  const [isMinimized, setIsMinimized] = useState(false);

  // Mock log generation for demonstration
  useEffect(() => {
    const mockLogs: DebugLog[] = [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        level: 'info',
        component: 'AISpaceListingModal',
        message: 'Component mounted',
        data: { hasUser: true, step: 'upload' }
      },
      {
        id: '2',
        timestamp: new Date().toISOString(),
        level: 'debug',
        component: 'WebScrapingService',
        message: 'Starting market data scraping',
        data: { location: 'San Francisco, CA', spaceType: 'garage' }
      },
      {
        id: '3',
        timestamp: new Date().toISOString(),
        level: 'warn',
        component: 'AISpaceListingModal',
        message: 'No scraping API key available - using mock data',
        data: { hasApiKey: false }
      },
      {
        id: '4',
        timestamp: new Date().toISOString(),
        level: 'error',
        component: 'WebScrapingService',
        message: 'Scraping failed for term',
        data: { term: 'garage storage', error: 'Network timeout' }
      }
    ];

    setLogs(mockLogs);
    setFilteredLogs(mockLogs);
  }, []);

  // Filter logs based on search and filters
  useEffect(() => {
    let filtered = logs;

    // Filter by component
    if (componentFilter !== 'all') {
      filtered = filtered.filter(log => log.component === componentFilter);
    }

    // Filter by level
    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => log.level === levelFilter);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.component.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm, levelFilter, componentFilter]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'destructive';
      case 'warn': return 'secondary';
      case 'info': return 'default';
      case 'debug': return 'outline';
      default: return 'default';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'info': return 'ℹ️';
      case 'debug': return '🐛';
      default: return '📝';
    }
  };

  const copyLogs = () => {
    const logText = filteredLogs.map(log => 
      `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.component}] ${log.message}${log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''}`
    ).join('\n\n');
    
    navigator.clipboard.writeText(logText);
  };

  const downloadLogs = () => {
    const logText = filteredLogs.map(log => 
      `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.component}] ${log.message}${log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''}`
    ).join('\n\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearLogs = () => {
    setLogs([]);
    setFilteredLogs([]);
  };

  const uniqueComponents = [...new Set(logs.map(log => log.component))];

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-96 z-50">
      <Card className="shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bug className="h-4 w-4" />
              Debug Panel
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              {onClose && (
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {!isMinimized && (
          <CardContent className="pt-0">
            <Tabs defaultValue="logs" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="logs">Logs</TabsTrigger>
                <TabsTrigger value="filters">Filters</TabsTrigger>
              </TabsList>

              <TabsContent value="logs" className="space-y-2">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyLogs}>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadLogs}>
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearLogs}>
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                </div>

                <ScrollArea className="h-48">
                  <div className="space-y-1">
                    {filteredLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2 text-xs border rounded bg-muted/50"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span>{getLevelIcon(log.level)}</span>
                          <Badge variant={getLevelColor(log.level) as any} className="text-xs">
                            {log.level}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {log.component}
                          </Badge>
                          <span className="text-muted-foreground text-xs">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="font-mono text-xs">{log.message}</div>
                        {log.data && (
                          <pre className="text-xs mt-1 text-muted-foreground overflow-x-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="filters" className="space-y-2">
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-medium">Search</label>
                    <Input
                      placeholder="Search logs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium">Level</label>
                    <select
                      value={levelFilter}
                      onChange={(e) => setLevelFilter(e.target.value)}
                      className="w-full h-8 text-xs border rounded px-2"
                    >
                      <option value="all">All Levels</option>
                      <option value="error">Error</option>
                      <option value="warn">Warning</option>
                      <option value="info">Info</option>
                      <option value="debug">Debug</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium">Component</label>
                    <select
                      value={componentFilter}
                      onChange={(e) => setComponentFilter(e.target.value)}
                      className="w-full h-8 text-xs border rounded px-2"
                    >
                      <option value="all">All Components</option>
                      {uniqueComponents.map(comp => (
                        <option key={comp} value={comp}>{comp}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default DebugPanel;
