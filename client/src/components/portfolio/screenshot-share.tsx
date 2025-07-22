import { useState, useRef } from "react";
import html2canvas from "html2canvas";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { 
  Camera, 
  Share2, 
  Download, 
  Twitter, 
  Copy, 
  Check,
  Trophy,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ScreenshotShareProps {
  portfolioValue: number;
  targetRef: React.RefObject<HTMLDivElement>;
}

export function ScreenshotShare({ portfolioValue, targetRef }: ScreenshotShareProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  // Function to capture the screenshot
  const captureScreenshot = async () => {
    if (!targetRef.current) return;
    
    setIsCapturing(true);
    try {
      // Add a class to the element we're capturing to style it for the screenshot
      targetRef.current.classList.add("screenshot-target");
      
      const canvas = await html2canvas(targetRef.current, {
        scale: 2, // Higher quality
        backgroundColor: "#ffffff",
        logging: false,
        allowTaint: true,
        useCORS: true
      });
      
      // Remove the class after capturing
      targetRef.current.classList.remove("screenshot-target");
      
      // Convert canvas to data URL
      const dataUrl = canvas.toDataURL("image/png");
      setScreenshot(dataUrl);
      setShowShareModal(true);
      
      // Show toast notification
      toast({
        title: "Screenshot captured!",
        description: "Your portfolio has been captured successfully.",
      });
    } catch (error) {
      console.error("Error capturing screenshot:", error);
      toast({
        title: "Failed to capture screenshot",
        description: "There was an error capturing your portfolio.",
        variant: "destructive"
      });
    } finally {
      setIsCapturing(false);
    }
  };

  // Function to download the screenshot
  const downloadScreenshot = () => {
    if (!screenshot) return;
    
    // Create a filename with current date
    const date = new Date().toISOString().slice(0, 10);
    const filename = `realethertech-portfolio-${date}.png`;
    
    // Convert data URL to Blob
    const byteString = atob(screenshot.split(',')[1]);
    const mimeString = screenshot.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    
    const blob = new Blob([ab], { type: mimeString });
    saveAs(blob, filename);
    
    toast({
      title: "Downloaded!",
      description: `Your portfolio screenshot has been saved as ${filename}`,
    });
  };

  // Function to copy the screenshot to clipboard
  const copyToClipboard = async () => {
    if (!screenshot) return;
    
    try {
      // Convert data URL to Blob
      const response = await fetch(screenshot);
      const blob = await response.blob();
      
      // Create a ClipboardItem
      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
      
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Screenshot copied to clipboard successfully.",
      });
      
      // Reset the copied state after 3 seconds
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      toast({
        title: "Copy failed",
        description: "Failed to copy screenshot to clipboard.",
        variant: "destructive"
      });
    }
  };

  // Function to share on Twitter
  const shareToTwitter = () => {
    if (!screenshot) return;
    
    const tweetText = encodeURIComponent(
      `Check out my crypto portfolio on #Realethertech! Current value: $${portfolioValue.toFixed(2)} 🚀 #cryptocurrency #investing`
    );
    
    // Open Twitter share dialog (note: we can't directly attach the image via this method)
    window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, "_blank");
    
    toast({
      title: "Twitter opened",
      description: "Share your achievement on Twitter!",
    });
  };

  return (
    <>
      <Button
        variant="outline"
        className="flex items-center space-x-2 ml-auto"
        onClick={captureScreenshot}
        disabled={isCapturing}
      >
        {isCapturing ? (
          <>
            <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
            <span>Capturing...</span>
          </>
        ) : (
          <>
            <Camera className="h-4 w-4" />
            <span>Share Achievement</span>
          </>
        )}
      </Button>
      
      {screenshot && (
        <Dialog open={showShareModal} onOpenChange={(open) => !open && setShowShareModal(false)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Share Your Portfolio Achievement</DialogTitle>
              <DialogDescription>
                Capture this moment or share your progress with others
              </DialogDescription>
            </DialogHeader>
            
            <div className="p-4 space-y-6">
              <div className="flex items-center space-x-3 mb-4">
                <Trophy className="h-6 w-6 text-yellow-500" />
                <h3 className="text-lg font-semibold">Portfolio Achievement</h3>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <img 
                  src={screenshot} 
                  alt="Portfolio Screenshot" 
                  className="w-full h-auto" 
                />
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" />
                  <p className="text-sm text-blue-800">
                    Share your portfolio achievement with friends or download it for your records.
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button 
                  variant="outline" 
                  className="flex items-center justify-center space-x-2"
                  onClick={downloadScreenshot}
                >
                  <Download className="h-4 w-4" />
                  <span>Download</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="flex items-center justify-center space-x-2"
                  onClick={copyToClipboard}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-green-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
                
                <Button 
                  className="flex items-center justify-center space-x-2 bg-[#1DA1F2] hover:bg-[#1a94e0] col-span-2"
                  onClick={shareToTwitter}
                >
                  <Twitter className="h-4 w-4" />
                  <span>Share on Twitter</span>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}