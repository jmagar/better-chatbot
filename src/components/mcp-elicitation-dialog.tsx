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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink } from "lucide-react";

interface JSONSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
}

interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

interface ElicitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverName: string;
  mode: "form" | "url";
  message: string;
  requestedSchema?: JSONSchema;
  url?: string;
  onAccept: (content?: Record<string, unknown>) => void;
  onDecline: () => void;
  onCancel: () => void;
}

export function ElicitationDialog({
  open,
  onOpenChange,
  serverName,
  mode,
  message,
  requestedSchema,
  url,
  onAccept,
  onDecline,
  onCancel,
}: ElicitationDialogProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    if (mode !== "form" || !requestedSchema?.properties) return true;

    const newErrors: Record<string, string> = {};
    const required = requestedSchema.required || [];

    for (const field of required) {
      if (!formData[field] || formData[field].trim() === "") {
        newErrors[field] = `${field} is required`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAccept = () => {
    if (mode === "form") {
      if (!validateForm()) return;
      onAccept(formData);
    } else {
      onAccept();
    }
    onOpenChange(false);
  };

  const handleDecline = () => {
    onDecline();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  const handleOpenUrl = () => {
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>User Approval Required</DialogTitle>
          <DialogDescription>
            Server <strong>{serverName}</strong> is requesting user input.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>

          {mode === "form" && requestedSchema?.properties && (
            <div className="space-y-4">
              {Object.entries(requestedSchema.properties).map(([key, prop]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>
                    {key}
                    {requestedSchema.required?.includes(key) && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </Label>
                  {prop.description && (
                    <p className="text-sm text-muted-foreground">
                      {prop.description}
                    </p>
                  )}
                  {prop.enum ? (
                    <Select
                      value={formData[key]}
                      onValueChange={(value) =>
                        setFormData({ ...formData, [key]: value })
                      }
                    >
                      <SelectTrigger id={key}>
                        <SelectValue placeholder={`Select ${key}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {prop.enum.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={key}
                      type={prop.type === "number" ? "number" : "text"}
                      value={formData[key] || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, [key]: e.target.value })
                      }
                      className={errors[key] ? "border-destructive" : ""}
                    />
                  )}
                  {errors[key] && (
                    <p className="text-sm text-destructive">{errors[key]}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {mode === "url" && url && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This action requires external authorization. Click the button
                below to open the authorization page in a new window.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleOpenUrl}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Authorization Page
              </Button>
              <p className="text-xs text-muted-foreground">
                After completing authorization, return here and click Accept.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="outline" onClick={handleDecline}>
            Decline
          </Button>
          <Button onClick={handleAccept}>Accept</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
