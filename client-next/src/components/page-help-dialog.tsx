import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfoBox } from "@nsmr/pixelart-react";

export interface PageHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: string;
}

export function PageHelpDialog({ open, onOpenChange, page }: PageHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <InfoBox className="h-5 w-5 text-primary" />
            <span>{page} Help</span>
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm mb-4">
            Learn how to use the <span className="font-semibold">{page}</span> page.
          </p>
          <p className="text-sm">
            For detailed documentation, guides, and examples, visit:
          </p>
          <a 
            href={`https://opencode.ai/docs/${page.toLowerCase().replace(/\s+/g, '-')}`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-primary hover:underline block mt-2 font-mono text-xs break-all"
          >
            https://opencode.ai/docs/{page.toLowerCase().replace(/\s+/g, '-')}
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
