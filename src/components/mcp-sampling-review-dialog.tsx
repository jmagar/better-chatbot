"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface SamplingMessage {
  role: "user" | "assistant";
  content: {
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
  };
}

interface SamplingReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverName: string;
  messages: SamplingMessage[];
  systemPrompt?: string;
  modelPreferences?: {
    hints?: Array<{ name?: string }>;
    intelligencePriority?: number;
    costPriority?: number;
    speedPriority?: number;
  };
  temperature?: number;
  maxTokens?: number;
  onApprove: (editedMessages: SamplingMessage[]) => void;
  onReject: () => void;
}

export function SamplingReviewDialog({
  open,
  onOpenChange,
  serverName,
  messages,
  systemPrompt,
  modelPreferences,
  temperature,
  maxTokens,
  onApprove,
  onReject,
}: SamplingReviewDialogProps) {
  const [editedMessages, setEditedMessages] =
    useState<SamplingMessage[]>(messages);

  const handleMessageEdit = (index: number, newText: string) => {
    const updated = [...editedMessages];
    if (updated[index]?.content.type === "text") {
      updated[index] = {
        ...updated[index],
        content: { ...updated[index].content, text: newText },
      };
      setEditedMessages(updated);
    }
  };

  const handleApprove = () => {
    onApprove(editedMessages);
    onOpenChange(false);
  };

  const handleReject = () => {
    onReject();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Sampling Request</DialogTitle>
          <DialogDescription>
            Server <strong>{serverName}</strong> is requesting an LLM
            completion. Review and edit the messages before approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {systemPrompt && (
            <div>
              <Label>System Prompt</Label>
              <div className="mt-1 p-3 bg-muted rounded-md text-sm">
                {systemPrompt}
              </div>
            </div>
          )}

          <div>
            <Label>Messages</Label>
            <div className="mt-2 space-y-3">
              {editedMessages.map((msg, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={msg.role === "user" ? "default" : "secondary"}
                    >
                      {msg.role}
                    </Badge>
                    {msg.content.type !== "text" && (
                      <Badge variant="outline">{msg.content.type}</Badge>
                    )}
                  </div>
                  {msg.content.type === "text" ? (
                    <Textarea
                      value={msg.content.text || ""}
                      onChange={(e) => handleMessageEdit(idx, e.target.value)}
                      className="min-h-[80px]"
                    />
                  ) : msg.content.type === "image" ? (
                    <div className="text-sm text-muted-foreground">
                      Image: {msg.content.mimeType}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Resource: {msg.content.uri}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {(modelPreferences || temperature !== undefined || maxTokens) && (
            <div>
              <Label>Parameters</Label>
              <div className="mt-1 p-3 bg-muted rounded-md text-sm space-y-1">
                {modelPreferences?.hints?.[0]?.name && (
                  <div>
                    <strong>Model:</strong> {modelPreferences.hints[0].name}
                  </div>
                )}
                {temperature !== undefined && (
                  <div>
                    <strong>Temperature:</strong> {temperature}
                  </div>
                )}
                {maxTokens && (
                  <div>
                    <strong>Max Tokens:</strong> {maxTokens}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReject}>
            Reject
          </Button>
          <Button onClick={handleApprove}>Approve & Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
