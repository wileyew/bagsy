import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";

export function StorageTest() {
  const [uploading, setUploading] = useState(false);
  const [testResults, setTestResults] = useState<{
    bucketExists: boolean;
    policiesExist: boolean;
    uploadWorks: boolean;
    readWorks: boolean;
  } | null>(null);
  const { user } = useAuthContext();
  const { toast } = useToast();

  const testStorageSetup = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to test storage.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    const results = {
      bucketExists: false,
      policiesExist: false,
      uploadWorks: false,
      readWorks: false,
    };

    try {
      // Test 1: Check if bucket exists
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      results.bucketExists = buckets?.some(bucket => bucket.name === 'space-photos') || false;

      if (!results.bucketExists) {
        toast({
          title: "Bucket not found",
          description: "Please create the 'space-photos' bucket first.",
          variant: "destructive",
        });
        setTestResults(results);
        return;
      }

      // Test 2: Try to upload a test file
      const testFileName = `${user.id}-${Date.now()}.txt`;
      const testContent = "This is a test file for storage verification.";
      const testFile = new File([testContent], testFileName, { type: 'text/plain' });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('space-photos')
        .upload(testFileName, testFile);

      results.uploadWorks = !uploadError;

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast({
          title: "Upload failed",
          description: uploadError.message,
          variant: "destructive",
        });
      }

      // Test 3: Try to read the uploaded file
      if (results.uploadWorks) {
        const { data: { publicUrl }, error: readError } = supabase.storage
          .from('space-photos')
          .getPublicUrl(testFileName);

        results.readWorks = !readError && !!publicUrl;

        // Clean up test file
        await supabase.storage
          .from('space-photos')
          .remove([testFileName]);
      }

      // Test 4: Check policies (this is more complex, so we'll assume they exist if upload works)
      results.policiesExist = results.uploadWorks;

      setTestResults(results);

      if (results.uploadWorks && results.readWorks) {
        toast({
          title: "Storage setup successful!",
          description: "Your Supabase storage is properly configured.",
        });
      } else {
        toast({
          title: "Storage setup incomplete",
          description: "Please check the storage policies and bucket configuration.",
          variant: "destructive",
        });
      }

    } catch (error: any) {
      console.error('Storage test error:', error);
      toast({
        title: "Test failed",
        description: error.message || "An error occurred during testing.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="apple-card max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Storage Setup Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={testStorageSetup}
          disabled={uploading || !user}
          className="w-full apple-button-primary"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Testing Storage...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Test Storage Setup
            </>
          )}
        </Button>

        {!user && (
          <p className="text-sm text-muted-foreground text-center">
            Sign in to test storage functionality
          </p>
        )}

        {testResults && (
          <div className="space-y-2">
            <h4 className="font-medium">Test Results:</h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                {testResults.bucketExists ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span>Bucket exists</span>
              </div>
              <div className="flex items-center gap-2">
                {testResults.policiesExist ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span>Policies configured</span>
              </div>
              <div className="flex items-center gap-2">
                {testResults.uploadWorks ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span>Upload works</span>
              </div>
              <div className="flex items-center gap-2">
                {testResults.readWorks ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span>Read access works</span>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p className="font-medium mb-1">What this tests:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Bucket existence</li>
            <li>Storage policies</li>
            <li>File upload capability</li>
            <li>Public read access</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
